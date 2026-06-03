/* Job-journal runner
 * - runNextStageExecution() claims the next pending stage execution, runs the
 *   appropriate stage function, and records completed / failed / waiting_for_model
 *   outcomes via executor helpers.
 * - Designed to be used by short-lived background tasks (expo-background-task)
 *   or a foreground loop for debugging. It is lease-aware and safe for concurrent
 *   workers up to the lease semantics implemented by the executor.
 */
import {
  claimNextStageExecution,
  completeStageExecution,
  failStageExecution,
  markExecutionWaitingForModel,
  recoveryExpiredLeases,
  renewExecutionLease,
  revokeExecutionLease,
} from './03-executor';
import {
  runEmbeddingStage,
} from './stages/04-embedding.stage';
import { getJobJournalDatabase } from './storage/database';
import { isReady as isModelReady } from './modelManager';
import type { JobJournalJob, JobJournalStage, JobJournalStageExecution } from './types';

import {
  runMetadataStage,
} from './stages/01-metadata.stage';
import { runOcrStage } from './stages/02-ocr.stage';
import { runOcrPostprocessStage } from './stages/03-ocr_postprocess.stage';
import { runKeywordsStage } from './stages/05-keywords.stage';
import { runIndexFtsStage } from './stages/06-index_fts.stage';
import { runIndexVecStage } from './stages/07-index_vec.stage';

