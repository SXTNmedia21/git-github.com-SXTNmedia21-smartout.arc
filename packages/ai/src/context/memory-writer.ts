// packages/ai/src/context/memory-writer.ts
//
// Producer-side helper for engine_memory. The reader lives in
// `context/collector.ts` (injects top-10 memories into every prompt). The
// writer previously existed only as a service-role helper in
// services/stage-engine/src/core/memory-manager.ts with no callers from the
// agent runtime — see BOTSSON-SYSTEM-MAP.md (Phase A3) and
// docs/plans/PLAN-engine-memory-writer.md.
//
// This module gives every capability tool and future session-summary writer
// ONE shared surface:
//
//   - normalises memory_type / scope to the values the DB CHECK constraints
//     accept (migration 20260319120000_fix_engine_memory_constraints.sql)
//   - clamps importance to [0, 1]
//   - blocks known-PII content from landing in memory (defence in depth;
//     see ADR-0077/0078)
//   - leaves `embedding` NULL for now — the pgvector column is nullable and
//     the collector ranks by importance, not by similarity yet. Populating
//     embeddings is a future enhancement, tracked in the A3 plan.
//
// The gate (`gate_action`) is NOT called here — the writer is a pure helper.
// Callers that are capability tools MUST call gate_action themselves before
// invoking saveMemory() (ADR-0099). This keeps the writer reusable from
// non-gated paths (e.g. session-end summary writer, background jobs) where a
// system actor is the writer.
//
// Connected to:
//   - packages/ai/src/capabilities/memory/tools.ts (agent-facing save_memory tool)
//   - packages/ai/src/context/collector.ts         (reader — surfaces memories in prompts)

import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Memory types accepted by the engine_memory CHECK constraint.
 * Keep in sync with migration 20260319120000_fix_engine_memory_constraints.sql.
 */
export type MemoryType = "preference" | "fact" | "summary" | "general" | "constant";

/**
 * Scope values accepted by the engine_memory CHECK constraint.
 * Keep in sync with migration 20260319120000_fix_engine_memory_constraints.sql.
 */
export type MemoryScope = "personal" | "team" | "workspace" | "conversation" | "onboarding";

export type SaveMemoryParams = {
  supabaseAdmin: SupabaseClient;
  workspaceId: string;
  profileId: string;
  content: string;
  memoryType?: MemoryType;
  scope?: MemoryScope;
  importance?: number;
  expiresAt?: string | null;
  sourceSessionId?: string | null;
};

export type SaveMemoryResult =
  | { ok: true; id: string }
  | {
      ok: false;
      reason: "empty_content" | "pii_blocked" | "invalid_ids" | "db_error";
      detail?: string;
    };

/**
 * Conservative PII heuristics. Any memory whose content matches these patterns
 * is refused. We block at write-time — even if a tool forgets the channel
 * guard, we never persist a personnummer or bank account number.
 *
 * Patterns intentionally err on the side of false positives. If this causes
 * friction for legitimate content, tighten them rather than loosening.
 */
const PII_PATTERNS: ReadonlyArray<RegExp> = [
  // Norwegian personnummer (11 digits, optionally separated)
  /\b\d{6}[\s-]?\d{5}\b/,
  // Norwegian bank account (11 digits, often formatted 4-2-5)
  /\b\d{4}[\s.-]?\d{2}[\s.-]?\d{5}\b/,
  // IBAN-like
  /\b[A-Z]{2}\d{2}[A-Z0-9]{10,30}\b/,
  // Credit-card-ish 13-19 digit runs
  /\b\d{13,19}\b/,
];

function looksLikePII(content: string): boolean {
  return PII_PATTERNS.some((rx) => rx.test(content));
}

/**
 * Persists a memory row for the given profile. Returns `{ ok: false }` on
 * any validation or DB error so callers can translate into a user-facing
 * message without throwing across the capability boundary.
 *
 * Telemetry is NOT emitted here — `toVercelTools` emits `botsson.tool_invoked`
 * per tool call (ADR-0116), which is the agent-facing signal. System-level
 * writers (e.g. session-summary) should emit their own named event.
 */
export async function saveMemory(params: SaveMemoryParams): Promise<SaveMemoryResult> {
  const {
    supabaseAdmin,
    workspaceId,
    profileId,
    content,
    memoryType = "fact",
    scope = "personal",
    importance = 0.5,
    expiresAt = null,
    sourceSessionId = null,
  } = params;

  // Fail fast on empty / forgeable identifiers. `emit()` in ADR-0116 forbids
  // empty-string IDs; we hold the same line for DB writes.
  if (!workspaceId || !profileId) {
    return { ok: false, reason: "invalid_ids" };
  }

  const trimmed = content.trim();
  if (trimmed.length === 0) {
    return { ok: false, reason: "empty_content" };
  }

  if (looksLikePII(trimmed)) {
    return { ok: false, reason: "pii_blocked" };
  }

  const clampedImportance = Math.max(0, Math.min(1, importance));

  const { data, error } = await supabaseAdmin
    .from("engine_memory")
    .insert({
      workspace_id: workspaceId,
      profile_id: profileId,
      content: trimmed,
      memory_type: memoryType,
      scope,
      importance: clampedImportance,
      source_session_id: sourceSessionId,
      expires_at: expiresAt,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { ok: false, reason: "db_error", detail: error?.message };
  }

  return { ok: true, id: data.id as string };
}
