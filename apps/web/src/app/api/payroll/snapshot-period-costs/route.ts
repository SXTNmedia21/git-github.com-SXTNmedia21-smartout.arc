/**
 * BFF POST /api/payroll/snapshot-period-costs
 *
 * Orchestrator 2 of 5 (T4.1). For each latest payroll.calculation row in
 * the period, re-runs interpretShift → per-bucket evaluateSupplements →
 * applyStackingPolicy → snapshotShiftCost and persists:
 *   - public.shift_cost_snapshot with frozen tariff JSONB (ADR-0252)
 *   - public.shift_pay_calculation_event rows per fired supplement (ADR-0251)
 *
 * Must be called AFTER derive-shift-hours.
 *
 * ADR-0252: tariff snapshot frozen at first calculation.
 * ADR-0251: shift_pay_calculation_event is INSERT-only (audit immutability).
 * ADR-0151: workspace_id derived server-side.
 * ADR-0099: gate_action before any write.
 *
 * Column notes:
 *   - schedule_shift PK is schedule_shift_id (not "id"); employee_id = FK → profile
 *   - public_holiday column is holiday_date (not "date")
 *   - public.supplement_rule (Phase 1) has match_predicate — NOT payroll.supplement_rule
 *   - employee_payroll_profile: no hourly_rate column; base rate resolves from tariff lookup
 *   - shift_cost_snapshot: payroll columns added via migration 20260527101500
 *   - evaluateSupplements is called per TimeBucket (not per shift)
 */
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import { gateAction } from "@/app/dashboard/_actions/_shared";
import { rejectCrossOrigin, resolvePayrollAuth } from "@/app/api/payroll/_shared";
import { createAdminClient } from "@smartout/supabase/admin";
import {
  interpretShift,
  evaluateSupplements,
  applyStackingPolicy,
  snapshotShiftCost,
  oreToNok,
} from "@smartout/payroll-calculate";
import type {
  ShiftInput,
  TimeEntryInput,
  SupplementRuleInput,
  TariffRateInput,
  WorkspaceSettings,
  PayrollProfile,
  PublicHoliday,
} from "@smartout/payroll-calculate";

export const runtime = "nodejs";

const RequestSchema = z.object({
  workspace_id: z
    .string()
    .uuid()
    .describe("UUID of the workspace context (forwarded from recalculate-period)"),
  period_id: z.string().uuid(),
});

function buildWorkspaceSettings(
  wsData: Record<string, unknown> | null,
  workspaceId: string,
): WorkspaceSettings {
  return {
    workspace_id: workspaceId,
    is_tariff_bound: (wsData?.is_tariff_bound as boolean) ?? false,
    supplement_stacking_policy: ((wsData?.supplement_stacking_policy as string) ??
      "category_exclusive") as WorkspaceSettings["supplement_stacking_policy"],
    overtime_requires_pre_approval: (wsData?.overtime_requires_pre_approval as boolean) ?? false,
    overtime_warn_threshold_minutes: (wsData?.overtime_warn_threshold_minutes as number) ?? 30,
    punch_rounding_minutes: ((wsData?.punch_rounding_minutes as number) ??
      0) as WorkspaceSettings["punch_rounding_minutes"],
    punch_rounding_direction: ((wsData?.punch_rounding_direction as string) ??
      "toward_employee") as WorkspaceSettings["punch_rounding_direction"],
    punch_rounding_snap_window_minutes:
      (wsData?.punch_rounding_snap_window_minutes as number) ?? 10,
    punch_window_early_minutes: (wsData?.punch_window_early_minutes as number) ?? 15,
    punch_window_late_minutes: (wsData?.punch_window_late_minutes as number) ?? 30,
    punch_grace_after_scheduled_minutes:
      (wsData?.punch_grace_after_scheduled_minutes as number) ?? 60,
    forced_break_reminder_minutes: (wsData?.forced_break_reminder_minutes as number) ?? 300,
    toil_default_max_banked_hours: (wsData?.toil_default_max_banked_hours as number) ?? 80,
    wellness_days_per_year_default: (wsData?.wellness_days_per_year_default as number) ?? 0,
    split_shift_threshold_minutes: (wsData?.split_shift_threshold_minutes as number) ?? 0,
    split_shift_allowance_amount: (wsData?.split_shift_allowance_amount as number) ?? 0,
    vacation_pay_pct: (wsData?.vacation_pay_pct as number) ?? 12.0,
    period_type: (wsData?.period_type as string) ?? "monthly",
    break_rule_is_paid: null,
  };
}

