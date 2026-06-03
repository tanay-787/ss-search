import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';

import { JOB_JOURNAL_SCHEMA, JOB_JOURNAL_VEC_SCHEMA } from './schema';

type VecStatus = {
  available: boolean;
  error: string | null;
};

let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;
let initializationPromise: Promise<void> | null = null;
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
  if (initializationPromise) {
    return initializationPromise;
  }

  initializationPromise = (async () => {
    await db.execAsync(JOB_JOURNAL_SCHEMA);

    // Ensure trigram table exists (migration for existing users)
    await db.execAsync(`
      CREATE VIRTUAL TABLE IF NOT EXISTS screenshot_search_trigram USING fts5(
        job_id UNINDEXED,
        ocr_text,
        keywords,
        tokenize='trigram'
      );
    `);

    // Run one-time migration for last_error column split
    await migrateLastErrorColumn(db);

    // Ensure system_health table exists for storing periodic integrity checks
    await db.execAsync(`CREATE TABLE IF NOT EXISTS system_health (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      check_time INTEGER NOT NULL,
      check_type TEXT NOT NULL,
      result TEXT NOT NULL
    );`);

    await loadVecExtension(db);
    if (vecStatus.available) {
      await db.execAsync(JOB_JOURNAL_VEC_SCHEMA);
    }

    // Perform an immediate integrity check at startup and persist the result
    try {
      await performIntegrityCheck(db);
    } catch (err) {
      // best-effort: don't block initialization on health check failures
      console.warn('Database integrity check at startup failed:', err);
    }
  })();

  return initializationPromise;
}

async function migrateLastErrorColumn(db: SQLite.SQLiteDatabase) {
  try {
    const columns = await db.getAllAsync<{ name: string }>(
      `PRAGMA table_info(stage_executions);`,
    );
    const columnNames = new Set(columns.map((column) => column.name));

    if (!columnNames.has('last_error_code')) {
      await db.runAsync(`ALTER TABLE stage_executions ADD COLUMN last_error_code TEXT;`);
    }
    if (!columnNames.has('last_error_message')) {
      await db.runAsync(`ALTER TABLE stage_executions ADD COLUMN last_error_message TEXT;`);
    }

    if (!columnNames.has('last_error')) {
      return;
    }

    const rows = await db.getAllAsync<{ id: string; last_error: string | null }>(
      `SELECT id, last_error FROM stage_executions WHERE last_error IS NOT NULL`,
    );

    for (const row of rows) {
      let code: string | null = null;
      let message: string | null = null;

      if (row.last_error) {
        const parts = row.last_error.split('|');
        code = parts[0] || null;
        message = parts.slice(1).join('|') || null;
      }

      await db.runAsync(
        `UPDATE stage_executions SET last_error_code = ?, last_error_message = ? WHERE id = ?`,
        [code, message, row.id],
      );
    }
  } catch (err) {
    // Migration is best-effort; if columns already exist or update fails, continue
    console.warn('Failed to migrate last_error column:', err);
  }
}

async function performIntegrityCheck(db: SQLite.SQLiteDatabase) {
  // PRAGMA integrity_check returns one-row, one-column result (usually column named 'integrity_check')
  try {
    const row = await (db as any).getFirstAsync?.(`PRAGMA integrity_check;`);
    let result = '';
    if (row) {
      // get the first column value regardless of column name
      const vals = Object.values(row) as string[];
      result = vals.length > 0 ? String(vals[0]) : '';
    }

    const now = Date.now();
    await db.runAsync(
      `INSERT INTO system_health (check_time, check_type, result) VALUES (?, ?, ?)`,
      [now, 'integrity_check', result],
    );

    return { ok: result === 'ok', result };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const now = Date.now();
    try {
      await db.runAsync(
        `INSERT INTO system_health (check_time, check_type, result) VALUES (?, ?, ?)`,
        [now, 'integrity_check', msg],
      );
    } catch {
      // ignore failures while trying to persist health result
    }
    return { ok: false, result: msg };
  }
}

export async function runDatabaseHealthCheck() {
  const db = await getJobJournalDatabase();
  return performIntegrityCheck(db);
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
