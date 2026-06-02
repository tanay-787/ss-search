import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { 
  getExecutorStats, 
  getJobJournalDatabase, 
  getStatus as getModelStatus, 
  subscribe as subscribeModel,
  ensureReady as ensureModelReady,
  ensureTextReady as ensureModelTextReady,
  unload as unloadModel,
  initModelMonitor,
  ingestJobJournalScreenshots,
  processJobJournalNow,
  type JobJournalStatus,
  type SiglipModelState,
  type JobJournalIntakeResult,
  type JobJournalErrorCode
} from '@/features/jobjournal';

interface JobJournalStats {
  pending: number;
  running: number;
  completed: number;
  failed: number;
  waitingForModel: number;
  totalJobs: number;
}

interface JobJournalState {
  stats: JobJournalStats;
  model: SiglipModelState;
  isSyncing: boolean;
  isProcessing: boolean;
  loading: boolean;
  lastError: string | null;
  lastErrorCode: JobJournalErrorCode | null;
}

interface JobJournalContextValue extends JobJournalState {
  sync: (options?: { vectorRequired?: boolean }) => Promise<JobJournalIntakeResult | null>;
  process: (iterations?: number) => Promise<number>;
  ensureModelReady: () => Promise<void>;
  ensureModelTextReady: () => Promise<void>;
  unloadModel: () => void;
}

const JobJournalContext = createContext<JobJournalContextValue | null>(null);

const DEFAULT_STATS: JobJournalStats = {
  pending: 0,
  running: 0,
  completed: 0,
  failed: 0,
  waitingForModel: 0,
  totalJobs: 0,
};

export function JobJournalProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<JobJournalState>({
    stats: DEFAULT_STATS,
    model: getModelStatus(),
    isSyncing: false,
    isProcessing: false,
    loading: true,
    lastError: null,
    lastErrorCode: null,
  });

  const isMounted = useRef(true);

  const refreshStats = useCallback(async () => {
    try {
      const db = await getJobJournalDatabase();
      const [executorStats, jobsCount] = await Promise.all([
        getExecutorStats(),
        db.getFirstAsync<{ count: number }>(`SELECT COUNT(*) as count FROM job_journal_jobs`),
      ]);

      if (!isMounted.current) return;

      setState(prev => ({
        ...prev,
        stats: {
          ...executorStats,
          totalJobs: jobsCount?.count ?? 0,
        },
        loading: false,
      }));
    } catch (error) {
      console.error('[JobJournalProvider] Failed to refresh stats:', error);
    }
  }, []);

  const sync = useCallback(async (options?: { vectorRequired?: boolean }) => {
    if (state.isSyncing) return null;
    
    setState(prev => ({ ...prev, isSyncing: true, lastError: null, lastErrorCode: null }));
    try {
      const result = await ingestJobJournalScreenshots(undefined, options);
      await refreshStats();
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Sync failed';
      setState(prev => ({ ...prev, lastError: message, lastErrorCode: 'IO_ERROR' }));
      console.error('[JobJournalProvider] Sync error:', error);
      return null;
    } finally {
      if (isMounted.current) {
        setState(prev => ({ ...prev, isSyncing: false }));
      }
    }
  }, [state.isSyncing, refreshStats]);

  const process = useCallback(async (iterations = 8) => {
    if (state.isProcessing) return 0;

    setState(prev => ({ ...prev, isProcessing: true, lastError: null, lastErrorCode: null }));
    try {
      const processed = await processJobJournalNow(iterations);
      await refreshStats();
      return processed;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Processing failed';
      setState(prev => ({ ...prev, lastError: message, lastErrorCode: 'UNKNOWN' }));
      console.error('[JobJournalProvider] Processing error:', error);
      return 0;
    } finally {
      if (isMounted.current) {
        setState(prev => ({ ...prev, isProcessing: false }));
      }
    }
  }, [state.isProcessing, refreshStats]);

  useEffect(() => {
    isMounted.current = true;
    
    // Initial load
    refreshStats();

    // Poll stats
    const statsInterval = setInterval(refreshStats, 5000);

    // Subscribe to model state
    const unsubscribeModel = subscribeModel((modelState) => {
      if (isMounted.current) {
        setState(prev => ({ ...prev, model: modelState }));
      }
    });

    // Initialize model monitor (handles retries when model becomes ready)
    const unsubscribeMonitor = initModelMonitor();

    return () => {
      isMounted.current = false;
      clearInterval(statsInterval);
      unsubscribeModel();
      unsubscribeMonitor();
    };
  }, [refreshStats]);

  const value: JobJournalContextValue = {
    ...state,
    sync,
    process,
    ensureModelReady,
    ensureModelTextReady,
    unloadModel,
  };

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
