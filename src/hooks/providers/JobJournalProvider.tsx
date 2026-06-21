import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { AppState } from 'react-native';
import { 
  getExecutorStats, 
  getJobJournalDatabase,
  ingestJobJournalScreenshots,
  resetFailedExecutions,
} from '@/core/jobjournal';
import { processUntilEmpty } from '@/core/jobjournal/06-backgroundTasks';
import { JobJournalErrorCode } from '@/core/jobjournal/types';

interface JobJournalStats {
  pending: number;
  running: number;
  completed: number;
  failed: number;
  totalJobs: number;
}

interface JobJournalState {
  stats: JobJournalStats;
  isSyncing: boolean;
  isProcessing: boolean;
  loading: boolean;
  lastError: string | null;
  lastErrorCode: JobJournalErrorCode | null;
}

interface JobJournalContextValue extends JobJournalState {
  sync: () => Promise<any | null>;
  process: (iterations?: number) => Promise<number>;
  retryFailed: () => Promise<number>;
}

const JobJournalContext = createContext<JobJournalContextValue | null>(null);

const DEFAULT_STATS: JobJournalStats = {
  pending: 0,
  running: 0,
  completed: 0,
  failed: 0,
  totalJobs: 0,
};

export function JobJournalProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<JobJournalState>({
    stats: DEFAULT_STATS,
    isSyncing: false,
    isProcessing: false,
    loading: true,
    lastError: null,
    lastErrorCode: null,
  });

  const isMounted = useRef(true);
  const syncLock = useRef(false);
  const engineLock = useRef(false);
  const appState = useRef(AppState.currentState);

  const refreshStats = useCallback(async () => {
    try {
      const db = await getJobJournalDatabase();
      const [rows, jobsCount] = await Promise.all([
        db.getAllAsync<{ status: string; count: number }>(
          `SELECT status, COUNT(*) as count FROM job_journal_jobs GROUP BY status`
        ),
        db.getFirstAsync<{ count: number }>(`SELECT COUNT(*) as count FROM job_journal_jobs`),
      ]);

      if (!isMounted.current) return;

      const stats = {
        pending: 0,
        running: 0,
        completed: 0,
        failed: 0,
        totalJobs: jobsCount?.count ?? 0,
      };

      for (const row of rows) {
        if (row.status === 'pending') stats.pending = row.count;
        else if (row.status === 'running') stats.running = row.count;
        else if (row.status === 'completed') stats.completed = row.count;
        else if (row.status === 'failed') stats.failed = row.count;
      }

      setState(prev => ({
        ...prev,
        stats,
        loading: false,
      }));
    } catch (error) {
      console.error('[JobJournalProvider] Failed to refresh stats:', error);
    }
  }, []);

  /**
   * Autonomous Workflow Engine
   * Watches for pending work and triggers high-speed processing in foreground.
   */
  const runEngine = useCallback(async () => {
    if (engineLock.current || appState.current !== 'active') return;
    
    // Only wake up if there is actually pending work
    const stats = await getExecutorStats();
    if (stats.pending === 0) return;

    engineLock.current = true;
    setState(prev => ({ ...prev, isProcessing: true }));
    
    try {
      console.log(`[JobJournalEngine] Waking up. Found ${stats.pending} pending tasks.`);
      await processUntilEmpty(1000, 10); 
      await refreshStats();
    } catch (err) {
      console.error('[JobJournalEngine] Loop error:', err);
    } finally {
      engineLock.current = false;
      if (isMounted.current) {
        setState(prev => ({ ...prev, isProcessing: false }));
      }
    }
  }, [refreshStats]);

  const sync = useCallback(async () => {
    if (syncLock.current) return null;
    
    syncLock.current = true;
    setState(prev => ({ ...prev, isSyncing: true, lastError: null, lastErrorCode: null }));
    
    try {
      const result = await ingestJobJournalScreenshots();
      await refreshStats();
      // Inform the engine that new work might be available
      void runEngine();
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Sync failed';
      setState(prev => ({ ...prev, lastError: message, lastErrorCode: 'IO_ERROR' }));
      console.error('[JobJournalProvider] Sync error:', error);
      return null;
    } finally {
      syncLock.current = false;
      if (isMounted.current) {
        setState(prev => ({ ...prev, isSyncing: false }));
      }
    }
  }, [refreshStats, runEngine]);

  const processManually = useCallback(async (iterations = 8) => {
    // Standard process call for manual UI triggers
    if (engineLock.current) return 0;
    engineLock.current = true;
    setState(prev => ({ ...prev, isProcessing: true }));
    try {
      const processed = await processUntilEmpty(iterations, 10);
      await refreshStats();
      return processed;
    } finally {
      engineLock.current = false;
      if (isMounted.current) {
        setState(prev => ({ ...prev, isProcessing: false }));
      }
    }
  }, [refreshStats]);

  const retryFailed = useCallback(async () => {
    setState(prev => ({ ...prev, lastError: null, lastErrorCode: null }));
    try {
      const resetCount = await resetFailedExecutions();
      await refreshStats();
      // Inform the engine that new work might be available
      void runEngine();
      return resetCount;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Retry failed';
      setState(prev => ({ ...prev, lastError: message, lastErrorCode: 'IO_ERROR' }));
      console.error('[JobJournalProvider] Retry error:', error);
      return 0;
    }
  }, [refreshStats, runEngine]);

  useEffect(() => {
    isMounted.current = true;
    
    // 1. Initial Load & Engine Start
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refreshStats().then(() => {
      void runEngine();
    });

    // 2. Poll stats for eventual consistency
    const statsInterval = setInterval(refreshStats, 5000);

    // 3. AppState Awareness: Stop/Start engine on foreground/background
    const appStateSub = AppState.addEventListener('change', (nextStatus) => {
      appState.current = nextStatus;
      if (nextStatus === 'active') {
        void runEngine();
      }
    });

    return () => {
      isMounted.current = false;
      clearInterval(statsInterval);
      appStateSub.remove();
    };
  }, [refreshStats, runEngine]);

  const value = React.useMemo<JobJournalContextValue>(() => ({
    ...state,
    sync,
    process: processManually,
    retryFailed,
  }), [state, sync, processManually, retryFailed]);

  return (
    <JobJournalContext.Provider value={value}>
      {children}
    </JobJournalContext.Provider>
  );
}

export function useJobJournalContext() {
  const context = useContext(JobJournalContext);
  if (!context) {
    throw new Error('useJobJournalContext must be used within a JobJournalProvider');
  }
  return context;
}
