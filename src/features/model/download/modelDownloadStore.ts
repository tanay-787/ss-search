import * as BackgroundTask from 'expo-background-task';
import * as FileSystem from 'expo-file-system/legacy';
import * as TaskManager from 'expo-task-manager';

import { GEMMA_MODEL_URL } from '../constants';

export const MODEL_DOWNLOAD_TASK = 'gemma-model-download-task';
export const MODEL_FILE_NAME = 'gemma-4-E2B-it.litertlm';

const MODEL_DIRECTORY = `${FileSystem.documentDirectory ?? ''}models/`;
const MODEL_FILE_URI = `${MODEL_DIRECTORY}${MODEL_FILE_NAME}`;
const STATE_FILE_URI = `${MODEL_DIRECTORY}download-state.json`;

type DownloadState = {
  fileUri: string | null;
  progress: number;
  resumeData: string | null;
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
let resumable: FileSystem.DownloadResumable | null = null;
let initialized = false;
let initializationPromise: Promise<void> | null = null;
const listeners = new Set<Listener>();

function emit() {
  for (const listener of listeners) {
    listener(state);
  }
}

async function ensureDirectory() {
  if (!FileSystem.documentDirectory) {
    throw new Error('Document directory is unavailable.');
  }

  await FileSystem.makeDirectoryAsync(MODEL_DIRECTORY, { intermediates: true });
}

async function persistState() {
  await ensureDirectory();
  await FileSystem.writeAsStringAsync(STATE_FILE_URI, JSON.stringify(state));
}

async function loadPersistedState() {
  try {
    const contents = await FileSystem.readAsStringAsync(STATE_FILE_URI);
    const parsed = JSON.parse(contents) as Partial<DownloadState>;
    state = { ...defaultState, ...parsed };
  } catch {
    state = defaultState;
  }
}

async function refreshFileState() {
  await ensureDirectory();
  const info = await FileSystem.getInfoAsync(MODEL_FILE_URI);
  if (info.exists) {
    state = {
      ...state,
      fileUri: MODEL_FILE_URI,
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
    if (!FileSystem.documentDirectory) {
      state = defaultState;
      emit();
      initialized = true;
      return;
    }

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
  return MODEL_FILE_URI;
}

export function isModelDownloaded() {
  return state.status === 'ready' && Boolean(state.fileUri);
}

export async function startModelDownload() {
  await ensureDirectory();
  state = { ...state, status: 'downloading', error: null, dismissed: false };
  emit();

  resumable = FileSystem.createDownloadResumable(
    GEMMA_MODEL_URL,
    MODEL_FILE_URI,
    {
      sessionType: FileSystem.FileSystemSessionType.BACKGROUND,
      cache: true,
    },
    (progress) => {
      const nextProgress =
        progress.totalBytesExpectedToWrite > 0
          ? progress.totalBytesWritten / progress.totalBytesExpectedToWrite
          : state.progress;

      state = { ...state, progress: nextProgress, status: 'downloading' };
      emit();
    },
    state.resumeData ?? undefined,
  );

  await registerModelDownloadTask();

  try {
    const result = await resumable.downloadAsync();
    if (!result) {
      return;
    }

    state = {
      ...state,
      fileUri: result.uri,
      progress: 1,
      resumeData: null,
      status: 'ready',
      error: null,
    };
    emit();
    await persistState();
    await unregisterModelDownloadTask();
  } catch (cause) {
    state = {
      ...state,
      status: 'error',
      error: cause instanceof Error ? cause.message : 'Model download failed.',
    };
    emit();
    await persistState();
    throw cause;
  } finally {
    resumable = null;
  }
}

export async function pauseModelDownload() {
  if (!resumable) return;

  const pauseState = await resumable.pauseAsync();
  state = {
    ...state,
    status: 'paused',
    progress: state.progress,
    resumeData: pauseState.resumeData ?? null,
    error: null,
  };
  emit();
  await persistState();
}

export async function resumeModelDownload() {
  if (state.status !== 'paused' || !state.resumeData) {
    return;
  }

  await ensureDirectory();
  resumable = FileSystem.createDownloadResumable(
    GEMMA_MODEL_URL,
    MODEL_FILE_URI,
    {
      sessionType: FileSystem.FileSystemSessionType.BACKGROUND,
      cache: true,
    },
    (progress) => {
      const nextProgress =
        progress.totalBytesExpectedToWrite > 0
          ? progress.totalBytesWritten / progress.totalBytesExpectedToWrite
          : state.progress;

      state = { ...state, progress: nextProgress, status: 'downloading' };
      emit();
    },
    state.resumeData,
  );

  state = { ...state, status: 'downloading', error: null };
  emit();
  await registerModelDownloadTask();

  const result = await resumable.resumeAsync();
  if (!result) {
    return;
  }

  state = {
    ...state,
    fileUri: result.uri,
    progress: 1,
    resumeData: null,
    status: 'ready',
    error: null,
  };
  emit();
  await persistState();
  await unregisterModelDownloadTask();
  resumable = null;
}

export async function cancelModelDownload() {
  if (resumable) {
    await resumable.cancelAsync();
    resumable = null;
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
    await FileSystem.deleteAsync(MODEL_FILE_URI);
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
    modelFileUri: MODEL_FILE_URI,
    state,
  };
}
