/**
 * GET /api/emma/session
 *
 * BFF endpoint: reads the active onboarding-interview engine_session for the
 * authenticated user's workspace. Replaces the client-side `getOnboardingState`
 * Ultravox temporaryTool (ADR-0282 Phase E T2.1).
 *
 * Auth (ADR-0151): workspace_id is derived server-side from the JWT-resolved
 * profile. The client never supplies it.
 *
 * Query discriminator (KRIT-1 / pre-Phase-E foundation):
 *   mission_id = 'onboarding-interview' AND mode = 'agent'
 * No process_id column exists on engine_sessions — see A2 rewrite note in plan.
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getServerContext } from "@/lib/auth/get-server-context";
import { createClient } from "@smartout/supabase/server";

export async function GET(request: NextRequest) {
  const ctx = await getServerContext(request);

  if (!ctx || !ctx.profile?.workspace_id) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const { profile } = ctx;
  const supabase = await createClient();

  // Note: engine_sessions has no `state` column. The lifecycle column is `status`.
  // Onboarding progress lives in `collected_data` (JSON). We return both so the
  // caller can derive current section from collected_data without a second query.
  const { data, error } = await supabase
    .from("engine_sessions")
    .select("id, mode, mission_id, status, collected_data")
    .eq("workspace_id", profile.workspace_id)
    .eq("mission_id", "onboarding-interview")
    .eq("mode", "agent")
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: "session_query_failed", details: error.message },
      { status: 500 },
    );
  }

  if (!data) {
    return NextResponse.json({ error: "session_not_found" }, { status: 404 });
  }

  return NextResponse.json({
    sessionId: data.id,
    mode: data.mode,
    missionId: data.mission_id,
    status: data.status,
    collectedData: data.collected_data,
  });
}
