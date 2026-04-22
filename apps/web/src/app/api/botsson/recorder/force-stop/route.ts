/**
 * POST /api/botsson/recorder/force-stop
 *
 * ADR-0185 § Force-stop — admin nødbrems. Inserts an auto-generated whisper
 * into `agent_session_whisper` so the NEXT system-prompt rebuild injects
 * "Previous turn interrupted by admin. Begin fresh." via the existing
 * `<admin_note>` pipe in prompt-builder.ts.
 *
 * Called from AdminActionDrawer confirm-hold (800ms hold).
 *
 * Design note — why not `session_lane.status='interrupted'`?
 * --------------------------------------------------------
 * ADR-0185 phrases force-stop as "Setter session_lane.status='interrupted'".
 * That is aspirational: `SessionLane` is an in-memory promise queue in
 * stage-engine (services/stage-engine/src/core/session-lane.ts), NOT a
 * persistence table. `engine_sessions.status` enum is
 * ('active','complete','expired','abandoned') — no 'interrupted' value.
 *
 * The ADR's operational intent — "Neste tur får en auto-generated
 * system-note: 'Previous turn interrupted by admin. Begin fresh.'" — maps
 * 1:1 to the whisper-injection pipe that already works end-to-end. Using
 * it keeps force-stop on a proven, audited path and requires zero new
 * infrastructure. Full evidence is preserved: the whisper row is auditable
 * via agent_session_whisper + activity_trail carries
 * recorder.session_force_stopped.
 *
 * Auth: workspace admin/owner.
 * C4 gate: `engine_authority_config.recorder.force_stop` must not be
 *   `disabled`. Default-closed: absent row also rejects (ADR-0185).
 * ADR-0151: profile_id resolved server-side from auth.uid().
 * ADR-0152: emit() fires with non-empty workspace_id + actor_id.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@smartout/supabase/server";
import { emit } from "@smartout/telemetry";

const ForceStopSchema = z.object({
  session_id: z.string().uuid(),
  reason: z.string().max(500).optional(),
});

// Exact phrasing per ADR-0185 § Force-stop. Kept stable so prompt-builder
// tests can assert the guidance the LLM receives when an admin hits the brake.
const SYSTEM_NOTE_CONTENT =
  "System note: Previous turn interrupted by admin. Begin fresh. Do not continue the prior thought — start from the user's next input.";

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
  let parsed: z.infer<typeof ForceStopSchema>;
  try {
    const raw = (await request.json()) as unknown;
    parsed = ForceStopSchema.parse(raw);
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

  // 4. C4 authority gate — recorder.force_stop must not be disabled.
  // Absent row = default closed. Default seed level is "confirm" per
  // supabase/migrations/20260515120400_recorder_authority_seed.sql.
  const { data: authority } = await supabase
    .from("engine_authority_config")
    .select("level")
    .eq("workspace_id", profile.workspace_id)
    .eq("capability", "recorder.force_stop")
    .maybeSingle();

  if (!authority || authority.level === "disabled") {
    return NextResponse.json({ error: "Force-stop disabled for this workspace" }, { status: 403 });
  }

  // 5. Insert the auto-generated system-note whisper. The prompt-builder
  // consumes this on the next advanceStage() call and marks it consumed.
  const { data: inserted, error } = await supabase
    .from("agent_session_whisper")
    .insert({
      session_id: parsed.session_id,
      workspace_id: profile.workspace_id,
      admin_profile_id: profile.profile_id,
      content: SYSTEM_NOTE_CONTENT,
    })
    .select("id, session_id")
    .single();

  if (error || !inserted) {
    return NextResponse.json(
      { error: error?.message ?? "Force-stop whisper insert failed" },
      { status: 500 },
    );
  }

  // 6. Emit — ADR-0152 non-empty IDs. `reason` defaults to "" when the
  // caller didn't supply one (drawer fires without reason; keyboard-held
  // cancellations rarely have time for typing).
  await emit({
    event: "recorder.session_force_stopped",
    workspace_id: profile.workspace_id,
    actor_id: profile.profile_id,
    properties: {
      entity: { entity_type: "agent_session", entity_id: parsed.session_id },
      data: {
        session_id: parsed.session_id,
        reason: parsed.reason ?? "",
        whisper_id: inserted.id,
      },
    },
  });

  return NextResponse.json({
    session_id: parsed.session_id,
    whisper_id: inserted.id,
  });
}
