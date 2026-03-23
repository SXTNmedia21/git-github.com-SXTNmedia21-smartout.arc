/**
 * MMKV read cache for offline data access.
 *
 * Stores serialized TanStack Query responses so the app can show
 * cached data instantly on launch and while offline. MMKV is a
 * high-performance key-value store backed by memory-mapped files —
 * reads are synchronous and sub-millisecond.
 */
import { MMKV } from "react-native-mmkv";

/** Singleton MMKV instance for all cached query data. */
export const storage = new MMKV({ id: "smartout-cache" });

/** Retrieve a cached value, returning undefined if missing or unparseable. */
export function cacheGet<T>(key: string): T | undefined {
  const raw = storage.getString(key);
  if (raw === undefined) return undefined;

  try {
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
}

/** Store a value in the cache. Serializes to JSON. */
export function cacheSet<T>(key: string, value: T): void {
  storage.set(key, JSON.stringify(value));
}

/** Remove a single key from the cache. */
export function cacheClear(key: string): void {
  storage.delete(key);
}

/** Remove all keys from the cache (e.g. on logout). */
export function cacheClearAll(): void {
  storage.clearAll();
}
