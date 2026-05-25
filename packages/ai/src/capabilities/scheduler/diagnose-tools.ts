/**
 * packages/ai/src/capabilities/scheduler/diagnose-tools.ts
 *
 * Read-only diagnostic tool: diagnose_turnus_disabled
 *
 * Why this file exists:
 *   When a manager asks "hvorfor kan jeg ikke planlegge uke 26?" Botsson
 *   has no way to answer — the schedule page shows a silent dead-end.
 *   This tool reads the cascade prerequisite state (D1→D5) for a target
 *   week and returns a structured Norwegian-language summary of what is
 *   missing and how to fix it.
 *
 * Design decisions:
 *   - READ-ONLY: no gate_action, no mutateWithGate, no DB writes.
 *   - Voice ALLOWED: diagnostics are pure reads; ADR-0288 only forbids
 *     irreversible C4 acts on voice. Voice gets a trimmed summary.
 *   - L-0177 fail-fast: workspace_id comes from ctx, never from request body.
 *   - ISO week → Mon→Sun date-range uses UTC arithmetic (no date-fns-tz
 *     dependency needed; week boundaries are calendar-day concepts).
 *
 * ADR REFERENCES:
 *   ADR-0099  — workspace scope on every query (Law 1)
 *   ADR-0134  — every mutation emits; read-only also emits for analytics
 *   ADR-0151  — workspace_id + profile_id server-derived (Law 5)
 *   ADR-0288  — voice allowed for reads (irreversible acts only restricted)
 */

import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { emit } from "@smartout/telemetry";
import { defineTool } from "../../types.js";
import type { AgentToolContext } from "../types.js";

// ─── ISO Week → date range ────────────────────────────────────────────────────

/**
 * Parse "YYYY-Www" ISO week string into { startDate, endDate } (Mon→Sun).
 *
 * Uses UTC-pinned arithmetic:
 *   - Jan 4 is always in ISO week 1 (ISO 8601 rule).
 *   - We find the Monday of that week, then offset by (weekNum - 1) * 7 days.
 *
 * Returns DATE strings "YYYY-MM-DD" (no timezone — planning_cycle uses DATE columns).
 */
function isoWeekToDateRange(isoWeek: string): { startDate: string; endDate: string } {
  const match = /^(\d{4})-W(\d{2})$/.exec(isoWeek);
  if (!match) {
    throw new Error(`Invalid ISO week format: ${isoWeek}. Expected YYYY-Www.`);
  }

  const year = Number(match[1]);
  const weekNum = Number(match[2]);

  // Find Jan 4 of the year — always in ISO week 1.
  const jan4 = new Date(Date.UTC(year, 0, 4));
  // Day-of-week for Jan 4 (UTC): 0=Sun → shift to Mon=0 convention.
  const jan4DayOfWeek = (jan4.getUTCDay() + 6) % 7; // Mon=0, Sun=6

  // Monday of ISO week 1.
  const week1Monday = new Date(jan4.getTime() - jan4DayOfWeek * 86_400_000);

  // Monday of the target week.
  const targetMonday = new Date(week1Monday.getTime() + (weekNum - 1) * 7 * 86_400_000);
  const targetSunday = new Date(targetMonday.getTime() + 6 * 86_400_000);

  const toDate = (d: Date) => d.toISOString().slice(0, 10);

  return { startDate: toDate(targetMonday), endDate: toDate(targetSunday) };
}

// ─── Missing dimension descriptor ────────────────────────────────────────────

type DimensionId = "D1" | "D2" | "D3" | "D4" | "D5" | "D6";

interface MissingDimension {
  dimension: DimensionId;
  reason: string;
  fix_hint: string;
}

interface DiagnoseResult {
  ready: boolean;
  target_week_iso: string;
  start_date: string;
  end_date: string;
  missing: MissingDimension[];
  shifts_in_week: number; // informational — week may already have shifts
}

// ─── Core diagnose logic ──────────────────────────────────────────────────────

