// ============================================
// agent-session.ts
// Session management for agent mode conversations.
// Creates and loads sessions with mode="agent" and manages
// the conversation turn history stored in collected_data.
// Connected to: src/core/session-manager.ts (loadAuthorizedSession, getSession)
// Connected to: src/types/session.ts (Session, SessionMode)
// Connected to: src/types/agent.ts (ConversationTurn)
// ============================================

import { supabaseAdmin } from "../lib/supabase.js";
import { loadAuthorizedSession, type SessionLoadResult } from "./session-manager.js";
import { config } from "../config.js";
import type { Session } from "../types/session.js";
import type { AuthContext } from "../types/auth.js";
import type { ConversationTurn } from "../types/agent.js";

/**
 * Creates a new agent session (mode="agent", no mission).
 * Returns the created session or null on failure.
 */
export async function createAgentSession(params: {
  workspaceId: string;
  profileId: string;
  userId?: string;
  channel: "chat" | "voice";
}): Promise<Session | null> {
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + config.SESSION_EXPIRY_HOURS);

  const { data: session, error } = await supabaseAdmin
    .from("engine_sessions")
    .insert({
      mode: "agent",
      mission_id: null,
      workspace_id: params.workspaceId,
      user_id: params.userId ?? null,
      profile_id: params.profileId,
      channel: params.channel,
      current_stage_id: null,
      stage_index: -1,
      status: "active",
      context: {},
      collected_data: { conversation: [] },
      callback_url: null,
      expires_at: expiresAt.toISOString(),
    })
    .select()
    .single();

  if (error || !session) {
    console.error("[agent-session] Failed to create agent session:", error?.message);
    return null;
  }

  return session as Session;
}

/**
 * Loads an agent session with workspace authorization.
 * Delegates to the shared session loader and verifies the session is in agent mode.
 */
export async function loadAgentSession(
  sessionId: string,
  auth: AuthContext,
): Promise<SessionLoadResult> {
  const result = await loadAuthorizedSession(sessionId, auth);
  if (!result.ok) return result;

  if (result.session.mode !== "agent") {
    return {
      ok: false,
      status: 403,
      message: "Session is not in agent mode",
    };
  }

  return result;
}

/**
 * Appends a conversation turn to the session's collected_data.conversation array.
 * Uses an atomic Postgres jsonb_set + array append via RPC to avoid race conditions
 * when concurrent messages (user + assistant) arrive close together.
 */
export async function appendConversationTurn(
  sessionId: string,
  turn: ConversationTurn,
): Promise<void> {
  // Atomic append using jsonb_set with array concatenation — no read-modify-write race
  const { error } = await supabaseAdmin.rpc("append_conversation_turn", {
    p_session_id: sessionId,
    p_turn: turn as unknown as Record<string, unknown>,
  });

  if (error) {
    // Fallback to read-modify-write if RPC doesn't exist yet (pre-migration)
    console.warn(
      "[agent-session] RPC append_conversation_turn failed, using fallback:",
      error.message,
    );

    const { data: session } = await supabaseAdmin
      .from("engine_sessions")
      .select("collected_data")
      .eq("id", sessionId)
      .single();

    if (!session) {
      console.error("[agent-session] Session not found for conversation append:", sessionId);
      return;
    }

    const collectedData = (session.collected_data ?? {}) as Record<string, unknown>;
    const conversation = (collectedData.conversation ?? []) as ConversationTurn[];
    conversation.push(turn);

    const { error: updateError } = await supabaseAdmin
      .from("engine_sessions")
      .update({
        collected_data: { ...collectedData, conversation },
        updated_at: new Date().toISOString(),
      })
      .eq("id", sessionId);

    if (updateError) {
      console.error("[agent-session] Failed to append conversation turn:", updateError.message);
    }
  }
}

/**
 * Gets the conversation history from a session's collected_data.
 */
export function getConversationHistory(session: Session): ConversationTurn[] {
  const collectedData = session.collected_data ?? {};
  return (collectedData.conversation ?? []) as ConversationTurn[];
}
