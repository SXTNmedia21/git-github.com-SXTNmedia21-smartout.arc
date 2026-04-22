/**
 * POST /api/botsson/recorder/flag
 *
 * Flags a single recorded turn for retention + Platform Admin review.
 * Called from:
 *   - Arena Log-view hover-flag affordance (employee-scope workspace admin)
 *   - Platform Admin Guardian turn-timeline (godmode)
 *
 * Effect: UPDATE agent_session_recording SET is_flagged=true,
 * flag_reason, flagged_by_profile_id. RLS on the table enforces workspace
 * scoping for JWT callers; godmode bypasses RLS via its own policy.
 *
 * Auth: workspace admin/owner OR godmode (ADR-0185 § recorder.flag).
 * profile_id is resolved server-side from auth.uid() (ADR-0151) —
 * NEVER accepted from request body.
 *
 * Telemetry: emits `recorder.turn_flagged` with non-empty workspace_id +
 * actor_id (ADR-0152 fail-fast contract).
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@smartout/supabase/server";
import { emit } from "@smartout/telemetry";

const FlagSchema = z.object({
  turn_id: z.string().uuid(),
  reason: z.string().min(1).max(500).optional(),
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
  let parsed: z.infer<typeof FlagSchema>;
  try {
    const raw = (await request.json()) as unknown;
    parsed = FlagSchema.parse(raw);
  } catch (err) {
    const message =
      err instanceof z.ZodError
        ? err.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ")
        : "Invalid request body";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  // 3. Resolve actor profile server-side (ADR-0151)
  const { data: profile } = await supabase
    .from("profile")
    .select("profile_id, workspace_id, role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile || !["admin", "owner"].includes(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // 4. Flag the turn (RLS enforces workspace boundary; explicit workspace_id
  // eq adds defence-in-depth so a user can't flag turns from another workspace
  // even if a godmode helper policy drifted).
  const { data: updated, error } = await supabase
    .from("agent_session_recording")
    .update({
      is_flagged: true,
      flag_reason: parsed.reason ?? null,
      flagged_by_profile_id: profile.profile_id,
    })
    .eq("id", parsed.turn_id)
    .eq("workspace_id", profile.workspace_id)
    .select("id, is_flagged, session_id, workspace_id")
    .single();

  if (error || !updated) {
    return NextResponse.json(
      { error: error?.message ?? "Turn not found" },
      { status: error ? 500 : 404 },
    );
  }

  // 5. Emit — non-empty IDs enforced by fail-fast at call site (ADR-0152).
  await emit({
    event: "recorder.turn_flagged",
    workspace_id: updated.workspace_id,
    actor_id: profile.profile_id,
    properties: {
      entity: { entity_type: "agent_session", entity_id: updated.session_id },
      data: {
        session_id: updated.session_id,
        turn_id: updated.id,
        reason: parsed.reason ?? "",
      },
    },
  });

  return NextResponse.json(updated);
}
