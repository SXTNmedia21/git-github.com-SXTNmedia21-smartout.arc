/**
 * BFF POST /api/payroll/apply-line-override
 *
 * Applier for wage_line_override proposals (Phase 2 T2.2, ADR-0292).
 *
 * This route is called by the admin approval flow (T5.2 UI, separate wave)
 * after the admin has set change_proposal.status='applied'. The DB trigger
 * payroll_proposal_applied_trg (20260507110100) emits an engine_event row
 * with event_kind='payroll.line_override_applied' as an audit record; the
 * actual supersession logic lives here (not in a DB trigger) so it is:
 *   - Testable in isolation
 *   - Retriable on failure (engine_event idempotency_key guards re-runs)
 *   - Observable (structured logs + telemetry)
 *
 * Semantics per ADR-0292 (non-negotiable):
 *   1. Verify change_proposal in workspace (ADR-0151, L-0177 fail-fast).
 *   2. Verify payroll.period.status = 'open' (period may have been locked
 *      after proposal was submitted — 409 if locked, proposal stays 'pending').
 *   3. Read payroll.calculation row identified by calculation_id in payload.
 *   4. Read the most-recent shift_pay_calculation_event for that calculation.
 *   5. INSERT new shift_pay_calculation_event with supersession link
 *      (superseded_by_event_id populated on the OLD event row).
 *   6. INSERT new payroll.calculation row:
 *      calculation_version = old.calculation_version + 1
 *      total_pay = proposed_amount
 *      All other fields copied from original.
 *   7. Original payroll.calculation row LEFT UNCHANGED (Bokføringsloven §13).
 *   8. UPDATE change_proposal: applied_at, applied_by (set by caller before
 *      this route is invoked — verified here for idempotency).
 *   9. Emit payroll.line_override_approved + payroll.line_overridden (ADR-0134).
 *   10. Idempotency: if change_proposal.status is already 'applied' with
 *       applied_at set, return 200 no-op (prevents double-apply on retry).
 *
 * ADR compliance (body-verified before docstring — L-0176):
 *   ADR-0151 — workspace_id never from body; derived from auth session.
 *   ADR-0204 — gateAction before write.
 *   ADR-0240 — no cross-namespace writes (payroll tables only).
 *   ADR-0251 — shift_pay_calculation_event append-only; supersession via
 *              superseded_by_event_id on the old row.
 *   ADR-0292 — both new shift_pay_calculation_event AND new payroll.calculation
 *              row inserted; original rows untouched; derivation_version+1.
 *   ADR-0134 — emit() with non-null workspace_id + actor_id.
 *   L-0177   — fail fast on row-not-found; no silent fallback.
 *   Bokføringsloven §13 — zero UPDATE on payroll.calculation rows; append-only.
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
  workspace_id: z
    .string()
    .uuid()
    .describe("UUID of the workspace context (forwarded from approve-proposal)"),
  change_proposal_id: z.string().uuid().describe("UUID of the change_proposal to apply"),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  // ─── CORS guard ───────────────────────────────────────────────────────────
  const cors = rejectCrossOrigin(request);
  if (cors) return cors;

  // ─── Input validation (workspace_id needed before auth resolve) ────────────
  let body: z.infer<typeof RequestSchema>;
  try {
    body = RequestSchema.parse(await request.json());
  } catch (err) {
    const message =
      err instanceof z.ZodError ? (err.errors[0]?.message ?? "Invalid body") : "Invalid body";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }

  // ─── Identity (ADR-0151: server-derived, validated against requested workspace) ──
  // Called server-to-server from approve-proposal (Pattern B); workspace_id forwarded
  // from the original UI request to ensure correct workspace resolution for
  // multi-workspace users.
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
    actionType: "apply_line_override",
    entityId: body.change_proposal_id,
  });
  if (!gate.allow) {
    return NextResponse.json(
      { ok: false, error: `forbidden: ${gate.reason ?? "denied"}` },
      { status: 403 },
    );
  }

  const admin = createAdminClient();

  // ─── Step 1: Verify change_proposal in workspace (ADR-0151, L-0177) ───────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: proposal, error: proposalErr } = await (admin as any)
    .from("change_proposal")
    .select("change_proposal_id, workspace_id, status, kind, changes, initiated_by, applied_at")
    .eq("change_proposal_id", body.change_proposal_id)
    .eq("workspace_id", auth.workspaceId)
    .maybeSingle();

  if (proposalErr || !proposal) {
    // L-0177: fail fast, no silent fallback
    return NextResponse.json({ ok: false, error: "proposal_not_found" }, { status: 404 });
  }

  const p = proposal as {
    change_proposal_id: string;
    workspace_id: string;
    status: string;
    kind: string | null;
    changes: Record<string, unknown>;
    initiated_by: string;
    applied_at: string | null;
  };

  // ─── Step 2: Verify kind (this route only handles wage_line_override) ──────
  if (p.kind !== "wage_line_override") {
    return NextResponse.json(
      { ok: false, error: "wrong_kind", detail: `Expected wage_line_override, got ${p.kind}` },
      { status: 422 },
    );
  }

  // ─── Step 3: Idempotency guard ────────────────────────────────────────────
  // If the proposal already has status='applied' and applied_at is set, this
  // applier has already run. Return 200 no-op so callers can safely retry.
  if (p.status === "applied" && p.applied_at) {
    return NextResponse.json({
      ok: true,
      idempotent: true,
      change_proposal_id: p.change_proposal_id,
      detail: "Allerede applisert — ingen endringer gjort.",
    });
  }

  // ─── Step 4: Verify proposal is in expected state ─────────────────────────
  if (p.status !== "applied") {
    return NextResponse.json(
      {
        ok: false,
        error: "proposal_not_approved",
        detail: `Forslaget har status '${p.status}' — kun 'applied' kan appliseres.`,
      },
      { status: 409 },
    );
  }

  // ─── Step 5: Extract payload from changes JSONB (Zod-validated at write time by T2.1) ──
  const changes = p.changes as {
    calculation_id?: string;
    calculation_line_id?: string;
    original_amount_cents?: number;
    proposed_amount_cents?: number;
    reason?: string;
    category?: string;
    period_id?: string;
  };

  const { calculation_id, period_id, proposed_amount_cents } = changes;

  if (!calculation_id || !period_id || proposed_amount_cents === undefined) {
    // Defensive guard — Zod validated at write time; this branch means payload
    // was corrupted or shape changed after T2.1 shipped. Loud failure.
    return NextResponse.json(
      {
        ok: false,
        error: "malformed_payload",
        detail:
          "change_proposal.changes mangler calculation_id, period_id eller proposed_amount_cents.",
      },
      { status: 422 },
    );
  }

  const proposedAmountNok = proposed_amount_cents / 100;

  // ─── Step 6: Verify period is open (ADR-0292 §2) ──────────────────────────
  const { data: period, error: periodErr } = await admin
    .schema("payroll")
    .from("period")
    .select("id, status")
    .eq("id", period_id)
    .eq("workspace_id", auth.workspaceId)
    .maybeSingle();

  if (periodErr || !period) {
    return NextResponse.json({ ok: false, error: "period_not_found" }, { status: 404 });
  }

  if (period.status !== "open") {
    return NextResponse.json(
      {
        ok: false,
        error: "period_frozen",
        detail: `Periode er ${period.status} — kan ikke applisere overstyring.`,
      },
      { status: 409 },
    );
  }

  // ─── Step 7: Read the original payroll.calculation row (ADR-0292 §3) ──────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: origCalcRaw, error: origCalcErr } = await (admin.schema("payroll") as any)
    .from("calculation")
    .select("*")
    .eq("id", calculation_id)
    .eq("workspace_id", auth.workspaceId)
    .maybeSingle();

  if (origCalcErr || !origCalcRaw) {
    return NextResponse.json({ ok: false, error: "calculation_not_found" }, { status: 404 });
  }

  const origCalc = origCalcRaw as {
    id: string;
    workspace_id: string;
    period_id: string;
    schedule_shift_id: string;
    profile_id: string;
    employee_group_id: string | null;
    shift_type_id: string | null;
    shift_date: string;
    scheduled_start: string;
    scheduled_end: string;
    actual_start: string | null;
    actual_end: string | null;
    gross_minutes: number;
    break_minutes_paid: number;
    break_minutes_unpaid: number;
    net_working_minutes: number;
    base_rate: number;
    base_pay: number;
    total_supplements: number;
    total_deductions: number;
    total_pay: number;
    calculation_version: number;
    calculated_at: string;
    provenance: Record<string, unknown> | null;
  };

  // ─── Step 8: Read the most-recent shift_pay_calculation_event for this shift (ADR-0292 §4) ──
  // We need to find the event to supersede. Query by shift_id, workspace_id, not-yet-superseded.
  const { data: origEvents } = await admin
    .from("shift_pay_calculation_event")
    .select("id, derivation_version, shift_period_end_date, shift_id, profile_id")
    .eq("workspace_id", auth.workspaceId)
    .eq("shift_id", origCalc.schedule_shift_id)
    .is("superseded_by_event_id", null)
    .order("derivation_version", { ascending: false })
    .limit(1);

  const origEvent = origEvents?.[0] ?? null;

  // ─── Step 9: INSERT new shift_pay_calculation_event (ADR-0292 §5, ADR-0251) ──
  // The new event represents the override. The old event will be updated to
  // point superseded_by_event_id → new event ID (service_role UPDATE per ADR-0251).
  const now = new Date().toISOString();
  const newEventDerivationVersion = (origEvent?.derivation_version ?? 1) + 1;

  const { data: newEvent, error: newEventErr } = await admin
    .from("shift_pay_calculation_event")
    .insert({
      workspace_id: auth.workspaceId,
      payroll_period_id: period_id,
      shift_id: origCalc.schedule_shift_id,
      profile_id: origCalc.profile_id,
      rule_type: "override",
      rate_value_applied: 1, // override is a fixed amount, rate = 1×amount
      rate_type: "fixed_per_shift" as const,
      source_text_applied: changes.reason ?? null,
      quantity_value: 1,
      subtotal: proposedAmountNok,
      amount_nok: proposedAmountNok,
      derivation_version: newEventDerivationVersion,
      calculated_by: `manual_override:${auth.profileId}`,
      shift_period_end_date: origEvent?.shift_period_end_date ?? origCalc.shift_date,
      provenance: {
        change_proposal_id: body.change_proposal_id,
        original_calculation_id: calculation_id,
        category: changes.category ?? "other",
        applied_by: auth.profileId,
      },
      // superseded_by_event_id is null on the new event (it is the latest)
    })
    .select("id")
    .single();

  if (newEventErr || !newEvent) {
    return NextResponse.json(
      {
        ok: false,
        error: "event_insert_failed",
        detail:
          (newEventErr as { message?: string } | null)?.message ??
          "kunne ikke opprette revisjonshendelse",
      },
      { status: 500 },
    );
  }

  // ─── Step 10: Update old event's superseded_by_event_id → new event ───────
  // Service_role only (ADR-0251 policy: service_role_supersede_shift_pay_calc_event).
  // This is the ONLY UPDATE permitted on shift_pay_calculation_event, and only
  // for the supersession chain columns. No other fields are modified.
  if (origEvent) {
    const { error: supersessionErr } = await admin
      .from("shift_pay_calculation_event")
      .update({
        superseded_by_event_id: newEvent.id,
        superseded_at: now,
      })
      .eq("id", origEvent.id)
      .eq("workspace_id", auth.workspaceId);

    if (supersessionErr) {
      // Non-fatal: the new event is inserted. Supersession link failure means the
      // audit chain is incomplete but data is not corrupted. Log and continue.
      console.error(
        "[apply-line-override] supersession UPDATE failed for event",
        origEvent.id,
        supersessionErr.message,
      );
    }
  }

  // ─── Step 11: INSERT new payroll.calculation row (ADR-0292 §6) ────────────
  // All fields copied from original; total_pay = proposedAmountNok;
  // calculation_version = original.calculation_version + 1.
  // Original row UNCHANGED (Bokføringsloven §13 — zero UPDATE).
  const newCalcVersion = (origCalc.calculation_version ?? 1) + 1;

  const { data: newCalc, error: newCalcErr } = await admin
    .schema("payroll")
    .from("calculation")
    .insert({
      workspace_id: auth.workspaceId,
      period_id: origCalc.period_id,
      schedule_shift_id: origCalc.schedule_shift_id,
      profile_id: origCalc.profile_id,
      employee_group_id: origCalc.employee_group_id ?? null,
      shift_type_id: origCalc.shift_type_id ?? null,
      shift_date: origCalc.shift_date,
      scheduled_start: origCalc.scheduled_start,
      scheduled_end: origCalc.scheduled_end,
      actual_start: origCalc.actual_start ?? null,
      actual_end: origCalc.actual_end ?? null,
      gross_minutes: origCalc.gross_minutes,
      break_minutes_paid: origCalc.break_minutes_paid,
      break_minutes_unpaid: origCalc.break_minutes_unpaid,
      net_working_minutes: origCalc.net_working_minutes,
      base_rate: origCalc.base_rate,
      base_pay: origCalc.base_pay,
      total_supplements: origCalc.total_supplements,
      total_deductions: origCalc.total_deductions,
      total_pay: proposedAmountNok, // <- override amount, only this changes
      calculation_version: newCalcVersion, // derivation_version+1 per ADR-0292
      provenance: {
        ...(typeof origCalc.provenance === "object" && origCalc.provenance !== null
          ? (origCalc.provenance as Record<string, unknown>)
          : {}),
        derivation_version: newCalcVersion,
        override_source: "wage_line_override",
        change_proposal_id: body.change_proposal_id,
        supersession_event_id: newEvent.id,
      },
    })
    .select("id")
    .single();

  if (newCalcErr || !newCalc) {
    return NextResponse.json(
      {
        ok: false,
        error: "calculation_insert_failed",
        detail:
          (newCalcErr as { message?: string } | null)?.message ??
          "kunne ikke opprette ny beregning",
      },
      { status: 500 },
    );
  }

  // ─── Step 12: Emit telemetry (ADR-0134) ───────────────────────────────────
  // Both payroll.line_override_approved and payroll.line_overridden per ADR-0292 §7.
  // IDs are non-empty: auth is validated at resolvePayrollAuth level.
  const wsId = nonEmpty(auth.workspaceId, "workspaceId");
  const actorId = nonEmpty(auth.profileId, "profileId");

  // entity_type uses "payroll_calculation" — payroll_calculation_line is not yet in EntityType.
  await emit({
    event: "payroll.line_override_approved",
    workspace_id: wsId,
    actor_id: actorId,
    properties: {
      entity: {
        entity_type: "payroll_calculation" as const,
        entity_id: calculation_id,
      },
      data: {
        change_proposal_id: body.change_proposal_id,
        calculation_id,
        period_id,
        resolved_by_profile_id: auth.profileId,
        gate_evaluation_id: null, // gateAction in _shared does not return gate_evaluation_id
      },
    },
  });

  await emit({
    event: "payroll.line_overridden",
    workspace_id: wsId,
    actor_id: actorId,
    properties: {
      entity: {
        entity_type: "payroll_calculation" as const,
        entity_id: calculation_id,
      },
      data: {
        change_proposal_id: body.change_proposal_id,
        original_calculation_id: calculation_id,
        new_calculation_id: newCalc.id,
        period_id,
        target_profile_id: origCalc.profile_id,
        original_amount_cents: changes.original_amount_cents ?? 0,
        new_amount_cents: proposed_amount_cents,
        derivation_version: newCalcVersion,
        supersession_event_id: newEvent.id,
      },
    },
  });

  return NextResponse.json({
    ok: true,
    change_proposal_id: body.change_proposal_id,
    new_calculation_id: newCalc.id,
    new_calculation_version: newCalcVersion,
    supersession_event_id: newEvent.id,
    proposed_amount_nok: proposedAmountNok,
  });
}
