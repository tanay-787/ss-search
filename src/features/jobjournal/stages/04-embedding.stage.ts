/* Embedding stage
 * - Produces both image and text embeddings for a job using SigLIP.
 * - Uses ModelManager.isReady() to avoid performing downloads in the stage itself;
 *   if the model is not ready the stage returns 'waiting_for_model' so the job can
 *   be retried later when the model becomes available.
 * - Stores native Float32Array buffers as binary BLOBs (no base64) in
 *   embedding_stage_results with modality 'image' or 'text'.
 * - Keeps model management separate (ModelManager + siglipModelManager).
 */
import { generateImageEmbedding, generateTextEmbedding } from '../embeddings';
import { isReady as isModelReady } from '../modelManager';
import { getJobJournalDatabase } from '../storage/database';
import type { JobJournalJob, JobJournalStageExecution } from '../types';

declare const Buffer: any;

export async function runEmbeddingStage(
  job: JobJournalJob,
  _execution: JobJournalStageExecution,
): Promise<{ status: 'completed' | 'waiting_for_model' | 'failed'; error?: string }> {
  try {
    const db = await getJobJournalDatabase();

    // Check if SigLIP model is ready
    if (!isModelReady()) {
      return {
        status: 'waiting_for_model',
        error: `SigLIP model not ready`,
        errorCode: 'MODEL_UNAVAILABLE',
      };
    }

    // Fetch OCR postprocessed text
    const ocrRow = await db.getFirstAsync<{ text: string }>(
      `SELECT text FROM ocr_postprocess_stage_results WHERE job_id = ?`,
      [job.id],
    );

    if (!ocrRow?.text) {
      return {
        status: 'failed',
        error: 'No OCR text found for embedding',
      };
    }

    // Generate embeddings
    const imageEmbedding = await generateImageEmbedding(job.imageUri);
    const textEmbedding = await generateTextEmbedding(ocrRow.text);

    if (!imageEmbedding || !textEmbedding) {
      return {
        status: 'failed',
        error: 'Failed to generate embeddings',
      };
    }

    // Store embeddings as binary blobs
    const now = Date.now();
    const imageId = `${job.id}_image`;
    const textId = `${job.id}_text`;

    const imageBuffer = Buffer.from(imageEmbedding.buffer);
    const textBuffer = Buffer.from(textEmbedding.buffer);

    // Insert image embedding
    await db.runAsync(
      `INSERT OR REPLACE INTO embedding_stage_results (id, job_id, modality, vector, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [imageId, job.id, 'image', imageBuffer, now, now],
    );

    // Insert text embedding
    await db.runAsync(
      `INSERT OR REPLACE INTO embedding_stage_results (id, job_id, modality, vector, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [textId, job.id, 'text', textBuffer, now, now],
    );

    return { status: 'completed' };
  } catch (error) {
    return {
      status: 'failed',
      error: error instanceof Error ? error.message : 'Unknown embedding error',
    };
  }
}
