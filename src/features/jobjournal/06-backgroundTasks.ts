/* Job Journal background task runner
 * - Defines a short-lived background task that claims and executes a small number
 *   of stage executions per invocation to respect OS background time budgets.
 * - Limits work per invocation via processOnce(maxIterations) to avoid overruns.
 * - Use registerJobJournalBackgroundTask() to define the TaskManager task,
 *   scheduleJobJournalBackgroundTask() to register with the OS, and
 *   processJobJournalNow() for immediate foreground debugging.
 * - This module intentionally does NOT auto-wire into app startup; callers decide
 *   when to register/schedule to avoid coupling with other features.
 */
import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import { runNextStageExecution } from './05-runner';

const JOB_JOURNAL_TASK_NAME = 'JOB_JOURNAL_RUNNER_TASK';

/**
 * Process loop for a single background invocation. Limits work to avoid overrunning OS budget.
 */
async function processOnce(maxIterations = 8) {
  let processed = 0;
  for (let i = 0; i < maxIterations; i++) {
    try {
      const didWork = await runNextStageExecution();
      if (!didWork) break;
      processed++;
    } catch (err) {
      // Swallow and continue a small number of times; task invocation will be retried by OS
      console.error('job-journal runner error', err);
      break;
    }
  }
  return processed;
}

export async function registerJobJournalBackgroundTask() {
  try {
    await TaskManager.defineTask(JOB_JOURNAL_TASK_NAME, async () => {
      try {
        await processOnce();
        return BackgroundTask.BackgroundTaskResult.Success;
      } catch (err) {
        console.error('JobJournal background task failed:', err);
        return BackgroundTask.BackgroundTaskResult.Failed;
      }
    });
  } catch {
    // defineTask may throw if already defined — ignore
  }
}

export async function scheduleJobJournalBackgroundTask(minimumIntervalMinutes = 15) {
  try {
    await BackgroundTask.registerTaskAsync(JOB_JOURNAL_TASK_NAME, {
      minimumInterval: minimumIntervalMinutes,
    });
  } catch (err) {
    console.error('Failed to schedule JobJournal background task:', err);
  }
}

export async function unregisterJobJournalBackgroundTask() {
  try {
    await BackgroundTask.unregisterTaskAsync(JOB_JOURNAL_TASK_NAME);
  } catch (err) {
    console.warn('Failed to unregister JobJournal background task:', err);
  }
}

/**
 * Run the runner loop immediately in-process (foreground). Useful for debugging.
 */
export async function processJobJournalNow(iterations = 64) {
  let total = 0;
  for (let i = 0; i < iterations; i++) {
    const didWork = await runNextStageExecution();
    if (!didWork) break;
    total++;
  }
  return total;
}

export { JOB_JOURNAL_TASK_NAME };
