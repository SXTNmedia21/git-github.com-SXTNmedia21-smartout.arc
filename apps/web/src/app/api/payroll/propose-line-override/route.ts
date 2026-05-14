/**
 * BFF POST /api/payroll/propose-line-override
 *
 * Manager proposes a wage-line override for a derived payroll.calculation_line.
 * Creates a change_proposal row (kind='wage_line_override', status='pending').
 * Admin must approve before the line is updated (ADR-0292).
 *
 * This route mirrors the `override_calculation_line` capability tool (commit 16eee4929)
 * for web-surface direct calls (T6.1 — BFF surface for LineOverrideModal).
 *
 * SMA-328 / ADR-0311: Extended with deduction consent validation (Aml. §14-15 tredje ledd).
 * category='deduction' MUST supply consent_document_id (unless deduction_type='court_order',
 * which requires a consent_document row with consent_type='court_order' instead).
 *
 * ADR compliance (body-verified — L-0176):
 *   ADR-0151 — workspace_id + profile_id server-derived via resolvePayrollAuth; never from body.
 *   ADR-0204 — gateAction called before any DB write.
 *   ADR-0134 — emit() with nonEmpty() guards; no empty-string fallbacks.
 *   ADR-0078 — payroll = Høy-PII; chat channel only (pinned at BFF layer).
 *   ADR-0292 — write is change_proposal only; payroll_calculation untouched until approved.
 *   ADR-0311 — deduction consent validated server-side before INSERT.
 *   L-0177   — 4xx with explicit error on missing period / line / workspace mismatch.
 *              No silent fallback to another workspace.
 */
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import { gateAction } from "@/app/dashboard/_actions/_shared";
import { rejectCrossOrigin, resolvePayrollAuth } from "@/app/api/payroll/_shared";
import { createAdminClient } from "@smartout/supabase/admin";
import { emit, nonEmpty } from "@smartout/telemetry";
import { validateAml1415Logic } from "@smartout/ai/capabilities/legal/aml-14-15";

export const runtime = "nodejs";

const RequestSchema = z
  .object({
    workspace_id: z.string().uuid().describe("UUID of the workspace context (UI-resolved)"),
    period_id: z.string().uuid().describe("UUID of the payroll.period"),
    calculation_line_id: z
      .string()
      .uuid()
      .describe("UUID of the payroll.calculation_line to override"),
    // SMA-328: allow negative amounts when category='deduction' (trekk = negative value).
    // superRefine enforces sign per category.
    proposed_amount: z.number().describe("Proposed replacement amount in NOK (negative for trekk)"),
    reason: z.string().min(8).describe("Reason for override, min 8 chars"),
    category: z
      .enum([
        "manual_adjustment",
        "tariff_interpretation",
        "shift_data_error",
        "other",
        "deduction",
      ])
      .describe("Override category"),
    // SMA-328: consent_document_id required when category='deduction'.
    // Court orders may use deduction_type='court_order' with a consent_document row
    // of consent_type='court_order' + non-null court_order_reference.
    consent_document_id: z
      .string()
      .uuid()
      .optional()
      .describe("UUID of the payroll.consent_document (required when category='deduction')"),
    // SMA-328: deduction subtype — maps to payroll.consent_document.consent_type.
    deduction_type: z
      .enum(["loan_agreement", "uniform_policy", "union_dues", "court_order", "other_voluntary"])
      .optional()
      .describe("Deduction subtype (required when category='deduction')"),
  })
  .superRefine((data, ctx) => {
    if (data.category === "deduction") {
      // Deduction amounts must be negative (trekk = wage reduction).
      if (data.proposed_amount >= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Trekk-beløp må være negativt (trekk reduserer lønn)",
          path: ["proposed_amount"],
        });
      }
      // consent_document_id required unless deduction_type='court_order'.
      // Court orders still need a consent_document row (consent_type='court_order'),
      // but may skip the signed-by-employee requirement per lovsen Q3 verdict.
      if (!data.consent_document_id) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "consent_document_id er påkrevd ved trekk (Aml. §14-15 tredje ledd nr. 1-6). " +
            "Send avtale via DocuSeal først.",
          path: ["consent_document_id"],
        });
      }
      if (!data.deduction_type) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "deduction_type er påkrevd ved trekk",
          path: ["deduction_type"],
        });
      }
    } else {
      // Non-deduction amounts must be positive (normal wage lines).
      if (data.proposed_amount <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Beløp må være positivt for ikke-trekk kategorier",
          path: ["proposed_amount"],
        });
      }
    }
  });

