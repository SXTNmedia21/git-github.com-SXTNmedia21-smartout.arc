/**
 * GET  /api/mobile/employee-onboarding/state
 * PUT  /api/mobile/employee-onboarding/state
 *
 * Mobile BFF twin of /api/employee-onboarding/state (web cookie route, T17).
 * Bearer auth only — mobile surface per ADR-0132/0151.
 *
 * GET — Lazily creates the state row (UPSERT ignoreDuplicates=false).
 *        If previously dismissed and not completed, fires welcome_wizard_resumed
 *        telemetry so resumption is captured in activity_trail.
 *
 * PUT — Updates current_step_index + step_data. Status/timestamp transitions
 *        flow through per-step save-step route or a dedicated complete/dismiss call.
 *
 * Auth (ADR-0151):
 *   - Authorization: Bearer <supabase_access_token>.
 *   - profile_id and workspace_id are NEVER accepted from the request body;
 *     both derived server-side from validated JWT via resolveMobileActor.
 *   - Fail-fast (L-0177): resolveMobileActor returns null on any empty ID.
 *
 * Uses admin client for the upsert (JWT INSERT policy exists, but admin keeps
 * the pattern consistent with the web twin and eliminates session-cookie coupling).
 */
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@smartout/supabase/admin";
import { resolveMobileActor } from "@/app/api/mobile/_shared/actor";
import { recordWelcomeResume } from "@/app/dashboard/_actions/welcome-wizard-actions";
import type { Json } from "@smartout/supabase/database.types";

export const runtime = "nodejs";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Extract Bearer token from Authorization header. Returns null if absent/malformed. */
function extractBearer(req: NextRequest): string | null {
  const auth = req.headers.get("authorization") ?? "";
  return auth.startsWith("Bearer ") ? auth.slice(7) : null;
}

// ── Schemas ───────────────────────────────────────────────────────────────────

const PutBody = z.object({
  current_step_index: z.number().int().min(0).max(8),
  step_data: z.record(z.unknown()).optional(),
});

// ── Handlers ─────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const token = extractBearer(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const actor = await resolveMobileActor(token);
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();

  // Lazy-create on first GET. ignoreDuplicates MUST be false (the default).
  // With ignoreDuplicates:true PostgREST emits DO NOTHING on conflict and
  // returns zero rows → .single() throws PGRST116 on every call after the first.
  // ignoreDuplicates:false issues DO UPDATE SET … RETURNING which always returns
  // the row. Only PK columns are supplied, so no existing data is overwritten.
  const { data, error } = await admin
    .from("employee_onboarding_state")
    .upsert(
      { profile_id: actor.profileId, workspace_id: actor.workspaceId },
      { onConflict: "profile_id", ignoreDuplicates: false },
    )
    .select("status, current_step_index, step_data, dismissed_at, completed_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // If the wizard was previously dismissed and not yet completed, fire a
  // resumed event so the activity_trail captures the re-open.
  if (data.dismissed_at && !data.completed_at) {
    await recordWelcomeResume(actor.profileId, actor.workspaceId);
  }

  return NextResponse.json({ ok: true, state: data });
}

export async function PUT(req: NextRequest) {
  const token = extractBearer(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const actor = await resolveMobileActor(token);
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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

  const admin = createAdminClient();

  const { error } = await admin
    .from("employee_onboarding_state")
    .update({
      current_step_index: parsed.data.current_step_index,
      step_data: (parsed.data.step_data ?? {}) as Json,
    })
    .eq("profile_id", actor.profileId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
