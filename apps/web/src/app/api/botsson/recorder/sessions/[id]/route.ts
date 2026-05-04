/**
 * GET /api/botsson/recorder/sessions/[id]
 *
 * Full session dump — returns every recorded turn ordered by turn_index.
 * Used by:
 *   - Platform Admin TurnTimeline replay view (ADR-0185)
 *   - Arena Log-view detail modal
 *
 * Auth: any authenticated user. RLS on agent_session_recording enforces
 * workspace scoping (jwt_admin_read_asr) and platform-admin cross-workspace
 * reads (godmode_read_asr). Non-admins see nothing for sessions outside
 * their workspace — that surfaces as a 404 here (indistinguishable from
 * "session does not exist", which is intentional: don't leak existence).
 *
 * No mutation, no emit.
 */

import { NextResponse } from "next/server";
import { createClient } from "@smartout/supabase/server";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id: sessionId } = await params;
  const supabase = await createClient();

  // 1. Auth
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Fetch turns — RLS does the workspace/godmode scoping.
  const { data: turns, error } = await supabase
    .from("agent_session_recording")
    .select("*")
    .eq("session_id", sessionId)
    .order("turn_index");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!turns || turns.length === 0) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  return NextResponse.json({
    session_id: sessionId,
    workspace_id: turns[0]!.workspace_id,
    turn_count: turns.length,
    turns,
  });
}
