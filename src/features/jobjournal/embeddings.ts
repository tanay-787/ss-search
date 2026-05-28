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

async function ensureSiglipReady(signal?: AbortSignal) {
  if (signal?.aborted) throw new Error('Aborted');
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

  // race loadingPromise with abort signal
  if (!signal) {
    await loadingPromise;
  } else {
    await withAbort(loadingPromise, signal);
  }
}

async function ensureSiglipTextReady(signal?: AbortSignal) {
  await ensureSiglipReady(signal);
  if (!siglipInstance) {
    throw new Error('SigLIP not initialized');
  }

  const state = getSiglipModelState();
  if (!state.textPath) {
    // download may be long; race with abort
    if (!signal) {
      await downloadSiglipTextModel();
    } else {
      await withAbort(downloadSiglipTextModel(), signal);
    }
  }
  await loadSiglipTextModel(siglipInstance);
}

function withAbort<T>(p: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return p;
  if (signal.aborted) return Promise.reject(new Error('Aborted'));
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(new Error('Aborted'));
    signal.addEventListener('abort', onAbort);
    p.then((v) => {
      signal.removeEventListener('abort', onAbort);
      resolve(v);
    }).catch((e) => {
      signal.removeEventListener('abort', onAbort);
      reject(e);
    });
  });
}

export async function generateImageEmbedding(screenshotUri: string, signal?: AbortSignal): Promise<Float32Array> {
  await ensureSiglipReady(signal);
  if (signal?.aborted) throw new Error('Aborted');

  // Wrap embedding call so we can abort waiting if signal fires
  const buf = await withAbort((async () => {
    return await siglipInstance.getImageEmbedding(screenshotUri);
  })(), signal);

  const buffer = buf;
  if (!buffer) {
    throw new Error('Invalid embedding returned from SigLIP');
  }
  return new Float32Array(buffer as ArrayBuffer);
}

export async function generateTextEmbedding(text: string, signal?: AbortSignal): Promise<Float32Array> {
  await ensureSiglipTextReady(signal);
  if (signal?.aborted) throw new Error('Aborted');
  if (!tokenizer) {
    throw new Error('SigLIP tokenizer not initialized');
  }

  const tokens = tokenizer.encode(text);
  const tokenBuffer = tokenizer.toNativeBuffer(tokens);

  const embeddingBuffer = await withAbort((async () => {
    return await siglipInstance.getTextEmbedding(tokenBuffer);
  })(), signal);

  if (!embeddingBuffer) {
    throw new Error('Invalid embedding returned from SigLIP');
  }

  return new Float32Array(embeddingBuffer as ArrayBuffer);
}