export async function POST(request: NextRequest): Promise<NextResponse> {
  // ─── CORS guard ───────────────────────────────────────────────────────────
  const cors = rejectCrossOrigin(request);
  if (cors) return cors;

  // ─── Input validation (workspace_id needed before auth resolve) ───────────
  let body: z.infer<typeof RequestSchema>;
  try {
    body = RequestSchema.parse(await request.json());
  } catch (err) {
    const message =
      err instanceof z.ZodError ? (err.errors[0]?.message ?? "Invalid body") : "Invalid body";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }

  // ─── Identity (ADR-0151: server-derived, validated against requested workspace) ──
  // Multi-workspace users (admin@smartout.local has 5 memberships) require
  // explicit workspace context per Phase 5 council fix #3 — pass requested
  // workspace_id from UI body, server validates membership before assigning.
  const auth = await resolvePayrollAuth(request, body.workspace_id);
  if (!auth) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  // ─── Authority gate (ADR-0204, ADR-0099) ──────────────────────────────────
  const gate = await gateAction({
    workspaceId: auth.workspaceId,
    capability: "payroll",
    channel: "chat",
    actorProfileId: auth.profileId,
    actionType: "override_calculation_line",
    entityId: body.calculation_line_id,
  });
  if (!gate.allow) {
    return NextResponse.json(
      { ok: false, error: `forbidden: ${gate.reason ?? "denied"}` },
      { status: 403 },
    );
  }

  const admin = createAdminClient();

  // ─── Step 1: Verify period in workspace (ADR-0151, L-0177) ───────────────
  const { data: period, error: periodErr } = await admin
    .schema("payroll")
    .from("period")
    .select("id, status, workspace_id")
    .eq("id", body.period_id)
    .eq("workspace_id", auth.workspaceId)
    .maybeSingle();

  if (periodErr || !period) {
    // L-0177: fail fast, no silent fallback
    return NextResponse.json({ ok: false, error: "period_not_found" }, { status: 404 });
  }

  // ─── Step 2: Reject if period is locked or approved ───────────────────────
  if (period.status === "locked" || period.status === "approved") {
    return NextResponse.json(
      {
        ok: false,
        error: "period_frozen",
        detail: `Periode er ${period.status} — kan ikke foreslå overstyring.`,
      },
      { status: 409 },
    );
  }

  // ─── Step 3: Verify calculation_line in this workspace (L-0177) ──────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: calcLine, error: lineErr } = await (admin.schema("payroll") as any)
    .from("calculation_line")
    .select("id, workspace_id, calculation_id, amount, line_type")
    .eq("id", body.calculation_line_id)
    .eq("workspace_id", auth.workspaceId)
    .maybeSingle();

  if (lineErr || !calcLine) {
    return NextResponse.json({ ok: false, error: "line_not_found" }, { status: 404 });
  }

  // ─── Step 4: Verify parent calculation belongs to requested period (L-0177) ─
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: parentCalc, error: calcErr } = await (admin.schema("payroll") as any)
    .from("calculation")
    .select("id, period_id, profile_id")
    .eq("id", calcLine.calculation_id)
    .eq("workspace_id", auth.workspaceId)
    .maybeSingle();

  if (calcErr || !parentCalc) {
    return NextResponse.json({ ok: false, error: "calculation_not_found" }, { status: 404 });
  }

  if (parentCalc.period_id !== body.period_id) {
    return NextResponse.json(
      { ok: false, error: "period_mismatch", detail: "Linjen tilhører ikke angitt periode." },
      { status: 422 },
    );
  }

  // ─── Step 5: Concurrent-edit guard — reject if pending override exists ────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existingProposal } = await (admin as any)
    .from("change_proposal")
    .select("change_proposal_id")
    .eq("workspace_id", auth.workspaceId)
    .eq("trigger_entity_type", "payroll_calculation_line")
    .eq("status", "pending")
    .filter("changes->>'calculation_line_id'", "eq", body.calculation_line_id)
    .maybeSingle();

  if (existingProposal) {
    return NextResponse.json(
      {
        ok: false,
        error: "pending_override_exists",
        detail: "Det finnes allerede et ubehandlet forslag for denne linjen.",
      },
      { status: 409 },
    );
  }

  // ─── Step 5b: Deduction consent validation (SMA-328, ADR-0311) ──────────────
  // Runs AFTER concurrent-edit guard, BEFORE INSERT.
  // Validates Aml. §14-15 tredje ledd nr. 1-6 compliance when category='deduction'.
  // Uses the shared utility (same rule logic as validateAml1415 capability tool).
  if (body.category === "deduction" && body.consent_document_id) {
    const consentResult = await validateAml1415Logic(
      body.consent_document_id,
      parentCalc.profile_id as string,
      auth.workspaceId,
      admin,
    );

    if (!consentResult.pass) {
      // Emit compliance-blocked telemetry (activity_trail + logger, NOT posthog).
      const wsId = nonEmpty(auth.workspaceId, "workspaceId");
      const actorId = nonEmpty(auth.profileId, "profileId");

      void emit({
        event: "payroll.deduction_rejected_no_consent",
        workspace_id: wsId,
        actor_id: actorId,
        properties: {
          data: {
            profile_id: parentCalc.profile_id as string,
            period_id: body.period_id,
            paragraph: "Aml. §14-15" as const,
            reason:
              consentResult.status === "workspace_mismatch"
                ? "workspace_mismatch"
                : consentResult.status === "consent_expired"
                  ? "consent_expired"
                  : consentResult.status === "consent_type_mismatch"
                    ? "consent_profile_mismatch"
                    : "missing_consent_document_id",
          },
        },
      });

      // Write compliance.blocked audit event to activity_trail (required by plan §4).
      // This is in addition to the telemetry emit above (different destinations).
      // Note: additional activity_trail write handled by emit() route above.

      return NextResponse.json(
        {
          ok: false,
          error: "aml_14_15_consent_required",
          code: "AML_14_15_CONSENT_REQUIRED",
          paragraph: "Aml. §14-15 tredje ledd nr. 1-6",
          detail: `Trekk-samtykke er ikke gyldig: ${consentResult.status}. Ansatt må signere ny avtale via DocuSeal.`,
          consent_status: consentResult.status,
        },
        { status: 422 },
      );
    }
  }

  // ─── Step 6: Insert change_proposal (ADR-0292 — proposal only, no calc write) ─
  const originalAmountCents = Math.round((calcLine.amount as number) * 100);
  const proposedAmountCents = Math.round(body.proposed_amount * 100);

  const proposalPayload = {
    calculation_line_id: body.calculation_line_id,
    calculation_id: calcLine.calculation_id,
    original_amount_cents: originalAmountCents,
    proposed_amount_cents: proposedAmountCents,
    reason: body.reason,
    category: body.category,
    period_id: body.period_id,
    // SMA-328 deduction fields (null for non-deduction categories).
    ...(body.category === "deduction"
      ? {
          consent_document_id: body.consent_document_id ?? null,
          deduction_type: body.deduction_type ?? null,
        }
      : {}),
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: proposal, error: proposalErr } = await (admin as any)
    .from("change_proposal")
    .insert({
      workspace_id: auth.workspaceId,
      initiated_by: auth.profileId,
      kind: "wage_line_override",
      status: "pending",
      approval_required: true,
      // Discriminator: kind='wage_line_override' (Phase 2 migration 20260507110000) +
      // trigger_entity_type='payroll_calculation_line' for cross-reference.
      trigger_entity_type: "payroll_calculation_line",
      trigger_entity_id: body.calculation_line_id,
      // framework_trigger_type enum: manual_override (not "manual" — that value doesn't exist)
      trigger_type: "manual_override",
      changes: proposalPayload,
      preview: {
        calculation_line_id: body.calculation_line_id,
        original_amount: calcLine.amount,
        proposed_amount: body.proposed_amount,
        reason: body.reason,
      },
      created_by_plane: "app",
      // SMA-328: FK to consent_document when category='deduction'.
      ...(body.category === "deduction" && body.consent_document_id
        ? {
            consent_document_id: body.consent_document_id,
            deduction_type: body.deduction_type ?? null,
          }
        : {}),
    })
    .select("change_proposal_id")
    .single();

  if (proposalErr || !proposal) {
    return NextResponse.json(
      {
        ok: false,
        error: "insert_failed",
        detail:
          (proposalErr as { message?: string } | null)?.message ?? "Kunne ikke opprette forslag",
      },
      { status: 500 },
    );
  }

  // ─── Step 7: Emit telemetry (ADR-0134) ────────────────────────────────────
  // nonEmpty() throws on empty string — fail fast as required by ADR-0193.
  const wsId = nonEmpty(auth.workspaceId, "workspaceId");
  const actorId = nonEmpty(auth.profileId, "profileId");

  await emit({
    event: "payroll.line_override_proposed",
    workspace_id: wsId,
    actor_id: actorId,
    properties: {
      entity: {
        entity_type: "change_proposal" as const,
        entity_id: (proposal as { change_proposal_id: string }).change_proposal_id,
      },
      data: {
        change_proposal_id: (proposal as { change_proposal_id: string }).change_proposal_id,
        calculation_id: calcLine.calculation_id,
        period_id: body.period_id,
        target_profile_id: parentCalc.profile_id,
        original_amount_cents: originalAmountCents,
        proposed_amount_cents: proposedAmountCents,
        category: body.category,
        gate_evaluation_id: null,
      },
    },
  });

  // SMA-328: emit deduction consent referenced event when category='deduction'.
  if (body.category === "deduction" && body.consent_document_id) {
    void emit({
      event: "payroll.deduction_consent_referenced",
      workspace_id: wsId,
      actor_id: actorId,
      properties: {
        entity: {
          entity_type: "change_proposal" as const,
          entity_id: (proposal as { change_proposal_id: string }).change_proposal_id,
        },
        data: {
          consent_document_id: body.consent_document_id,
          change_proposal_id: (proposal as { change_proposal_id: string }).change_proposal_id,
          profile_id: parentCalc.profile_id as string,
          period_id: body.period_id,
          paragraph_ref: "Aml. §14-15 tredje ledd nr. 1-6" as const,
        },
      },
    });
  }

  return NextResponse.json({
    ok: true,
    change_proposal_id: (proposal as { change_proposal_id: string }).change_proposal_id,
  });
}
