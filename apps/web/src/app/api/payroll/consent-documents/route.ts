/**
 * POST /api/payroll/consent-documents
 *
 * Creates a payroll.consent_document row for court_order consent type ONLY.
 * Court orders use lovhjemmel (utleggstrekk fra namsmann) — no employee signature
 * required. The court order reference (utleggstrekk-saksnummer) is mandatory.
 *
 * DocuSeal-mediated consent types (loan_agreement, uniform_policy, union_dues,
 * other_voluntary) are explicitly OUT OF SCOPE for this endpoint. They return 404
 * with code `consent_type_requires_docuseal` pointing to the deferred DocuSeal sortie.
 *
 * ADR-0151: workspace_id NEVER from request body — server-derived from JWT cookie
 *           (mirrors T2 deduction-consents GET handler exactly).
 * L-0177:   profile not in JWT workspace → 404 explicit, never silent empty response.
 * ADR-0204: gateAction called before any DB write (NOT gatedMutation — feature-flagged,
 *           throws in prod; see T1 send/route.ts).
 * ADR-0134: emit() with nonEmpty() guards — no empty-string fallback on identity fields.
 * ADR-0078: payroll = Høy-PII; server-only route.
 *
 * Response 201: { ok: true, consentDocumentId: string }
 * Response 400: Zod validation error
 * Response 401: not authenticated
 * Response 403: gateAction denied (not manager+ role or capability denied)
 * Response 404: profile not in JWT workspace, OR consentType !== 'court_order'
 * Response 500: DB insert failure
 *
 * L-0176: body verified first (below), docstring describes verified body.
 */
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import { gateAction } from "@/app/dashboard/_actions/_shared";
import { rejectCrossOrigin, resolvePayrollAuth } from "@/app/api/payroll/_shared";
import { createAdminClient } from "@smartout/supabase/admin";
import { emit, nonEmpty } from "@smartout/telemetry";

export const runtime = "nodejs";

// ─── Input Schema ─────────────────────────────────────────────────────────────
// Only 'court_order' is accepted. All other consent types require the DocuSeal
// signing flow (deferred sortie). Reject them explicitly with a machine-readable
// error code so the client can surface a helpful remediation message.
const CreateConsentDocumentSchema = z.object({
  employeeProfileId: z.string().uuid("employeeProfileId must be a UUID"),
  consentType: z.enum(
    ["court_order", "loan_agreement", "uniform_policy", "union_dues", "other_voluntary"],
    { required_error: "consentType is required" },
  ),
  courtOrderReference: z.string().min(1, "courtOrderReference is required for court_order"),
  signedAt: z.string().datetime({ message: "signedAt must be a valid ISO timestamp" }),
  signedDocumentUrl: z.string().url("signedDocumentUrl must be a valid URL"),
  expiresAt: z.string().datetime({ message: "expiresAt must be a valid ISO timestamp" }).optional(),
});

type CreateConsentDocumentBody = z.infer<typeof CreateConsentDocumentSchema>;

