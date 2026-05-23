/**
 * POST /api/mobile/employee-onboarding/state/dismiss
 *
 * Mobile BFF for dismissing the employee onboarding wizard. Bearer auth only.
 *
 * Auth (ADR-0151):
 *   - Authorization: Bearer <supabase_access_token>.
 *   - profile_id and workspace_id derived server-side from JWT.
 *   - Never trusts any body-supplied identity.
 *
 * Mirrors the web twin at /api/employee-onboarding/state/dismiss (cookie-auth,
 * T17) but resolves identity via resolveMobileActor instead of resolveCurrentProfile().
 *
 * Performs the same upsert as dismissWelcomeWizard() — inlined here because
 * the Server Action cannot run in a mobile-Bearer context (no cookie session).
 * Constraint eos_dismissed_iff_ts enforces dismissed_at IS NOT NULL when status='dismissed'.
 *
 * Telemetry: emits "profile welcome_wizard_dismissed" (4 destinations per ADR-0134).
 * nonEmpty() brand-checks enforce non-empty workspace_id/actor_id (ADR-0134 L-0177).
 */
import { type NextRequest, NextResponse } from "next/server";
import { resolveMobileActor } from "@/app/api/mobile/_shared/actor";
import { createAdminClient } from "@smartout/supabase/admin";
import { emit, nonEmpty } from "@smartout/telemetry";

export const runtime = "nodejs";

/** Extract Bearer token from Authorization header. Returns null if absent/malformed. */
function extractBearer(req: NextRequest): string | null {
  const auth = req.headers.get("authorization") ?? "";
  return auth.startsWith("Bearer ") ? auth.slice(7) : null;
}

export async function POST(req: NextRequest) {
  const token = extractBearer(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const actor = await resolveMobileActor(token);
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();

  // UPSERT status='dismissed'. The CHECK constraint eos_dismissed_iff_ts requires
  // dismissed_at IS NOT NULL whenever status='dismissed'.
  const { error } = await admin.from("employee_onboarding_state").upsert(
    {
      profile_id: actor.profileId,
      workspace_id: actor.workspaceId,
      status: "dismissed",
      dismissed_at: new Date().toISOString(),
    },
    { onConflict: "profile_id" },
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Emit dismissed event. step=0 + step_name="mobile_dismiss" as sentinel
  // (caller did not supply step context; mobile dismiss is always at-close).
  void emit({
    event: "profile welcome_wizard_dismissed",
    workspace_id: nonEmpty(actor.workspaceId, "workspace_id"),
    actor_id: nonEmpty(actor.profileId, "actor_id"),
    properties: {
      entity: { entity_type: "profile", entity_id: actor.profileId },
      data: { step: 0, step_name: "mobile_dismiss" },
    },
  });

  return NextResponse.json({ ok: true });
}
