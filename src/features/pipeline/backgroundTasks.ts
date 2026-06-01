import * as TaskManager from 'expo-task-manager';
import * as BackgroundTask from 'expo-background-task';
import { getPipelineDatabase } from './storage/database';
import { extractOcrFromScreenshot } from './ocr';
import { generateImageEmbedding, storeImageEmbedding } from './embeddings';
import type { PipelineQueueItem } from './types';

const OCR_TASK_NAME = 'SCREENSHOT_OCR_TASK';
const EMBEDDING_TASK_NAME = 'SCREENSHOT_EMBEDDING_TASK';

export async function registerBackgroundTasks() {
  await TaskManager.defineTask(OCR_TASK_NAME, async () => {
    try {
      await processOcrQueue();
      return BackgroundTask.BackgroundTaskResult.Success;
    } catch (error) {
      console.error('OCR task failed:', error);
      return BackgroundTask.BackgroundTaskResult.Failed;
    }
  });

  await TaskManager.defineTask(EMBEDDING_TASK_NAME, async () => {
    try {
      await processEmbeddingQueue();
      return BackgroundTask.BackgroundTaskResult.Success;
    } catch (error) {
      console.error('Embedding task failed:', error);
      return BackgroundTask.BackgroundTaskResult.Failed;
    }
  });
}

async function processOcrQueue() {
  const db = await getPipelineDatabase();

  const items = await db.getAllAsync<PipelineQueueItem>(
    `SELECT id, screenshot_id as screenshotId, stage, priority, state, retry_count as retryCount, created_at as createdAt, updated_at as updatedAt, last_error as lastError FROM ingestion_queue WHERE stage = 'ocr' AND state = 'pending' LIMIT 5`,
  );

  for (const item of items) {
    try {
      await db.runAsync(
        `UPDATE ingestion_queue SET state = 'processing', updated_at = ? WHERE id = ?`,
        [Date.now(), item.id],
      );

      const screenshot = await db.getFirstAsync<{ uri: string }>(
        `SELECT uri FROM screenshots WHERE id = ?`,
        [item.screenshotId],
      );

      if (!screenshot) continue;

      await extractOcrFromScreenshot(screenshot.uri, item.screenshotId);

      await db.runAsync(
        `UPDATE ingestion_queue SET stage = 'embedding', state = 'pending', last_error = NULL, updated_at = ?
         WHERE screenshot_id = ?`,
        [Date.now(), item.screenshotId],
      );
    } catch (error) {
      await db.runAsync(
        `UPDATE ingestion_queue SET retry_count = retry_count + 1, last_error = ?, state = 'error', updated_at = ?
         WHERE screenshot_id = ?`,
        [
          error instanceof Error ? error.message : 'OCR failed',
          Date.now(),
          item.screenshotId,
        ],
      );
    }
  }
}

async function processEmbeddingQueue() {
  const db = await getPipelineDatabase();

  const items = await db.getAllAsync<PipelineQueueItem>(
    `SELECT id, screenshot_id as screenshotId, stage, priority, state, retry_count as retryCount, created_at as createdAt, updated_at as updatedAt, last_error as lastError FROM ingestion_queue WHERE stage = 'embedding' AND state = 'pending' LIMIT 3`,
  );

  for (const item of items) {
    try {
      await db.runAsync(
        `UPDATE ingestion_queue SET state = 'processing', updated_at = ? WHERE id = ?`,
        [Date.now(), item.id],
      );

      const screenshot = await db.getFirstAsync<{ uri: string }>(
        `SELECT uri FROM screenshots WHERE id = ?`,
        [item.screenshotId],
      );

      if (!screenshot) continue;

      const embedding = await generateImageEmbedding(screenshot.uri);
      await storeImageEmbedding(item.screenshotId, embedding);

      await db.runAsync(
        `UPDATE ingestion_queue SET stage = 'done', state = 'completed', last_error = NULL, updated_at = ?
         WHERE screenshot_id = ?`,
        [Date.now(), item.screenshotId],
      );
    } catch (error) {
      await db.runAsync(
        `UPDATE ingestion_queue SET retry_count = retry_count + 1, last_error = ?, state = 'error', updated_at = ?
         WHERE screenshot_id = ?`,
        [
          error instanceof Error ? error.message : 'Embedding failed',
          Date.now(),
          item.screenshotId,
        ],
      );
    }
  }
}

export async function scheduleBackgroundTasks() {
  try {
    await BackgroundTask.registerTaskAsync(OCR_TASK_NAME, {
      minimumInterval: 15,
    });

    await BackgroundTask.registerTaskAsync(EMBEDDING_TASK_NAME, {
      minimumInterval: 30,
    });
  } catch (error) {
    console.error('Failed to schedule background tasks:', error);
  }
}

export async function unregisterBackgroundTasks() {
  try {
    await BackgroundTask.unregisterTaskAsync(OCR_TASK_NAME);
  } catch (error) {
    console.warn('Failed to unregister OCR task:', error);
  }

  try {
    await BackgroundTask.unregisterTaskAsync(EMBEDDING_TASK_NAME);
  } catch (error) {
    console.warn('Failed to unregister embedding task:', error);
  }
}

export async function processNow() {
  await processOcrQueue();
  await processEmbeddingQueue();
}
