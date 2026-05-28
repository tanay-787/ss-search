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

export async function runNextStageExecution(): Promise<boolean> {
  await recoveryExpiredLeases();
  const execution = await claimNextStageExecution();
  if (!execution) {
    return false;
  }

  const job = await getJob(execution.jobId);
  if (!job) {
    return false;
  }

  let result: { status: 'completed' | 'failed' | 'waiting_for_model'; error?: string };

  try {
    switch (execution.stage as JobJournalStage) {
      case 'metadata': {
        // metadata returns a MetadataResult; treat any successful return as completed
        await runMetadataStage(job);
        result = { status: 'completed' };
        break;
      }
      case 'ocr': {
        // ocr stage returns status object
        result = await runOcrStage(job);
        break;
      }
      case 'ocr_postprocess': {
        // postprocess returns processed result; treat as completed on success
        await runOcrPostprocessStage(job);
        result = { status: 'completed' };
        break;
      }
      case 'embedding': {
        // embedding accepts execution (checks model readiness)
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
  }

  if (result.status === 'completed') {
    await completeStageExecution(execution.id, execution.jobId, execution.stage);
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
