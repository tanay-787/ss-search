import { getOcrResult, type OcrBlock } from './02-ocr.stage';
import { getJobJournalDatabase } from '../storage/database';
import type { JobJournalJob } from '../types';

export interface OcrPostprocessedResult {
  text: string;
  blocks: OcrBlock[];
  language: string;
  blockCount: number;
}

function cleanText(text: string): string {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join('\n')
    .replace(/\s+/g, ' ')
    .trim();
}

function filterHighConfidenceBlocks(blocks: OcrBlock[]): OcrBlock[] {
  return blocks.filter((block) => {
    const blockText = block.text || '';
    const isHighConfidence = blockText.length > 0;
    return isHighConfidence;
  });
}

function detectLanguage(text: string): string {
  if (!text || text.length === 0) return 'en';

  const hasLatinChars = /[a-zA-Z]/.test(text);
  const hasChineseChars = /[\u4e00-\u9fff]/.test(text);
  const hasArabicChars = /[\u0600-\u06ff]/.test(text);
  const hasDevanagariChars = /[\u0900-\u097f]/.test(text);
  const hasCyrillicChars = /[\u0400-\u04ff]/.test(text);

  if (hasChineseChars) return 'zh';
  if (hasArabicChars) return 'ar';
  if (hasDevanagariChars) return 'hi';
  if (hasCyrillicChars) return 'ru';
  if (hasLatinChars) return 'en';

  return 'en';
}

export async function runOcrPostprocessStage(job: JobJournalJob): Promise<OcrPostprocessedResult> {
  const ocrResult = await getOcrResult(job.id);

  if (!ocrResult) {
    throw new Error(`OCR result not found for job ${job.id}`);
  }

  const filteredBlocks = filterHighConfidenceBlocks(ocrResult.blocks);
  const cleanedText = cleanText(ocrResult.text);
  const detectedLanguage = detectLanguage(cleanedText);

  const db = await getJobJournalDatabase();
  const now = Date.now();

  await db.runAsync(
    `INSERT OR REPLACE INTO ocr_postprocess_stage_results
     (job_id, text, blocks_json, language, block_count, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [job.id, cleanedText, JSON.stringify(filteredBlocks), detectedLanguage, filteredBlocks.length, now, now],
  );

  return {
    text: cleanedText,
    blocks: filteredBlocks,
    language: detectedLanguage,
    blockCount: filteredBlocks.length,
  };
}

export async function getOcrPostprocessed(jobId: string): Promise<OcrPostprocessedResult | null> {
  const db = await getJobJournalDatabase();

  const row = await db.getFirstAsync<{
    text: string;
    blocks_json: string;
    language: string;
    block_count: number;
  }>(`SELECT text, blocks_json, language, block_count FROM ocr_postprocess_stage_results WHERE job_id = ?`, [jobId]);

  if (!row) return null;

  return {
    text: row.text || '',
    blocks: row.blocks_json ? JSON.parse(row.blocks_json) : [],
    language: row.language,
    blockCount: row.block_count,
  };
}
