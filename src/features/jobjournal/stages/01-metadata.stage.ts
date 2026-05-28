import { File } from 'expo-file-system';
import { Image } from 'react-native';

import { getJobJournalDatabase } from '../storage/database';
import type { JobJournalJob } from '../types';

export interface MetadataResult {
  width: number | null;
  height: number | null;
  fileSize: number | null;
  fileExists: boolean;
}

export async function runMetadataStage(job: JobJournalJob): Promise<MetadataResult> {
  const now = Date.now();
  let width: number | null = null;
  let height: number | null = null;
  let fileSize: number | null = null;
  let fileExists = false;

  try {
    const file = new File(job.imageUri);
    fileExists = file.exists;

    if (fileExists) {
      const info = file.info();
      fileSize = info.size ?? null;

      await new Promise<void>((resolve, reject) => {
        Image.getSize(
          job.imageUri,
          (w, h) => {
            width = w;
            height = h;
            resolve();
          },
          (error) => {
            console.warn(`Failed to get image dimensions for ${job.id}:`, error);
            resolve();
          },
        );
      });
    }
  } catch (error) {
    console.warn(`Error extracting metadata for ${job.id}:`, error);
  }

  const db = await getJobJournalDatabase();

  await db.runAsync(
    `INSERT OR REPLACE INTO metadata_stage_results
     (job_id, width, height, file_size, file_exists, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [job.id, width, height, fileSize, fileExists ? 1 : 0, now, now],
  );

  return {
    width,
    height,
    fileSize,
    fileExists,
  };
}

export async function getMetadata(jobId: string): Promise<MetadataResult | null> {
  const db = await getJobJournalDatabase();

  const row = await db.getFirstAsync<{
    width: number | null;
    height: number | null;
    file_size: number | null;
    file_exists: number;
  }>(`SELECT width, height, file_size, file_exists FROM metadata_stage_results WHERE job_id = ?`, [
    jobId,
  ]);

  if (!row) return null;

  return {
    width: row.width,
    height: row.height,
    fileSize: row.file_size,
    fileExists: row.file_exists === 1,
  };
}
