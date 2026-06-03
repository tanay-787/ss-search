import { generateTextEmbedding } from '../embeddings';
import { getJobJournalDatabase } from '../storage/database';

export interface SearchResult {
  jobId: string;
  uri: string;
  ocrText: string;
  keywords: string[];
  score: number;
  searchMethod: 'fts' | 'embedding' | 'hybrid';
}

export async function hybridSearch(
  query: string,
  limit: number = 20,
  useEmbeddings: boolean = true,
): Promise<SearchResult[]> {
  const db = await getJobJournalDatabase();
  const candidates = new Map<string, SearchResult>();

  const sanitizedQuery = query.trim();
  if (!sanitizedQuery) return [];

  // 1. Semantic Search (Vector)
  if (useEmbeddings) {
    try {
      console.log(`[hybridSearch] Attempting vector search for: "${sanitizedQuery}"`);
      const queryEmbedding = await generateTextEmbedding(sanitizedQuery);
      const embeddingJson = JSON.stringify(Array.from(queryEmbedding));

      const vectorResults = await db.getAllAsync<{
        job_id: string;
        distance: number;
        uri: string;
        ocrText: string;
      }>(`
        SELECT 
          v.job_id,
          vec_distance(v.embedding, ?) as distance,
          j.image_uri as uri,
          o.text as ocrText
        FROM image_embedding_index v
        JOIN job_journal_jobs j ON j.id = v.job_id
        LEFT JOIN ocr_postprocess_stage_results o ON o.job_id = v.job_id
        WHERE vec_distance(v.embedding, ?) < 0.7
        ORDER BY distance ASC
        LIMIT ?
      `, [embeddingJson, embeddingJson, limit]);

      vectorResults.forEach((row) => {
        candidates.set(row.job_id, {
          jobId: row.job_id,
          uri: row.uri,
          ocrText: row.ocrText || '',
          keywords: [], 
          score: 1 - row.distance,
          searchMethod: 'embedding',
        });
      });
      console.log(`[hybridSearch] Vector search returned ${vectorResults.length} candidates`);
    } catch (err) {
      console.warn('[hybridSearch] Vector search failed:', err instanceof Error ? err.message : String(err));
    }
  }
// 2. Keyword/Text Search (FTS5)
// Layer A: Standard Word-based Prefix Matching
const tokens = sanitizedQuery.replace(/[^\w\s]/g, ' ').trim().split(/\s+/).filter(Boolean);

if (tokens.length > 0) {
  const ftsQuery = tokens.map(t => `${t}*`).join(' AND ');
  console.log(`[hybridSearch] Attempting standard FTS search with: "${ftsQuery}"`);

  try {
    const ftsResults = await db.getAllAsync<{
      job_id: string;
      ocr_text: string;
      keywords: string;
      uri: string;
    }>(`
      SELECT 
        idx.job_id,
        idx.ocr_text,
        idx.keywords,
        j.image_uri as uri
      FROM screenshot_search_index idx
      JOIN job_journal_jobs j ON j.id = idx.job_id
      WHERE screenshot_search_index MATCH ?
      ORDER BY rank
      LIMIT ?
    `, [ftsQuery, limit]);

    ftsResults.forEach((row) => {
      const existing = candidates.get(row.job_id);
      if (existing) {
        existing.score = Math.min(1.0, existing.score + 0.3);
        existing.searchMethod = 'hybrid';
      } else {
        candidates.set(row.job_id, {
          jobId: row.job_id,
          uri: row.uri,
          ocrText: row.ocr_text || '',
          keywords: row.keywords ? row.keywords.split(' ') : [],
          score: 0.9, // High base score for exact word prefix match
          searchMethod: 'fts',
        });
      }
    });
    console.log(`[hybridSearch] Standard FTS returned ${ftsResults.length} matches`);
  } catch (err) {
    console.warn('[hybridSearch] Standard FTS search failed:', err);
  }

  // Layer B: Trigram-based Fuzzy/Substring Matching
  // Only run if we don't have enough results or as a complementary layer
  if (candidates.size < limit) {
    const trigramQuery = `"${sanitizedQuery}"`;
    console.log(`[hybridSearch] Attempting Trigram fuzzy search with: ${trigramQuery}`);

    try {
      const triResults = await db.getAllAsync<{
        job_id: string;
        ocr_text: string;
        keywords: string;
        uri: string;
      }>(`
        SELECT 
          idx.job_id,
          idx.ocr_text,
          idx.keywords,
          j.image_uri as uri
        FROM screenshot_search_trigram idx
        JOIN job_journal_jobs j ON j.id = idx.job_id
        WHERE screenshot_search_trigram MATCH ?
        ORDER BY rank
        LIMIT ?
      `, [trigramQuery, limit]);

      triResults.forEach((row) => {
        const existing = candidates.get(row.job_id);
        if (existing) {
          existing.score = Math.min(1.0, existing.score + 0.1);
        } else {
          candidates.set(row.job_id, {
            jobId: row.job_id,
            uri: row.uri,
            ocrText: row.ocr_text || '',
            keywords: row.keywords ? row.keywords.split(' ') : [],
            score: 0.7, // Lower base score for fuzzy trigram match
            searchMethod: 'fts', // Categorized as text search
          });
        }
      });
      console.log(`[hybridSearch] Trigram search returned ${triResults.length} matches`);
    } catch (err) {
      console.warn('[hybridSearch] Trigram search failed:', err);
    }
  }
}

  const finalResults = Array.from(candidates.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
    
  if (finalResults.length === 0) {
    const count = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM screenshot_search_index');
    console.log(`[hybridSearch] No results found for query: "${sanitizedQuery}". Index contains ${count?.count ?? 0} total documents.`);
  }

  return finalResults;
}
