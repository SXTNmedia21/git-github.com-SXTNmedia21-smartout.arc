// ============================================
// memory-manager.ts
// Manages persistent memory for agent conversations.
// Memories are per-profile, per-workspace, and can expire.
// Connected to: engine_memory table (Supabase)
// Connected to: src/core/agent-router.ts (loads memories for prompt context)
// ============================================

import { supabaseAdmin } from "../lib/supabase.js";

export type Memory = {
  id: string;
  memory_type: "preference" | "fact" | "summary";
  content: string;
  created_at: string;
};

/**
 * Loads the most recent non-expired memories for a profile.
 * Used to provide conversational context to the agent.
 */
export async function loadRecentMemories(
  workspaceId: string,
  profileId: string,
  limit = 5,
): Promise<Memory[]> {
  const { data, error } = await supabaseAdmin
    .from("engine_memory")
    .select("id, memory_type, content, created_at")
    .eq("workspace_id", workspaceId)
    .eq("profile_id", profileId)
    .or("expires_at.is.null,expires_at.gt.now()")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data) return [];
  return data as Memory[];
}

/**
 * Saves a new memory for a profile.
 * Memories can be preferences, facts, or conversation summaries.
 */
export async function saveMemory(params: {
  workspaceId: string;
  profileId: string;
  memoryType: "preference" | "fact" | "summary";
  content: string;
  sourceSessionId?: string;
  expiresAt?: string;
}): Promise<void> {
  await supabaseAdmin.from("engine_memory").insert({
    workspace_id: params.workspaceId,
    profile_id: params.profileId,
    memory_type: params.memoryType,
    content: params.content,
    source_session_id: params.sourceSessionId ?? null,
    expires_at: params.expiresAt ?? null,
  });
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
