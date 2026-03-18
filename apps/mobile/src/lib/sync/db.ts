/**
 * SQLite database for the offline write queue.
 *
 * Opens (or creates) the `smartout_sync.db` database and ensures the
 * `pending_writes` table exists. This is the local persistence layer
 * that survives app restarts — writes queued here are drained by the
 * SyncWorker when connectivity is available.
 */
import * as SQLite from "expo-sqlite";

const DB_NAME = "smartout_sync.db";

let dbInstance: SQLite.SQLiteDatabase | null = null;

/** Returns the singleton SQLite database, creating the pending_writes table on first call. */
export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (dbInstance) return dbInstance;

  const db = await SQLite.openDatabaseAsync(DB_NAME);

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS pending_writes (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      action      TEXT NOT NULL,
      payload     TEXT NOT NULL,
      row_id      TEXT NOT NULL,
      status      TEXT NOT NULL DEFAULT 'pending',
      retry_count INTEGER NOT NULL DEFAULT 0,
      created_at  TEXT NOT NULL,
      synced_at   TEXT
    );
  `);

  dbInstance = db;
  return db;
}
