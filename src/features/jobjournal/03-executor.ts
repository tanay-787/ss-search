import { getJobJournalDatabase } from './storage/database';
import type { JobJournalStage, JobJournalStageExecution } from './types';

const LEASE_DURATION_MS = 5 * 60 * 1000;

const STAGE_DEPENDENCIES: Record<JobJournalStage, JobJournalStage[]> = {
  metadata: [],
  ocr: ['metadata'],
  ocr_postprocess: ['ocr'],
  embedding: ['ocr_postprocess'],
  keywords: ['ocr_postprocess'],
  index: ['embedding', 'keywords'],
};

const STAGE_CHILDREN: Record<JobJournalStage, JobJournalStage[]> = {
  metadata: ['ocr'],
  ocr: ['ocr_postprocess'],
  ocr_postprocess: ['embedding', 'keywords'],
  embedding: ['index'],
  keywords: ['index'],
  index: [],
};

function getExecutionId(jobId: string, stage: JobJournalStage) {
  return `${jobId}_${stage}`;
}

function placeholders(count: number) {
  return new Array(count).fill('?').join(', ');
}

async function enqueueReadyChildren(jobId: string, stage: JobJournalStage, now: number) {
  const db = await getJobJournalDatabase();
  const children = STAGE_CHILDREN[stage];
  for (const child of children) {
    const dependencies = STAGE_DEPENDENCIES[child];
    const rows = await db.getAllAsync<{ stage: string }>(
      `SELECT stage
       FROM stage_executions
       WHERE job_id = ? AND status = 'completed' AND stage IN (${placeholders(dependencies.length)})`,
      [jobId, ...dependencies],
    );
    const completedDeps = new Set(rows.map((row) => row.stage));
    const allDependenciesMet = dependencies.every((dependency) => completedDeps.has(dependency));

    if (!allDependenciesMet) {
      continue;
    }

    const executionId = getExecutionId(jobId, child);
    await db.runAsync(
      `INSERT OR IGNORE INTO stage_executions
       (id, job_id, stage, attempt, status, lease_until, created_at, updated_at, last_error)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [executionId, jobId, child, 0, 'pending', null, now, now, null],
    );
  }
}

async function markJobCompletedIfTerminal(jobId: string, now: number) {
  const db = await getJobJournalDatabase();
  const nonTerminal = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count
     FROM stage_executions
     WHERE job_id = ? AND status IN ('pending', 'running', 'waiting_for_model')`,
    [jobId],
  );
  const failed = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count
     FROM stage_executions
     WHERE job_id = ? AND status = 'failed'`,
    [jobId],
  );

  if ((nonTerminal?.count ?? 0) === 0 && (failed?.count ?? 0) === 0) {
    await db.runAsync(`UPDATE job_journal_jobs SET status = 'completed', updated_at = ? WHERE id = ?`, [
      now,
      jobId,
    ]);
  }
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

    await db.runAsync(`UPDATE job_journal_jobs SET status = 'running', updated_at = ? WHERE id = ?`, [
      now,
      pendingExecution.job_id,
    ]);

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

export async function renewExecutionLease(
  executionId: string,
  leaseDurationMs: number = LEASE_DURATION_MS,
): Promise<boolean> {
  const db = await getJobJournalDatabase();
  const now = Date.now();
  const leaseUntil = now + leaseDurationMs;
  const result = await db.runAsync(
    `UPDATE stage_executions
     SET lease_until = ?, updated_at = ?
     WHERE id = ? AND status = 'running'`,
    [leaseUntil, now, executionId],
  );
  return (result.changes ?? 0) > 0;
}

export async function completeStageExecution(
  executionId: string,
  jobId: string,
  stage: JobJournalStage,
  outputPath?: string,
): Promise<void> {
  const db = await getJobJournalDatabase();
  const now = Date.now();

  await db.execAsync('BEGIN IMMEDIATE');
  try {
    // Verify that the stage has produced the expected output before marking completed.
    // This avoids enqueueing children when parent outputs haven't been persisted yet.
    if (stage === 'metadata') {
      const row = await db.getFirstAsync<{ job_id: string }>(
        `SELECT job_id FROM metadata_stage_results WHERE job_id = ?`,
        [jobId],
      );
      if (!row) throw new Error(`Metadata result missing for job ${jobId}`);
    } else if (stage === 'ocr') {
      const row = await db.getFirstAsync<{ job_id: string }>(`SELECT job_id FROM ocr_stage_results WHERE job_id = ?`, [jobId]);
      if (!row) throw new Error(`OCR result missing for job ${jobId}`);
    } else if (stage === 'ocr_postprocess') {
      const row = await db.getFirstAsync<{ job_id: string }>(
        `SELECT job_id FROM ocr_postprocess_stage_results WHERE job_id = ?`,
        [jobId],
      );
      if (!row) throw new Error(`OCR postprocess result missing for job ${jobId}`);
    } else if (stage === 'embedding') {
      const row = await db.getFirstAsync<{ id: string }>(
        `SELECT id FROM embedding_stage_results WHERE job_id = ? LIMIT 1`,
        [jobId],
      );
      if (!row) throw new Error(`Embedding result missing for job ${jobId}`);
    } else if (stage === 'index') {
      const row = await db.getFirstAsync<{ rowid: number }>(`SELECT rowid FROM screenshot_search_index WHERE job_id = ?`, [jobId]);
      if (!row) throw new Error(`Index entries missing for job ${jobId}`);
    }

    const completion = await db.runAsync(
      `UPDATE stage_executions
       SET status = 'completed', lease_until = NULL, updated_at = ?, last_error = NULL
       WHERE id = ? AND status = 'running'`,
      [now, executionId],
    );
    if ((completion.changes ?? 0) === 0) {
      throw new Error(`Execution ${executionId} is not claimable for completion`);
    }

    await db.runAsync(
      `INSERT OR REPLACE INTO stage_checkpoints
       (job_id, stage, output_path, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)`,
      [jobId, stage, outputPath ?? null, now, now],
    );

    await enqueueReadyChildren(jobId, stage, now);
    await markJobCompletedIfTerminal(jobId, now);

    await db.execAsync('COMMIT');
  } catch (error) {
    await db.execAsync('ROLLBACK');
    throw error;
  }
}

export async function failStageExecution(
  executionId: string,
  errorMessage: string,
  errorCode?: string,
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
  const lastErrorStored = `${errorCode ?? 'ERROR'}|${errorMessage}`;

  if (nextAttempt >= maxRetries) {
    await db.runAsync(
      `UPDATE stage_executions
       SET status = 'failed', lease_until = NULL, updated_at = ?, last_error = ?
       WHERE id = ?`,
      [now, lastErrorStored, executionId],
    );

    const jobId = await db.getFirstAsync<{ job_id: string }>(
      `SELECT job_id FROM stage_executions WHERE id = ?`,
      [executionId],
    );
    if (jobId) {
      await db.runAsync(`UPDATE job_journal_jobs SET status = 'failed', updated_at = ? WHERE id = ?`, [
        now,
        jobId.job_id,
      ]);
    }
    return;
  }

  await db.runAsync(
    `UPDATE stage_executions
     SET status = 'pending', attempt = ?, lease_until = NULL, updated_at = ?, last_error = ?
     WHERE id = ?`,
    [nextAttempt, now, lastErrorStored, executionId],
  );
}

export async function markExecutionWaitingForModel(
  executionId: string,
  errorMessage: string,
  errorCode?: string,
): Promise<void> {
  const db = await getJobJournalDatabase();
  const now = Date.now();
  const lastErrorStored = `${errorCode ?? 'WAIT_MODEL'}|${errorMessage}`;
  await db.runAsync(
    `UPDATE stage_executions
     SET status = 'waiting_for_model', lease_until = NULL, updated_at = ?, last_error = ?
     WHERE id = ?`,
    [now, lastErrorStored, executionId],
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
    `SELECT status, COUNT(*) as count FROM stage_executions GROUP BY status`,
  );
  const result = { pending: 0, running: 0, completed: 0, failed: 0 };
  for (const row of stats) {
    if (row.status === 'pending') result.pending = row.count;
    else if (row.status === 'running') result.running = row.count;
    else if (row.status === 'completed') result.completed = row.count;
    else if (row.status === 'failed') result.failed = row.count;
  }
  return result;
}

export async function revokeExecutionLease(executionId: string): Promise<boolean> {
  const db = await getJobJournalDatabase();
  const now = Date.now();
  const result = await db.runAsync(
    `UPDATE stage_executions
     SET status = 'pending', lease_until = NULL, updated_at = ?
     WHERE id = ? AND status = 'running'`,
    [now, executionId],
  );
  return (result.changes ?? 0) > 0;
}
