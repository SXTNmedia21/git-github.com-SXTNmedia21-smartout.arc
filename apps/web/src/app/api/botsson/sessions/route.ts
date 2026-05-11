/**
 * GET /api/botsson/sessions
 *
 * BFF endpoint: lists the authenticated profile's chat-mode Botsson sessions
 * (mode='agent', channel='chat', is_archived=false), 50 most recent.
 *
 * Auth (ADR-0151): workspace_id + profile_id derived server-side from JWT-resolved
 * profile via getServerContext. Client never supplies them.
 *
 * Single source of truth (ADR-0296): engine_sessions.collected_data.conversation
 * is the canonical chat-persistence surface. emma_* tables dropped in migration
 * 20260529000000.
 *
 * Fail-fast (L-0177): missing/empty workspace_id or profile_id → 403.
 * No silent fallback to JWT-default workspace.
 *
 * anon+JWT client only — no service-role per Law 5. RLS policy
 * workspace_isolation_sessions scopes results to caller's workspace.
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getServerContext } from "@/lib/auth/get-server-context";
import { createClient } from "@smartout/supabase/server";
import type { SessionListItem } from "./_schema";

export async function GET(request: NextRequest) {
  const ctx = await getServerContext(request);

  // 401: no auth at all
  if (!ctx) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  // L-0177 fail-fast: explicit workspace_id + profile_id required.
  // No silent fallback — missing profile or empty IDs → 403.
  if (!ctx.profile?.workspace_id || !ctx.profile?.profile_id) {
    return NextResponse.json({ error: "no_workspace_profile" }, { status: 403 });
  }

  const { profile } = ctx;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("engine_sessions")
    .select(
      "id, summary, created_at, updated_at, channel, mode, collected_data, status, is_archived",
    )
    .eq("workspace_id", profile.workspace_id)
    .eq("profile_id", profile.profile_id)
    .eq("mode", "agent")
    .eq("channel", "chat")
    .eq("is_archived", false)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: "list_failed", details: error.message }, { status: 500 });
  }

  const sessions: SessionListItem[] = (data ?? []).map((row) => {
    // Derive turn_count and last_turn_at from collected_data.conversation array.
    // Falls back to updated_at when conversation array is empty or missing.
    const conversation =
      (row.collected_data as { conversation?: Array<{ timestamp?: string }> } | null)
        ?.conversation ?? [];
    const lastTurnAt =
      conversation.length > 0
        ? (conversation[conversation.length - 1]?.timestamp ?? row.updated_at)
        : row.updated_at;

    return {
      id: row.id,
      summary: row.summary,
      started_at: row.created_at,
      last_turn_at: lastTurnAt,
      turn_count: conversation.length,
      channel: row.channel as "chat" | "voice",
      mode: "agent" as const,
    };
  });

  return NextResponse.json({ sessions });
}
