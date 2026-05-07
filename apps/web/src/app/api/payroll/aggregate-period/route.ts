/**
 * BFF POST /api/payroll/aggregate-period
 *
 * Orchestrator 3 of 5 (T4.1). Calls aggregatePeriod() and writes
 * payroll.calculation_line rows per profile per pay-code.
 * Must be called AFTER snapshot-period-costs.
 *
 * ADR-0151: workspace_id derived server-side.
 * ADR-0099: gate_action before any write.
 */
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import { gateAction } from "@/app/dashboard/_actions/_shared";
import { rejectCrossOrigin, resolvePayrollAuth } from "@/app/api/payroll/_shared";
import { createAdminClient } from "@smartout/supabase/admin";
import { aggregatePeriod, nokToOre, oreToNok } from "@smartout/payroll-calculate";
import type {
  SnapshottedShiftCost,
  ManualSupplementInput,
  TipDistributionInput,
} from "@smartout/payroll-calculate";

export const runtime = "nodejs";

const RequestSchema = z.object({
  period_id: z.string().uuid(),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  const cors = rejectCrossOrigin(request);
  if (cors) return cors;

  const auth = await resolvePayrollAuth(request);
  if (!auth) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let body: z.infer<typeof RequestSchema>;
  try {
    body = RequestSchema.parse(await request.json());
  } catch (err) {
    const message =
      err instanceof z.ZodError ? (err.errors[0]?.message ?? "Invalid body") : "Invalid body";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }

  const gate = await gateAction({
    workspaceId: auth.workspaceId,
    capability: "payroll",
    channel: "chat",
    actorProfileId: auth.profileId,
    actionType: "aggregate_period",
    entityId: body.period_id,
  });
  if (!gate.allow) {
    return NextResponse.json(
      { ok: false, error: `forbidden: ${gate.reason ?? "denied"}` },
      { status: 403 },
    );
  }

  const admin = createAdminClient();
  const workspaceId = auth.workspaceId;

  // Verify period — fail-fast on not-found (L-0177).
  const { data: period, error: periodErr } = await admin
    .schema("payroll")
    .from("period")
    .select("id, status, start_date, end_date")
    .eq("id", body.period_id)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (periodErr || !period) {
    return NextResponse.json({ ok: false, error: "period_not_found" }, { status: 404 });
  }
  if (period.status === "locked" || period.status === "approved") {
    return NextResponse.json({ ok: false, error: "period_frozen" }, { status: 409 });
  }

  // Fetch shift_cost_snapshots for this period.
  const { data: snapshots, error: snapErr } = await admin
    .from("shift_cost_snapshot")
    .select(
      "id, profile_id, shift_id, session_date, base_amount, supplement_amount, total_amount, currency, pay_rule_ids, tariff_rate_snapshot",
    )
    .eq("workspace_id", workspaceId)
    .eq("payroll_period_id", body.period_id);

  if (snapErr) {
    return NextResponse.json(
      { ok: false, error: "snapshot_fetch_error", detail: snapErr.message },
      { status: 500 },
    );
  }

  // Filter out snapshots without shift_id or profile_id (legacy cascade rows before migration).
  const snapshotInputs: SnapshottedShiftCost[] = (snapshots ?? [])
    .filter(
      (s): s is typeof s & { shift_id: string; profile_id: string } =>
        !!s.shift_id && !!s.profile_id,
    )
    .map((s) => ({
      shift_id: s.shift_id,
      profile_id: s.profile_id,
      workspace_id: workspaceId,
      tariff_rate_snapshot:
        (s.tariff_rate_snapshot as SnapshottedShiftCost["tariff_rate_snapshot"]) ?? [],
      base_pay_ore: nokToOre(s.base_amount ?? 0),
      total_supplements_ore: nokToOre(s.supplement_amount ?? 0),
      total_ore: nokToOre(s.total_amount ?? 0),
      lines: [],
    }));

  // Fetch manual supplements for shifts in this period.
  const periodShiftIds = new Set(snapshotInputs.map((s) => s.shift_id));
  const { data: manualSupps } = await admin
    .schema("payroll")
    .from("manual_supplement")
    .select("id, schedule_shift_id, added_by, amount, description, salary_code, supplement_rule_id")
    .eq("workspace_id", workspaceId)
    .in("schedule_shift_id", periodShiftIds.size > 0 ? [...periodShiftIds] : ["__no_match__"]);

  const manualInputs: ManualSupplementInput[] = (manualSupps ?? []).map((ms) => ({
    id: ms.id,
    schedule_shift_id: ms.schedule_shift_id,
    profile_id: ms.added_by,
    workspace_id: workspaceId,
    amount: ms.amount,
    salary_code: ms.salary_code ?? null,
    description: ms.description,
    supplement_rule_id: ms.supplement_rule_id ?? null,
  }));

  // Fetch tip distributions for this period.
  // tip_distribution has calculated_amount + adjusted_amount (not net_amount).
  const { data: tipDists } = await admin
    .from("tip_distribution")
    .select(
      "id, profile_id, calculated_amount, adjusted_amount, pool_id, status, payroll_period_id",
    )
    .eq("workspace_id", workspaceId)
    .eq("payroll_period_id", body.period_id)
    .gt("calculated_amount", 0);

  const tipInputs: TipDistributionInput[] = (tipDists ?? []).map((td) => ({
    id: td.id,
    profile_id: td.profile_id,
    workspace_id: workspaceId,
    pool_id: td.pool_id,
    calculated_amount: td.calculated_amount ?? 0,
    adjusted_amount: td.adjusted_amount ?? null,
    payroll_period_id: td.payroll_period_id ?? null,
    status: td.status ?? "approved",
  }));

  // Monthly salary override: employee_payroll_profile has no monthly_salary column in Phase 1.
  // monthlySalaryByProfile left empty — aggregatePeriod treats monthly profiles at period level.
  const monthlySalaryByProfile = new Map<string, bigint>();

  // Run aggregation.
  const aggregated = aggregatePeriod(
    snapshotInputs,
    manualInputs,
    tipInputs,
    body.period_id,
    monthlySalaryByProfile,
  );

  // Find the latest calculation row ID per profile for this period.
  const { data: calcRows } = await admin
    .schema("payroll")
    .from("calculation")
    .select("id, profile_id, calculation_version")
    .eq("workspace_id", workspaceId)
    .eq("period_id", body.period_id)
    .order("calculation_version", { ascending: false });

  const latestCalcByProfile = new Map<string, string>(); // profile_id → calculation.id
  for (const c of calcRows ?? []) {
    if (!latestCalcByProfile.has(c.profile_id)) {
      latestCalcByProfile.set(c.profile_id, c.id);
    }
  }

  const lineRows: Record<string, unknown>[] = [];
  for (const agg of aggregated) {
    const calcId = latestCalcByProfile.get(agg.profile_id);
    if (!calcId) continue;

    for (const line of agg.lines) {
      lineRows.push({
        workspace_id: workspaceId,
        calculation_id: calcId,
        salary_code: line.pay_code,
        description: line.description,
        line_type: "supplement",
        hours: line.hours ?? null,
        amount: oreToNok(line.amount_ore),
        rate: null,
        supplement_rule_id: line.supplement_rule_id ?? null,
        metadata: { profile_id: agg.profile_id, period_id: body.period_id },
      });
    }
  }

  // Delete old lines for these calculations, then insert fresh (idempotent re-run).
  const calcIds = [...new Set([...latestCalcByProfile.values()])];
  if (calcIds.length > 0) {
    // eslint-disable-next-line smartout/no-direct-supabase-write
    await admin.schema("payroll").from("calculation_line").delete().in("calculation_id", calcIds);
  }

  if (lineRows.length > 0) {
    // eslint-disable-next-line smartout/no-direct-supabase-write
    const { error: lineErr } = await (admin.schema("payroll").from("calculation_line") as any) // eslint-disable-line @typescript-eslint/no-explicit-any
      .insert(lineRows);

    if (lineErr) {
      return NextResponse.json(
        { ok: false, error: "line_insert_error", detail: (lineErr as { message: string }).message },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({
    ok: true,
    period_id: body.period_id,
    profiles_aggregated: aggregated.length,
    lines_written: lineRows.length,
  });
}
