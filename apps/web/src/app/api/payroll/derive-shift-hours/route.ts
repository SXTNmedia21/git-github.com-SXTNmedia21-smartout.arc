/**
 * BFF POST /api/payroll/derive-shift-hours
 *
 * Orchestrator 1 of 5 (T4.1). Runs Layer 3 of the payroll pipeline —
 * interpretShift + evaluateSupplements + applyStackingPolicy — for every
 * shift in a payroll period and persists results to payroll.calculation.
 *
 * PATTERN: BFF route because @smartout/payroll-calculate is a JS package —
 * it cannot be called from PL/pgSQL. This route fetches all required data
 * from DB, calls the pure-fn pipeline, and writes payroll.calculation rows.
 * Pattern mirrors /api/tips/approve-distribution (tips BFF).
 *
 * ADR-0151: workspace_id + profile_id derived server-side. Body carries only
 *   period_id.
 * ADR-0099: gate_action called before any write.
 * ADR-0078: payroll = Høy-PII — chat-only, BFF enforces.
 * ADR-0252: derivation_version = MAX(existing) + 1 per period (idempotent).
 *
 * Column notes:
 *   - schedule_shift PK is schedule_shift_id (not "id")
 *   - schedule_shift.employee_id = FK → profile.profile_id
 *   - time_entry is in timesheet schema; PK is time_entry_id
 *   - public_holiday column is holiday_date (not "date")
 *   - employee_payroll_profile has both salary_type (legacy) and remuneration_type (Wave 1A SMA-345)
 *   - night_worker_category comes from shift_type join, not schedule_shift directly
 */
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import { gateAction } from "@/app/dashboard/_actions/_shared";
import { rejectCrossOrigin, resolvePayrollAuth } from "@/app/api/payroll/_shared";
import { createAdminClient } from "@smartout/supabase/admin";
import { interpretShift } from "@smartout/payroll-calculate";
import type {
  ShiftInput,
  TimeEntryInput,
  WorkspaceSettings,
  PayrollProfile,
  PublicHoliday,
} from "@smartout/payroll-calculate";
// NOTE: evaluateSupplements runs in snapshot-period-costs step where tariff rates are available.

export const runtime = "nodejs";

const RequestSchema = z.object({
  workspace_id: z
    .string()
    .uuid()
    .describe("UUID of the workspace context (forwarded from recalculate-period)"),
  period_id: z.string().uuid(),
});