async function runDiagnose(
  supabase: SupabaseClient,
  workspaceId: string,
  startDate: string,
  endDate: string,
  departmentId: string | undefined,
): Promise<{ missing: MissingDimension[]; shiftsInWeek: number }> {
  const missing: MissingDimension[] = [];

  // ── D1 check: planning_cycle overlapping the target window ───────────────
  // planning_cycle is workspace-scoped (no department_id column).
  // status IN ('draft', 'active') — archived cycles are past, not usable for planning.
  const { data: cycle, error: cycleErr } = await supabase
    .from("planning_cycle")
    .select("planning_cycle_id")
    .eq("workspace_id", workspaceId)
    .in("status", ["draft", "active"])
    .lte("start_date", endDate)
    .gte("end_date", startDate)
    .limit(1)
    .maybeSingle();

  if (cycleErr) {
    // L-0177: fail-fast on real DB error, not "no rows found"
    throw new Error(`D1 planning_cycle query error: ${cycleErr.message}`);
  }

  if (!cycle) {
    missing.push({
      dimension: "D1",
      reason: "Ingen aktiv planning_cycle for perioden",
      fix_hint: "Opprett planperiode under /dashboard/year-wheel",
    });
  }

  // ── D1 check: department_operating_hours ─────────────────────────────────
  // Even if no planning_cycle, check DOH so manager gets the full picture.
  // Filter by department_id if provided; otherwise check any row in workspace.
  let dohQuery = supabase
    .from("department_operating_hours")
    .select("id")
    .eq("workspace_id", workspaceId)
    .limit(1);

  if (departmentId) {
    dohQuery = dohQuery.eq("department_id", departmentId);
  }

  const { data: dohRows, error: dohErr } = await dohQuery;

  if (dohErr) {
    throw new Error(`D1 department_operating_hours query error: ${dohErr.message}`);
  }

  const hasDoh = Array.isArray(dohRows) && dohRows.length > 0;
  if (!hasDoh) {
    missing.push({
      dimension: "D1",
      reason: departmentId
        ? "Ingen åpningstider satt for avdelingen"
        : "Ingen åpningstider satt (department_operating_hours mangler)",
      fix_hint: "Sett åpningstider under /dashboard/departments → Åpningstider",
    });
  }

  // ── D2 check: active employment contracts in workspace ───────────────────
  const { data: contractRows, error: contractErr } = await supabase
    .from("employment_contract")
    .select("contract_id")
    .eq("workspace_id", workspaceId)
    .eq("status", "active")
    .limit(1);

  if (contractErr) {
    throw new Error(`D2 employment_contract query error: ${contractErr.message}`);
  }

  const hasContracts = Array.isArray(contractRows) && contractRows.length > 0;
  if (!hasContracts) {
    missing.push({
      dimension: "D2",
      reason: "Ingen aktive ansettelseskontrakter i arbeidsplassen",
      fix_hint: "Opprett ansatte og aktiver kontrakter under /dashboard/employees → Kontrakter",
    });
  }

  // ── D3 check: active regulatory_framework exists (K1a platform-level) ─────
  // framework_rule belongs to regulatory_framework (no workspace_id column).
  // K1a frameworks are platform-level — check that at least one is active.
  const { data: frameworks, error: fwErr } = await supabase
    .from("regulatory_framework")
    .select("framework_id")
    .eq("is_active", true)
    .limit(1);

  if (fwErr) {
    throw new Error(`D3 regulatory_framework query error: ${fwErr.message}`);
  }

  const hasRules = Array.isArray(frameworks) && frameworks.length > 0;

  if (!hasRules) {
    missing.push({
      dimension: "D3",
      reason: "Ingen aktive regelverksrammer (regulatory_framework) funnet",
      fix_hint: "Kontakt Smartout-support — plattformens regelverkrammer mangler.",
    });
  }

  // ── D4 check: active season overlapping the target window ────────────────
  const { data: activeSeason, error: seasonErr } = await supabase
    .from("season")
    .select("season_id, name")
    .eq("workspace_id", workspaceId)
    .eq("status", "active")
    .lte("start_date", endDate)
    .or(`end_date.is.null,end_date.gte.${startDate}`)
    .order("start_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (seasonErr) {
    throw new Error(`D4 season query error: ${seasonErr.message}`);
  }

  if (!activeSeason) {
    missing.push({
      dimension: "D4",
      reason: "Ingen aktiv sesong for perioden",
      fix_hint: "Aktiver en sesong som dekker perioden under /dashboard/year-wheel → Sesonger",
    });
  } else {
    // Season exists — check for season_budget.
    const { data: budget, error: budgetErr } = await supabase
      .from("season_budget")
      .select("season_budget_id")
      .eq("workspace_id", workspaceId)
      .eq("season_id", activeSeason.season_id)
      .maybeSingle();

    if (budgetErr) {
      throw new Error(`D4 season_budget query error: ${budgetErr.message}`);
    }

    if (!budget) {
      missing.push({
        dimension: "D4",
        reason: `Sesong '${activeSeason.name ?? activeSeason.season_id}' mangler budsjett (season_budget)`,
        fix_hint: "Opprett budsjett for sesongen under /dashboard/year-wheel → Budsjett",
      });
    } else {
      // Budget exists — check for demand signals (day_factor + hour_factor).
      const { data: dayFactors, error: dfErr } = await supabase
        .from("day_factor")
        .select("day_factor_id")
        .eq("season_budget_id", budget.season_budget_id)
        .limit(1);

      if (dfErr) {
        throw new Error(`D4 day_factor query error: ${dfErr.message}`);
      }

      const { data: hourFactors, error: hfErr } = await supabase
        .from("hour_factor")
        .select("hour_factor_id")
        .eq("season_budget_id", budget.season_budget_id)
        .limit(1);

      if (hfErr) {
        throw new Error(`D4 hour_factor query error: ${hfErr.message}`);
      }

      const hasDayFactor = Array.isArray(dayFactors) && dayFactors.length > 0;
      const hasHourFactor = Array.isArray(hourFactors) && hourFactors.length > 0;

      if (!hasDayFactor || !hasHourFactor) {
        const which =
          !hasDayFactor && !hasHourFactor
            ? "day_factor og hour_factor"
            : !hasDayFactor
              ? "day_factor"
              : "hour_factor";
        missing.push({
          dimension: "D4",
          reason: `Mangler etterspørselssignaler: ${which}`,
          fix_hint: "Sett dag- og timefaktorer under /dashboard/year-wheel → Etterspørsel",
        });
      }
    }
  }

  // ── D5 check: workspace exists + is active ───────────────────────────────
  // V1 lightweight — checks workspace row exists and is_active=true.
  // Full D5 niche/parameter validation deferred to V2 (workspace.niche column
  // does not exist in current schema — spec aspirational).
  const { data: workspaceRow, error: wsErr } = await supabase
    .from("workspace")
    .select("workspace_id, is_active")
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (wsErr) {
    throw new Error(`D5 workspace query error: ${wsErr.message}`);
  }

  if (!workspaceRow?.is_active) {
    missing.push({
      dimension: "D5",
      reason: "Arbeidsplassen er ikke aktiv (workspace.is_active = false)",
      fix_hint: "Aktiver arbeidsplassen under /dashboard/settings → Arbeidsplass",
    });
  }

  // ── D6 informational: shifts already in week? ────────────────────────────
  // Not a "missing" — just informs the manager that the week has data.
  let shiftsInWeek = 0;
  const { data: existingShifts, error: shiftsErr } = await supabase
    .from("schedule_shift")
    .select("schedule_shift_id")
    .eq("workspace_id", workspaceId)
    .gte("shift_date", startDate)
    .lte("shift_date", endDate);

  if (!shiftsErr && Array.isArray(existingShifts)) {
    shiftsInWeek = existingShifts.length;
  }

  return { missing, shiftsInWeek };
}

