import { useMemo } from 'react';
import { useJobJournalStats } from '@/lib/hooks';

export function useLibrarySummary() {
  const { totalJobs, pending, running, failed, loading } = useJobJournalStats();

  return useMemo(() => ({
    screenshots: totalJobs,
    pendingStages: pending,
    runningStages: running,
    failedStages: failed,
    loading
  }), [totalJobs, pending, running, failed, loading]);
}
