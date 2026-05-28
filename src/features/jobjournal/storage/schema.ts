export const JOB_JOURNAL_SCHEMA = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS job_journal_jobs (
  id TEXT PRIMARY KEY,
  image_uri TEXT NOT NULL,
  image_hash TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS stage_executions (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES job_journal_jobs(id) ON DELETE CASCADE,
  stage TEXT NOT NULL,
  attempt INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL,
  lease_until INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  last_error TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS stage_executions_job_stage_idx
  ON stage_executions(job_id, stage);

CREATE INDEX IF NOT EXISTS stage_executions_status_created_idx
  ON stage_executions(status, created_at);

CREATE INDEX IF NOT EXISTS stage_executions_running_lease_idx
  ON stage_executions(status, lease_until);

CREATE TABLE IF NOT EXISTS stage_checkpoints (
  job_id TEXT NOT NULL REFERENCES job_journal_jobs(id) ON DELETE CASCADE,
  stage TEXT NOT NULL,
  output_path TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (job_id, stage)
);

CREATE TABLE IF NOT EXISTS metadata_stage_results (
  job_id TEXT PRIMARY KEY REFERENCES job_journal_jobs(id) ON DELETE CASCADE,
  width INTEGER,
  height INTEGER,
  file_size INTEGER,
  file_exists INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS ocr_stage_results (
  job_id TEXT PRIMARY KEY REFERENCES job_journal_jobs(id) ON DELETE CASCADE,
  text TEXT,
  blocks_json TEXT,
  language TEXT,
  confidence REAL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS ocr_postprocess_stage_results (
  job_id TEXT PRIMARY KEY REFERENCES job_journal_jobs(id) ON DELETE CASCADE,
  text TEXT,
  blocks_json TEXT,
  language TEXT,
  block_count INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS embedding_stage_results (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES job_journal_jobs(id) ON DELETE CASCADE,
  modality TEXT NOT NULL,
  vector BLOB NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS embedding_stage_results_job_modality_idx
  ON embedding_stage_results(job_id, modality);

CREATE TABLE IF NOT EXISTS keyword_stage_results (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES job_journal_jobs(id) ON DELETE CASCADE,
  keyword TEXT NOT NULL,
  type TEXT NOT NULL,
  score REAL NOT NULL,
  positions_json TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS keyword_stage_results_job_keyword_idx
  ON keyword_stage_results(job_id, keyword);

CREATE TABLE IF NOT EXISTS search_readiness (
  job_id TEXT PRIMARY KEY REFERENCES job_journal_jobs(id) ON DELETE CASCADE,
  fts_ready INTEGER NOT NULL DEFAULT 0,
  vector_ready INTEGER NOT NULL DEFAULT 0,
  keywords_ready INTEGER NOT NULL DEFAULT 0,
  indexed_at INTEGER,
  updated_at INTEGER NOT NULL
);

CREATE VIRTUAL TABLE IF NOT EXISTS screenshot_search_index USING fts5(
  job_id UNINDEXED,
  ocr_text,
  keywords
);
`;

export const JOB_JOURNAL_VEC_SCHEMA = `
CREATE VIRTUAL TABLE IF NOT EXISTS image_embedding_index USING vec0(
  embedding float[768],
  job_id text
);
`;