// ─── Output formatters ────────────────────────────────────────────────────────

function formatChatOutput(result: DiagnoseResult): string {
  const [yearStr, weekStr] = result.target_week_iso.split("-W");
  const weekLabel = `uke ${weekStr} (${result.start_date} → ${result.end_date})`;

  const lines: string[] = [`Diagnose for ${weekLabel}:`, ""];

  if (result.missing.length === 0) {
    lines.push("Alt klart for planlegging.");
    lines.push("");
    lines.push(`Klar til planlegging: JA`);
    lines.push(
      "Foreslått neste steg: bruk `foreslå plan` eller `bruk mal fra uke X` for å starte.",
    );
  } else {
    for (const m of result.missing) {
      lines.push(`✗ ${m.dimension}: ${m.reason} — ${m.fix_hint}`);
    }

    if (result.shifts_in_week > 0) {
      lines.push(
        `(Uke ${weekStr} har allerede ${result.shifts_in_week} vakter — diagnose kjøres likevel)`,
      );
    }

    lines.push("");
    lines.push(`Klar til planlegging: NEI (${result.missing.length} mangler)`);

    const firstFix = result.missing[0];
    if (firstFix) {
      lines.push(`Foreslått neste steg: ${firstFix.fix_hint.toLowerCase()}.`);
    }
  }

  // Suppress unused variable warning
  void yearStr;

  return lines.join("\n");
}

