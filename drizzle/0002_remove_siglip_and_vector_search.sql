DROP TABLE `embedding_stage_results`;--> statement-breakpoint
ALTER TABLE `job_journal_jobs` DROP COLUMN `vector_required`;--> statement-breakpoint
ALTER TABLE `search_readiness` DROP COLUMN `vector_ready`;