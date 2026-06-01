import { useEffect, useMemo, useState } from 'react';

import { getExecutorStats, getJobJournalDatabase } from '@/features/jobjournal';

type LibrarySummary = {
  screenshots: number;
  pendingStages: number;
  runningStages: number;
  failedStages: number;
};

const EMPTY_SUMMARY: LibrarySummary = {
  screenshots: 0,
  pendingStages: 0,
  runningStages: 0,
  failedStages: 0,
};

export function useLibrarySummary() {
  const [summary, setSummary] = useState<LibrarySummary>(EMPTY_SUMMARY);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setInterval> | null = null;

    async function refresh() {
      const db = await getJobJournalDatabase();
      const [jobs, stats] = await Promise.all([
        db.getFirstAsync<{ count: number }>(`SELECT COUNT(*) as count FROM job_journal_jobs`),
        getExecutorStats(),
      ]);

      if (!active) return;

      setSummary({
        screenshots: jobs?.count ?? 0,
        pendingStages: stats.pending,
        runningStages: stats.running,
        failedStages: stats.failed,
      });
      setLoading(false);
    }

    refresh();
    timer = setInterval(refresh, 5000);

    return () => {
      active = false;
      if (timer) clearInterval(timer);
    };
  }, []);

  return useMemo(() => ({ ...summary, loading }), [loading, summary]);
}
