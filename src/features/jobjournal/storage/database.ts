import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';

import { JOB_JOURNAL_SCHEMA, JOB_JOURNAL_VEC_SCHEMA } from './schema';

type VecStatus = {
  available: boolean;
  error: string | null;
};

let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;
let vecStatus: VecStatus = { available: false, error: null };

export function getJobJournalVecStatus() {
  return vecStatus;
}

async function loadVecExtension(db: SQLite.SQLiteDatabase) {
  if (Platform.OS === 'web') {
    vecStatus = { available: false, error: 'sqlite-vec is not supported on web.' };
    return;
  }

  const extension = SQLite.bundledExtensions?.['sqlite-vec'];
  if (!extension) {
    vecStatus = { available: false, error: 'sqlite-vec extension is not bundled.' };
    return;
  }

  try {
    await db.loadExtensionAsync(extension.libPath, extension.entryPoint);
    vecStatus = { available: true, error: null };
  } catch (cause) {
    vecStatus = {
      available: false,
      error: cause instanceof Error ? cause.message : 'Failed to load sqlite-vec extension.',
    };
  }
}

async function initializeDatabase(db: SQLite.SQLiteDatabase) {
  await db.execAsync(JOB_JOURNAL_SCHEMA);
  await loadVecExtension(db);
  if (vecStatus.available) {
    await db.execAsync(JOB_JOURNAL_VEC_SCHEMA);
  }
}

export async function initializeJobJournalDatabase() {
  const db = await getJobJournalDatabase();
  await initializeDatabase(db);
}

export async function getJobJournalDatabase() {
  if (!databasePromise) {
    databasePromise = (async () => {
      const db = await SQLite.openDatabaseAsync('ss-search.db');
      await initializeDatabase(db);
      return db;
    })();
  }

  return databasePromise;
}
