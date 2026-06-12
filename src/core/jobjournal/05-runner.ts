/* Job-journal runner
 * - runNextStageExecution() claims the next pending stage execution, runs the
 *   appropriate stage function, and records completed / failed
 *   outcomes via executor helpers.
 */
import { eq, count } from 'drizzle-orm';
import {
  claimNextStageExecution,
  completeStageExecution,
  failStageExecution,
  recoveryExpiredLeases,
  renewExecutionLease,
  revokeExecutionLease,
} from './03-executor';
import { getDrizzleDb, getJobJournalDatabase } from './storage/database';
import { 
  jobJournalJobs, 
  metadataStageResults, 
  ocrStageResults, 
  ocrPostprocessStageResults,
  stageExecutions
} from './storage/drizzle-schema';
import type { JobJournalJob, JobJournalStage, JobJournalStageExecution } from './types';

import {
  runMetadataStage,
} from './stages/01-metadata.stage';
import { runOcrStage } from './stages/02-ocr.stage';
import { runOcrPostprocessStage } from './stages/03-ocr_postprocess.stage';
import { runKeywordsStage } from './stages/05-keywords.stage';
import { runIndexFtsStage } from './stages/06-index_fts.stage';

const STAGE_TIMEOUTS: Record<JobJournalStage, number> = {
  metadata: 30_000,
  ocr: 120_000,
  ocr_postprocess: 30_000,
  keywords: 60_000,
  index_fts: 120_000,
};

async function promiseWithTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return await new Promise<T>((resolve, reject) => {
    timer = setTimeout(() => reject(new Error('Stage timed out')), ms);
    p.then((v) => {
      if (timer) clearTimeout(timer);
      resolve(v);
    }).catch((err) => {
      if (timer) clearTimeout(timer);
      reject(err);
    });
  });
}

let currentExecutionId: string | null = null;
let shutdownHandlerInstalled = false;

async function getJob(jobId: string): Promise<JobJournalJob | null> {
  const db = await getDrizzleDb();
  const row = await db.query.jobJournalJobs.findFirst({
    where: eq(jobJournalJobs.id, jobId)
  });

  if (!row) return null;

  return {
    id: row.id,
    imageUri: row.imageUri,
    imageHash: row.imageHash,
    status: row.status as any,
    createdAt: row.createdAt.getTime(),
    updatedAt: row.updatedAt.getTime(),
  };
}

function getCheckpointPointer(jobId: string, stage: JobJournalStage) {
  if (stage === 'index_fts') return `screenshot_search_index:${jobId}`;
  if (stage === 'keywords') return `keyword_stage_results:${jobId}`;
  if (stage === 'ocr_postprocess') return `ocr_postprocess_stage_results:${jobId}`;
  if (stage === 'ocr') return `ocr_stage_results:${jobId}`;
  return `metadata_stage_results:${jobId}`;
}

async function validateStageInput(jobId: string, stage: JobJournalStage): Promise<string | null> {
  const db = await getDrizzleDb();

  if (stage === 'ocr') {
    const res = await db.query.metadataStageResults.findFirst({
      where: eq(metadataStageResults.jobId, jobId),
      columns: { fileExists: true }
    });
    if (!res) return 'Metadata result missing';
    if (!res.fileExists) return 'Image file does not exist';
    return null;
  }

  if (stage === 'ocr_postprocess') {
    const res = await db.query.ocrStageResults.findFirst({
      where: eq(ocrStageResults.jobId, jobId),
      columns: { text: true }
    });
    if (!res) return 'OCR result missing';
    return null;
  }

  if (stage === 'keywords') {
    const res = await db.query.ocrPostprocessStageResults.findFirst({
      where: eq(ocrPostprocessStageResults.jobId, jobId),
      columns: { text: true }
    });
    if (!res) return 'OCR postprocess result missing';
    return null;
  }

  if (stage === 'index_fts') {
    const res = await db.query.ocrPostprocessStageResults.findFirst({
      where: eq(ocrPostprocessStageResults.jobId, jobId),
      columns: { text: true }
    });
    if (!res) return 'OCR postprocess result missing';
    return null;
  }

  return null;
}

/**
 * Core execution logic for a claimed stage.
 */
