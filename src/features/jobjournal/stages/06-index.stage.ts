/* Index stage
 * - Final stage: indexes OCR text into FTS5 and embeddings into vector index.
 * - Fetches OCR text and keywords from stage result tables.
 * - Fetches embeddings (image + text) from embedding_stage_results.
 * - Inserts into screenshot_search_index (FTS5) and image_embedding_index (vec0).
 * - Uses job_id as the document ID across all indices for cross-reference.
 * - Once indexing completes, the job moves to 'completed' state and is ready for search.
 */
import { getJobJournalDatabase, getJobJournalVecStatus } from '../storage/database';
import type { JobJournalJob } from '../types';

export async function runIndexStage(job: JobJournalJob): Promise<{ status: 'completed' | 'failed'; error?: string }> {
  try {
    const db = await getJobJournalDatabase();
    const now = Date.now();

    // Fetch OCR text
    const ocrRow = await db.getFirstAsync<{ text: string }>(
      `SELECT text FROM ocr_postprocess_stage_results WHERE job_id = ?`,
      [job.id],
    );
    const ocrText = ocrRow?.text || '';

    const keywordRows = await db.getAllAsync<{ keyword: string; type: string }>(
      `SELECT keyword, type FROM keyword_stage_results WHERE job_id = ? ORDER BY score DESC LIMIT 20`,
      [job.id],
    );
    const keywordsText = keywordRows.map((row) => row.keyword).join(' ');
    const ftsReady = ocrText.trim().length > 0 || keywordsText.trim().length > 0;
    const keywordsReady = keywordsText.trim().length > 0;

    // Always insert an FTS5 row for the job, even if content is empty. This ensures
    // the job appears in indices and keeps search_readiness authoritative about
    // whether FTS content is actually present.
    await db.runAsync(
      `INSERT OR REPLACE INTO screenshot_search_index (job_id, ocr_text, keywords)
       VALUES (?, ?, ?)`,
      [job.id, ocrText, keywordsText],
    );

    // Fetch and register embeddings in vector index
    let vectorReady = false;
    const vecStatus = getJobJournalVecStatus();

    // If job requests vector indexing but vec extension is unavailable, fail early
    if (job.vectorRequired && !vecStatus.available) {
      await db.runAsync(
        `INSERT OR REPLACE INTO search_readiness
         (job_id, fts_ready, vector_ready, keywords_ready, indexed_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [job.id, ftsReady ? 1 : 0, 0, keywordsReady ? 1 : 0, null, now],
      );
      return { status: 'failed', error: 'Vector indexing required but vec extension unavailable', errorCode: 'VECTOR_UNAVAILABLE' };
    }

    if (vecStatus.available) {
      const embeddingRows = await db.getAllAsync<{ modality: string; vector: ArrayBuffer }>(
        `SELECT modality, vector FROM embedding_stage_results WHERE job_id = ?`,
        [job.id],
      );

      // Register only the image embedding in vec0 (vec0 expects a single vector per doc)
      const imageEmbedding = embeddingRows.find((r) => r.modality === 'image');
      if (imageEmbedding) {
        const float32 = new Float32Array(imageEmbedding.vector);
        const embeddingJson = JSON.stringify(Array.from(float32));

        // Delete any old entry first
        await db.runAsync(`DELETE FROM image_embedding_index WHERE job_id = ?`, [job.id]);

        // Insert the image embedding into vector index
        await db.runAsync(
          `INSERT INTO image_embedding_index (embedding, job_id)
           VALUES (?, ?)`,
          [embeddingJson, job.id],
        );
        vectorReady = true;
      }
    } else {
      vectorReady = false;
    }

    await db.runAsync(
      `INSERT OR REPLACE INTO search_readiness
       (job_id, fts_ready, vector_ready, keywords_ready, indexed_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [job.id, ftsReady ? 1 : 0, vectorReady ? 1 : 0, keywordsReady ? 1 : 0, now, now],
    );

    if (vecStatus.available && !vectorReady) {
      return { status: 'failed', error: 'Image embedding missing for vector indexing', errorCode: 'VECTOR_MISSING' };
    }

    return { status: 'completed' };
  } catch (error) {
    return {
      status: 'failed',
      error: error instanceof Error ? error.message : 'Index stage error',
      errorCode: 'UNKNOWN',
    };
  }
}
