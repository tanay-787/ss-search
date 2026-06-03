import { getJobJournalDatabase } from '../storage/database';
import type { JobJournalJob } from '../types';

export async function runIndexFtsStage(job: JobJournalJob): Promise<{ status: 'completed' | 'failed'; error?: string }> {
  try {
    const db = await getJobJournalDatabase();
    const now = Date.now();

    // Fetch OCR text
    const ocrRow = await db.getFirstAsync<{ text: string }>(
      `SELECT text FROM ocr_postprocess_stage_results WHERE job_id = ?`,
      [job.id],
    );
    const ocrText = ocrRow?.text || '';

    // Fetch Keywords
    const keywordRows = await db.getAllAsync<{ keyword: string; type: string }>(
      `SELECT keyword, type FROM keyword_stage_results WHERE job_id = ? ORDER BY score DESC LIMIT 20`,
      [job.id],
    );
    const keywordsText = keywordRows.map((row) => row.keyword).join(' ');
    
    const ftsReady = ocrText.trim().length > 0 || keywordsText.trim().length > 0;
    const keywordsReady = keywordsText.trim().length > 0;

    // 1. Update FTS Indices
    // Explicitly delete old entries to ensure idempotency (FTS5 doesn't support UNIQUE string IDs)
    await db.runAsync(`DELETE FROM screenshot_search_index WHERE job_id = ?`, [job.id]);
    await db.runAsync(`DELETE FROM screenshot_search_trigram WHERE job_id = ?`, [job.id]);
    
    // Insert into standard word-based index
    await db.runAsync(
      `INSERT INTO screenshot_search_index (job_id, ocr_text, keywords)
       VALUES (?, ?, ?)`,
      [job.id, ocrText, keywordsText],
    );

    // Insert into trigram-based fuzzy index
    await db.runAsync(
      `INSERT INTO screenshot_search_trigram (job_id, ocr_text, keywords)
       VALUES (?, ?, ?)`,
      [job.id, ocrText, keywordsText],
    );

    // 2. Update Search Readiness
    // We use a transaction-safe way to update specific columns without overwriting vector status
    const existing = await db.getFirstAsync<{ job_id: string }>(
      `SELECT job_id FROM search_readiness WHERE job_id = ?`,
      [job.id]
    );

    if (existing) {
      await db.runAsync(
        `UPDATE search_readiness 
         SET fts_ready = ?, keywords_ready = ?, indexed_at = ?, updated_at = ?
         WHERE job_id = ?`,
        [ftsReady ? 1 : 0, keywordsReady ? 1 : 0, now, now, job.id]
      );
    } else {
      await db.runAsync(
        `INSERT INTO search_readiness (job_id, fts_ready, vector_ready, keywords_ready, indexed_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [job.id, ftsReady ? 1 : 0, 0, keywordsReady ? 1 : 0, now, now]
      );
    }

    return { status: 'completed' };
  } catch (error) {
    return {
      status: 'failed',
      error: error instanceof Error ? error.message : 'Index FTS error',
    };
  }
}
