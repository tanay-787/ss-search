import { useMemo } from 'react';
import { useJobJournalContext } from './providers/JobJournalProvider';

export function useJobJournalStats() {
  const { stats, loading } = useJobJournalContext();
  
  return useMemo(() => ({
    ...stats,
    loading
  }), [stats, loading]);
}
