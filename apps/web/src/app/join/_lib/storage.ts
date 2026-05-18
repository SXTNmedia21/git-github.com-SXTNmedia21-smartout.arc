import type { JoinState } from "../types";
import { JOIN_STORAGE_KEY, JOIN_STORAGE_TTL_MS, JOIN_STORAGE_SCHEMA_VERSION } from "../types";

type StorageEnvelope = {
  schemaVersion: number;
  savedAt: string; // ISO-8601
  state: JoinState;
};

/**
 * Persists the current wizard state to localStorage wrapped in a versioned
 * envelope that carries a TTL timestamp and schema version for safe migration.
 *
 * ADR-0357 invariant: wizard state NEVER stores Supabase access tokens.
 * Only user-supplied form data (company name, email, hours, etc.) is written.
 */
export function saveJoinState(state: JoinState): void {
  if (typeof window === "undefined") return;
  try {
    const envelope: StorageEnvelope = {
      schemaVersion: JOIN_STORAGE_SCHEMA_VERSION,
      savedAt: new Date().toISOString(),
      state,
    };
    localStorage.setItem(JOIN_STORAGE_KEY, JSON.stringify(envelope));
  } catch {
    // best-effort
  }
}

/**
 * Loads persisted wizard state from localStorage.
 *
 * Purges entries that are:
 * - not a valid envelope object (legacy pre-envelope format)
 * - from a different schema version
 * - older than JOIN_STORAGE_TTL_MS
 *
 * Returns null when no valid, in-TTL envelope exists.
 */
export function loadJoinState(): Partial<JoinState> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(JOIN_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StorageEnvelope> & Record<string, unknown>;
    // Legacy entries (pre-envelope) have step1/step2 etc. directly. Migrate by purging.
    if (!parsed || typeof parsed !== "object" || typeof parsed.schemaVersion !== "number") {
      localStorage.removeItem(JOIN_STORAGE_KEY);
      return null;
    }
    if (parsed.schemaVersion !== JOIN_STORAGE_SCHEMA_VERSION) {
      localStorage.removeItem(JOIN_STORAGE_KEY);
      return null;
    }
    if (typeof parsed.savedAt !== "string") {
      localStorage.removeItem(JOIN_STORAGE_KEY);
      return null;
    }
    const savedAtMs = Date.parse(parsed.savedAt);
    if (Number.isNaN(savedAtMs) || Date.now() - savedAtMs > JOIN_STORAGE_TTL_MS) {
      localStorage.removeItem(JOIN_STORAGE_KEY);
      return null;
    }
    return parsed.state as Partial<JoinState>;
  } catch {
    return null;
  }
}

/**
 * Removes the persisted wizard envelope from localStorage.
 * Called on successful signup completion to prevent stale state on next visit.
 */
export function clearJoinState(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(JOIN_STORAGE_KEY);
  } catch {
    // best-effort
  }
}
