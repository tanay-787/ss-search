import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import * as MediaLibrary from 'expo-media-library';
import { eq, desc, sql } from 'drizzle-orm';

import { useJobJournalOperations } from './useJobJournalOperations';
import { getDrizzleDb } from '@/core/jobjournal/storage/database';
import { jobJournalJobs, stageExecutions, metadataStageResults } from '@/core/jobjournal/storage/drizzle-schema';

export type JobJournalLibraryItem = {
  id: string;
  uri: string;
  filename: string;
  creationTime: number;
  width: number;
  height: number;
  status: 'queued' | 'working' | 'indexed' | 'error';
  stage: 'metadata' | 'ocr' | 'enrichment' | 'done' | 'new';
  retryCount: number;
  lastError: string | null;
};

function normalizeJobStage(
  stage: string | null,
  jobStatus: string
): JobJournalLibraryItem['stage'] {
  if (jobStatus === 'completed') return 'done';
  if (!stage) return 'new';
  
  if (stage === 'metadata') return 'metadata';
  if (stage === 'ocr' || stage === 'ocr_postprocess') return 'ocr';
  if (stage === 'keywords' || stage === 'index_fts') return 'enrichment';
  
  return 'new';
}

function normalizeJobStatus(
  status: string
): JobJournalLibraryItem['status'] {
  if (status === 'running') return 'working';
  if (status === 'completed') return 'indexed';
  if (status === 'failed') return 'error';
  return 'queued';
}

export function useJobJournalLibrary() {
  const [permissionResponse, requestPermission] = MediaLibrary.usePermissions({
    granularPermissions: ['photo'],
  });
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<JobJournalLibraryItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  const { sync, process } = useJobJournalOperations();

  const loadFromJournal = useCallback(async () => {
    const db = await getDrizzleDb();
    
    // Complex join to get latest execution per job
    // We'll use a subquery/SQL for the ROW_NUMBER logic as Drizzle doesn't have a direct DSL for it yet
    const rows = await db.all(sql`
      SELECT
         j.id,
         j.image_uri as uri,
         j.image_hash,
         j.created_at,
         m.width,
         m.height,
         j.status as job_status,
         e.stage as current_stage,
         e.attempt,
         e.last_error_message
       FROM job_journal_jobs j
       LEFT JOIN metadata_stage_results m ON m.job_id = j.id
       LEFT JOIN stage_executions e ON e.job_id = j.id AND e.status != 'completed'
       ORDER BY j.created_at DESC
       LIMIT 5000
    `);

    return rows.map((row: any) => {
      const createdAt = row.created_at ?? Date.now();
      const creationTime = createdAt > 1000000000000 ? Math.floor(createdAt / 1000) : createdAt;
      return {
        id: row.id,
        uri: row.uri,
        filename: row.image_hash ?? 'screenshot',
        creationTime,
        width: row.width ?? 1080,
        height: row.height ?? 1920,
        stage: normalizeJobStage(row.current_stage, row.job_status),
        status: normalizeJobStatus(row.job_status),
        retryCount: row.attempt ?? 0,
        lastError: row.last_error_message,
      };
    });
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    
    let active = true;
    
    const tick = async () => {
      if (!active) return;
      if (permissionResponse?.status === 'granted') {
        try {
          const data = await loadFromJournal();
          if (active) setItems(data);
        } catch (err) {
          console.error('[useJobJournalLibrary] tick failed:', err);
        }
      }
    };

    tick();
    const interval = setInterval(tick, 5000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [permissionResponse?.status, loadFromJournal]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      await sync();
      await process(8);
      const data = await loadFromJournal();
      setItems(data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to load library.');
    } finally {
      setLoading(false);
    }
  }, [sync, process, loadFromJournal]);

  const requestAccess = useCallback(async () => {
    const response = await requestPermission();
    if (response.status === 'granted') {
      await refresh();
    }
  }, [refresh, requestPermission]);

  return {
    items,
    error,
    loading,
    permissionResponse,
    granted: permissionResponse?.status === 'granted',
    requestAccess,
    refresh,
  };
}
