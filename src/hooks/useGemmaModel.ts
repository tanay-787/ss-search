import { useMemo } from 'react';
import { GEMMA_3N_E2B_IT_INT4, getRecommendedBackend, useModel } from 'react-native-litert-lm';

export function useGemmaModel() {
  // Choose recommended backend (prefers 'gpu' when available)
  const recommended = getRecommendedBackend();
  const backend = useMemo(() => recommended ?? 'gpu', [recommended]);

  const { model, isReady, downloadProgress, error, load, deleteModel, memorySummary } = useModel(
    GEMMA_3N_E2B_IT_INT4,
    {
      backend,
      autoLoad: true,
      systemPrompt: 'You are a helpful assistant.',
      enableMemoryTracking: true,
    },
  );

  return { model, isReady, downloadProgress, error, load, deleteModel, memorySummary, backend };
}
