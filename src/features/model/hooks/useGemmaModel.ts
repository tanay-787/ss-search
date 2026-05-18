import { useMemo } from 'react';
import { getRecommendedBackend, useModel } from 'react-native-litert-lm';

import { DEFAULT_SYSTEM_PROMPT, GEMMA_MODEL_URL } from '../constants';
import type { GemmaModelState } from '../types';

type UseGemmaModelOptions = {
  modelSourceUri?: string | null;
  autoLoad?: boolean;
};

function normalizeLocalModelPath(pathOrUri: string | null | undefined) {
  if (!pathOrUri) {
    return null;
  }

  return pathOrUri.startsWith('file://') ? pathOrUri.replace('file://', '') : pathOrUri;
}

export function useGemmaModel(options: UseGemmaModelOptions = {}) {
  const { modelSourceUri = GEMMA_MODEL_URL, autoLoad = true } = options;
  const backend = useMemo(() => getRecommendedBackend() ?? 'cpu', []);
  const modelPath = normalizeLocalModelPath(modelSourceUri);

  const {
    model,
    isReady,
    isGenerating,
    downloadProgress,
    error,
    generate,
    reset,
    deleteModel,
    load,
    memorySummary,
  } = useModel(modelPath ?? GEMMA_MODEL_URL, {
    backend,
    autoLoad,
    systemPrompt: DEFAULT_SYSTEM_PROMPT,
    enableMemoryTracking: true,
  });

  const state: GemmaModelState = {
    backend,
    downloadProgress,
    error,
    isGenerating,
    isReady,
    status: error ? 'error' : isReady ? 'ready' : downloadProgress > 0 ? 'loading' : 'idle',
  };

  return {
    model,
    state,
    generate,
    reset,
    deleteModel,
    load,
    memorySummary,
  };
}