const STAGE_TIMEOUTS: Record<JobJournalStage, number> = {
  metadata: 30_000, // 30s
  ocr: 120_000, // 2m
  ocr_postprocess: 30_000, // 30s
  embedding: 10 * 60_000, // 10m
  keywords: 60_000, // 1m
  index: 120_000, // 2m
  index_fts: 120_000, // 2m
  index_vec: 120_000, // 2m
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
  const db = await getJobJournalDatabase();
  const row = await db.getFirstAsync<{
    id: string;
    imageUri: string;
    imageHash: string;
    status: string;
    vector_required: number | null;
    createdAt: number;
    updatedAt: number;
  }>(
    `SELECT id, image_uri as imageUri, image_hash as imageHash, status, vector_required, created_at as createdAt, updated_at as updatedAt FROM job_journal_jobs WHERE id = ?`,
    [jobId],
  );

  if (!row) return null;

  return {
    id: row.id,
    imageUri: row.imageUri,
    imageHash: row.imageHash,
    status: row.status as any,
    vectorRequired: Boolean(row.vector_required),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function getCheckpointPointer(jobId: string, stage: JobJournalStage) {
  if (stage === 'index' || stage === 'index_fts') return `screenshot_search_index:${jobId}`;
  if (stage === 'index_vec') return `image_embedding_index:${jobId}`;
  if (stage === 'embedding') return `embedding_stage_results:${jobId}`;
  if (stage === 'keywords') return `keyword_stage_results:${jobId}`;
  if (stage === 'ocr_postprocess') return `ocr_postprocess_stage_results:${jobId}`;
  if (stage === 'ocr') return `ocr_stage_results:${jobId}`;
  return `metadata_stage_results:${jobId}`;
}

async function validateStageInput(jobId: string, stage: JobJournalStage): Promise<string | null> {
  const db = await getJobJournalDatabase();

  if (stage === 'ocr') {
    const metadata = await db.getFirstAsync<{ file_exists: number }>(
      `SELECT file_exists FROM metadata_stage_results WHERE job_id = ?`,
      [jobId],
    );
    if (!metadata) return 'Metadata result missing';
    if (metadata.file_exists !== 1) return 'Image file does not exist';
    return null;
  }

  if (stage === 'ocr_postprocess') {
    const ocr = await db.getFirstAsync<{ text: string | null }>(
      `SELECT text FROM ocr_stage_results WHERE job_id = ?`,
      [jobId],
    );
    if (!ocr) return 'OCR result missing';
    return null;
  }

  if (stage === 'embedding' || stage === 'keywords' || stage === 'index') {
    const post = await db.getFirstAsync<{ text: string | null }>(
      `SELECT text FROM ocr_postprocess_stage_results WHERE job_id = ?`,
      [jobId],
    );
    if (!post) return 'OCR postprocess result missing';
    return null;
  }

  if (stage === 'index_fts') {
    const post = await db.getFirstAsync<{ text: string | null }>(
      `SELECT text FROM ocr_postprocess_stage_results WHERE job_id = ?`,
      [jobId],
    );
    if (!post) return 'OCR postprocess result missing';
    return null;
  }

  if (stage === 'index_vec') {
    const embedding = await db.getFirstAsync<{ id: string }>(
      `SELECT id FROM embedding_stage_results WHERE job_id = ? AND modality = 'image'`,
      [jobId],
    );
    if (!embedding) return 'Embedding result missing';
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

  let result: { status: 'completed' | 'failed' | 'waiting_for_model'; error?: string; errorCode?: string };
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
      case 'embedding': {
        // Create an AbortController to allow cooperative cancellation of embedding work.
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        try {
          result = await runEmbeddingStage(job, execution, controller.signal);
        } catch (err) {
          result = { status: 'failed', error: err instanceof Error ? err.message : 'Stage timed out', errorCode: (err instanceof Error && err.message === 'Aborted') ? 'TIMEOUT' : 'UNKNOWN' };
        } finally {
          clearTimeout(timer);
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
      case 'index':
      case 'index_fts': {
        try {
          result = await promiseWithTimeout(runIndexFtsStage(job), timeoutMs);
        } catch (err) {
          result = { status: 'failed', error: err instanceof Error ? err.message : 'Stage timed out' };
        }
        break;
      }
      case 'index_vec': {
        try {
          result = await promiseWithTimeout(runIndexVecStage(job), timeoutMs);
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
  } else if (result.status === 'waiting_for_model') {
    await markExecutionWaitingForModel(execution.id, result.error || 'Waiting for model', result.errorCode);
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
  
  // Model-aware claiming: only allow heavy tasks if model is ready
  const execution = await claimNextStageExecution({ allowHeavy: isModelReady() });
  if (!execution) return false;

  console.log(`[runner] Claimed: ${execution.stage} (Job: ${execution.jobId})`);

  // Track current claimed execution so that graceful shutdown can revoke the lease
  currentExecutionId = execution.id;
  if (!shutdownHandlerInstalled) {
    // Install handlers if environment supports process signals
    if (typeof process !== 'undefined' && typeof (process as any).on === 'function') {
      const handleSignal = async (sig: string) => {
        try {
          if (currentExecutionId) {
            // best-effort revoke; ignore errors
            await revokeExecutionLease(currentExecutionId);
             
            console.log(`revoked execution lease for ${currentExecutionId} due to signal ${sig}`);
          }
        } catch (err) {
           
          console.error('Error revoking execution lease during shutdown', err);
        } finally {
          // exit after attempting revoke
          try {
            process.exit(0);
          } catch {
            // ignore
          }
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
    // clear current execution marker so shutdown handler won't try to revoke it
    currentExecutionId = null;
  }
}

/**
 * Advanced concurrent execution: scheduler can claim and run multiple tasks.
 */
export async function claimAndRunNextExecution(options: { allowHeavy: boolean }): Promise<boolean> {
  const execution = await claimNextStageExecution(options);
  if (!execution) return false;
  
  try {
    await runStageExecution(execution);
    return true;
  } catch (err) {
    console.error(`[runner] Concurrent execution failed for ${execution.stage}:`, err);
    return true; // continue processing other tasks
  }
}

export async function getExecutorStats(): Promise<{
  pending: number;
  running: number;
  completed: number;
  failed: number;
  waitingForModel: number;
}> {
  const db = await getJobJournalDatabase();

  const stats = await db.getAllAsync<{ status: string; count: number }>(
    `SELECT status, COUNT(*) as count FROM stage_executions GROUP BY status`,
  );

  const result = {
    pending: 0,
    running: 0,
    completed: 0,
    failed: 0,
    waitingForModel: 0,
  };

  for (const stat of stats) {
    if (stat.status === 'pending') result.pending = stat.count;
    else if (stat.status === 'running') result.running = stat.count;
    else if (stat.status === 'completed') result.completed = stat.count;
    else if (stat.status === 'failed') result.failed = stat.count;
    else if (stat.status === 'waiting_for_model') result.waitingForModel = stat.count;
  }

  return result;
}
