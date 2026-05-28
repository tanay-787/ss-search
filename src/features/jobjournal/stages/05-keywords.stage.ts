import { getJobJournalDatabase } from '../storage/database';
import type { JobJournalJob } from '../types';

// Simple stopword list; keep small to avoid large bundle
const STOPWORDS = new Set([
  'a','an','the','and','or','but','if','then','else','when','at','by','for','with','about','against','between','into','through','during','before','after','above','below','to','from','up','down','in','out','on','off','over','under','again','further','then','once','here','there','all','any','both','each','few','more','most','other','some','such','no','nor','not','only','own','same','so','than','too','very','s','t','can','will','just','don','should','now'
]);

function tokenize(text: string) {
  // Normalize: lowercase, replace non-alphanum with spaces, split
  return text
    .toLowerCase()
    .replace(/[^a-z0-9@#:\/.\-\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function extractEntities(text: string) {
  const entities: { type: string; value: string; positions: number[] }[] = [];

  // URLs
  const urlRe = /https?:\/\/[\w\-./?=&%]+/g;
  let m: RegExpExecArray | null;
  while ((m = urlRe.exec(text))) {
    entities.push({ type: 'url', value: m[0], positions: [m.index] });
  }

  // emails
  const emailRe = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
  while ((m = emailRe.exec(text))) {
    entities.push({ type: 'email', value: m[0], positions: [m.index] });
  }

  // dates (simple ISO or common formats)
  const dateRe = /\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g;
  while ((m = dateRe.exec(text))) {
    entities.push({ type: 'date', value: m[0], positions: [m.index] });
  }

  return entities;
}

export async function runKeywordsStage(job: JobJournalJob): Promise<{ status: 'completed' | 'failed'; error?: string }> {
  try {
    const db = await getJobJournalDatabase();

    const row = await db.getFirstAsync<{ text: string; blocks_json: string }>(
      `SELECT text, blocks_json FROM ocr_postprocess_stage_results WHERE job_id = ?`,
      [job.id],
    );

    if (!row || !row.text) {
      return { status: 'failed', error: 'No OCR text available' };
    }

    const text = row.text;
    const tokens = tokenize(text).filter((t) => t.length > 1 && !STOPWORDS.has(t));

    if (tokens.length === 0) {
      return { status: 'completed' };
    }

    // TF counts
    const tf: Record<string, number> = {};
    tokens.forEach((t) => (tf[t] = (tf[t] || 0) + 1));

    // Position boosts: assign higher weight to earlier occurrences
    const positions: Record<string, number[]> = {};
    const rawTokens = text.toLowerCase().split(/\s+/);
    let posIndex = 0;
    for (const t of rawTokens) {
      const normalized = t.replace(/[^a-z0-9@#:\/.\-]/g, '');
      if (!normalized) { posIndex++; continue; }
      const tok = normalized;
      if (!positions[tok]) positions[tok] = [];
      positions[tok].push(posIndex);
      posIndex++;
    }

    const keywordScores: { keyword: string; score: number; positions: number[] }[] = [];
    for (const k of Object.keys(tf)) {
      const base = tf[k];
      const posArr = positions[k] || [];
      // position boost: earlier average position -> higher boost
      const avgPos = posArr.length ? posArr.reduce((a,b)=>a+b,0)/posArr.length : 9999;
      const posBoost = 1 + Math.max(0, (100 - avgPos) / 100);
      const score = base * posBoost;
      keywordScores.push({ keyword: k, score, positions: posArr });
    }

    // Entities extraction and ensure included
    const entities = extractEntities(text);
    for (const ent of entities) {
      keywordScores.push({ keyword: ent.value.toLowerCase(), score: 1000, positions: ent.positions });
    }

    // Sort and pick top N
    keywordScores.sort((a,b) => b.score - a.score);
    const TOP_N = 15;
    const selected = keywordScores.slice(0, TOP_N);

    const now = Date.now();

    // Remove existing keywords for job
    await db.runAsync(`DELETE FROM keyword_stage_results WHERE job_id = ?`, [job.id]);

    // Insert keywords
    for (const kw of selected) {
      const id = `${job.id}_kw_${kw.keyword.slice(0,40).replace(/\s+/g,'_')}`;
      await db.runAsync(
        `INSERT INTO keyword_stage_results (id, job_id, keyword, type, score, positions_json, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, job.id, kw.keyword, entities.find(e=>e.value.toLowerCase()===kw.keyword)?.type || 'term', kw.score, JSON.stringify(kw.positions), now, now],
      );
    }

    return { status: 'completed' };
  } catch (error) {
    return { status: 'failed', error: error instanceof Error ? error.message : 'Keywords error' };
  }
}
