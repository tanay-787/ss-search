export type JobJournalStatus = 'pending' | 'running' | 'completed' | 'failed' | 'waiting_for_model';

export type JobJournalStage =
  | 'metadata'
  | 'ocr'
  | 'ocr_postprocess'
  | 'embedding'
  | 'keywords'
  | 'index_fts'
  | 'index_vec';

export type JobJournalJob = {
  id: string;
  imageUri: string;
  imageHash: string;
  status: JobJournalStatus;
  vectorRequired?: boolean;
  createdAt: number;
  updatedAt: number;
};

export type JobJournalStageExecution = {
  id: string;
  jobId: string;
  stage: JobJournalStage;
  attempt: number;
  status: JobJournalStatus;
  leaseUntil: number | null;
  createdAt: number;
  updatedAt: number;
  lastError: string | null;
};

export type JobJournalCheckpoint = {
  jobId: string;
  stage: JobJournalStage;
  outputPath: string | null;
  createdAt: number;
  updatedAt: number;
};

export type SiglipModelConfig = {
  visionUrl: string | null;
  textUrl: string | null;
  tokenizerUrl: string | null;
};

export type SiglipModelState = {
  config: SiglipModelConfig;
  status: 'idle' | 'downloading' | 'ready' | 'error';
  isLoaded: boolean;
  isTextLoaded: boolean;
  progress: number;
  error: string | null;
  visionPath: string | null;
  textPath: string | null;
  tokenizerPath: string | null;
};

export type JobJournalErrorCode =
  | 'PRECONDITION_FAILED'
  | 'MODEL_UNAVAILABLE'
  | 'TIMEOUT'
  | 'IO_ERROR'
  | 'VECTOR_MISSING'
  | 'VECTOR_UNAVAILABLE'
  | 'NOT_FOUND'
  | 'UNKNOWN';

export type StageResult = {
  status: 'completed' | 'failed' | 'waiting_for_model';
  error?: string;
  errorCode?: JobJournalErrorCode;
};
