/* OCR stage
 * - Extracts text from screenshot image using rn-mlkit-ocr
 * - Stores raw OCR result (text + blocks) for postprocessing stage
 * - Detector type auto-detected but can fallback to 'latin' for robustness
 */
import { recognizeText, type OcrBlock, type OcrResult } from 'rn-mlkit-ocr';

import { getJobJournalDatabase } from '../storage/database';
import type { JobJournalJob } from '../types';

export type { OcrBlock, OcrResult };

export async function runOcrStage(job: JobJournalJob): Promise<{
  status: 'completed' | 'failed';
  error?: string;
}> {
  try {
    const ocrResult = await recognizeText(job.imageUri, 'latin');

    if (!ocrResult) {
      return {
        status: 'failed',
        error: 'OCR returned no result',
      };
    }

    const db = await getJobJournalDatabase();
    const now = Date.now();
    const text = ocrResult.text ?? '';
    const blocks = ocrResult.blocks ?? [];

    await db.runAsync(
      `INSERT OR REPLACE INTO ocr_stage_results
       (job_id, text, blocks_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)`,
      [job.id, text, JSON.stringify(blocks), now, now],
    );

    return { status: 'completed' };
  } catch (error) {
    return {
      status: 'failed',
      error: error instanceof Error ? error.message : 'Unknown OCR error',
    };
  }
}

export async function getOcrResult(jobId: string): Promise<OcrResult | null> {
  const db = await getJobJournalDatabase();

  const row = await db.getFirstAsync<{
    text: string;
    blocks_json: string;
  }>(`SELECT text, blocks_json FROM ocr_stage_results WHERE job_id = ?`, [jobId]);

  if (!row) return null;

  return {
    text: row.text || '',
    blocks: row.blocks_json ? JSON.parse(row.blocks_json) : [],
  };
}
