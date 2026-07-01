import { sql } from 'drizzle-orm';
import { getDrizzleDb } from '../storage/database';
import { canonicalize } from '../stages/03-ocr_postprocess.stage';

export interface SearchResult {
  jobId: string;
  uri: string;
  ocrText: string;
  keywords: string[];
  score: number;
  searchMethod: 'fts' | 'hybrid';
  width: number;
  height: number;
  aspectRatio: number;
  isLandscape: boolean;
}

/**
 * Query-Conditioned Scorer
 * Calculates how well a result "explains" the query tokens relative to the query context.
 * Importance is dynamic: a word is important ONLY if it matches the query.
 */
function calculateQueryScore(queryTokens: string[], docText: string, docKeywords: string[]): number {
  if (queryTokens.length === 0) return 0;
  
  let matches = 0;
  const canonDoc = canonicalize(docText);
  // Keywords already contains expanded and canonicalized tokens from Stage 5
  const canonKeywords = docKeywords.map(k => canonicalize(k));

  for (const token of queryTokens) {
    const canonToken = canonicalize(token);
    
    // Priority 1: Exact or Expanded Keyword Match (High Signal Identity)
    // This catches "Infy" in "ARGxInfyy" because Stage 5 expanded it.
    if (canonKeywords.includes(canonToken)) {
      matches += 1.0;
    } 
    // Priority 2: Substring Match in Raw Text (Lower Signal)
    else if (canonDoc.includes(canonToken)) {
      matches += 0.5;
    }
  }

  // Score is the ratio of query tokens "explained" by the document
  return matches / queryTokens.length;
}

export async function hybridSearch(
  query: string,
  limit: number = 20,
): Promise<SearchResult[]> {
  const db = await getDrizzleDb();
  const candidates = new Map<string, SearchResult>();

  const sanitizedQuery = query.trim();
  if (!sanitizedQuery) return [];

  const queryTokens = sanitizedQuery.split(/\s+/).filter(Boolean);
  const canonQuery = canonicalize(sanitizedQuery);

  // 1. Keyword/Text Search (FTS5) - BROAD RETRIEVAL + DYNAMIC RERANKING
  if (queryTokens.length > 0) {
    // Permissive broad retrieval: OR logic to get anything potentially related
    const ftsQuery = queryTokens.map(t => `${t}*`).join(' OR '); 
    const trigramQuery = canonQuery.replace(/[^\w]/g, ' ').trim();

    try {
      console.log(`[hybridSearch] Broad retrieval with FTS ("${ftsQuery}") and Trigram ("${trigramQuery}")`);
      
      const rawMatches = await db.all(sql`
        SELECT 
          idx.job_id,
          o.text as cleaned_ocr_text,
          idx.keywords,
          j.image_uri as uri,
          m.width,
          m.height
        FROM screenshot_search_index idx
        JOIN job_journal_jobs j ON j.id = idx.job_id
        LEFT JOIN metadata_stage_results m ON m.job_id = idx.job_id
        LEFT JOIN ocr_postprocess_stage_results o ON o.job_id = idx.job_id
        WHERE screenshot_search_index MATCH ${ftsQuery}
        UNION
        SELECT 
          tri.job_id,
          o.text as cleaned_ocr_text,
          tri.keywords,
          j.image_uri as uri,
          m.width,
          m.height
        FROM screenshot_search_trigram tri
        JOIN job_journal_jobs j ON j.id = tri.job_id
        LEFT JOIN metadata_stage_results m ON m.job_id = tri.job_id
        LEFT JOIN ocr_postprocess_stage_results o ON o.job_id = tri.job_id
        WHERE screenshot_search_trigram MATCH ${trigramQuery}
        LIMIT 100
      `);

      console.log(`[hybridSearch] Broad retrieval found ${rawMatches.length} raw candidates. Reranking...`);

      rawMatches.forEach((row: any) => {
        const docKeywords = row.keywords ? row.keywords.split(' ') : [];
        const relevanceScore = calculateQueryScore(queryTokens, row.cleaned_ocr_text || '', docKeywords);
        
        if (relevanceScore > 0) {
          const w = row.width || 1;
          const h = row.height || 1;
          const aspect = w / h;
          candidates.set(row.job_id, {
            jobId: row.job_id,
            uri: row.uri,
            ocrText: row.cleaned_ocr_text || '',
            keywords: docKeywords,
            score: relevanceScore,
            searchMethod: 'fts',
            width: w,
            height: h,
            aspectRatio: aspect,
            isLandscape: aspect > 1,
          });
        }
      });
    } catch (err) {
      console.warn('[hybridSearch] FTS broad retrieval/reranking failed:', err);
    }
  }

  const finalResults = Array.from(candidates.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
    
  if (finalResults.length === 0) {
    const countResult = await db.all(sql`SELECT count(*) as count FROM screenshot_search_index`) as { count: number }[];
    console.log(`[hybridSearch] No results found for query: "${sanitizedQuery}". Index contains ${countResult[0]?.count ?? 0} total documents.`);
  }

  return finalResults;
}
