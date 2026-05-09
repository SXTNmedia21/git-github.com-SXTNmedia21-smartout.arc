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
 * ADR compliance (body-verified — L-0176):
 *   ADR-0151 — workspace_id + profile_id server-derived via resolvePayrollAuth; never from body.
 *   ADR-0204 — gateAction called before any DB write.
 *   ADR-0134 — emit() with nonEmpty() guards; no empty-string fallbacks.
 *   ADR-0078 — payroll = Høy-PII; chat channel only (pinned at BFF layer).
 *   ADR-0292 — write is change_proposal only; payroll_calculation untouched until approved.
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

export const runtime = "nodejs";

const RequestSchema = z.object({
  period_id: z.string().uuid().describe("UUID of the payroll.period"),
  calculation_line_id: z
    .string()
    .uuid()
    .describe("UUID of the payroll.calculation_line to override"),
  proposed_amount: z.number().positive().describe("Proposed replacement amount in NOK"),
  reason: z.string().min(8).describe("Reason for override, min 8 chars"),
  category: z
    .enum(["manual_adjustment", "tariff_interpretation", "shift_data_error", "other"])
    .describe("Override category"),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  // ─── CORS guard ───────────────────────────────────────────────────────────
  const cors = rejectCrossOrigin(request);
  if (cors) return cors;

  // ─── Identity (ADR-0151: server-derived, never from body) ─────────────────
  const auth = await resolvePayrollAuth(request);
  if (!auth) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  // ─── Input validation ──────────────────────────────────────────────────────
  let body: z.infer<typeof RequestSchema>;
  try {
    body = RequestSchema.parse(await request.json());
  } catch (err) {
    const message =
      err instanceof z.ZodError ? (err.errors[0]?.message ?? "Invalid body") : "Invalid body";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
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
    .eq("kind", "wage_line_override")
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
      trigger_entity_type: "payroll_calculation_line",
      trigger_entity_id: body.calculation_line_id,
      trigger_type: "manual",
      changes: proposalPayload,
      preview: {
        calculation_line_id: body.calculation_line_id,
        original_amount: calcLine.amount,
        proposed_amount: body.proposed_amount,
        reason: body.reason,
      },
      created_by_plane: "app",
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

  return NextResponse.json({
    ok: true,
    change_proposal_id: (proposal as { change_proposal_id: string }).change_proposal_id,
  });
}
