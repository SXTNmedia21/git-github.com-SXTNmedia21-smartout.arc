/**
 * GET  /api/employee-onboarding/state
 * PUT  /api/employee-onboarding/state
 *
 * Web BFF for the employee onboarding wizard state. Cookie-auth (web only).
 * Mobile twin lands in T21 with Bearer auth.
 *
 * Auth (ADR-0151):
 *   - Identity derived server-side via resolveCurrentProfile() — never trust
 *     profile_id / workspace_id from the request body.
 *   - Cookie session only; Bearer is not supported on this endpoint.
 *
 * GET — Lazily creates the state row (UPSERT with ignoreDuplicates=false).
 *        If the wizard was previously dismissed (dismissed_at IS NOT NULL) and
 *        not yet completed, fires a welcome_wizard_resumed telemetry event so
 *        resumption is tracked in the activity_trail.
 *
 * PUT — Updates current_step_index + step_data. Does not touch status/timestamps
 *        (those flow through dedicated Server Actions: completeWelcome,
 *        dismissWelcomeWizard).
 */
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@smartout/supabase/server";
import type { Json } from "@smartout/supabase/database.types";
import { resolveCurrentProfile } from "@/app/dashboard/_actions/_shared";
import { recordWelcomeResume } from "@/app/dashboard/_actions/welcome-wizard-actions";

export const runtime = "nodejs";

// ── Schemas ──────────────────────────────────────────────────────────────────

const PutBody = z.object({
  current_step_index: z.number().int().min(0).max(8),
  step_data: z.record(z.unknown()).optional(),
});

// ── Handlers ─────────────────────────────────────────────────────────────────

export async function GET(_req: NextRequest) {
  // Server-side identity resolution per ADR-0151.
  // resolveCurrentProfile() filters is_active=true and uses cookie session.
  const profile = await resolveCurrentProfile();
  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createClient();

  // Lazy-create on first GET. ignoreDuplicates MUST be false (the default).
  // With ignoreDuplicates:true PostgREST emits DO NOTHING on conflict and
  // returns zero rows → .single() throws PGRST116 on every call after the first.
  // ignoreDuplicates:false issues DO UPDATE SET … RETURNING which always returns
  // the row. Only PK columns are supplied, so no existing data is overwritten.
  const { data, error } = await supabase
    .from("employee_onboarding_state")
    .upsert(
      {
        profile_id: profile.profileId,
        workspace_id: profile.workspaceId,
      },
      { onConflict: "profile_id", ignoreDuplicates: false },
    )
    .select("status, current_step_index, step_data, dismissed_at, completed_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // If the wizard was previously dismissed and not yet completed, fire a
  // resumed event so the activity_trail captures the re-open.
  if (data.dismissed_at && !data.completed_at) {
    await recordWelcomeResume(profile.profileId, profile.workspaceId);
  }

  return NextResponse.json({ ok: true, state: data });
}

export async function PUT(req: NextRequest) {
  // Server-side identity resolution per ADR-0151.
  const profile = await resolveCurrentProfile();
  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 422 });
  }

  const parsed = PutBody.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "Invalid request body" },
      { status: 422 },
    );
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from("employee_onboarding_state")
    .update({
      current_step_index: parsed.data.current_step_index,
      step_data: (parsed.data.step_data ?? {}) as Json,
    })
    .eq("profile_id", profile.profileId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
