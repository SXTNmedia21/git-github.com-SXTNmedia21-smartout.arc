/**
 * BFF /api/reconciliation/wizard-override — mobile admin override of
 * wizard preflight blockers (closure Item 4 / Invariant #9).
 *
 * ADR-0132 (Mobile AI Routing): mobile MUST go through this BFF.
 * ADR-0133 (web composes, mobile executes): mobile never imports capabilities.
 * ADR-0134 (Mobile Telemetry Contract): actor_id + workspace_id resolve
 *          SERVER-SIDE from the authenticated session — never reflect the
 *          client body. Empty-string fallback is banned.
 * ADR-0176 (Actor ID Resolution, Invariant 3): server-side BFF re-derivation
 *          is the CVE-class red line. A client-supplied workspace_id or
 *          actor_id is a security bug — NEVER accept one.
 * ADR-0189 (authority seed parity): capabilities seeded at migration time.
 *
 * Authority gates (dual, defence-in-depth):
 *   1. `signoff.admin_override` (closure migration) — suggest / admin min_role.
 *      Route-level gate; this is the canonical closure capability.
 *   2. `reconciliation.wizard_submit_with_blocker` (migration 20260516100000)
 *      — confirm / admin min_role. Enforced inside the Server Action path
 *      that flips status to 'submitted'.
 *
 * Auth (per ADR-0132): dual path — cookie (web) OR Bearer (mobile).
 *
 * CORS: same-origin only.
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@smartout/supabase/server";
import { createAdminClient } from "@smartout/supabase/admin";
import { emit, nonEmpty } from "@smartout/telemetry";
import { gateAction } from "@/app/dashboard/_actions/_shared";

// Schema deliberately omits workspace_id / actor_id / profile_id — identity
// is server-derived (ADR-0176 Invariant 3). 20-char floor matches the web
// Server Action (override-wizard-blocker-action.ts) and the mobile
// AdminOverrideSheet UI threshold.
const RequestSchema = z.object({
  sessionId: z.string().uuid(),
  reason: z.string().min(20, "Begrunnelse må være minst 20 tegn."),
  blockerCodes: z.array(z.string().min(1).max(64)).min(1, "Blokkeringskode(r) må oppgis."),
});

type AuthResult = {
  userId: string;
  workspaceId: string;
  profileId: string;
  surface: "runtime_mobile" | "runtime_web";
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
  let surface: "runtime_mobile" | "runtime_web";

  if (bearerToken) {
    const { data, error } = await admin.auth.getUser(bearerToken);
    if (error || !data.user) return null;
    userId = data.user.id;
    surface = "runtime_mobile";
  } else {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    userId = user.id;
    surface = "runtime_web";
  }

  const { data: profile, error: profileErr } = await admin
    .from("profile")
    .select("profile_id, workspace_id")
    .eq("user_id", userId)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (profileErr || !profile) return null;
  // ADR-0134: fail fast — empty-string identity fields are banned.
  if (!profile.profile_id || !profile.workspace_id) return null;
  if (profile.profile_id.trim() === "" || profile.workspace_id.trim() === "") return null;

  return {
    userId,
    profileId: profile.profile_id,
    workspaceId: profile.workspace_id,
    surface,
  };
}

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  // 0. CORS.
  const cors = rejectCrossOrigin(request);
  if (cors) return cors;

  // 1. Auth — cookie or Bearer.
  const auth = await resolveAuth(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // 2. Validate body. No identity fields allowed.
  let body: z.infer<typeof RequestSchema>;
  try {
    const raw = await request.json();
    body = RequestSchema.parse(raw);
  } catch (err) {
    const message =
      err instanceof z.ZodError
        ? (err.errors[0]?.message ?? "Invalid request body")
        : "Invalid request body";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  // 3. Resolve session + recon, verifying workspace scope (ADR-0176).
  const admin = createAdminClient();
  const { data: session, error: sessionErr } = await admin
    .from("department_session")
    .select("department_session_id, workspace_id")
    .eq("department_session_id", body.sessionId)
    .maybeSingle();

  if (sessionErr || !session) {
    return NextResponse.json({ error: "Fant ikke økt." }, { status: 404 });
  }
  if (session.workspace_id !== auth.workspaceId) {
    // Cross-workspace = 404 (prevent enumeration).
    return NextResponse.json({ error: "Fant ikke økt." }, { status: 404 });
  }

  const { data: recon, error: reconErr } = await admin
    .from("daily_reconciliation")
    .select("reconciliation_id, status, approval_notes")
    .eq("session_id", body.sessionId)
    .maybeSingle();

  if (reconErr) {
    return NextResponse.json({ error: "Kunne ikke lese avstemming." }, { status: 500 });
  }
  if (!recon) {
    return NextResponse.json({ error: "Ingen avstemming å overstyre." }, { status: 409 });
  }
  if (recon.status === "approved" || recon.status === "locked") {
    return NextResponse.json({ error: "Avstemming er allerede godkjent." }, { status: 409 });
  }

  // 4. C4 authority gate — closure Item 4 capability. Seeded `suggest` /
  // admin min_role via 20260517120000_closure_authority_seed_override.sql.
  // `channel` hard-pinned to "chat" (ADR-0078: voice forbidden for critical).
  const gate = await gateAction({
    workspaceId: auth.workspaceId,
    capability: "signoff.admin_override",
    channel: "chat",
    actorProfileId: auth.profileId,
    actionType: "override",
    entityId: recon.reconciliation_id,
  });

  if (!gate.allow) {
    return NextResponse.json(
      { error: `capability_disabled: ${gate.reason ?? "forbidden"}` },
      { status: 403 },
    );
  }

  // 5. Persist — mirror the web overrideWizardBlockerAction semantics:
  //    status -> 'submitted', settled_by/at set, approval_notes prefixed.
  //    This keeps a single override-path through the reconciliation lifecycle
  //    regardless of which surface (web dialog vs mobile sheet) triggered it.
  const now = new Date().toISOString();
  const blockerList = body.blockerCodes.join(", ");
  const overrideNotes = `[OVERRIDE BLOCKER: ${blockerList}] ${body.reason}`;

  const { error: updateErr } = await admin
    .from("daily_reconciliation")
    .update({
      status: "submitted",
      settled_by: auth.profileId,
      settled_at: now,
      approval_notes: overrideNotes,
      updated_at: now,
    })
    .eq("reconciliation_id", recon.reconciliation_id);

  if (updateErr) {
    return NextResponse.json({ error: "Kunne ikke oppdatere avstemming." }, { status: 500 });
  }

  // 6. Telemetry — registered event, server-derived identity (ADR-0134).
  await emit({
    event: "reconciliation admin_override",
    workspace_id: nonEmpty(auth.workspaceId, "workspace_id"),
    actor_id: nonEmpty(auth.profileId, "actor_id"),
    properties: {
      entity: {
        entity_type: "reconciliation",
        entity_id: recon.reconciliation_id,
        entity_label: `recon/${recon.reconciliation_id}`,
      },
      data: {
        reconciliation_id: recon.reconciliation_id,
        session_id: body.sessionId,
        override: true,
        gate_blocked: body.blockerCodes,
        reason: body.reason,
        surface: auth.surface,
      },
    },
  });

  return NextResponse.json({
    ok: true,
    reconciliation_id: recon.reconciliation_id,
    surface: auth.surface,
  });
}
