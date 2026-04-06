/**
 * Web fallback for expo-sqlite.
 * Returns a no-op database — offline sync queue is disabled on web.
 * Employees have connectivity; writes go directly to Supabase.
 * Metro resolves `expo-sqlite` to this file when building for web.
 */

export interface SQLiteDatabase {
  execAsync(sql: string): Promise<void>;
  getAllAsync<T = any>(sql: string, params?: any[]): Promise<T[]>;
  getFirstAsync<T = any>(sql: string, params?: any[]): Promise<T | null>;
  runAsync(sql: string, params?: any[]): Promise<{ lastInsertRowId: number; changes: number }>;
}

const noOpDb: SQLiteDatabase = {
  async execAsync() {},
  async getAllAsync() {
    return [];
  },
  async getFirstAsync() {
    return null;
  },
  async runAsync() {
    return { lastInsertRowId: 0, changes: 0 };
  },
};

export async function openDatabaseAsync(_name: string): Promise<SQLiteDatabase> {
  return noOpDb;
}

export default { openDatabaseAsync };
