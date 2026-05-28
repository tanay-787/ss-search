/* Model-ready monitor for job journal
 * - Subscribes to pipeline model state changes and triggers retryWaitingForModelExecutions()
 *   when the SigLIP model becomes ready (primary, immediate unstick).
 * - Debounces retries to avoid thrash and includes a startup safety: ensureReady() + retry
 *   to handle cases where model became ready while app was down.
 * - Keeps lifecycle control to the caller: initModelMonitor() returns an unsubscribe teardown
 *   so the app can wire and unwind the monitor where appropriate.
 */
import type { SiglipModelState } from './types';
import { subscribe as subscribeModel, ensureReady, getStatus } from './modelManager';
import { retryWaitingForModelExecutions } from './03-executor';

let timer: ReturnType<typeof setTimeout> | null = null;
const DEBOUNCE_MS = 2000;

function scheduleRetry() {
  if (timer) {
    clearTimeout(timer as any);
  }
  timer = setTimeout(async () => {
    try {
      await retryWaitingForModelExecutions();
    } catch {
      // swallow - retry can be triggered again
      // console.warn('retryWaitingForModelExecutions failed', err);
    } finally {
      timer = null;
    }
  }, DEBOUNCE_MS);
}

/**
 * Start the model-ready monitor.
 * Returns a teardown function to unsubscribe.
 */
export function initModelMonitor() {
  // Subscribe to model state changes and trigger retry when ready
  const unsubscribe = subscribeModel((state: SiglipModelState) => {
    if (state.status === 'ready') {
      scheduleRetry();
    }
  });

  // Startup safety: ensure model is ready (downloads if needed) and then retry waiting executions
  (async () => {
    try {
      await ensureReady();
      // If model is already ready, trigger immediate retry
      const st = getStatus();
      if (st.status === 'ready') {
        scheduleRetry();
      }
    } catch {
      // ignore - subscription will catch ready state later
    }
  })();

  return () => {
    if (timer) clearTimeout(timer as any);
    unsubscribe();
  };
}
