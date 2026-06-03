/* Job Journal background task runner
 * - Defines a short-lived background task that claims and executes a small number
 *   of stage executions per invocation to respect OS background time budgets.
 * - Optimized Sequential Flow: Processes one task at a time to minimize memory 
 *   pressure and native resource contention (best for ML Kit & ExecuTorch).
 * - High Throughput: Tight loop with zero downtime between tasks.
 */
import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import { runNextStageExecution } from './05-runner';

const JOB_JOURNAL_TASK_NAME = 'JOB_JOURNAL_RUNNER_TASK';

/**
 * Process loop for a single background invocation. 
 * Drains the queue sequentially to avoid native resource contention.
 */
async function processOnce(maxIterations = 32) {
  let processed = 0;
  
  for (let i = 0; i < maxIterations; i++) {
    try {
      // runNextStageExecution is model-aware and prioritized.
      // It returns true if it performed work, false if nothing was available.
      const didWork = await runNextStageExecution();
      
      if (!didWork) {
        break; // Queue is empty or blocked
      }
      
      processed++;
    } catch (err) {
      console.error('[backgroundTasks] Task execution error:', err);
      // Continue to next iteration for robustness unless a fatal error occurs
    }
  }

  return processed;
}

// Define task at top level for reliable registration
try {
  TaskManager.defineTask(JOB_JOURNAL_TASK_NAME, async () => {
    try {
      console.log('[backgroundTasks] Starting background processing cycle...');
      const count = await processOnce(16); // Lower limit for background to avoid OS termination
      console.log(`[backgroundTasks] Background cycle finished. Processed ${count} tasks.`);
      return BackgroundTask.BackgroundTaskResult.Success;
    } catch (err) {
      console.error('JobJournal background task failed:', err);
      return BackgroundTask.BackgroundTaskResult.Failed;
    }
  });
} catch (err) {
  console.warn('Failed to define JobJournal background task:', err);
}

export async function registerJobJournalBackgroundTask() {
  // defineTask is handled at top level.
}

export async function scheduleJobJournalBackgroundTask(minimumIntervalMinutes = 15) {
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(JOB_JOURNAL_TASK_NAME);
    if (!isRegistered) {
      await BackgroundTask.registerTaskAsync(JOB_JOURNAL_TASK_NAME, {
        minimumInterval: minimumIntervalMinutes,
      });
    }
  } catch (err) {
    console.error('Failed to schedule JobJournal background task:', err);
  }
}

export async function unregisterJobJournalBackgroundTask() {
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(JOB_JOURNAL_TASK_NAME);
    if (isRegistered) {
      await BackgroundTask.unregisterTaskAsync(JOB_JOURNAL_TASK_NAME);
    }
  } catch (err) {
    console.warn('Failed to unregister JobJournal background task:', err);
  }
}

/**
 * Run the runner loop immediately in-process (foreground). 
 * Higher iteration limit for active app sessions.
 */
export async function processJobJournalNow(iterations = 128) {
  return await processOnce(iterations);
}

export { JOB_JOURNAL_TASK_NAME };
