import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';
import { drizzle, ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite';
import { migrate } from 'drizzle-orm/expo-sqlite/migrator';

import * as schema from './drizzle-schema';
import migrations from '../../../../drizzle/migrations';

type VecStatus = {
  available: boolean;
  error: string | null;
};

let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;
let drizzlePromise: Promise<ExpoSQLiteDatabase<typeof schema>> | null = null;
let initializationPromise: Promise<ExpoSQLiteDatabase<typeof schema>> | null = null;
let vecStatus: VecStatus = { available: false, error: null };

export function getJobJournalVecStatus() {
  return vecStatus;
}

async function loadVecExtension(db: SQLite.SQLiteDatabase) {
  vecStatus = { available: false, error: 'sqlite-vec is disabled for this release.' };
}

/**
 * Shared initialization logic. Ensures extensions, migrations, and virtual tables are ready.
 */
async function initializeDatabase(expoDb: SQLite.SQLiteDatabase): Promise<ExpoSQLiteDatabase<typeof schema>> {
  if (initializationPromise) {
    return initializationPromise;
  }

  initializationPromise = (async () => {
    // 1. Extensions
    await loadVecExtension(expoDb);

    // 2. Instance
    const db = drizzle(expoDb, { schema });

    // 3. Migrations
    try {
      await migrate(db, migrations);
      console.log('[database] Drizzle migrations applied successfully');
    } catch (err) {
      console.error('[database] Drizzle migration failed:', err);
      throw err;
    }

    // 4. Virtual Tables (Manual FTS5 & sqlite-vec setup)
    await expoDb.execAsync(`
      CREATE VIRTUAL TABLE IF NOT EXISTS screenshot_search_index USING fts5(
        job_id,
        ocr_text,
        keywords
      );

      CREATE VIRTUAL TABLE IF NOT EXISTS screenshot_search_trigram USING fts5(
        job_id,
        ocr_text,
        keywords,
        tokenize='trigram'
      );
    `);

    // 5. Shared Health check logic
    await expoDb.execAsync(`CREATE TABLE IF NOT EXISTS system_health (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      check_time INTEGER NOT NULL,
      check_type TEXT NOT NULL,
      result TEXT NOT NULL
    );`);

    try {
      await performIntegrityCheck(expoDb);
    } catch { /* ignore */ }

    return db;
  })();

  return initializationPromise;
}

async function performIntegrityCheck(db: SQLite.SQLiteDatabase) {
  try {
    const row = await (db as any).getFirstAsync?.(`PRAGMA integrity_check;`);
    let result = '';
    if (row) {
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
    } catch { /* ignore */ }
    return { ok: false, result: msg };
  }
}

export async function runDatabaseHealthCheck() {
  const db = await getJobJournalDatabase();
  return performIntegrityCheck(db);
}

export async function initializeJobJournalDatabase() {
  await getDrizzleDb();
}
export async function getJobJournalDatabase() {
  if (!databasePromise) {
    databasePromise = (async () => {
      // V2: Migrated to Drizzle ORM. Changing filename to ensure a clean Drizzle-owned schema.
      const db = await SQLite.openDatabaseAsync('ss-search.db', {
        enableChangeListener: true
      });
      await initializeDatabase(db);
      return db;
    })();
  }

  return databasePromise;
}


export async function getDrizzleDb() {
  if (!drizzlePromise) {
    drizzlePromise = (async () => {
      const expoDb = await getJobJournalDatabase();
      return await initializeDatabase(expoDb);
    })();
  }
  return drizzlePromise;
}
