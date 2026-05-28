import {
  downloadSiglipTextModel,
  downloadSiglipVisionAndTokenizer,
  getSiglipModelState,
  loadSiglipModels,
  loadSiglipTextModel,
  loadSiglipTokenizer,
} from './siglipModelManager';
import { SiglipTokenizer } from './siglipTokenizer';

let siglipInstance: any = null;
let tokenizer: SiglipTokenizer | null = null;
let loadingPromise: Promise<void> | null = null;

export function initializeEmbeddings(siglip: any, tokenizerInstance: SiglipTokenizer | null) {
  siglipInstance = siglip;
  tokenizer = tokenizerInstance;
}

async function ensureSiglipReady() {
  if (siglipInstance && tokenizer) {
    return;
  }

  if (!loadingPromise) {
    loadingPromise = (async () => {
      await downloadSiglipVisionAndTokenizer();
      const state = getSiglipModelState();
      if (state.status === 'error') {
        throw new Error(state.error || 'SigLIP download failed');
      }

      siglipInstance = await loadSiglipModels();
      tokenizer = await loadSiglipTokenizer();
    })().finally(() => {
      loadingPromise = null;
    });
  }

  await loadingPromise;
}

async function ensureSiglipTextReady() {
  await ensureSiglipReady();
  if (!siglipInstance) {
    throw new Error('SigLIP not initialized');
  }

  const state = getSiglipModelState();
  if (!state.textPath) {
    await downloadSiglipTextModel();
  }
  await loadSiglipTextModel(siglipInstance);
}

export async function generateImageEmbedding(screenshotUri: string): Promise<Float32Array> {
  await ensureSiglipReady();

  const buffer = await siglipInstance.getImageEmbedding(screenshotUri);
  if (!buffer) {
    throw new Error('Invalid embedding returned from SigLIP');
  }
  return new Float32Array(buffer as ArrayBuffer);
}

export async function generateTextEmbedding(text: string): Promise<Float32Array> {
  await ensureSiglipTextReady();
  if (!tokenizer) {
    throw new Error('SigLIP tokenizer not initialized');
  }

  const tokens = tokenizer.encode(text);
  const tokenBuffer = tokenizer.toNativeBuffer(tokens);
  const embeddingBuffer = await siglipInstance.getTextEmbedding(tokenBuffer);

  if (!embeddingBuffer) {
    throw new Error('Invalid embedding returned from SigLIP');
  }

  return new Float32Array(embeddingBuffer as ArrayBuffer);
}