async function runStageExecution(execution: JobJournalStageExecution): Promise<boolean> {
  const job = await getJob(execution.jobId);
  
  if (!job) {
    console.error(`[runner] Job not found: ${execution.jobId}`);
    await failStageExecution(execution.id, `Job not found: ${execution.jobId}`);
    return true;
  }

  let result: { status: 'completed' | 'failed'; error?: string; errorCode?: string };
  const inputError = await validateStageInput(job.id, execution.stage);
  if (inputError) {
    console.warn(`[runner] Input validation failed for ${execution.stage} (${execution.jobId}): ${inputError}`);
    await failStageExecution(execution.id, inputError);
    return true;
  }

  let heartbeat: ReturnType<typeof setInterval> | null = null;
  try {
    heartbeat = setInterval(() => {
      void renewExecutionLease(execution.id);
    }, 60_000);
    const timeoutMs = STAGE_TIMEOUTS[execution.stage];
    
    console.log(`[runner] Running stage: ${execution.stage} (timeout: ${timeoutMs}ms)`);
    
    switch (execution.stage as JobJournalStage) {
      case 'metadata': {
        try {
          const metadata = await promiseWithTimeout(runMetadataStage(job), timeoutMs);
          result = metadata.fileExists
            ? { status: 'completed' }
            : { status: 'failed', error: 'Image file does not exist' };
        } catch (err) {
          result = { status: 'failed', error: err instanceof Error ? err.message : 'Stage timed out' };
        }
        break;
      }
      case 'ocr': {
        try {
          result = await promiseWithTimeout(runOcrStage(job), timeoutMs);
        } catch (err) {
          result = { status: 'failed', error: err instanceof Error ? err.message : 'Stage timed out' };
        }
        break;
      }
      case 'ocr_postprocess': {
        try {
          await promiseWithTimeout(runOcrPostprocessStage(job), timeoutMs);
          result = { status: 'completed' };
        } catch (err) {
          result = { status: 'failed', error: err instanceof Error ? err.message : 'Stage timed out' };
        }
        break;
      }
      case 'keywords': {
        try {
          result = await promiseWithTimeout(runKeywordsStage(job), timeoutMs);
        } catch (err) {
          result = { status: 'failed', error: err instanceof Error ? err.message : 'Stage timed out' };
        }
        break;
      }
      case 'index_fts': {
        try {
          result = await promiseWithTimeout(runIndexFtsStage(job), timeoutMs);
        } catch (err) {
          result = { status: 'failed', error: err instanceof Error ? err.message : 'Stage timed out' };
        }
        break;
      }
      default:
        result = { status: 'failed', error: 'Unknown stage' };
    }
  } catch (error) {
    result = {
      status: 'failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  } finally {
    if (heartbeat) clearInterval(heartbeat);
  }

  console.log(`[runner] Stage ${execution.stage} finished with status: ${result.status}${result.error ? ` (Error: ${result.error})` : ''}`);

  if (result.status === 'completed') {
    try {
      await completeStageExecution(
        execution.id,
        execution.jobId,
        execution.stage,
        getCheckpointPointer(execution.jobId, execution.stage),
      );
      console.log(`[runner] Successfully completed and checkpointed ${execution.stage} for ${execution.jobId}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[runner] Completion logic failed for ${execution.stage}: ${msg}`);
      await failStageExecution(execution.id, `Completion validation failed: ${msg}`);
    }
  } else {
    await failStageExecution(execution.id, result.error || 'Stage failed', result.errorCode);
  }

  return true;
}

/**
 * Runner orchestrates stage execution.
 * It periodically renews execution leases (heartbeat) and wraps stages 
 * in timeouts to ensure system stability.
 */
export async function runNextStageExecution(): Promise<boolean> {
  await recoveryExpiredLeases();
  
  const execution = await claimNextStageExecution();
  if (!execution) return false;

  console.log(`[runner] Claimed: ${execution.stage} (Job: ${execution.jobId})`);

  currentExecutionId = execution.id;
  if (!shutdownHandlerInstalled) {
    if (typeof process !== 'undefined' && typeof (process as any).on === 'function') {
      const handleSignal = async (sig: string) => {
        try {
          if (currentExecutionId) {
            await revokeExecutionLease(currentExecutionId);
            console.log(`revoked execution lease for ${currentExecutionId} due to signal ${sig}`);
          }
        } catch (err) {
          console.error('Error revoking execution lease during shutdown', err);
        } finally {
          try {
            process.exit(0);
          } catch {}
        }
      };
      (process as any).on('SIGINT', () => void handleSignal('SIGINT'));
      (process as any).on('SIGTERM', () => void handleSignal('SIGTERM'));
    }
    shutdownHandlerInstalled = true;
  }

  try {
    return await runStageExecution(execution);
  } finally {
    currentExecutionId = null;
  }
}

export async function claimAndRunNextExecution(): Promise<boolean> {
  const execution = await claimNextStageExecution();
  if (!execution) return false;
  
  try {
    await runStageExecution(execution);
    return true;
  } catch (err) {
    console.error(`[runner] Concurrent execution failed for ${execution.stage}:`, err);
    return true;
  }
}

export async function getExecutorStats() {
  const db = await getDrizzleDb();
  const rows = await db.select({ status: stageExecutions.status, count: count() })
    .from(stageExecutions)
    .groupBy(stageExecutions.status);

  const result = {
    pending: 0,
    running: 0,
    completed: 0,
    failed: 0,
  };

  for (const row of rows) {
    if (row.status === 'pending') result.pending = row.count;
    else if (row.status === 'running') result.running = row.count;
    else if (row.status === 'completed') result.completed = row.count;
    else if (row.status === 'failed') result.failed = row.count;
  }

  return result;
}
