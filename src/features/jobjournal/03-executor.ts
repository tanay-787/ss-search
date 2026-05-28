import { getJobJournalDatabase } from './storage/database';
import type { JobJournalStage, JobJournalStageExecution } from './types';

const LEASE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

const STAGE_DAG: Record<JobJournalStage, JobJournalStage | null> = {
  metadata: 'ocr',
  ocr: 'ocr_postprocess',
  ocr_postprocess: 'embedding',
  embedding: 'keywords',
  keywords: 'index',
  index: null,
};

function getNextStage(stage: JobJournalStage): JobJournalStage | null {
  return STAGE_DAG[stage];
}

function getExecutionId(jobId: string, stage: JobJournalStage) {
  return `${jobId}_${stage}`;
}

export async function claimNextStageExecution(): Promise<JobJournalStageExecution | null> {
  const db = await getJobJournalDatabase();
  let attempts = 0;

  while (attempts < 5) {
    const now = Date.now();
    const pendingExecution = await db.getFirstAsync<{
      id: string;
      job_id: string;
      stage: string;
      attempt: number;
      created_at: number;
      updated_at: number;
    }>(
      `SELECT id, job_id, stage, attempt, created_at, updated_at
       FROM stage_executions
       WHERE status = 'pending'
       ORDER BY created_at ASC
       LIMIT 1`,
    );

    if (!pendingExecution) {
      return null;
    }

    const leaseUntil = now + LEASE_DURATION_MS;
    const claimResult = await db.runAsync(
      `UPDATE stage_executions
       SET status = 'running', lease_until = ?, updated_at = ?
       WHERE id = ? AND status = 'pending'`,
      [leaseUntil, now, pendingExecution.id],
    );

    if ((claimResult.changes ?? 0) === 0) {
      attempts += 1;
      continue;
    }

    return {
      id: pendingExecution.id,
      jobId: pendingExecution.job_id,
      stage: pendingExecution.stage as JobJournalStage,
      attempt: pendingExecution.attempt,
      status: 'running',
      leaseUntil,
      createdAt: pendingExecution.created_at,
      updatedAt: now,
      lastError: null,
    };
  }

  return null;
}

export async function completeStageExecution(
  executionId: string,
  jobId: string,
  stage: JobJournalStage,
  outputPath?: string,
): Promise<void> {
  const db = await getJobJournalDatabase();
  const now = Date.now();
  const nextStage = getNextStage(stage);

  await db.runAsync(
    `UPDATE stage_executions
     SET status = 'completed', lease_until = NULL, updated_at = ?, last_error = NULL
     WHERE id = ?`,
    [now, executionId],
  );

  if (outputPath) {
    await db.runAsync(
      `INSERT OR REPLACE INTO stage_checkpoints
       (job_id, stage, output_path, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)`,
      [jobId, stage, outputPath, now, now],
    );
  }

  if (nextStage) {
    const nextExecutionId = getExecutionId(jobId, nextStage);
    await db.runAsync(
      `INSERT INTO stage_executions
       (id, job_id, stage, attempt, status, lease_until, created_at, updated_at, last_error)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [nextExecutionId, jobId, nextStage, 0, 'pending', null, now, now, null],
    );
  } else {
    await db.runAsync(
      `UPDATE job_journal_jobs
       SET status = 'completed', updated_at = ?
       WHERE id = ?`,
      [now, jobId],
    );
  }
}

export async function failStageExecution(
  executionId: string,
  errorMessage: string,
  maxRetries: number = 3,
): Promise<void> {
  const db = await getJobJournalDatabase();
  const now = Date.now();

  const execution = await db.getFirstAsync<{ attempt: number }>(
    `SELECT attempt FROM stage_executions WHERE id = ?`,
    [executionId],
  );

  if (!execution) {
    return;
  }

  const nextAttempt = execution.attempt + 1;

  if (nextAttempt >= maxRetries) {
    await db.runAsync(
      `UPDATE stage_executions
       SET status = 'failed', lease_until = NULL, updated_at = ?, last_error = ?
       WHERE id = ?`,
      [now, errorMessage, executionId],
    );

    const jobId = await db.getFirstAsync<{ job_id: string }>(
      `SELECT job_id FROM stage_executions WHERE id = ?`,
      [executionId],
    );

    if (jobId) {
      await db.runAsync(
        `UPDATE job_journal_jobs SET status = 'failed', updated_at = ? WHERE id = ?`,
        [now, jobId.job_id],
      );
    }
  } else {
    await db.runAsync(
      `UPDATE stage_executions
       SET status = 'pending', attempt = ?, lease_until = NULL, updated_at = ?, last_error = ?
       WHERE id = ?`,
      [nextAttempt, now, errorMessage, executionId],
    );
  }
}

export async function markExecutionWaitingForModel(
  executionId: string,
  errorMessage: string,
): Promise<void> {
  const db = await getJobJournalDatabase();
  const now = Date.now();

  await db.runAsync(
    `UPDATE stage_executions
     SET status = 'waiting_for_model', lease_until = NULL, updated_at = ?, last_error = ?
     WHERE id = ?`,
    [now, errorMessage, executionId],
  );
}

export async function retryWaitingForModelExecutions(): Promise<number> {
  const db = await getJobJournalDatabase();
  const now = Date.now();

  const result = await db.runAsync(
    `UPDATE stage_executions
     SET status = 'pending', attempt = 0, lease_until = NULL, updated_at = ?
     WHERE status = 'waiting_for_model'`,
    [now],
  );

  return result.changes ?? 0;
}

export async function recoveryExpiredLeases(): Promise<number> {
  const db = await getJobJournalDatabase();
  const now = Date.now();

  const result = await db.runAsync(
    `UPDATE stage_executions
     SET status = 'pending', lease_until = NULL, updated_at = ?
     WHERE status = 'running' AND lease_until IS NOT NULL AND lease_until < ?`,
    [now, now],
  );

  return result.changes ?? 0;
}

export async function getStageExecutionStats(): Promise<{
  pending: number;
  running: number;
  completed: number;
  failed: number;
}> {
  const db = await getJobJournalDatabase();

  const stats = await db.getAllAsync<{ status: string; count: number }>(
    `SELECT status, COUNT(*) as count
     FROM stage_executions
     GROUP BY status`,
  );

  const result = {
    pending: 0,
    running: 0,
    completed: 0,
    failed: 0,
  };

  for (const row of stats) {
    if (row.status === 'pending') result.pending = row.count;
    else if (row.status === 'running') result.running = row.count;
    else if (row.status === 'completed') result.completed = row.count;
    else if (row.status === 'failed') result.failed = row.count;
  }

  return result;
}
