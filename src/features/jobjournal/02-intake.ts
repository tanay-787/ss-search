import * as MediaLibrary from 'expo-media-library';
import { File } from 'expo-file-system';

import {
  loadJobJournalScreenshotSource,
  watchJobJournalScreenshotSource,
} from './01-source';
import { getJobJournalDatabase } from './storage/database';
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
  const file = new File(asset.uri);
  const info = file.info({ md5: true });
  if (info.exists && info.md5) {
    return { hash: `md5:${info.md5}`, isReliable: true };
  }

  const fallbackHash = [
    asset.id,
    asset.uri,
    asset.filename ?? '',
    asset.creationTime ?? 0,
    asset.width ?? 0,
    asset.height ?? 0,
  ].join('|');
  return { hash: `fallback:${fallbackHash}`, isReliable: false };
}

function getStageExecutionId(jobId: string, stage: JobJournalStage) {
  return `${jobId}_${stage}`;
}

async function seedJobForAsset(asset: MediaLibrary.Asset, vectorRequired: boolean = false): Promise<{
  createdJob: boolean;
  createdExecution: boolean;
}> {
  const db = await getJobJournalDatabase();
  const now = Date.now();
  const jobId = getJobId(asset);
  const hashResult = await getImageHash(asset);
  const imageHash = hashResult.hash;
  const imageUri = asset.uri;

  const existingJob = hashResult.isReliable
    ? await db.getFirstAsync<{ id: string; vector_required?: number }>(`SELECT id, vector_required FROM job_journal_jobs WHERE image_hash = ?`, [
        imageHash,
      ])
    : await db.getFirstAsync<{ id: string; vector_required?: number }>(`SELECT id, vector_required FROM job_journal_jobs WHERE id = ?`, [jobId]);

  if (existingJob) {
    // If caller requested vector indexing and job previously did not require it, update the job record.
    if (vectorRequired && !(existingJob.vector_required === 1)) {
      await db.runAsync(`UPDATE job_journal_jobs SET vector_required = 1, updated_at = ? WHERE id = ?`, [now, existingJob.id]);
    }

    const stageExecutionId = getStageExecutionId(existingJob.id, INITIAL_STAGE);
    const existingExecution = await db.getFirstAsync<{ id: string }>(
      `SELECT id FROM stage_executions WHERE id = ?`,
      [stageExecutionId],
    );

    if (!existingExecution) {
      await db.runAsync(
        `INSERT INTO stage_executions (
          id, job_id, stage, attempt, status, lease_until, created_at, updated_at, last_error
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [stageExecutionId, existingJob.id, INITIAL_STAGE, 0, 'pending', null, now, now, null],
      );
      return { createdJob: false, createdExecution: true };
    }

    return { createdJob: false, createdExecution: false };
  }

  await db.runAsync(
    `INSERT INTO job_journal_jobs (
      id, image_uri, image_hash, status, vector_required, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [jobId, imageUri, imageHash, 'pending', vectorRequired ? 1 : 0, now, now],
  );

  const stageExecutionId = getStageExecutionId(jobId, INITIAL_STAGE);
  await db.runAsync(
    `INSERT INTO stage_executions (
      id, job_id, stage, attempt, status, lease_until, created_at, updated_at, last_error
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [stageExecutionId, jobId, INITIAL_STAGE, 0, 'pending', null, now, now, null],
  );

  return { createdJob: true, createdExecution: true };
}

export async function ingestJobJournalScreenshots(assets: MediaLibrary.Asset[] = [], options?: { vectorRequired?: boolean }) {
  const nextAssets = assets.length > 0 ? assets : await loadJobJournalScreenshotSource();
  let createdJobs = 0;
  let existingJobs = 0;
  let createdExecutions = 0;
  const vectorRequired = options?.vectorRequired ?? false;

  for (const asset of nextAssets) {
    const result = await seedJobForAsset(asset, vectorRequired);
    if (result.createdJob) createdJobs += 1;
    else existingJobs += 1;
    if (result.createdExecution) createdExecutions += 1;
  }

  const result: JobJournalIntakeResult = {
    totalAssets: nextAssets.length,
    createdJobs,
    existingJobs,
    createdExecutions,
  };

  return result;
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
