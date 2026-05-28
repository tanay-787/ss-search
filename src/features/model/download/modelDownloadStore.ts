import * as BackgroundTask from 'expo-background-task';
import { Directory, File, Paths } from 'expo-file-system';
import * as TaskManager from 'expo-task-manager';

import { GEMMA_MODEL_URL } from '../constants';

export const MODEL_DOWNLOAD_TASK = 'gemma-model-download-task';
export const MODEL_FILE_NAME = 'gemma-3n-E2B-it-int4.litertlm';

const MODEL_DIRECTORY = new Directory(Paths.document, 'models');
const MODEL_FILE = new File(MODEL_DIRECTORY, MODEL_FILE_NAME);
const STATE_FILE = new File(MODEL_DIRECTORY, 'download-state.json');

type DownloadState = {
  fileUri: string | null;
  progress: number;
  resumeData: null;
  status: 'idle' | 'checking' | 'downloading' | 'paused' | 'ready' | 'error';
  error: string | null;
  dismissed: boolean;
};

type Listener = (state: DownloadState) => void;

const defaultState: DownloadState = {
  fileUri: null,
  progress: 0,
  resumeData: null,
  status: 'idle',
  error: null,
  dismissed: false,
};

let state: DownloadState = defaultState;
let initialized = false;
let initializationPromise: Promise<void> | null = null;
const listeners = new Set<Listener>();
let cancelRequested = false;
let pauseRequested = false;

function emit() {
  for (const listener of listeners) {
    listener(state);
  }
}

async function ensureDirectory() {
  if (!MODEL_DIRECTORY.exists) {
    await MODEL_DIRECTORY.create({ intermediates: true });
  }
}

async function persistState() {
  await ensureDirectory();
  await STATE_FILE.write(JSON.stringify(state));
}

async function loadPersistedState() {
  try {
    if (!STATE_FILE.exists) {
      state = defaultState;
      return;
    }
    const contents = await STATE_FILE.text();
    const parsed = JSON.parse(contents) as Partial<DownloadState>;
    state = { ...defaultState, ...parsed };
  } catch {
    state = defaultState;
  }
}

async function refreshFileState() {
  await ensureDirectory();
  if (MODEL_FILE.exists) {
    state = {
      ...state,
      fileUri: MODEL_FILE.uri,
      progress: 1,
      status: 'ready',
      error: null,
      resumeData: null,
    };
  } else if (state.status === 'ready') {
    state = { ...state, fileUri: null, progress: 0, status: 'idle' };
  }
  emit();
}

export async function initializeModelDownloadState() {
  if (initialized) {
    return;
  }
  if (initializationPromise) {
    await initializationPromise;
    return;
  }

  initializationPromise = (async () => {
    state = { ...defaultState, status: 'checking' };
    emit();
    await loadPersistedState();
    await refreshFileState();
    initialized = true;
  })();

  try {
    await initializationPromise;
  } finally {
    initializationPromise = null;
  }
}

export function getModelDownloadState() {
  return state;
}

export function subscribeModelDownloadState(listener: Listener) {
  listeners.add(listener);
  listener(state);
  return () => listeners.delete(listener);
}

export async function registerModelDownloadTask() {
  if (await TaskManager.isTaskRegisteredAsync(MODEL_DOWNLOAD_TASK)) {
    return;
  }
  await import('./modelDownloadTask');
  await BackgroundTask.registerTaskAsync(MODEL_DOWNLOAD_TASK);
}

export async function unregisterModelDownloadTask() {
  if (!(await TaskManager.isTaskRegisteredAsync(MODEL_DOWNLOAD_TASK))) {
    return;
  }
  await BackgroundTask.unregisterTaskAsync(MODEL_DOWNLOAD_TASK);
}

export function getModelFileUri() {
  return MODEL_FILE.uri;
}

export function isModelDownloaded() {
  return state.status === 'ready' && Boolean(state.fileUri);
}

export async function startModelDownload() {
  await ensureDirectory();
  state = { ...state, status: 'downloading', error: null, dismissed: false };
  emit();
  cancelRequested = false;
  pauseRequested = false;

  await registerModelDownloadTask();

  try {
    const result = await File.downloadFileAsync(GEMMA_MODEL_URL, MODEL_FILE, { idempotent: true });
    if (!result) {
      return;
    }

    if (cancelRequested || pauseRequested) {
      try {
        if (MODEL_FILE.exists) {
          await MODEL_FILE.delete();
        }
      } catch {
        // ignore if file already absent
      }
      state = {
        ...state,
        fileUri: null,
        progress: 0,
        resumeData: null,
        status: cancelRequested ? 'idle' : 'paused',
        error: null,
      };
      emit();
      await persistState();
      await unregisterModelDownloadTask();
      return;
    }

    state = {
      ...state,
      fileUri: result.uri ?? MODEL_FILE.uri,
      progress: 1,
      resumeData: null,
      status: 'ready',
      error: null,
    };
    emit();
    await persistState();
    await unregisterModelDownloadTask();

    // Wake up any jobjournal executions that were waiting for the model.
    // Dynamic import to avoid circular dependency at module load time.
    try {
      const executor = await import('../../jobjournal/03-executor');
      if (executor && typeof executor.retryWaitingForModelExecutions === 'function') {
        // best-effort; don't block download completion
        void executor.retryWaitingForModelExecutions();
      }
    } catch (err) {
      // ignore errors from waking up jobjournal; not critical
      // eslint-disable-next-line no-console
      console.warn('Failed to notify jobjournal about model readiness', err);
    }
  } catch (cause) {
    state = {
      ...state,
      status: 'error',
      error: cause instanceof Error ? cause.message : 'Model download failed.',
    };
    emit();
    await persistState();
    throw cause;
  }
}

export async function pauseModelDownload() {
  if (state.status !== 'downloading') {
    return;
  }
  pauseRequested = true;
  state = {
    ...state,
    status: 'paused',
    progress: state.progress,
    resumeData: null,
    error: null,
  };
  emit();
  await persistState();
}

export async function resumeModelDownload() {
  if (state.status !== 'paused') {
    return;
  }
  await startModelDownload();
}

export async function cancelModelDownload() {
  if (state.status === 'downloading') {
    cancelRequested = true;
  }

  state = {
    ...state,
    progress: 0,
    resumeData: null,
    status: 'idle',
    error: null,
  };
  emit();
  await persistState();
}

export async function dismissModelDownloadPrompt() {
  state = { ...state, dismissed: true };
  emit();
  await persistState();
}

export async function clearDownloadedModel() {
  await cancelModelDownload();
  try {
    if (MODEL_FILE.exists) {
      await MODEL_FILE.delete();
    }
  } catch {
    // ignore if file already absent
  }
  state = { ...state, fileUri: null, progress: 0, status: 'idle', error: null };
  emit();
  await persistState();
  await unregisterModelDownloadTask();
}

export function getModelDownloadSummary() {
  return {
    modelFileUri: MODEL_FILE.uri,
    state,
  };
}
