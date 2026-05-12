/**
 * BFF POST /api/payroll/run-deviation-checks
 *
 * Orchestrator 4 of 5. Runs runDeviationChecks() → upserts payroll.deviation
 * rows. Returns { deviation_count, error_count }.
 *
 * ADR-0151: workspace_id derived server-side.
 * ADR-0099: gate_action before write.
 */
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import { gateAction } from "@/app/dashboard/_actions/_shared";
import { rejectCrossOrigin, resolvePayrollAuth } from "@/app/api/payroll/_shared";
import { createAdminClient } from "@smartout/supabase/admin";
import { runDeviationChecks } from "@smartout/payroll-calculate";
import type {
  DeviationChecksInput,
  AggregatedPeriod,
  InterpretedShift,
  WorkspaceSettings,
  RegulatoryFrameworkInput,
  TariffRateInput,
  PayrollProfile,
  PeriodLine,
  TimeBucket,
  FiredSupplement,
} from "@smartout/payroll-calculate";

export const runtime = "nodejs";

const RequestSchema = z.object({
  workspace_id: z
    .string()
    .uuid()
    .describe("UUID of the workspace context (forwarded from recalculate-period)"),
  period_id: z.string().uuid(),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
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
  const auth = await resolvePayrollAuth(request, body.workspace_id);
  if (!auth) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const gate = await gateAction({
    workspaceId: auth.workspaceId,
    capability: "payroll",
    channel: "chat",
    actorProfileId: auth.profileId,
    actionType: "run_deviation_checks",
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

  // Fetch snapshots to build AggregatedPeriod inputs.
  const { data: snapshots } = await admin
    .from("shift_cost_snapshot")
    .select("id, profile_id, shift_id, base_amount, supplement_amount, total_amount")
    .eq("workspace_id", workspaceId)
    .eq("payroll_period_id", body.period_id);

  // Build AggregatedPeriod[] from snapshots (minimal — shift-level detail sufficient for W01-W14).
  const aggByProfile = new Map<
    string,
    { profile_id: string; total_ore: bigint; shift_ids: string[] }
  >();
  for (const snap of snapshots ?? []) {
    const profileId = snap.profile_id;
    const shiftId = snap.shift_id;
    if (!profileId || !shiftId) continue; // profile_id + shift_id are nullable on legacy rows
    const existing = aggByProfile.get(profileId);
    const totalOre = BigInt(Math.round((snap.total_amount ?? 0) * 100));
    if (existing) {
      existing.total_ore += totalOre;
      existing.shift_ids.push(shiftId);
    } else {
      aggByProfile.set(profileId, {
        profile_id: profileId,
        total_ore: totalOre,
        shift_ids: [shiftId],
      });
    }
  }

  const aggregated: AggregatedPeriod[] = [...aggByProfile.values()].map((a) => ({
    profile_id: a.profile_id,
    period_id: body.period_id,
    workspace_id: workspaceId,
    gross_amount_ore: a.total_ore,
    tips_amount_ore: 0n,
    manual_supplement_ore: 0n,
    total_ore: a.total_ore,
    lines: [] as PeriodLine[],
    shift_ids: a.shift_ids,
  }));

  // Fetch interpretations from calculation rows.
  const { data: calcRows } = await admin
    .schema("payroll")
    .from("calculation")
    .select(
      "id, profile_id, schedule_shift_id, shift_date, net_working_minutes, gross_minutes, actual_start, actual_end, calculation_version",
    )
    .eq("workspace_id", workspaceId)
    .eq("period_id", body.period_id)
    .order("calculation_version", { ascending: false });

  // Keep latest per shift.
  const latestByShift = new Map<
    string,
    {
      id: string;
      profile_id: string;
      schedule_shift_id: string;
      shift_date: string | null;
      net_working_minutes: number | null;
      gross_minutes: number | null;
      actual_start: string | null;
      actual_end: string | null;
      calculation_version: number | null;
    }
  >();
  for (const c of calcRows ?? []) {
    if (!latestByShift.has(c.schedule_shift_id)) latestByShift.set(c.schedule_shift_id, c);
  }

  const shifts: InterpretedShift[] = [...latestByShift.values()].map((c) => ({
    shift_id: c.schedule_shift_id,
    profile_id: c.profile_id,
    workspace_id: workspaceId,
    effective_start: c.actual_start ?? "",
    effective_end: c.actual_end ?? "",
    shift_date: c.shift_date ?? "",
    scheduled_break_minutes: 0,
    paid_break_minutes: 0,
    unpaid_break_minutes: 0,
    gross_minutes: c.gross_minutes ?? 0,
    worked_minutes: c.net_working_minutes ?? 0,
    buckets: [] as TimeBucket[],
    fired_supplements: [] as FiredSupplement[],
    night_worker_category: null,
  }));

  // Fetch workspace settings and tariff rates.
  const [wsResult, tariffResult, profilesResult] = await Promise.all([
    admin
      .schema("payroll")
      .from("workspace_settings")
      .select("*")
      .eq("workspace_id", workspaceId)
      .maybeSingle(),
    admin
      .from("tariff_rate_table")
      .select(
        "id, workspace_id, rate_type, amount, unit, source, law_version, effective_from, effective_until, paragraf_ref, seniority_level, role_class",
      )
      .or(`workspace_id.eq.${workspaceId},workspace_id.is.null`)
      .lte("effective_from", period.end_date),
    admin
      .from("employee_payroll_profile")
      .select(
        "profile_id, salary_type, agreed_weekly_hours, overtime_mode, toil_agreement_signed_at, seniority_start_date, tariff_category, has_fagbrev, sector_experience_years",
      )
      .in("profile_id", [...new Set((calcRows ?? []).map((c) => c.profile_id))])
      .eq("workspace_id", workspaceId),
  ]);

  const wsData = wsResult.data;
  const workspaceSettings: WorkspaceSettings = {
    workspace_id: workspaceId,
    is_tariff_bound: wsData?.is_tariff_bound ?? false,
    supplement_stacking_policy: (wsData?.supplement_stacking_policy ??
      "category_exclusive") as WorkspaceSettings["supplement_stacking_policy"],
    overtime_requires_pre_approval: wsData?.overtime_requires_pre_approval ?? false,
    overtime_warn_threshold_minutes: wsData?.overtime_warn_threshold_minutes ?? 30,
    punch_rounding_minutes: (wsData?.punch_rounding_minutes ??
      0) as WorkspaceSettings["punch_rounding_minutes"],
    punch_rounding_direction: (wsData?.punch_rounding_direction ??
      "toward_employee") as WorkspaceSettings["punch_rounding_direction"],
    punch_rounding_snap_window_minutes: wsData?.punch_rounding_snap_window_minutes ?? 10,
    punch_window_early_minutes: wsData?.punch_window_early_minutes ?? 15,
    punch_window_late_minutes: wsData?.punch_window_late_minutes ?? 30,
    punch_grace_after_scheduled_minutes: wsData?.punch_grace_after_scheduled_minutes ?? 60,
    forced_break_reminder_minutes: wsData?.forced_break_reminder_minutes ?? 300,
    toil_default_max_banked_hours: wsData?.toil_default_max_banked_hours ?? 80,
    wellness_days_per_year_default: wsData?.wellness_days_per_year_default ?? 0,
    split_shift_threshold_minutes: wsData?.split_shift_threshold_minutes ?? 0,
    split_shift_allowance_amount: wsData?.split_shift_allowance_amount ?? 0,
    vacation_pay_pct: wsData?.vacation_pay_pct ?? 12.0,
    period_type: wsData?.period_type ?? "monthly",
    break_rule_is_paid: null,
  };

  const tariffRates: TariffRateInput[] = (tariffResult.data ?? []).map((t) => ({
    id: t.id,
    workspace_id: t.workspace_id ?? null,
    rate_type: t.rate_type,
    amount: t.amount,
    unit: t.unit,
    source: t.source,
    law_version: t.law_version ?? "2025",
    effective_from: t.effective_from,
    effective_until: t.effective_until ?? null,
    paragraf_ref: t.paragraf_ref ?? null,
    seniority_level: t.seniority_level ?? null,
    role_class: t.role_class ?? null,
  }));

  const profilesMap = new Map<string, PayrollProfile>();
  for (const pp of profilesResult.data ?? []) {
    profilesMap.set(pp.profile_id, {
      id: pp.profile_id,
      profile_id: pp.profile_id,
      workspace_id: workspaceId,
      salary_type: pp.salary_type ?? "hourly",
      agreed_weekly_hours: pp.agreed_weekly_hours ?? 37.5,
      holiday_allowance_pct: 12.0,
      overtime_mode: (pp.overtime_mode ?? "paid_out") as "paid_out" | "banked",
      toil_agreement_signed_at: pp.toil_agreement_signed_at ?? null,
      toil_max_banked_hours: null,
      seniority_start_date: pp.seniority_start_date ?? "2020-01-01",
      tariff_category: pp.tariff_category ?? "voksen_ufaglart",
      has_fagbrev: pp.has_fagbrev ?? false,
      sector_experience_years: pp.sector_experience_years ?? 0,
    });
  }

  // Build regulatory framework — Aml. statutory thresholds (Phase 1).
  const framework: RegulatoryFrameworkInput = {
    min_rest_hours_between_shifts: 11, // Aml. §10-8
    max_daily_hours: 9, // Aml. §10-4
    max_weekly_hours: 40, // Aml. §10-4
    max_weekly_ot_hours: 10, // Aml. §10-6
    forced_break_threshold_minutes: 330, // Aml. §10-9: 5.5h = 330 min
  };

  const deviationInput: DeviationChecksInput = {
    aggregated,
    shifts,
    workspaceSettings,
    framework,
    profilesByProfileId: profilesMap,
    tariffRates,
    periodStartDate: period.start_date,
    evaluationYear: new Date().getFullYear(),
  };

  const deviations = runDeviationChecks(deviationInput);

  // Get latest derivation version for response.
  const latestVersion = Math.max(...(calcRows ?? []).map((c) => c.calculation_version ?? 0), 0);

  // Delete existing non-acknowledged deviations for this period before re-inserting.
  // eslint-disable-next-line smartout/no-direct-supabase-write
  await admin
    .schema("payroll")
    .from("deviation")
    .delete()
    .eq("workspace_id", workspaceId)
    .eq("period_id", body.period_id)
    .is("acknowledged_by", null);

  const deviationRows = deviations.map((d) => ({
    workspace_id: workspaceId,
    period_id: body.period_id,
    profile_id: d.profile_id ?? null,
    schedule_shift_id: d.shift_id ?? null,
    calculation_id: null,
    check_id: d.check_id,
    severity: d.severity,
    message: d.message,
    details: d.details ?? null,
    resolution: null,
    acknowledged_by: null,
    acknowledged_at: null,
  }));

  if (deviationRows.length > 0) {
    // eslint-disable-next-line smartout/no-direct-supabase-write, @typescript-eslint/no-explicit-any
    const { error: devErr } = await (admin.schema("payroll").from("deviation") as any).insert(
      deviationRows,
    );
    if (devErr) {
      return NextResponse.json(
        {
          ok: false,
          error: "deviation_insert_error",
          detail: (devErr as { message: string }).message,
        },
        { status: 500 },
      );
    }
  }

  const errorCount = deviations.filter((d) => d.severity === "error").length;

  return NextResponse.json({
    ok: true,
    period_id: body.period_id,
    deviation_count: deviations.length,
    error_count: errorCount,
    derivation_version: latestVersion,
  });
}
