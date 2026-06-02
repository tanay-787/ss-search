import * as MediaLibrary from 'expo-media-library';
import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';

import { useJobJournalOperations } from '@/lib/hooks';
import { getJobJournalDatabase } from '@/features/jobjournal';
import type { ScreenshotAsset } from '../types';

function normalizeJobStage(
  stage: string | null,
  jobStatus: string
): ScreenshotAsset['pipelineStage'] {
  if (jobStatus === 'completed') return 'done';
  if (!stage) return 'new';
  
  if (stage === 'metadata') return 'new';
  if (stage === 'ocr' || stage === 'ocr_postprocess') return 'ocr';
  if (stage === 'embedding') return 'embedding';
  if (stage === 'keywords' || stage === 'index') return 'enrichment';
  
  return 'new';
}

function normalizeJobStatus(
  status: string
): ScreenshotAsset['pipelineState'] {
  if (status === 'running') return 'working';
  if (status === 'completed') return 'indexed';
  if (status === 'failed') return 'error';
  return 'queued';
}

export function useScreenshotLibrary() {
  const [permissionResponse, requestPermission] = MediaLibrary.usePermissions({
    granularPermissions: ['photo'],
  });
  const [loading, setLoading] = useState(false);
  const [assets, setAssets] = useState<ScreenshotAsset[]>([]);
  const [error, setError] = useState<string | null>(null);

  const { sync, process } = useJobJournalOperations();

  const loadFromJournal = useCallback(async () => {
    const db = await getJobJournalDatabase();
    
    // We get the "current" stage by looking at the execution with the highest created_at or most advanced stage
    // For simplicity, we'll join with the latest execution for each job.
    const rows = await db.getAllAsync<{
      id: string;
      uri: string;
      filename: string | null;
      created_at: number;
      width: number | null;
      height: number | null;
      job_status: string;
      current_stage: string | null;
      attempt: number | null;
      last_error_message: string | null;
    }>(
      `SELECT
         j.id,
         j.image_uri as uri,
         j.image_hash as filename, -- using hash as filename placeholder if needed
         j.created_at,
         m.width,
         m.height,
         j.status as job_status,
         e.stage as current_stage,
         e.attempt,
         e.last_error_message
       FROM job_journal_jobs j
       LEFT JOIN metadata_stage_results m ON m.job_id = j.id
       LEFT JOIN (
         SELECT job_id, stage, attempt, last_error_message,
                ROW_NUMBER() OVER (PARTITION BY job_id ORDER BY created_at DESC) as rn
         FROM stage_executions
       ) e ON e.job_id = j.id AND e.rn = 1
       ORDER BY j.created_at DESC
       LIMIT 500`,
    );

    return rows.map((row) => {
      const createdAt = row.created_at ?? Date.now();
      const creationTime = createdAt > 1000000000000 ? Math.floor(createdAt / 1000) : createdAt;
      return {
        id: row.id,
        uri: row.uri,
        filename: row.filename ?? 'screenshot',
        creationTime,
        width: row.width ?? 1080,
        height: row.height ?? 1920,
        pipelineStage: normalizeJobStage(row.current_stage, row.job_status),
        pipelineState: normalizeJobStatus(row.job_status),
        retryCount: row.attempt ?? 0,
        lastError: row.last_error_message,
      };
    });
  }, []);

  const syncJournal = useCallback(async () => {
    await sync();
    // We don't wait for processing to finish here, as it's a background-capable process
    // But for "refresh" we might want to run a few iterations if in foreground
    await process(8);
    const items = await loadFromJournal();
    setAssets(items);
  }, [sync, process, loadFromJournal]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      await syncJournal();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to load screenshots.');
    } finally {
      setLoading(false);
    }
  }, [syncJournal]);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    if (permissionResponse?.status === 'granted') {
      void refresh();
    }
    const interval = setInterval(() => {
      if (permissionResponse?.status === 'granted') {
        void refresh();
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [permissionResponse?.status, refresh]);

  const requestAccess = useCallback(async () => {
    const response = await requestPermission();
    if (response.status === 'granted') {
      await refresh();
    }
  }, [refresh, requestPermission]);

  return {
    assets,
    error,
    loading,
    permissionResponse,
    granted: permissionResponse?.status === 'granted',
    denied: permissionResponse != null && permissionResponse.status !== 'granted',
    requestAccess,
    refresh,
  };
}