function formatVoiceOutput(result: DiagnoseResult): string {
  const weekNum = result.target_week_iso.split("-W")[1] ?? result.target_week_iso;

  if (result.missing.length === 0) {
    return `Alt klart for uke ${weekNum}. Du kan starte planlegging nå.`;
  }

  const count = result.missing.length;
  const dims = result.missing.map((m) => m.dimension).join(", ");
  return `${count} mangler for uke ${weekNum}: ${dims}. Skal jeg lese opp detaljer?`;
}

// ─── Tool definition ──────────────────────────────────────────────────────────

export const diagnoseTurnusDisabled = defineTool({
  name: "diagnose_turnus_disabled",
  description:
    "Diagnostiserer hvorfor turnus-planlegging ikke er tilgjengelig for en gitt uke. " +
    "Sjekker alle cascade-forutsetninger (D1–D5): planning_cycle, department_operating_hours, " +
    "employment_contract, framework_rule, season, season_budget, day_factor, hour_factor, " +
    "og workspace.niche. Returnerer strukturert liste over mangler med konkrete fix-hint. " +
    "Kun lesing — ingen skriving til databasen. Tilgjengelig på chat og voice.",
  schema: z.object({
    target_week_iso: z
      .string()
      .regex(/^\d{4}-W\d{2}$/, "ISO-uke-format, f.eks. 2026-W26")
      .describe("Måluke i ISO-format, f.eks. '2026-W26'"),
    department_id: z
      .string()
      .uuid()
      .optional()
      .describe("Valgfri avdelings-ID. Hvis utelatt, diagnostiseres hele arbeidsplassen."),
  }),
  execute: async (params, ctx: AgentToolContext) => {
    const supabase = ctx.supabaseAdmin as SupabaseClient;

    // L-0177: workspace_id must come from context, never from params.
    const { workspaceId, profileId, channel } = ctx;

    // Parse ISO week to date range.
    let startDate: string;
    let endDate: string;
    try {
      const range = isoWeekToDateRange(params.target_week_iso);
      startDate = range.startDate;
      endDate = range.endDate;
    } catch (err) {
      return `Ugyldig uke-format: ${params.target_week_iso}. Bruk format YYYY-Www, f.eks. 2026-W26.`;
    }

    let missing: MissingDimension[] = [];
    let shiftsInWeek = 0;

    try {
      const result = await runDiagnose(
        supabase,
        workspaceId,
        startDate,
        endDate,
        params.department_id,
      );
      missing = result.missing;
      shiftsInWeek = result.shiftsInWeek;
    } catch (err) {
      // L-0177: real DB errors are thrown, not silently absorbed.
      return `Feil ved diagnose: ${err instanceof Error ? err.message : String(err)}`;
    }

    const diagnoseResult: DiagnoseResult = {
      ready: missing.length === 0,
      target_week_iso: params.target_week_iso,
      start_date: startDate,
      end_date: endDate,
      missing,
      shifts_in_week: shiftsInWeek,
    };

    // ADR-0134: emit telemetry regardless of ready state.
    // Read-only but valuable for product analytics (how often are workspaces blocked?).
    // Route: posthog + logger + activity_trail (NOT engine_event — no workflow trigger).
    //
    // Note: SchedulerDiagnoseRequested.properties.channel is typed "chat" | "voice".
    // SessionChannel includes "sms" which is not valid here; we narrow explicitly.
    const emitChannel: "chat" | "voice" = channel === "voice" ? "voice" : "chat";
    await emit({
      event: "scheduler.diagnose.requested",
      workspace_id: workspaceId,
      actor_id: profileId,
      properties: {
        target_week_iso: params.target_week_iso,
        department_id: params.department_id ?? null,
        ready: diagnoseResult.ready,
        missing_count: missing.length,
        missing_dimensions: missing.map((m) => m.dimension) as Array<
          "D1" | "D2" | "D3" | "D4" | "D5" | "D6"
        >,
        channel: emitChannel,
      },
    });

    // ADR-0288: voice gets a trimmed summary; chat gets the full structured output.
    if (channel === "voice") {
      return formatVoiceOutput(diagnoseResult);
    }

    return formatChatOutput(diagnoseResult);
  },
});
