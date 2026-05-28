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
import type { JobJournalJob, JobJournalStage } from './types';

import {
  runMetadataStage,
} from './stages/01-metadata.stage';
import { runOcrStage } from './stages/02-ocr.stage';
import { runOcrPostprocessStage } from './stages/03-ocr_postprocess.stage';
import { runKeywordsStage } from './stages/05-keywords.stage';
import { runIndexStage } from './stages/06-index.stage';

const STAGE_TIMEOUTS: Record<JobJournalStage, number> = {
  metadata: 30_000, // 30s
  ocr: 120_000, // 2m
  ocr_postprocess: 30_000, // 30s
  embedding: 10 * 60_000, // 10m
  keywords: 60_000, // 1m
  index: 120_000, // 2m
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
  return db.getFirstAsync<JobJournalJob>(
    `SELECT id, image_uri as imageUri, image_hash as imageHash, status, vector_required as vectorRequired, created_at as createdAt, updated_at as updatedAt FROM job_journal_jobs WHERE id = ?`,
    [jobId],
  );
}

function getCheckpointPointer(jobId: string, stage: JobJournalStage) {
  if (stage === 'index') return `screenshot_search_index:${jobId}`;
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

  if (stage === 'embedding' || stage === 'keywords') {
    const post = await db.getFirstAsync<{ text: string | null }>(
      `SELECT text FROM ocr_postprocess_stage_results WHERE job_id = ?`,
      [jobId],
    );
    if (!post) return 'OCR postprocess result missing';
    return null;
  }

  if (stage === 'index') {
    const deps = await db.getAllAsync<{ stage: string }>(
      `SELECT stage FROM stage_executions WHERE job_id = ? AND status = 'completed' AND stage IN ('embedding', 'keywords')`,
      [jobId],
    );
    const done = new Set(deps.map((row) => row.stage));
    if (!done.has('embedding') || !done.has('keywords')) {
      return 'Index dependencies incomplete';
    }
    const post = await db.getFirstAsync<{ text: string | null }>(
      `SELECT text FROM ocr_postprocess_stage_results WHERE job_id = ?`,
      [jobId],
    );
    if (!post) return 'OCR postprocess result missing';
    return null;
  }

  return null;
}

export async function runNextStageExecution(): Promise<boolean> {
  await recoveryExpiredLeases();
  const execution = await claimNextStageExecution();
  if (!execution) {
    return false;
  }

  const job = await getJob(execution.jobId);
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
            // eslint-disable-next-line no-console
            console.log(`revoked execution lease for ${currentExecutionId} due to signal ${sig}`);
          }
        } catch (err) {
          // eslint-disable-next-line no-console
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
  if (!job) {
    await failStageExecution(execution.id, `Job not found: ${execution.jobId}`);
    return true;
  }

  let result: { status: 'completed' | 'failed' | 'waiting_for_model'; error?: string; errorCode?: string };
  const inputError = await validateStageInput(job.id, execution.stage);
  if (inputError) {
    await failStageExecution(execution.id, inputError);
    return true;
  }

  let heartbeat: ReturnType<typeof setInterval> | null = null;
  try {
    heartbeat = setInterval(() => {
      void renewExecutionLease(execution.id);
    }, 60_000);
    const timeoutMs = STAGE_TIMEOUTS[execution.stage];
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
      case 'index': {
        try {
          result = await promiseWithTimeout(runIndexStage(job), timeoutMs);
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
    // clear current execution marker so shutdown handler won't try to revoke it
    currentExecutionId = null;
  }

  if (result.status === 'completed') {
    try {
      await completeStageExecution(
        execution.id,
        execution.jobId,
        execution.stage,
        getCheckpointPointer(execution.jobId, execution.stage),
      );
    } catch (err) {
      // If the atomic completion fails (e.g., missing output), mark execution failed so it can be retried.
      const msg = err instanceof Error ? err.message : String(err);
      await failStageExecution(execution.id, `Completion validation failed: ${msg}`);
    }
  } else if (result.status === 'waiting_for_model') {
    await markExecutionWaitingForModel(execution.id, result.error || 'Waiting for model', result.errorCode);
  } else {
    await failStageExecution(execution.id, result.error || 'Stage failed', result.errorCode);
  }

  return true;
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
