import { useMemo } from 'react';
import { useJobJournalContext } from './providers/JobJournalProvider';

export function useJobJournalOperations() {
  const { 
    sync, 
    process, 
    isSyncing, 
    isProcessing, 
    lastError,
    lastErrorCode 
  } = useJobJournalContext();

  return useMemo(() => ({
    sync,
    process,
    isSyncing,
    isProcessing,
    lastError,
    lastErrorCode
  }), [sync, process, isSyncing, isProcessing, lastError, lastErrorCode]);
}
