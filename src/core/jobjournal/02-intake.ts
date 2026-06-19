import * as MediaLibrary from 'expo-media-library/legacy';
import { File } from 'expo-file-system';
import { eq, and, inArray } from 'drizzle-orm';

import {
  loadJobJournalScreenshotSource,
  watchJobJournalScreenshotSource,
} from './01-source';
import { getDrizzleDb } from './storage/database';
import { jobJournalJobs, stageExecutions } from './storage/drizzle-schema';
import type { JobJournalStage } from './types';

const INITIAL_STAGE: JobJournalStage = 'metadata';

export type JobJournalIntakeResult = {
  totalAssets: number;
  createdJobs: number;
  existingJobs: number;
  createdExecutions: number;
};

function getJobId(asset: MediaLibrary.Asset) {
  return `job_${asset.id}`;
}

async function getImageHash(asset: MediaLibrary.Asset) {
  // To avoid expensive I/O when processing thousands of screenshots, we generate a unique hash
  // using asset metadata. Since asset.id is guaranteed to be unique and stable, this is 100% reliable.
  const fallbackHash = [
    asset.id,
    asset.filename ?? '',
    asset.creationTime ?? 0,
    asset.width ?? 0,
    asset.height ?? 0,
  ].join('|');
  return { hash: `meta:${fallbackHash}`, isReliable: true };
}

function getStageExecutionId(jobId: string, stage: JobJournalStage) {
  return `${jobId}_${stage}`;
}

export async function ingestJobJournalScreenshots(assets: MediaLibrary.Asset[] = []) {
  const nextAssets = assets.length > 0 ? assets : await loadJobJournalScreenshotSource();
  const db = await getDrizzleDb();
  const now = new Date();

  let createdJobs = 0;
  let existingJobs = 0;
  let createdExecutions = 0;

  if (nextAssets.length === 0) {
    return {
      totalAssets: 0,
      createdJobs: 0,
      existingJobs: 0,
      createdExecutions: 0,
    };
  }

  // 1. Map all jobIds to query
  const assetJobIds = nextAssets.map(asset => getJobId(asset));

  // 2. Fetch existing jobs and metadata stage executions in chunks to avoid SQLite parameter limit (999)
  const existingJobRows: { id: string; imageHash: string }[] = [];
  const existingExecutionRows: { jobId: string }[] = [];
  
  const QUERY_BATCH_SIZE = 500;
  for (let i = 0; i < assetJobIds.length; i += QUERY_BATCH_SIZE) {
    const chunk = assetJobIds.slice(i, i + QUERY_BATCH_SIZE);
    
    // Fetch jobs chunk
    const jobs = await db.select({
      id: jobJournalJobs.id,
      imageHash: jobJournalJobs.imageHash,
    })
    .from(jobJournalJobs)
    .where(inArray(jobJournalJobs.id, chunk));
    existingJobRows.push(...jobs);

    // Fetch executions chunk
    const execs = await db.select({
      jobId: stageExecutions.jobId,
    })
    .from(stageExecutions)
    .where(and(
      eq(stageExecutions.stage, INITIAL_STAGE),
      inArray(stageExecutions.jobId, chunk)
    ));
    existingExecutionRows.push(...execs);
  }

  const existingJobIds = new Set(existingJobRows.map(r => r.id));
  const existingHashes = new Set(existingJobRows.map(r => r.imageHash));
  const existingExecutions = new Set(existingExecutionRows.map(r => r.jobId));

  const jobsToInsert: typeof jobJournalJobs.$inferInsert[] = [];
  const executionsToInsert: typeof stageExecutions.$inferInsert[] = [];

  for (const asset of nextAssets) {
    const jobId = getJobId(asset);
    const hashResult = await getImageHash(asset);
    const imageHash = hashResult.hash;

    // Check if job exists
    if (existingJobIds.has(jobId) || existingHashes.has(imageHash)) {
      existingJobs += 1;

      const matchedJobId = existingJobIds.has(jobId) 
        ? jobId 
        : existingJobRows.find(r => r.imageHash === imageHash)?.id;

      if (matchedJobId && !existingExecutions.has(matchedJobId)) {
        const stageExecutionId = getStageExecutionId(matchedJobId, INITIAL_STAGE);
        executionsToInsert.push({
          id: stageExecutionId,
          jobId: matchedJobId,
          stage: INITIAL_STAGE,
          status: 'pending',
          createdAt: now,
          updatedAt: now,
        });
        createdExecutions += 1;
        existingExecutions.add(matchedJobId);
      }
      continue;
    }

    // New Job
    jobsToInsert.push({
      id: jobId,
      imageUri: asset.uri,
      imageHash,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    });
    createdJobs += 1;
    existingJobIds.add(jobId);
    existingHashes.add(imageHash);

    const stageExecutionId = getStageExecutionId(jobId, INITIAL_STAGE);
    executionsToInsert.push({
      id: stageExecutionId,
      jobId,
      stage: INITIAL_STAGE,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    });
    createdExecutions += 1;
    existingExecutions.add(jobId);
  }

  // 3. Batch insert jobs and executions in chunks
  const INSERT_BATCH_SIZE = 100;
  if (jobsToInsert.length > 0 || executionsToInsert.length > 0) {
    await db.transaction(async (tx) => {
      // Insert jobs
      for (let i = 0; i < jobsToInsert.length; i += INSERT_BATCH_SIZE) {
        const chunk = jobsToInsert.slice(i, i + INSERT_BATCH_SIZE);
        await tx.insert(jobJournalJobs).values(chunk);
      }

      // Insert executions
      for (let i = 0; i < executionsToInsert.length; i += INSERT_BATCH_SIZE) {
        const chunk = executionsToInsert.slice(i, i + INSERT_BATCH_SIZE);
        await tx.insert(stageExecutions).values(chunk);
      }
    });
  }

  return {
    totalAssets: nextAssets.length,
    createdJobs,
    existingJobs,
    createdExecutions,
  };
}

export async function syncJobJournalScreenshots() {
  return ingestJobJournalScreenshots();
}

/**
 * Keeps the job journal in sync with the live screenshot source.
 */
export async function watchJobJournalIntake(
  onChange: (result: JobJournalIntakeResult) => void | Promise<void>,
  onError: (cause: unknown) => void,
) {
  return watchJobJournalScreenshotSource(
    async (assets) => {
      const result = await ingestJobJournalScreenshots(assets);
      await onChange(result);
    },
    onError,
  );
}