type ShiftRow = {
  schedule_shift_id: string;
  employee_id: string | null;
  start_time: string;
  end_time: string;
  shift_date: string | null;
  custom_rate: number | null;
  custom_rate_type: string | null;
  shift_type_id: string | null;
  breaks: number | null;
};

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
    actionType: "snapshot_period_costs",
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

  // Fetch latest calculation rows for this period.
  const { data: calcs, error: calcErr } = await admin
    .schema("payroll")
    .from("calculation")
    .select("id, profile_id, schedule_shift_id, shift_date, calculation_version, shift_type_id")
    .eq("workspace_id", workspaceId)
    .eq("period_id", body.period_id)
    .order("calculation_version", { ascending: false });

  if (calcErr) {
    return NextResponse.json(
      { ok: false, error: "calc_fetch_error", detail: calcErr.message },
      { status: 500 },
    );
  }

  // Keep only the latest calculation_version per shift.
  const latestByShift = new Map<string, NonNullable<typeof calcs>[number]>();
  for (const calc of calcs ?? []) {
    if (!latestByShift.has(calc.schedule_shift_id)) {
      latestByShift.set(calc.schedule_shift_id, calc);
    }
  }
  const latestCalcs = [...latestByShift.values()];

  if (latestCalcs.length === 0) {
    return NextResponse.json({
      ok: true,
      period_id: body.period_id,
      snapshots_created: 0,
      events_created: 0,
    });
  }

  const shiftIds = latestCalcs.map((c) => c.schedule_shift_id);

  // Fetch all required data in parallel.
  const [
    shiftsResult,
    rulesResult,
    settingsResult,
    holidaysResult,
    timeEntriesResult,
    tariffResult,
  ] = await Promise.all([
    // schedule_shift PK = schedule_shift_id; employee_id = FK → profile
    admin
      .from("schedule_shift")
      .select(
        "schedule_shift_id, employee_id, start_time, end_time, shift_date, custom_rate, custom_rate_type, shift_type_id, breaks",
      )
      .in("schedule_shift_id", shiftIds),
    // public.supplement_rule (Phase 1 table with match_predicate) — NOT payroll.supplement_rule
    admin
      .from("supplement_rule")
      .select(
        "id, workspace_id, is_active, supplement_type, rate_type, rate_value, tariff_rate_table_id, match_predicate, paragraf_ref, version_hash, valid_from, valid_until",
      )
      .eq("is_active", true)
      .or(`workspace_id.eq.${workspaceId},workspace_id.is.null`),
    admin
      .schema("payroll")
      .from("workspace_settings")
      .select("*")
      .eq("workspace_id", workspaceId)
      .maybeSingle(),
    // public_holiday: column is holiday_date (not "date")
    admin
      .from("public_holiday")
      .select("holiday_date, name")
      .gte("holiday_date", period.start_date)
      .lte("holiday_date", period.end_date),
    // time_entry is in timesheet schema; PK = time_entry_id
    admin
      .schema("timesheet")
      .from("time_entry")
      .select("time_entry_id, shift_id, profile_id, workspace_id, punch_in, punch_out, breaks")
      .in("shift_id", shiftIds),
    // Tariff rates frozen into snapshot per ADR-0252
    admin
      .from("tariff_rate_table")
      .select(
        "id, workspace_id, rate_type, amount, unit, source, law_version, effective_from, effective_until, paragraf_ref, seniority_level, role_class",
      )
      .or(`workspace_id.eq.${workspaceId},workspace_id.is.null`)
      .lte("effective_from", period.end_date)
      .or("effective_until.is.null,effective_until.gt." + period.start_date),
  ]);

  // Fetch payroll profiles.
  const profileIdSet = new Set(latestCalcs.map((c) => c.profile_id));
  const profileIds = [...profileIdSet] as string[];
  const { data: payrollProfileRows } = await admin
    .from("employee_payroll_profile")
    .select(
      "id, profile_id, workspace_id, salary_type, agreed_weekly_hours, holiday_allowance_pct, overtime_mode, toil_agreement_signed_at, toil_max_banked_hours, seniority_start_date, tariff_category, has_fagbrev, sector_experience_years",
    )
    .in("profile_id", profileIds)
    .eq("workspace_id", workspaceId);

  // Fetch night_worker_category via shift_type (payroll schema).
  const shiftTypeIds = [
    ...new Set(latestCalcs.map((c) => c.shift_type_id).filter(Boolean)),
  ] as string[];
  const { data: shiftTypeRows } =
    shiftTypeIds.length > 0
      ? await admin
          .schema("payroll")
          .from("shift_type")
          .select("id, night_worker_category")
          .in("id", shiftTypeIds)
      : { data: [] as Array<{ id: string; night_worker_category: string | null }> };

  // Build indexes.
  const nightWorkerByShiftTypeId = new Map<string, "night_watch" | "manual" | "ordinary" | null>();
  for (const st of shiftTypeRows ?? []) {
    nightWorkerByShiftTypeId.set(
      st.id,
      (st.night_worker_category as "night_watch" | "manual" | "ordinary" | null) ?? null,
    );
  }

  const shiftMap = new Map<string, ShiftRow>();
  for (const s of (shiftsResult.data ?? []) as ShiftRow[]) {
    shiftMap.set(s.schedule_shift_id, s);
  }

  const teByShift = new Map<string, TimeEntryInput>();
  for (const te of timeEntriesResult.data ?? []) {
    if (!teByShift.has(te.shift_id)) {
      teByShift.set(te.shift_id, {
        time_entry_id: te.time_entry_id,
        shift_id: te.shift_id,
        profile_id: te.profile_id,
        workspace_id: (te.workspace_id as string | null) ?? workspaceId,
        punch_in: te.punch_in,
        punch_out: te.punch_out ?? null,
        breaks: te.breaks as TimeEntryInput["breaks"],
      });
    }
  }

  const profileMap = new Map<string, PayrollProfile>();
  for (const pp of payrollProfileRows ?? []) {
    profileMap.set(pp.profile_id, {
      id: pp.id,
      profile_id: pp.profile_id,
      workspace_id: pp.workspace_id,
      salary_type: pp.salary_type ?? "hourly",
      agreed_weekly_hours: pp.agreed_weekly_hours ?? 37.5,
      holiday_allowance_pct: pp.holiday_allowance_pct ?? 12.0,
      overtime_mode: (pp.overtime_mode ?? "paid_out") as "paid_out" | "banked",
      toil_agreement_signed_at: pp.toil_agreement_signed_at ?? null,
      toil_max_banked_hours: pp.toil_max_banked_hours ?? null,
      seniority_start_date: pp.seniority_start_date ?? "2020-01-01",
      tariff_category: pp.tariff_category ?? "voksen_ufaglart",
      has_fagbrev: pp.has_fagbrev ?? false,
      sector_experience_years: pp.sector_experience_years ?? 0,
    });
  }

  const workspaceSettings = buildWorkspaceSettings(
    settingsResult.data as Record<string, unknown> | null,
    workspaceId,
  );

  // holiday_date column (not "date").
  const holidays: PublicHoliday[] = (holidaysResult.data ?? []).map((h) => ({
    date: h.holiday_date,
    name: h.name,
  }));

  const supplementRules: SupplementRuleInput[] = (rulesResult.data ?? []).map((r) => ({
    id: r.id,
    workspace_id: r.workspace_id ?? null,
    is_active: r.is_active,
    supplement_type: r.supplement_type,
    rate_type: r.rate_type,
    rate_value: r.rate_value ?? 0,
    tariff_rate_table_id: r.tariff_rate_table_id ?? null,
    match_predicate: (r.match_predicate as SupplementRuleInput["match_predicate"]) ?? {},
    paragraf_ref: r.paragraf_ref ?? null,
    version_hash: r.version_hash ?? null,
    valid_from: r.valid_from ?? null,
    valid_until: r.valid_until ?? null,
  }));

  const tariffRates: TariffRateInput[] = (tariffResult.data ?? []).map((t) => ({
    id: t.id,
    workspace_id: t.workspace_id ?? null,
    rate_type: t.rate_type,
    amount: t.amount,
    unit: t.unit,
    source: t.source,
    law_version: (t.law_version as string | null) ?? "2025",
    effective_from: t.effective_from,
    effective_until: t.effective_until ?? null,
    paragraf_ref: (t.paragraf_ref as string | null) ?? null,
    seniority_level: (t.seniority_level as string | null) ?? null,
    role_class: (t.role_class as string | null) ?? null,
  }));

  // Build snapshot + audit rows per shift.
  const snapshotRows: Record<string, unknown>[] = [];
  const auditEventRows: Record<string, unknown>[] = [];

  for (const calc of latestCalcs) {
    const shift = shiftMap.get(calc.schedule_shift_id);
    const profile = profileMap.get(calc.profile_id);
    if (!shift || !profile) continue;

    const nightWorkerCategory = calc.shift_type_id
      ? (nightWorkerByShiftTypeId.get(calc.shift_type_id) ?? null)
      : null;

    const shiftInput: ShiftInput = {
      shift_id: shift.schedule_shift_id,
      profile_id: shift.employee_id ?? calc.profile_id,
      workspace_id: workspaceId,
      start_time: shift.start_time,
      end_time: shift.end_time,
      scheduled_start: shift.start_time,
      scheduled_end: shift.end_time,
      scheduled_break_minutes: typeof shift.breaks === "number" ? shift.breaks : 0,
      shift_date: shift.shift_date ?? shift.start_time.slice(0, 10),
      night_worker_category: nightWorkerCategory,
      custom_rate: shift.custom_rate ?? null,
      custom_rate_type: (shift.custom_rate_type as "per_hour" | "per_shift" | null) ?? null,
    };

    const te: TimeEntryInput = teByShift.get(shift.schedule_shift_id) ?? {
      time_entry_id: shift.schedule_shift_id + "_fallback",
      shift_id: shift.schedule_shift_id,
      profile_id: shiftInput.profile_id,
      workspace_id: workspaceId,
      punch_in: shift.start_time,
      punch_out: shift.end_time,
      breaks: null,
    };

    // interpretShift: (shift, timeEntry, publicHolidays, workspaceSettings)
    const interpreted = interpretShift(shiftInput, te, holidays, workspaceSettings);

    // evaluateSupplements is per-bucket. Loop over buckets, collect all fired supplements.
    // Base hourly rate: no column on employee_payroll_profile in Phase 1; use 0.
    // snapshotShiftCost resolves tariff via lookup when baseHourlyRateNok = 0.
    const baseHourlyRateNok = 0;
    const allFiredRaw = interpreted.buckets.flatMap((bucket) =>
      evaluateSupplements(
        bucket,
        shiftInput,
        supplementRules,
        tariffRates,
        workspaceSettings,
        baseHourlyRateNok,
      ),
    );
    const fired = applyStackingPolicy(allFiredRaw, workspaceSettings.supplement_stacking_policy);

    // Populate fired_supplements on interpreted before passing to snapshotShiftCost.
    interpreted.fired_supplements = fired;

    const snapshot = snapshotShiftCost(interpreted, tariffRates, profile, baseHourlyRateNok);

    snapshotRows.push({
      workspace_id: workspaceId,
      profile_id: calc.profile_id,
      shift_id: calc.schedule_shift_id, // payroll column — migration 20260527101500
      payroll_period_id: body.period_id, // payroll column — migration 20260527101500
      session_date: shiftInput.shift_date,
      base_amount: oreToNok(snapshot.base_pay_ore),
      supplement_amount: oreToNok(snapshot.total_supplements_ore),
      total_amount: oreToNok(snapshot.total_ore),
      currency: "NOK",
      pay_rule_ids: fired.map((f) => f.rule_id),
      tariff_rate_snapshot: tariffRates, // frozen JSONB per ADR-0252
      // Legacy cascade columns required by NOT NULL constraints on shift_cost_snapshot:
      schedule_shift_id: calc.schedule_shift_id,
      base_cost: oreToNok(snapshot.base_pay_ore),
      total_cost: oreToNok(snapshot.total_ore),
      base_hours: 0,
      base_rate: baseHourlyRateNok,
    });

    // One audit event per fired supplement (ADR-0251: INSERT-only, no upsert).
    const shiftPeriodEndDate = period.end_date;
    for (const f of fired) {
      auditEventRows.push({
        workspace_id: workspaceId,
        profile_id: calc.profile_id,
        shift_id: calc.schedule_shift_id,
        payroll_period_id: body.period_id,
        rule_id: f.rule_id,
        tariff_rate_table_id: f.tariff_rate_table_id ?? null,
        rule_type: `supplement_rule:${f.supplement_type}`,
        rate_type: f.rate_type,
        rate_value_applied: f.rate_value_nok,
        quantity_value: f.quantity_minutes / 60, // minutes → hours (rate is per_hour)
        subtotal: oreToNok(f.amount_ore),
        amount_nok: oreToNok(f.amount_ore),
        provenance: {
          rule_id: f.rule_id,
          tariff_version: "2025",
          derivation_version: calc.calculation_version,
          triggered_by_event: "manual_recalc",
          matched_window: f.provenance.matched_window ?? null,
          rate_source: f.provenance.rate_source,
        },
        derivation_version: calc.calculation_version,
        shift_period_end_date: shiftPeriodEndDate,
        superseded_at: null,
        superseded_by_event_id: null,
      });
    }
  }

  // Delete existing snapshots for this period then insert fresh (idempotent re-run).
  // No unique constraint on (shift_id, payroll_period_id) — delete+insert is the pattern.
  if (snapshotRows.length > 0) {
    // eslint-disable-next-line smartout/no-direct-supabase-write
    await admin.from("shift_cost_snapshot").delete().eq("payroll_period_id", body.period_id);

    // eslint-disable-next-line smartout/no-direct-supabase-write, @typescript-eslint/no-explicit-any
    const { error: snapErr } = await (admin.from("shift_cost_snapshot") as any).insert(
      snapshotRows,
    );
    if (snapErr) {
      return NextResponse.json(
        {
          ok: false,
          error: "snapshot_insert_error",
          detail: (snapErr as { message: string }).message,
        },
        { status: 500 },
      );
    }
  }

  // INSERT audit events (ADR-0251: INSERT-only, no upsert).
  if (auditEventRows.length > 0) {
    // eslint-disable-next-line smartout/no-direct-supabase-write, @typescript-eslint/no-explicit-any
    const { error: auditErr } = await (admin.from("shift_pay_calculation_event") as any).insert(
      auditEventRows,
    );
    if (auditErr) {
      // Non-fatal: audit failure must not block the orchestrator.
      console.error(
        "[snapshot-period-costs] audit event insert partial failure:",
        (auditErr as { message: string }).message,
      );
    }
  }

  return NextResponse.json({
    ok: true,
    period_id: body.period_id,
    snapshots_created: snapshotRows.length,
    events_created: auditEventRows.length,
  });
}
