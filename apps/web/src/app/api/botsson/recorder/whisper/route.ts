/**
 * POST /api/botsson/recorder/whisper
 *
 * Creates an admin whisper — a private <admin_note> that the Stage Engine
 * injects into the NEXT system prompt for the target session. Whispers are
 * NEVER rendered to the user (ADR-0185 + ADR-0078).
 *
 * Called from Platform Admin Guardian (AdminActionDrawer).
 *
 * Auth:
 *   - workspace admin/owner OR godmode
 *   - C4 authority `recorder.whisper` must not be "disabled" (ADR-0185 §
 *     Authority Defaults). Default seed is "confirm" per-workspace; godmode
 *     still honours this gate to preserve workspace boundary.
 *
 * profile_id resolved server-side (ADR-0151). Emits recorder.whisper_created
 * with non-empty IDs (ADR-0152).
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@smartout/supabase/server";
import { emit, nonEmpty } from "@smartout/telemetry";
const WhisperSchema = z.object({
  session_id: z.string().uuid(),
  content: z.string().min(1).max(2000),
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
  let parsed: z.infer<typeof WhisperSchema>;
  try {
    const raw = (await request.json()) as unknown;
    parsed = WhisperSchema.parse(raw);
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

  // 4. C4 authority gate — recorder.whisper must not be disabled (or absent).
  // Absent = treated as disabled (default closed) so a seeding miss can't
  // silently open the surface.
  const { data: authority } = await supabase
    .from("engine_authority_config")
    .select("level")
    .eq("workspace_id", profile.workspace_id)
    .eq("capability", "recorder.whisper")
    .maybeSingle();

  if (!authority || authority.level === "disabled") {
    return NextResponse.json({ error: "Whisper disabled for this workspace" }, { status: 403 });
  }

  // 5. Insert whisper
  const { data: inserted, error } = await supabase
    .from("agent_session_whisper")
    .insert({
      session_id: parsed.session_id,
      workspace_id: profile.workspace_id,
      admin_profile_id: profile.profile_id,
      content: parsed.content,
    })
    .select("id, session_id, created_at")
    .single();

  if (error || !inserted) {
    return NextResponse.json({ error: error?.message ?? "Whisper insert failed" }, { status: 500 });
  }

  // 6. Emit
  await emit({
    event: "recorder.whisper_created",
    workspace_id: nonEmpty(profile.workspace_id, "workspace_id"),
    actor_id: nonEmpty(profile.profile_id, "actor_id"),
    properties: {
      entity: { entity_type: "agent_session", entity_id: inserted.session_id },
      data: {
        session_id: inserted.session_id,
        whisper_id: inserted.id,
        content_length: parsed.content.length,
      },
    },
  });

  return NextResponse.json(inserted);
}
