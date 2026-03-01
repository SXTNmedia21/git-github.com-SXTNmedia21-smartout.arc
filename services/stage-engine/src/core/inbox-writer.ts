// ============================================
// inbox-writer.ts
// Validates and writes agent data to the engine_inbox table.
// All agent-stored data goes through here — never directly to entity tables.
// Connected to: DECISIONS.md D2 (inbox model)
// Connected to: src/routes/store.ts (route handler)
// ============================================

import { supabaseAdmin } from "../lib/supabase.js";
import type { InboxEntry } from "../types/session.js";

/** Maximum size for the data payload in bytes (100KB) */
const MAX_DATA_SIZE = 100 * 1024;

/**
 * Validates store request data before writing to inbox.
 * Returns an error message string if invalid, null if valid.
 */
export function validateStoreData(
  entityType: string,
  data: Record<string, unknown>,
): string | null {
  if (!entityType || entityType.trim().length === 0) {
    return "entity_type must be a non-empty string";
  }

  if (!data || typeof data !== "object" || Object.keys(data).length === 0) {
    return "data must be a non-empty object";
  }

  // Check data size
  const serialized = JSON.stringify(data);
  if (serialized.length > MAX_DATA_SIZE) {
    return `data exceeds maximum size of ${MAX_DATA_SIZE / 1024}KB`;
  }

  return null;
}

/**
 * Writes a data entry to the engine_inbox table.
 *
 * @returns The created inbox entry, or null on failure
 */
export async function writeToInbox(params: {
  sessionId: string;
  stageId: string;
  workspaceId: string;
  entityType: string;
  data: Record<string, unknown>;
}): Promise<InboxEntry | null> {
  const { data: entry, error } = await supabaseAdmin
    .from("engine_inbox")
    .insert({
      session_id: params.sessionId,
      stage_id: params.stageId,
      workspace_id: params.workspaceId,
      entity_type: params.entityType,
      data: params.data,
    })
    .select()
    .single();

  if (error) {
    console.error("[inbox-writer] Failed to write:", error.message);
    return null;
  }

  return entry as InboxEntry;
}
