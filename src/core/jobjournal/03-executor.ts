import { eq, and, inArray, sql, count, asc, notInArray } from 'drizzle-orm';
import { getJobJournalDatabase, getDrizzleDb } from './storage/database';
import { 
  jobJournalJobs, 
  stageExecutions, 
  stageCheckpoints, 
  metadataStageResults,
  ocrStageResults,
  ocrPostprocessStageResults,
} from './storage/drizzle-schema';
import type { JobJournalStage, JobJournalStageExecution } from './types';

const LEASE_DURATION_MS = 5 * 60 * 1000;

const STAGE_DEPENDENCIES: Record<JobJournalStage, JobJournalStage[]> = {
  metadata: [],
  ocr: ['metadata'],
  ocr_postprocess: ['ocr'],
  keywords: ['ocr_postprocess'],
  index_fts: ['ocr_postprocess', 'keywords'],
};

const STAGE_CHILDREN: Record<JobJournalStage, JobJournalStage[]> = {
  metadata: ['ocr'],
  ocr: ['ocr_postprocess'],
  ocr_postprocess: ['keywords', 'index_fts'],
  keywords: ['index_fts'],
  index_fts: [],
};

function getExecutionId(jobId: string, stage: JobJournalStage) {
  return `${jobId}_${stage}`;
}

function placeholders(count: number) {
  return new Array(count).fill('?').join(', ');
}

/**
 * Simple Mutex for serializing database write transactions.
 */
class Mutex {
  private promise: Promise<void> = Promise.resolve();

  async lock() {
    let resolve: () => void;
    const next = new Promise<void>(res => { resolve = res; });
    const prev = this.promise;
    this.promise = next;
    await prev;
    return () => resolve();
  }
}

const writeMutex = new Mutex();

async function enqueueReadyChildren(jobId: string, stage: JobJournalStage, now: Date) {
  const db = await getDrizzleDb();
  const children = STAGE_CHILDREN[stage];

  if (!children || children.length === 0) {
    return;
  }

  console.log(`[executor] Checking children for ${stage} (Job: ${jobId}): [${children.join(', ')}]`);

  for (const child of children) {
    const dependencies = STAGE_DEPENDENCIES[child];
    if (dependencies.length === 0) {
      const executionId = getExecutionId(jobId, child);
      await db.insert(stageExecutions).values({
        id: executionId,
        jobId,
        stage: child,
        status: 'pending',
        attempt: 0,
        createdAt: now,
        updatedAt: now,
      }).onConflictDoNothing();
      continue;
    }

    // Check if ALL dependencies for this child are 'completed'
    const completedDeps = await db.select({ stage: stageExecutions.stage })
      .from(stageExecutions)
      .where(and(
        eq(stageExecutions.jobId, jobId),
        eq(stageExecutions.status, 'completed'),
        inArray(stageExecutions.stage, dependencies)
      ));

    if (completedDeps.length === dependencies.length) {
      const executionId = getExecutionId(jobId, child);
      await db.insert(stageExecutions).values({
        id: executionId,
        jobId,
        stage: child,
        status: 'pending',
        attempt: 0,
        createdAt: now,
        updatedAt: now,
      }).onConflictDoNothing();
      
      console.log(`[executor] Enqueued child stage ${child} for job ${jobId}`);
    } else {
      const missing = dependencies.filter(d => !completedDeps.some(cd => cd.stage === d));
      console.log(`[executor] Child ${child} for ${jobId} waiting for: [${missing.join(', ')}]`);
    }
  }
}

async function markJobCompletedIfTerminal(jobId: string, now: Date) {
  const db = await getDrizzleDb();
  
  const [nonTerminalResult] = await db.select({ count: count() })
    .from(stageExecutions)
    .where(and(
      eq(stageExecutions.jobId, jobId),
      inArray(stageExecutions.status, ['pending', 'running'])
    ));

  const [failedResult] = await db.select({ count: count() })
    .from(stageExecutions)
    .where(and(
      eq(stageExecutions.jobId, jobId),
      eq(stageExecutions.status, 'failed')
    ));

  if (nonTerminalResult.count === 0 && failedResult.count === 0) {
    await db.update(jobJournalJobs)
      .set({ status: 'completed', updatedAt: now })
      .where(eq(jobJournalJobs.id, jobId));
  }
}

/**
 * Claim Next Stage Execution.
 */
export async function claimNextStageExecution(): Promise<JobJournalStageExecution | null> {
  const db = await getDrizzleDb();
  let attempts = 0;

  while (attempts < 5) {
    const now = new Date();
    
    // Prioritize by creation time for steady throughput
    const pendingExecution = await db.query.stageExecutions.findFirst({
      where: eq(stageExecutions.status, 'pending'),
      orderBy: [asc(stageExecutions.createdAt)]
    });

    if (!pendingExecution) {
      return null;
    }

    const leaseUntil = new Date(now.getTime() + LEASE_DURATION_MS);
    
    // Atomic update using changes check to handle race conditions between workers
    const result = await db.update(stageExecutions)
      .set({ status: 'running', leaseUntil, updatedAt: now })
      .where(and(
        eq(stageExecutions.id, pendingExecution.id),
        eq(stageExecutions.status, 'pending')
      ));

    if (result.changes === 0) {
      attempts += 1;
      continue;
    }

    await db.update(jobJournalJobs)
      .set({ status: 'running', updatedAt: now })
      .where(eq(jobJournalJobs.id, pendingExecution.jobId));

    return {
      id: pendingExecution.id,
      jobId: pendingExecution.jobId,
      stage: pendingExecution.stage as JobJournalStage,
      attempt: pendingExecution.attempt,
      status: 'running',
      leaseUntil: leaseUntil.getTime(),
      createdAt: pendingExecution.createdAt.getTime(),
      updatedAt: now.getTime(),
      lastError: pendingExecution.lastError,
    };
  }

  return null;
}

