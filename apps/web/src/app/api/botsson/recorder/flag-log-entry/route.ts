/**
 * POST /api/botsson/recorder/flag-log-entry
 *
 * User-initiated escalation from the Arena LogView hover-flag affordance
 * (ADR-0184 Q13, ADR-0185 Phase 2b). Different semantics from
 * /api/botsson/recorder/flag-session:
 *
 *   - Caller is the END USER, not an admin — any authenticated role passes
 *     the role check (employee/manager/admin/owner).
 *   - session_id is resolved SERVER-SIDE from the user's most recent
 *     recorded turn in the last LOOKBACK_MINUTES. The Arena client does
 *     not have access to the stage-engine session_id (agent-sdk swallows
 *     it internally in useAgent's /api/wizard/start response); see
 *     architecture notes at the bottom of this file.
 *   - No DB mutation on agent_session_recording — pure escalation signal
 *     for platform-admin review. Admins follow up via /flag-session if
 *     they want to bump retention on the underlying turns.
 *
 * When no recent session is found, the endpoint still accepts the
 * escalation (session_id resolves to "" in the telemetry payload) so
 * activity_trail records the user's intent even if Emma was not active.
 *
 * Auth: any authenticated profile. profile_id + workspace_id derived from
 * auth.uid() per ADR-0151 — never accepted from the body.
 *
 * Telemetry: emits `recorder.user_flag_submitted` with non-empty
 * workspace_id + actor_id (ADR-0152 fail-fast contract).
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@smartout/supabase/server";
import { emit, nonEmpty } from "@smartout/telemetry";
// How far back we look for the user's active session. 30 minutes covers
// typical Ultravox idle timeouts + the LogView scroll-back window. Beyond
// that the session is stale enough that flagging it retroactively would
// be ambiguous — we record the escalation intent without a session anchor.
const LOOKBACK_MINUTES = 30;

const FlagLogEntrySchema = z.object({
  entry_type: z.string().min(1).max(100),
  entry_content: z.string().min(1).max(2000),
  timestamp: z.number().int().nonnegative(),
  reason: z.string().min(1).max(500),
});

export async function POST(request: Request) {
  const supabase = await createClient();

  // 1. Auth — any authenticated user
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Parse body
  let parsed: z.infer<typeof FlagLogEntrySchema>;
  try {
    const raw = (await request.json()) as unknown;
    parsed = FlagLogEntrySchema.parse(raw);
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
    .select("profile_id, workspace_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile) {
    return NextResponse.json({ error: "No profile found for user" }, { status: 403 });
  }

  // 4. Resolve active session from most recent recorded turn by this actor.
  // RLS on agent_session_recording scopes by workspace + profile already;
  // we add explicit eq() guards for defence-in-depth.
  const lookbackIso = new Date(Date.now() - LOOKBACK_MINUTES * 60_000).toISOString();
  const { data: latestTurn } = await supabase
    .from("agent_session_recording")
    .select("session_id")
    .eq("workspace_id", profile.workspace_id)
    .eq("profile_id", profile.profile_id)
    .gte("created_at", lookbackIso)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const resolvedSessionId = latestTurn?.session_id ?? "";

  // 5. Emit — workspace_id + actor_id are guaranteed non-empty here (we
  // returned 403 above if profile was null). session_id may legitimately
  // be "" when no recent session was found; activity_trail still records
  // the escalation intent.
  await emit({
    event: "recorder.user_flag_submitted",
    workspace_id: nonEmpty(profile.workspace_id, "workspace_id"),
    actor_id: nonEmpty(profile.profile_id, "actor_id"),
    properties: {
      entity: {
        entity_type: "agent_session",
        entity_id: resolvedSessionId || "unknown",
      },
      data: {
        session_id: resolvedSessionId,
        entry_type: parsed.entry_type,
        entry_content: parsed.entry_content,
        timestamp: parsed.timestamp,
        reason: parsed.reason,
      },
    },
  });

  return NextResponse.json({
    session_id: resolvedSessionId,
    recorded: true,
  });
}

/*
 * ─── Architecture note: why server-side session_id resolution? ────────────
 *
 * The Arena LogView's hover-flag button is user-facing, not admin-facing.
 * The end user sees Emma do something surprising and wants to escalate it
 * to Platform Admin. They have no concept of "which stage-engine session
 * am I in"; the SDK (packages/agent-sdk/src/hooks/useAgent.ts) fetches
 * /api/wizard/start internally and consumes the returned session_id
 * without exposing it on the AgentSession return type.
 *
 * Options considered in Phase 2b:
 *   a) Extend AgentConfig with onSessionStart callback — rejected,
 *      agent-sdk is system-agent-coordinator territory (see
 *      .claude/agents/botsson-harness-builder.md scope rules).
 *   b) Make /flag-session session_id optional and fallback — rejected,
 *      conflates admin session flagging with user escalation and would
 *      broaden the admin/owner role gate.
 *   c) Dedicated endpoint (this file) that resolves session_id from the
 *      actor's most recent recording turn — chosen. Clean separation of
 *      concerns, respects ADR-0151 (derive server-side), and is the
 *      natural home for the user-escalation semantics.
 *
 * If a future change exposes session_id on the client (SDK contract
 * change or BotssonProvider tracking the /api/wizard/start response
 * directly), this endpoint can accept an optional session_id hint and
 * skip the lookup — the telemetry shape stays the same.
 */
