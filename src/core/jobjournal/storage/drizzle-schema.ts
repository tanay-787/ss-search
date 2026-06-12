import { sqliteTable, text, integer, real, blob, uniqueIndex, index, primaryKey } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';

export const jobJournalJobs = sqliteTable('job_journal_jobs', {
  id: text('id').primaryKey(),
  imageUri: text('image_uri').notNull(),
  imageHash: text('image_hash').notNull().unique(),
  status: text('status').notNull(), // pending, running, completed, failed
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const stageExecutions = sqliteTable('stage_executions', {
  id: text('id').primaryKey(),
  jobId: text('job_id').notNull().references(() => jobJournalJobs.id, { onDelete: 'cascade' }),
  stage: text('stage').notNull(),
  attempt: integer('attempt').notNull().default(0),
  status: text('status').notNull(), // pending, running, completed, failed
  leaseUntil: integer('lease_until', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  lastError: text('last_error'),
  lastErrorCode: text('last_error_code'),
  lastErrorMessage: text('last_error_message'),
}, (table) => ({
  jobStageIdx: uniqueIndex('stage_executions_job_stage_idx').on(table.jobId, table.stage),
  statusCreatedIdx: index('stage_executions_status_created_idx').on(table.status, table.createdAt),
  runningLeaseIdx: index('stage_executions_running_lease_idx').on(table.status, table.leaseUntil),
}));

export const stageCheckpoints = sqliteTable('stage_checkpoints', {
  jobId: text('job_id').notNull().references(() => jobJournalJobs.id, { onDelete: 'cascade' }),
  stage: text('stage').notNull(),
  outputPath: text('output_path'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.jobId, table.stage] }),
}));

export const metadataStageResults = sqliteTable('metadata_stage_results', {
  jobId: text('job_id').primaryKey().references(() => jobJournalJobs.id, { onDelete: 'cascade' }),
  width: integer('width'),
  height: integer('height'),
  fileSize: integer('file_size'),
  fileExists: integer('file_exists', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const ocrStageResults = sqliteTable('ocr_stage_results', {
  jobId: text('job_id').primaryKey().references(() => jobJournalJobs.id, { onDelete: 'cascade' }),
  text: text('text'),
  blocksJson: text('blocks_json'),
  language: text('language'),
  confidence: real('confidence'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const ocrPostprocessStageResults = sqliteTable('ocr_postprocess_stage_results', {
  jobId: text('job_id').primaryKey().references(() => jobJournalJobs.id, { onDelete: 'cascade' }),
  text: text('text'),
  canonicalText: text('canonical_text'),
  blocksJson: text('blocks_json'),
  language: text('language'),
  blockCount: integer('block_count'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const keywordStageResults = sqliteTable('keyword_stage_results', {
  id: text('id').primaryKey(),
  jobId: text('job_id').notNull().references(() => jobJournalJobs.id, { onDelete: 'cascade' }),
  keyword: text('keyword').notNull(),
  type: text('type').notNull(),
  score: real('score').notNull(),
  positionsJson: text('positions_json'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
}, (table) => ({
  jobKeywordIdx: uniqueIndex('keyword_stage_results_job_keyword_idx').on(table.jobId, table.keyword),
}));

export const searchReadiness = sqliteTable('search_readiness', {
  jobId: text('job_id').primaryKey().references(() => jobJournalJobs.id, { onDelete: 'cascade' }),
  ftsReady: integer('fts_ready', { mode: 'boolean' }).notNull().default(false),
  keywordsReady: integer('keywords_ready', { mode: 'boolean' }).notNull().default(false),
  indexedAt: integer('indexed_at', { mode: 'timestamp' }),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

// Relationships
export const jobsRelations = relations(jobJournalJobs, ({ many, one }) => ({
  executions: many(stageExecutions),
  checkpoints: many(stageCheckpoints),
  metadata: one(metadataStageResults, {
    fields: [jobJournalJobs.id],
    references: [metadataStageResults.jobId],
  }),
  ocr: one(ocrStageResults, {
    fields: [jobJournalJobs.id],
    references: [ocrStageResults.jobId],
  }),
  ocrPostprocess: one(ocrPostprocessStageResults, {
    fields: [jobJournalJobs.id],
    references: [ocrPostprocessStageResults.jobId],
  }),
  keywords: many(keywordStageResults),
  readiness: one(searchReadiness, {
    fields: [jobJournalJobs.id],
    references: [searchReadiness.jobId],
  }),
}));
