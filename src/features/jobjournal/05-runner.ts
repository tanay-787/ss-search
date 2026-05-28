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

async function getJob(jobId: string): Promise<JobJournalJob | null> {
  const db = await getJobJournalDatabase();
  return db.getFirstAsync<JobJournalJob>(
    `SELECT id, image_uri as imageUri, image_hash as imageHash, status, created_at as createdAt, updated_at as updatedAt FROM job_journal_jobs WHERE id = ?`,
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
  if (!job) {
    await failStageExecution(execution.id, `Job not found: ${execution.jobId}`);
    return true;
  }

  let result: { status: 'completed' | 'failed' | 'waiting_for_model'; error?: string };
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
    switch (execution.stage as JobJournalStage) {
      case 'metadata': {
        const metadata = await runMetadataStage(job);
        result = metadata.fileExists
          ? { status: 'completed' }
          : { status: 'failed', error: 'Image file does not exist' };
        break;
      }
      case 'ocr': {
        result = await runOcrStage(job);
        break;
      }
      case 'ocr_postprocess': {
        await runOcrPostprocessStage(job);
        result = { status: 'completed' };
        break;
      }
      case 'embedding': {
        result = await runEmbeddingStage(job, execution);
        break;
      }
      case 'keywords': {
        result = await runKeywordsStage(job);
        break;
      }
      case 'index': {
        result = await runIndexStage(job);
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

  if (result.status === 'completed') {
    await completeStageExecution(
      execution.id,
      execution.jobId,
      execution.stage,
      getCheckpointPointer(execution.jobId, execution.stage),
    );
  } else if (result.status === 'waiting_for_model') {
    await markExecutionWaitingForModel(execution.id, result.error || 'Waiting for model');
  } else {
    await failStageExecution(execution.id, result.error || 'Stage failed');
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