export async function POST(request: NextRequest): Promise<NextResponse> {
  // ─── CORS guard ──────────────────────────────────────────────────────────────
  const cors = rejectCrossOrigin(request);
  if (cors) return cors;

  // ─── Parse + validate body ───────────────────────────────────────────────────
  let body: CreateConsentDocumentBody;
  try {
    const rawBody = await request.json();
    const parsed = CreateConsentDocumentSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          error: parsed.error.errors[0]?.message ?? "Invalid request body",
          details: parsed.error.errors,
        },
        { status: 400 },
      );
    }
    body = parsed.data;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  // ─── Option B scope gate: court_order ONLY ───────────────────────────────────
  // DocuSeal-mediated flows are out of scope. Return 404 with a machine-readable
  // code so the client can show a remediation message pointing to the deferred sortie.
  if (body.consentType !== "court_order") {
    return NextResponse.json(
      {
        ok: false,
        error: "consent_type_requires_docuseal",
        message:
          "Denne samtykketypen krever DocuSeal-signering. " +
          "Bruk POST /api/payroll/consent-documents kun for court_order (lovhjemmel). " +
          "DocuSeal-flyt for andre samtykketyper er ikke implementert ennå.",
        code: "consent_type_requires_docuseal",
        supported_types: ["court_order"],
        deferred_types: ["loan_agreement", "uniform_policy", "union_dues", "other_voluntary"],
      },
      { status: 404 },
    );
  }

  // ─── Identity (ADR-0151: server-derived workspace, never from body) ───────────
  // resolvePayrollAuth resolves workspaceId from JWT cookie (web) or Bearer token (mobile).
  const auth = await resolvePayrollAuth(request);
  if (!auth) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  // ─── Authority gate (ADR-0204: gateAction before any DB write) ───────────────
  // capability: 'payroll', actionType: 'create_consent_document'.
  // gateAction enforces role floor (manager+) via engine_authority_config seed.
  // Default-allow applies when no seed row exists (Track C adds explicit seed).
  const gate = await gateAction({
    workspaceId: auth.workspaceId,
    capability: "payroll",
    channel: "system",
    actorProfileId: auth.profileId,
    actionType: "create_consent_document",
    entityId: body.employeeProfileId,
  });
  if (!gate.allow) {
    return NextResponse.json(
      { ok: false, error: `forbidden: ${gate.reason ?? "gate_denied"}` },
      { status: 403 },
    );
  }

  const admin = createAdminClient();

  // ─── Validate employee profile belongs to JWT workspace (ADR-0151, L-0177) ───
  // Fail-fast: profile not in workspace → 404 (not 403) to avoid leaking existence.
  const { data: employeeProfile, error: profileErr } = await admin
    .from("profile")
    .select("profile_id, role")
    .eq("profile_id", body.employeeProfileId)
    .eq("workspace_id", auth.workspaceId)
    .eq("is_active", true)
    .maybeSingle();

  if (profileErr || !employeeProfile) {
    // L-0177: explicit 404 — never silent empty, never 403 (avoids leaking profile existence).
    return NextResponse.json(
      { ok: false, error: "profile_not_found_in_workspace" },
      { status: 404 },
    );
  }

  // ─── Fetch actor role for telemetry ─────────────────────────────────────────
  // Separate lookup: resolvePayrollAuth does not expose role.
  const { data: actorProfile } = await admin
    .from("profile")
    .select("role")
    .eq("profile_id", auth.profileId)
    .eq("workspace_id", auth.workspaceId)
    .maybeSingle();

  const actorRole = (actorProfile?.role as string | null) ?? "unknown";

  // ─── INSERT payroll.consent_document ─────────────────────────────────────────
  // docuseal_submission_id = NULL (court_order requires no DocuSeal envelope).
  // paragraph_ref defaults to 'Aml. §14-15 tredje ledd nr. 1-6' (DB column default).
  // status defaults to 'active' (DB column default).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: inserted, error: insertErr } = await (admin.schema("payroll") as any)
    .from("consent_document")
    .insert({
      workspace_id: auth.workspaceId,
      employee_profile_id: body.employeeProfileId,
      consent_type: "court_order",
      court_order_reference: body.courtOrderReference,
      signed_at: body.signedAt,
      signed_document_url: body.signedDocumentUrl,
      expires_at: body.expiresAt ?? null,
      docuseal_submission_id: null,
      status: "active",
      paragraph_ref: "Aml. §14-15 tredje ledd nr. 1-6",
    })
    .select("consent_document_id")
    .single();

  if (insertErr || !inserted) {
    console.error("[payroll/consent-documents] INSERT failed:", insertErr?.message);
    return NextResponse.json(
      { ok: false, error: "consent_document_insert_failed" },
      { status: 500 },
    );
  }

  const consentDocumentId = (inserted as { consent_document_id: string }).consent_document_id;

  // ─── Telemetry ───────────────────────────────────────────────────────────────
  // All 4 destinations: posthog (analytics) + activity_trail (compliance audit) +
  // logger (stdout) + engine_event (downstream workflow triggers).
  void emit({
    event: "payroll.consent_document.created",
    workspace_id: nonEmpty(auth.workspaceId, "workspace_id"),
    actor_id: nonEmpty(auth.profileId, "actor_id"),
    properties: {
      entity: {
        entity_type: "consent_document",
        entity_id: consentDocumentId,
        entity_label: `court_order:${body.courtOrderReference}`,
      },
      data: {
        consent_document_id: consentDocumentId,
        employee_profile_id: body.employeeProfileId,
        consent_type: "court_order",
        court_order_reference: body.courtOrderReference,
        actor_role: actorRole,
      },
    },
  });

  // ─── Response 201 ─────────────────────────────────────────────────────────────
  return NextResponse.json({ ok: true, consentDocumentId }, { status: 201 });
}
