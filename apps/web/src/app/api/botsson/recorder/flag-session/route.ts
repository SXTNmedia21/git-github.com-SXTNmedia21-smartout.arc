/**
 * POST /api/botsson/recorder/flag-session
 *
 * Flags an ENTIRE session — every agent_session_recording row matching
 * (session_id, workspace_id) is updated with is_flagged=true + flag_reason
 * + flagged_by_profile_id. Complements the per-turn /flag endpoint when the
 * admin wants to mark the whole session (e.g. "Emma behaved wrong all the
 * way through — flag everything for retention + review").
 *
 * Called from:
 *   - AdminActionDrawer "Flag hele sesjonen" button (Platform Admin).
 *   - Arena LogView hover-flag affordance will call this once Phase 2b
 *     rewires the UI to include session_id in the payload. Until then the
 *     Zod check rejects that call with 400 and the UI alert-fallback fires.
 *
 * Auth: workspace admin/owner (RLS + role gate). Godmode cross-workspace
 * access is honoured via the RLS policy `godmode_rw_recording`.
 *
 * profile_id is resolved server-side from auth.uid() (ADR-0151) — never
 * accepted from the request body. emit() fires with non-empty workspace_id
 * + actor_id (ADR-0152 fail-fast contract).
 *
 * Retention impact: fan-out flag extends retention for every flagged row
 * from 90d → 365d via the existing retention policy on
 * agent_session_recording (see ADR-0184 § Retention).
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@smartout/supabase/server";
import { emit, nonEmpty } from "@smartout/telemetry";
const FlagSessionSchema = z.object({
  session_id: z.string().uuid(),
  reason: z.string().min(1).max(500),
  // Optional LogView metadata — carried through for audit context when the
  // flag originates from a specific row in Arena LogView. The drawer has no
  // row-level context and omits these.
  entry_type: z.string().max(100).optional(),
  entry_content: z.string().max(2000).optional(),
  timestamp: z.number().optional(),
});

export async function POST(request: Request) {
  const supabase = await createClient();

  // 1. Auth
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Parse body
  let parsed: z.infer<typeof FlagSessionSchema>;
  try {
    const raw = (await request.json()) as unknown;
    parsed = FlagSessionSchema.parse(raw);
  } catch (err) {
    const message =
      err instanceof z.ZodError
        ? err.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ")
        : "Invalid request body";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  // 3. Resolve actor profile (ADR-0151)
  const { data: profile } = await supabase
    .from("profile")
    .select("profile_id, workspace_id, role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile || !["admin", "owner"].includes(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // 4. Fan-out flag all turns on this session in the actor's workspace.
  // Defence-in-depth: explicit workspace_id AND session_id scoping so a
  // drifted RLS policy can't leak cross-workspace flagging.
  const { data: updated, error } = await supabase
    .from("agent_session_recording")
    .update({
      is_flagged: true,
      flag_reason: parsed.reason,
      flagged_by_profile_id: profile.profile_id,
    })
    .eq("session_id", parsed.session_id)
    .eq("workspace_id", profile.workspace_id)
    .select("id");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const flaggedTurnCount = updated?.length ?? 0;
  if (flaggedTurnCount === 0) {
    // No turns matched — either the session doesn't exist, or it belongs
    // to another workspace. 404 is the honest answer; we don't leak which.
    return NextResponse.json({ error: "Session not found in workspace" }, { status: 404 });
  }

  // 5. Emit — non-empty IDs enforced by fail-fast at call site (ADR-0152).
  await emit({
    event: "recorder.session_flagged",
    workspace_id: nonEmpty(profile.workspace_id, "workspace_id"),
    actor_id: nonEmpty(profile.profile_id, "actor_id"),
    properties: {
      entity: { entity_type: "agent_session", entity_id: parsed.session_id },
      data: {
        session_id: parsed.session_id,
        reason: parsed.reason,
        flagged_turn_count: flaggedTurnCount,
        entry_type: parsed.entry_type ?? "",
        entry_content: parsed.entry_content ?? "",
        timestamp: parsed.timestamp ?? 0,
      },
    },
  });

  return NextResponse.json({
    session_id: parsed.session_id,
    flagged_turn_count: flaggedTurnCount,
  });
}