/** Build workspace settings from DB row with safe defaults. */
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
  // workspace_id forwarded from recalculate-period (server-to-server orchestration).
  const auth = await resolvePayrollAuth(request, body.workspace_id);
  if (!auth) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  // C4 authority gate (ADR-0099). Admin-only, chat channel.
  const gate = await gateAction({
    workspaceId: auth.workspaceId,
    capability: "payroll",
    channel: "chat",
    actorProfileId: auth.profileId,
    actionType: "derive_shift_hours",
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

  // Verify period belongs to workspace — fail-fast (L-0177 / ADR-0151).
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

  // Determine next derivation_version (ADR-0252 idempotence: append-only).
  const { data: maxVer } = await admin
    .schema("payroll")
    .from("calculation")
    .select("calculation_version")
    .eq("workspace_id", workspaceId)
    .eq("period_id", body.period_id)
    .order("calculation_version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextVersion = (maxVer?.calculation_version ?? 0) + 1;

  // Fetch all required data for calc-engine in parallel.
  // Note: schedule_shift PK = schedule_shift_id; employee_id = FK → profile.profile_id.
  // Supplement rules fetched in snapshot-period-costs step (where tariff rates are also available).
  const [shiftsResult, settingsResult, holidaysResult] = await Promise.all([
    admin
      .from("schedule_shift")
      .select(
        "schedule_shift_id, employee_id, workspace_id, start_time, end_time, breaks, shift_date, custom_rate, custom_rate_type, shift_type_id",
      )
      .eq("workspace_id", workspaceId)
      .gte("start_time", period.start_date)
      .lte("start_time", period.end_date + "T23:59:59Z")
      .not("employee_id", "is", null),
    admin
      .schema("payroll")
      .from("workspace_settings")
      .select("*")
      .eq("workspace_id", workspaceId)
      .maybeSingle(),
    // public_holiday column is holiday_date (not "date").
    admin
      .from("public_holiday")
      .select("holiday_date, name")
      .gte("holiday_date", period.start_date)
      .lte("holiday_date", period.end_date),
  ]);

  if (shiftsResult.error) {
    return NextResponse.json(
      { ok: false, error: "shifts_fetch_error", detail: shiftsResult.error.message },
      { status: 500 },
    );
  }

  const shifts = shiftsResult.data ?? [];

  // Fetch time_entries for all shifts — time_entry is in timesheet schema; PK = time_entry_id.
  const shiftIds = shifts.map((s) => s.schedule_shift_id);
  const { data: timeEntries, error: timeErr } =
    shiftIds.length > 0
      ? await admin
          .schema("timesheet")
          .from("time_entry")
          .select("time_entry_id, shift_id, profile_id, workspace_id, punch_in, punch_out, breaks")
          .in("shift_id", shiftIds)
      : {
          data: [] as {
            time_entry_id: string;
            shift_id: string;
            profile_id: string;
            workspace_id: string;
            punch_in: string;
            punch_out: string | null;
            breaks: unknown;
          }[],
          error: null,
        };

  if (timeErr) {
    return NextResponse.json(
      { ok: false, error: "time_entry_fetch_error", detail: timeErr.message },
      { status: 500 },
    );
  }

  // Fetch payroll profiles. Wave 1A (SMA-345) added hourly_rate, monthly_salary, remuneration_type, currency.
  const profileIdSet = new Set(shifts.map((s) => s.employee_id).filter(Boolean));
  const profileIds = [...profileIdSet] as string[];
  const { data: payrollProfileRows, error: profilesErr } =
    profileIds.length > 0
      ? await admin
          .from("employee_payroll_profile")
          .select(
            "id, profile_id, workspace_id, salary_type, agreed_weekly_hours, holiday_allowance_pct, overtime_mode, toil_agreement_signed_at, toil_max_banked_hours, seniority_start_date, tariff_category, has_fagbrev, sector_experience_years, hourly_rate, monthly_salary, remuneration_type, currency",
          )
          .in("profile_id", profileIds)
          .eq("workspace_id", workspaceId)
      : {
          data: [] as {
            id: string;
            profile_id: string;
            workspace_id: string;
            salary_type: string;
            agreed_weekly_hours: number;
            holiday_allowance_pct: number;
            overtime_mode: "paid_out" | "banked";
            toil_agreement_signed_at: string | null;
            toil_max_banked_hours: number | null;
            seniority_start_date: string;
            tariff_category: string;
            has_fagbrev: boolean;
            sector_experience_years: number;
            hourly_rate: number | null;
            monthly_salary: number | null;
            remuneration_type: string | null;
            currency: string;
          }[],
          error: null,
        };

  if (profilesErr) {
    return NextResponse.json(
      { ok: false, error: "payroll_profiles_fetch_error", detail: profilesErr.message },
      { status: 500 },
    );
  }

  // Fetch night_worker_category via shift_type (not directly on schedule_shift).
  const shiftTypeIds = [...new Set(shifts.map((s) => s.shift_type_id).filter(Boolean))] as string[];
  // shift_type is in payroll schema.
  const { data: shiftTypeRows } =
    shiftTypeIds.length > 0
      ? await admin
          .schema("payroll")
          .from("shift_type")
          .select("id, night_worker_category")
          .in("id", shiftTypeIds)
      : { data: [] as { id: string; night_worker_category: string | null }[] };

  const nightWorkerByShiftTypeId = new Map<string, "night_watch" | "manual" | "ordinary" | null>();
  for (const st of shiftTypeRows ?? []) {
    nightWorkerByShiftTypeId.set(
      st.id,
      (st.night_worker_category as "night_watch" | "manual" | "ordinary" | null) ?? null,
    );
  }

  // Index data for O(1) lookups.
  const teByShiftId = new Map<string, TimeEntryInput>();
  for (const te of timeEntries ?? []) {
    if (!teByShiftId.has(te.shift_id)) {
      teByShiftId.set(te.shift_id, {
        time_entry_id: te.time_entry_id,
        shift_id: te.shift_id,
        profile_id: te.profile_id,
        workspace_id: te.workspace_id ?? workspaceId,
        punch_in: te.punch_in,
        punch_out: te.punch_out ?? null,
        breaks: te.breaks as TimeEntryInput["breaks"],
      });
    }
  }

  const payrollProfileByProfileId = new Map<string, PayrollProfile>();
  for (const pp of payrollProfileRows ?? []) {
    payrollProfileByProfileId.set(pp.profile_id, {
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

  // Run calc-engine per shift and collect calculation rows.
  const calculationRows: Record<string, unknown>[] = [];
  let processedCount = 0;
  let skippedCount = 0;

  for (const shift of shifts) {
    const profileId = shift.employee_id; // employee_id = FK → profile.profile_id
    if (!profileId) {
      skippedCount++;
      continue;
    }
    const profile = payrollProfileByProfileId.get(profileId);
    if (!profile) {
      skippedCount++;
      continue;
    }

    const nightWorkerCategory = shift.shift_type_id
      ? (nightWorkerByShiftTypeId.get(shift.shift_type_id) ?? null)
      : null;

    const shiftInput: ShiftInput = {
      shift_id: shift.schedule_shift_id,
      profile_id: profileId,
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

    const te: TimeEntryInput = teByShiftId.get(shift.schedule_shift_id) ?? {
      time_entry_id: shift.schedule_shift_id + "_fallback",
      shift_id: shift.schedule_shift_id,
      profile_id: profileId,
      workspace_id: workspaceId,
      punch_in: shift.start_time,
      punch_out: shift.end_time,
      breaks: null,
    };

    const interpreted = interpretShift(shiftInput, te, holidays, workspaceSettings);
    // evaluateSupplements runs in snapshot-period-costs (where tariff rates are available).

    calculationRows.push({
      workspace_id: workspaceId,
      period_id: body.period_id,
      profile_id: profileId,
      schedule_shift_id: shift.schedule_shift_id,
      shift_date: shiftInput.shift_date,
      scheduled_start: shift.start_time,
      scheduled_end: shift.end_time,
      actual_start: te.punch_in,
      actual_end: te.punch_out ?? shift.end_time,
      gross_minutes: interpreted.gross_minutes,
      net_working_minutes: interpreted.worked_minutes,
      break_minutes_paid: interpreted.paid_break_minutes,
      break_minutes_unpaid: interpreted.unpaid_break_minutes,
      base_rate: 0, // resolved in snapshot-period-costs step
      base_pay: 0, // computed by snapshot-period-costs step
      total_supplements: 0, // computed by snapshot-period-costs step
      total_deductions: 0,
      total_pay: 0,
      calculation_version: nextVersion,
      shift_type_id: shift.shift_type_id ?? null,
      provenance: {
        derivation_version: nextVersion,
        triggered_by_event: "manual_recalc",
        interpreted_at: new Date().toISOString(),
        fired_supplement_rule_ids: [], // populated by snapshot-period-costs step
        time_entry_id: te.time_entry_id,
      },
    });

    processedCount++;
  }

  // INSERT new calculation rows (append-only for audit per ADR-0252).
  // Direct admin write: orchestrators are system-level, not agent-initiated.
  // cascade_gate_write is for cascade-engine writes only (ADR dual-gate B1).
  if (calculationRows.length > 0) {
    // eslint-disable-next-line smartout/no-direct-supabase-write, @typescript-eslint/no-explicit-any
    const { error: insertErr } = await (admin.schema("payroll").from("calculation") as any).insert(
      calculationRows,
    );

    if (insertErr) {
      return NextResponse.json(
        {
          ok: false,
          error: "calculation_insert_error",
          detail: (insertErr as { message: string }).message,
        },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({
    ok: true,
    period_id: body.period_id,
    processed_shifts: processedCount,
    skipped_shifts: skippedCount,
    derivation_version: nextVersion,
  });
}
