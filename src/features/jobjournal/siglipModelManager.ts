import { Directory, File, Paths } from 'expo-file-system';
import { createSigLIP } from 'react-native-siglip';

import { SiglipTokenizer } from './siglipTokenizer';
import type { SiglipModelState } from './types';

const getModelDir = () => new Directory(Paths.document, 'models', 'siglip');

const DEFAULT_STATE: SiglipModelState = {
  config: {
    visionUrl: process.env.EXPO_PUBLIC_SIGLIP_VISION_URL ?? null,
    textUrl: process.env.EXPO_PUBLIC_SIGLIP_TEXT_URL ?? null,
    tokenizerUrl: process.env.EXPO_PUBLIC_SIGLIP_TOKENIZER_URL ?? null,
  },
  status: 'idle',
  progress: 0,
  error: null,
  visionPath: null,
  textPath: null,
  tokenizerPath: null,
};

let state: SiglipModelState = { ...DEFAULT_STATE };
const listeners = new Set<(nextState: SiglipModelState) => void>();

function emit() {
  listeners.forEach((listener) => listener(state));
}

export function getSiglipModelState() {
  return state;
}

export function subscribeSiglipModelState(listener: (nextState: SiglipModelState) => void) {
  listeners.add(listener);
  listener(state);
  return () => listeners.delete(listener);
}

export async function initializeSiglipModels(visionUrl: string, textUrl: string, tokenizerUrl: string) {
  state = { ...state, config: { visionUrl, textUrl, tokenizerUrl } };
  emit();
}

export async function downloadSiglipVisionAndTokenizer() {
  if (!state.config.visionUrl || !state.config.textUrl || !state.config.tokenizerUrl) {
    state = { ...state, error: 'SigLIP model URLs not configured' };
    emit();
    return;
  }

  state = { ...state, status: 'downloading', progress: 0, error: null };
  emit();

  try {
    const modelDir = getModelDir();
    if (!modelDir.exists) {
      await modelDir.create({ intermediates: true });
    }

    const visionFile = new File(modelDir, 'siglip2_vision.pte');
    const tokenizerFile = new File(modelDir, 'siglip2_tokenizer.json');

    const downloadFile = async (url: string, file: File, label: string) => {
      if (file.exists) {
        return file.uri;
      }

      const result = await File.downloadFileAsync(url, file, { idempotent: true });
      if (!result) {
        throw new Error(`Failed to download ${label}`);
      }
      return file.uri;
    };

    await downloadFile(state.config.visionUrl!, visionFile, 'vision model');
    state = { ...state, progress: 0.5 };
    emit();

    await downloadFile(state.config.tokenizerUrl!, tokenizerFile, 'tokenizer');
    state = {
      ...state,
      status: 'ready',
      progress: 1,
      visionPath: visionFile.uri,
      tokenizerPath: tokenizerFile.uri,
    };
    emit();
  } catch (cause) {
    state = {
      ...state,
      status: 'error',
      error: cause instanceof Error ? cause.message : 'Download failed',
    };
    emit();
  }
}

export async function downloadSiglipTextModel() {
  const textUrl = state.config.textUrl;
  if (!textUrl) {
    state = { ...state, error: 'SigLIP text model URL not configured' };
    emit();
    return;
  }

  state = { ...state, status: 'downloading', error: null };
  emit();

  try {
    const modelDir = getModelDir();
    if (!modelDir.exists) {
      await modelDir.create({ intermediates: true });
    }

    const textFile = new File(modelDir, 'siglip2_text.pte');
    if (!textFile.exists) {
      const result = await File.downloadFileAsync(textUrl, textFile, { idempotent: true });
      if (!result) {
        throw new Error('Failed to download text model');
      }
    }

    state = { ...state, status: 'ready', textPath: textFile.uri };
    emit();
  } catch (cause) {
    state = {
      ...state,
      status: 'error',
      error: cause instanceof Error ? cause.message : 'Download failed',
    };
    emit();
  }
}

export async function loadSiglipModels() {
  if (!state.visionPath) {
    throw new Error('SigLIP vision model not available');
  }

  const siglip = createSigLIP();
  await siglip.loadVisionModel(state.visionPath);
  return siglip;
}

export async function loadSiglipTextModel(siglip: ReturnType<typeof createSigLIP>) {
  if (!state.textPath) {
    throw new Error('SigLIP text model not available');
  }
  await siglip.loadTextModel(state.textPath);
}

export async function loadSiglipTokenizer() {
  if (!state.tokenizerPath) {
    throw new Error('SigLIP tokenizer not available');
  }
  return SiglipTokenizer.load(state.tokenizerPath);
}
