// ============================================
// memory-manager.ts
// Manages persistent memory for agent conversations.
// Memories are per-profile, per-workspace, and can expire.
// Connected to: engine_memory table (Supabase)
// Connected to: src/core/agent-router.ts (loads memories for prompt context)
// ============================================
//
// Note: loadRecentMemories below is legacy and currently unused — the live
// memory read path runs through packages/ai/src/context/collector.ts
// (collectContext), and that call site is recorded directly in agent-router.
// We still add a recorder hook here so any future caller that reuses this
// helper is covered automatically (ADR-0184).

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "../lib/supabase.js";
import { getRecorder } from "./session-recorder.js";

export type Memory = {
  id: string;
  memory_type: "preference" | "fact" | "summary";
  content: string;
  created_at: string;
};

/**
 * Loads the most recent non-expired memories for a profile.
 * Used to provide conversational context to the agent.
 *
 * `sessionId` is optional — when provided, the recorder captures the read as
 * a memory_read turn (context_collect phase). Omit it when calling from a
 * non-turn context (e.g. background eviction) to skip recording cleanly.
 */
export async function loadRecentMemories(
  workspaceId: string,
  profileId: string,
  limit = 5,
  sessionId?: string,
): Promise<Memory[]> {
  const { data, error } = await supabaseAdmin
    .from("engine_memory")
    .select("id, memory_type, content, created_at")
    .eq("workspace_id", workspaceId)
    .eq("profile_id", profileId)
    .or("expires_at.is.null,expires_at.gt.now()")
    .order("created_at", { ascending: false })
    .limit(limit);

  const memories: Memory[] = error || !data ? [] : (data as Memory[]);

  if (sessionId) {
    try {
      getRecorder()?.recordTurn({
        sessionId,
        workspaceId,
        profileId,
        turnKind: "memory_read",
        phase: "context_collect",
        content: { memory_count: memories.length },
      });
    } catch {
      // Recorder must never throw into the primary path.
    }
  }

  return memories;
}

/**
 * Saves a new memory for a profile.
 * Memories can be preferences, facts, or conversation summaries.
 *
 * When `sourceSessionId` is provided, the recorder captures the write as a
 * memory_write turn (post_turn phase). This path is currently unused — live
 * agent writes go through packages/ai/src/context/memory-writer.ts and the
 * save_memory capability tool (which records via the boundary shim). The
 * hook here covers any future caller of this helper.
 */
export async function saveMemory(params: {
  workspaceId: string;
  profileId: string;
  memoryType: "preference" | "fact" | "summary";
  content: string;
  sourceSessionId?: string;
  expiresAt?: string;
}): Promise<{ id: string | null }> {
  const client = supabaseAdmin as unknown as SupabaseClient;
  const { data, error } = await client
    .from("engine_memory")
    .insert({
      workspace_id: params.workspaceId,
      profile_id: params.profileId,
      memory_type: params.memoryType,
      content: params.content,
      source_session_id: params.sourceSessionId ?? null,
      expires_at: params.expiresAt ?? null,
    })
    .select("id")
    .single();

  const id = (error || !data ? null : (data as { id: string }).id) ?? null;

  if (id && params.sourceSessionId) {
    try {
      getRecorder()?.recordTurn({
        sessionId: params.sourceSessionId,
        workspaceId: params.workspaceId,
        profileId: params.profileId,
        turnKind: "memory_write",
        phase: "post_turn",
        content: {
          memory_id: id,
          memory_type: params.memoryType,
        },
      });
    } catch {
      // Recorder must never throw into the primary path.
    }
  }

  return { id };
}

/**
 * Deletes all expired memories from the database.
 * Intended to be called periodically (e.g., alongside session cleanup).
 * Returns the count of deleted memories.
 */
export async function cleanExpiredMemories(): Promise<number> {
  const { data, error } = await supabaseAdmin
    .from("engine_memory")
    .delete()
    .lt("expires_at", new Date().toISOString())
    .not("expires_at", "is", null)
    .select("id");

  if (error) return 0;
  return data?.length ?? 0;
}
