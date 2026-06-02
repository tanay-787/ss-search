import { useMemo } from 'react';
import { useJobJournalContext } from './providers/JobJournalProvider';

export function useJobJournalModel() {
  const { 
    model, 
    ensureModelReady, 
    ensureModelTextReady, 
    unloadModel 
  } = useJobJournalContext();

  const isReady = useMemo(() => model.status === 'ready', [model.status]);

  return useMemo(() => ({
    status: model.status,
    progress: model.progress,
    error: model.error,
    isReady,
    ensureReady: ensureModelReady,
    ensureTextReady: ensureModelTextReady,
    unload: unloadModel,
  }), [model, isReady, ensureModelReady, ensureModelTextReady, unloadModel]);
}
