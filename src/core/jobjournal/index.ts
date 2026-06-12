export {
  loadJobJournalScreenshotSource,
  watchJobJournalScreenshotSource
} from './01-source';
export {
  ingestJobJournalScreenshots, syncJobJournalScreenshots,
  watchJobJournalIntake, type JobJournalIntakeResult
} from './02-intake';

export {
  getExecutorStats, runNextStageExecution
} from './05-runner';
export {
  registerJobJournalBackgroundTask,
  scheduleJobJournalBackgroundTask,
  unregisterJobJournalBackgroundTask
} from './06-backgroundTasks';
export { runKeywordsStage } from './stages/05-keywords.stage';
export { getJobJournalDatabase, getJobJournalVecStatus, initializeJobJournalDatabase } from './storage/database';
export { JOB_JOURNAL_SCHEMA, JOB_JOURNAL_VEC_SCHEMA } from './storage/schema';

export type {
  JobJournalJob,
  JobJournalStage,
  JobJournalStageExecution,
  JobJournalStatus,
} from './types';

export { parseStageLastError } from './utils/error';
