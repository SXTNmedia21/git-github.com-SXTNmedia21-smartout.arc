/**
 * BFF GET /api/journey/guided/:runId/status — read-only run state.
 *
 * ADR-0132 (Mobile AI Routing): mobile thin client reads state through BFF.
 * ADR-0176 Invariant 3: workspace scoping is derived SERVER-SIDE from the
 *          authenticated session. Cross-workspace reads return 404 (not 403)
 *          to prevent enumeration attacks.
 *
 * Auth: dual path (cookie / Bearer) matching /api/journey/guided/start.
 * Returns: { status, current_step, steps[], started_at, completed_at, last_error }.
 *
 * Read-only — never emits telemetry.
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@smartout/supabase/server";
import { createAdminClient } from "@smartout/supabase/admin";

type AuthResult = {
  userId: string;
  workspaceId: string;
  profileId: string;
};

function rejectCrossOrigin(request: NextRequest): NextResponse | null {
  const origin = request.headers.get("origin");
  if (!origin) return null;
  const host = request.headers.get("host");
  if (!host) return NextResponse.json({ error: "Missing host header" }, { status: 400 });
  try {
    const originHost = new URL(origin).host;
    if (originHost !== host) {
      return NextResponse.json({ error: "Cross-origin forbidden" }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ error: "Invalid origin" }, { status: 400 });
  }
  return null;
}

async function resolveAuth(request: NextRequest): Promise<AuthResult | null> {
  const authHeader = request.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  const admin = createAdminClient();
  let userId: string | null = null;

  if (bearerToken) {
    const { data, error } = await admin.auth.getUser(bearerToken);
    if (error || !data.user) return null;
    userId = data.user.id;
  } else {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    userId = user.id;
  }

  const { data: profile, error: profileErr } = await admin
    .from("profile")
    .select("profile_id, workspace_id")
    .eq("user_id", userId)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (profileErr || !profile) return null;
  if (!profile.profile_id || !profile.workspace_id) return null;

  return {
    userId,
    profileId: profile.profile_id,
    workspaceId: profile.workspace_id,
  };
}

export async function GET(request: NextRequest, context: { params: Promise<{ runId: string }> }) {
  // 0. CORS — reject cross-origin before DB touch.
  const cors = rejectCrossOrigin(request);
  if (cors) return cors;

  // 1. Auth.
  const auth = await resolveAuth(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // 2. Param validation — UUID only.
  const { runId } = await context.params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(runId)) {
    return NextResponse.json({ error: "Invalid run id" }, { status: 400 });
  }

  // 3. Workspace-scoped read on engine_state.
  // Cross-workspace = 404 (ADR-0176 enumeration prevention).
  const admin = createAdminClient();
  const { data: state, error: stateErr } = await admin
    .from("engine_state")
    .select(
      "id, workspace_id, status, current_step, started_at, completed_at, last_error, steps_snapshot",
    )
    .eq("id", runId)
    .maybeSingle();

  if (stateErr || !state || state.workspace_id !== auth.workspaceId) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }

  // 4. Fetch step detail for progress rendering.
  const { data: steps, error: stepsErr } = await admin
    .from("engine_state_step")
    .select("id, step_order, action_type, status, completed_at, result")
    .eq("state_id", runId)
    .order("step_order", { ascending: true });

  if (stepsErr) {
    return NextResponse.json({ error: "Step read failed" }, { status: 500 });
  }

  return NextResponse.json({
    run_id: state.id,
    status: state.status,
    current_step: state.current_step,
    started_at: state.started_at,
    completed_at: state.completed_at,
    last_error: state.last_error,
    steps: (steps ?? []).map((s) => ({
      id: s.id,
      step_order: s.step_order,
      action_type: s.action_type,
      status: s.status,
      completed_at: s.completed_at,
    })),
  });
}