export async function renewExecutionLease(
  executionId: string,
  leaseDurationMs: number = LEASE_DURATION_MS,
): Promise<boolean> {
  const db = await getDrizzleDb();
  const now = new Date();
  const leaseUntil = new Date(now.getTime() + leaseDurationMs);
  
  const result = await db.update(stageExecutions)
    .set({ leaseUntil, updatedAt: now })
    .where(and(
      eq(stageExecutions.id, executionId),
      eq(stageExecutions.status, 'running')
    ));
    
  return result.changes > 0;
}

/**
 * Completes a stage execution with transaction safety and a write mutex.
 */
export async function completeStageExecution(
  executionId: string,
  jobId: string,
  stage: JobJournalStage,
  outputPath?: string,
): Promise<void> {
  // Use a global mutex to prevent transaction collisions in concurrent execution
  const unlock = await writeMutex.lock();
  
  try {
    console.log(`[executor] Completing stage ${stage} for job ${jobId}`);
    const db = await getDrizzleDb();
    const expoDb = await getJobJournalDatabase(); 
    const now = new Date();

    // Verify stage results before marking completed
    if (stage === 'metadata') {
      const res = await db.query.metadataStageResults.findFirst({ where: eq(metadataStageResults.jobId, jobId) });
      if (!res) throw new Error(`Metadata missing for job ${jobId}`);
    } else if (stage === 'ocr') {
      const res = await db.query.ocrStageResults.findFirst({ where: eq(ocrStageResults.jobId, jobId) });
      if (!res) throw new Error(`OCR missing for job ${jobId}`);
    } else if (stage === 'ocr_postprocess') {
      const res = await db.query.ocrPostprocessStageResults.findFirst({ where: eq(ocrPostprocessStageResults.jobId, jobId) });
      if (!res) throw new Error(`OCR postprocess missing for job ${jobId}`);
    } else if (stage === 'index_fts') {
      const row = await expoDb.getFirstAsync<{ rowid: number }>(`SELECT rowid FROM screenshot_search_index WHERE job_id = ?`, [jobId]);
      if (!row) throw new Error(`FTS index missing for job ${jobId}`);
    }

    await db.transaction(async (tx) => {
      // 1. Mark completed
      const completion = await tx.update(stageExecutions)
        .set({ status: 'completed', leaseUntil: null, updatedAt: now, lastError: null })
        .where(and(eq(stageExecutions.id, executionId), eq(stageExecutions.status, 'running')));

      if (completion.changes === 0) throw new Error(`Execution ${executionId} not claimable`);

      // 2. Checkpoint
      await tx.insert(stageCheckpoints).values({
        jobId,
        stage,
        outputPath: outputPath ?? null,
        createdAt: now,
        updatedAt: now,
      }).onConflictDoUpdate({
        target: [stageCheckpoints.jobId, stageCheckpoints.stage],
        set: { outputPath: outputPath ?? null, updatedAt: now }
      });

      // 3. Chain next stages
      await enqueueReadyChildren(jobId, stage, now);
      await markJobCompletedIfTerminal(jobId, now);
    });

  } finally {
    unlock();
  }
}

export async function failStageExecution(
  executionId: string,
  errorMessage: string,
  errorCode?: string,
  maxRetries: number = 3,
): Promise<void> {
  const db = await getDrizzleDb();
  const now = new Date();

  const execution = await db.query.stageExecutions.findFirst({
    where: eq(stageExecutions.id, executionId),
    columns: { attempt: true, jobId: true }
  });
  
  if (!execution) return;

  const nextAttempt = execution.attempt + 1;
  const status = nextAttempt >= maxRetries ? 'failed' : 'pending';

  await db.update(stageExecutions)
    .set({ 
      status, 
      attempt: nextAttempt, 
      leaseUntil: null, 
      updatedAt: now, 
      lastErrorCode: errorCode ?? 'ERROR', 
      lastErrorMessage: errorMessage 
    })
    .where(eq(stageExecutions.id, executionId));

  if (status === 'failed') {
    await db.update(jobJournalJobs)
      .set({ status: 'failed', updatedAt: now })
      .where(eq(jobJournalJobs.id, execution.jobId));
  }
}

export async function recoveryExpiredLeases(): Promise<number> {
  const db = await getDrizzleDb();
  const now = new Date();
  const result = await db.update(stageExecutions)
    .set({ status: 'pending', leaseUntil: null, updatedAt: now })
    .where(and(
      eq(stageExecutions.status, 'running'),
      sql`${stageExecutions.leaseUntil} IS NOT NULL`,
      sql`${stageExecutions.leaseUntil} < ${now.getTime()}`
    ));
  return result.changes;
}

export async function getStageExecutionStats() {
  const db = await getDrizzleDb();
  const rows = await db.select({ status: stageExecutions.status, count: count() })
    .from(stageExecutions)
    .groupBy(stageExecutions.status);
    
  const result = { pending: 0, running: 0, completed: 0, failed: 0 };
  for (const row of rows) {
    if (row.status === 'pending') result.pending = row.count;
    else if (row.status === 'running') result.running = row.count;
    else if (row.status === 'completed') result.completed = row.count;
    else if (row.status === 'failed') result.failed = row.count;
  }
  return result;
}

export async function revokeExecutionLease(executionId: string): Promise<boolean> {
  const db = await getDrizzleDb();
  const now = new Date();
  const result = await db.update(stageExecutions)
    .set({ status: 'pending', leaseUntil: null, updatedAt: now })
    .where(and(eq(stageExecutions.id, executionId), eq(stageExecutions.status, 'running')));
  return result.changes > 0;
}
