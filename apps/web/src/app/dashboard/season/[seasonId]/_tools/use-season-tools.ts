"use client";

/**
 * use-season-tools.ts — Botsson tools for /dashboard/season/[seasonId].
 *
 * Six tools — four read, two write proposals:
 *
 *   getSeasonStatus          — current season metadata (name, status, dates, planning_cycle)
 *   getActivationReadiness   — D4 completeness gate: budget + day factors + hour factors + hours
 *   getBudgetSummary         — season_budget KPIs (revenue target, labor %, wage, price)
 *   getFactorSummary         — day_factor + hour_factor distribution snapshot
 *   proposeActivateSeason    — invokes activateSeasonAction; user sees toast result
 *   proposeArchiveSeason     — invokes archiveSeasonAction; user sees toast result
 *
 * Write tools call the authoritative Server Actions directly.
 * workspace_id is resolved server-side by each action (ADR-0151).
 * The tool body NEVER passes workspace_id.
 *
 * Pattern follows use-year-wheel-tools.ts:
 *   - `useSeasonTools(input): ClientToolKit` exported
 *   - `dataRef = useRef(input)` refreshed every render via useEffect
 *   - definitions + implementations memoised independently
 *   - implementations return `JSON.stringify({ ok, ... })`
 *
 * Cascade vocabulary:
 *   - Season is the canonical D4 (demand signal) + D5 (service concept) authoring unit.
 *   - Budget = D4 revenue envelope. Day factors + hour factors = D4 demand distribution.
 *   - Activation triggers D1 fanout (department_operating_hours seeding).
 */

import { useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";
import type {
  ClientToolDefinition,
  ClientToolImplementation,
  ClientToolKit,
} from "@smartout/agent-sdk";
import type {
  Season,
  SeasonBudget,
  DayFactor,
  HourFactor,
} from "@/app/dashboard/year-wheel/_hooks";
import { activateSeasonAction } from "@/app/dashboard/_actions/activate-season-action";
import { archiveSeasonAction } from "@/app/dashboard/_actions/archive-season-action";

const PARAMETER_LOCATION_BODY = "PARAMETER_LOCATION_BODY" as const;

// ── Types ──────────────────────────────────────────────────────────────────

export type SeasonToolInput = {
  /** The season currently displayed on this detail page. */
  season: Season;
  /** Resolved budget for this season (null if not yet created). */
  budget: SeasonBudget | null;
  /** Day factor rows for this season's budget. */
  dayFactors: DayFactor[];
  /** Hour factor rows for this season's budget. */
  hourFactors: HourFactor[];
  /** Whether this season's D1 operating-hours have been seeded post-activation. */
  seeded: boolean;
  /** Whether season-specific operating hours exist (separate from default_weekly). */
  hasSeasonHours: boolean;
  /** UI action — navigate to a different tab on this page. */
  uiActions: {
    switchTab: (
      tab: "budget" | "day" | "hour" | "hours" | "goals" | "procedures" | "overview",
    ) => void;
  };
};

// ── Hook ───────────────────────────────────────────────────────────────────

export function useSeasonTools(input: SeasonToolInput): ClientToolKit {
  const dataRef = useRef(input);
  useEffect(() => {
    dataRef.current = input;
  });

  const definitions = useMemo<ClientToolDefinition[]>(
    () => [
      {
        temporaryTool: {
          modelToolName: "getSeasonStatus",
          description:
            "Get the current season's metadata — name, status (draft/active/archived), start/end dates, season type, and planning cycle linkage. Call first when the user asks about this specific season or before proposing any action on it.",
          dynamicParameters: [],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "getActivationReadiness",
          description:
            "Check whether this draft season is ready to activate — returns the D4 completeness checklist: budget set, day factors configured, hour factors configured, and whether season-specific operating hours exist (soft check). Use when user asks 'kan jeg aktivere denne sesongen?' or 'hva mangler?'.",
          dynamicParameters: [],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "getBudgetSummary",
          description:
            "Return this season's D4 revenue budget — total target revenue (NOK), labor percentage, average hourly wage, base price per guest, and budget status (draft/active/locked). Use when user asks about revenue targets, cost ratios, or staffing economics for this season.",
          dynamicParameters: [],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "getFactorSummary",
          description:
            "Summarise the D4 day-factor and hour-factor distribution for this season — highest/lowest weekday weights, peak operating hour. Use when user asks 'hvilken dag er høyest?', 'når er det travlest?', or needs to understand the demand distribution before activating.",
          dynamicParameters: [],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "proposeActivateSeason",
          description:
            "Activate this season — calls the server action, archives the currently active season atomically, and seeds D1 operating-hours fanout. Use when user explicitly says 'aktiver denne sesongen' or confirms after getActivationReadiness shows all checks pass. Requires budget + day factors + hour factors.",
          dynamicParameters: [],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "proposeArchiveSeason",
          description:
            "Archive this season (draft or active → archived). Use when user says 'arkiver denne sesongen' or wants to move it to archived state. Idempotent — safe to call if already archived.",
          dynamicParameters: [],
          client: {},
        },
      },
    ],
    [],
  );

  const implementations = useMemo<Record<string, ClientToolImplementation>>(
    () => ({
      getSeasonStatus: () => {
        const d = dataRef.current;
        const s = d.season;
        return JSON.stringify({
          season_id: s.season_id,
          name: s.name,
          status: s.status,
          season_type: s.season_type,
          start_date: s.start_date ?? null,
          end_date: s.end_date ?? null,
          planning_cycle_id: s.planning_cycle_id ?? null,
          color: s.color ?? null,
          description: s.description ?? null,
          seeded: d.seeded,
        });
      },

      getActivationReadiness: () => {
        const d = dataRef.current;
        const budgetOk =
          !!d.budget && d.budget.total_target_revenue !== null && d.budget.total_target_revenue > 0;
        const dayFactorsOk = d.dayFactors.length > 0;
        const hourFactorsOk = d.hourFactors.length > 0;
        const hasBlockers = !budgetOk || !dayFactorsOk || !hourFactorsOk;
        return JSON.stringify({
          season_id: d.season.season_id,
          status: d.season.status,
          ready_to_activate: d.season.status === "draft" && !hasBlockers,
          checks: {
            budget_configured: budgetOk,
            day_factors_configured: dayFactorsOk,
            hour_factors_configured: hourFactorsOk,
            season_hours_configured: d.hasSeasonHours,
          },
          blockers: [
            ...(!budgetOk ? ["Budsjett mangler — sett omsetning i Budsjettering-fanen."] : []),
            ...(!dayFactorsOk ? ["Dagfaktorer mangler — konfigurer i Dagfaktorer-fanen."] : []),
            ...(!hourFactorsOk ? ["Timefaktorer mangler — konfigurer i Timefaktorer-fanen."] : []),
          ],
          advisories: [
            ...(!d.hasSeasonHours
              ? [
                  "Sesong-åpningstider ikke satt — aktivering bruker standard åpningstider fra avdeling.",
                ]
              : []),
          ],
        });
      },

      getBudgetSummary: () => {
        const d = dataRef.current;
        if (!d.budget) {
          return JSON.stringify({
            ok: false,
            message: "Ingen budsjettdata for denne sesongen ennå. Gå til Budsjettering-fanen.",
          });
        }
        const b = d.budget;
        return JSON.stringify({
          season_id: d.season.season_id,
          total_target_revenue_nok: b.total_target_revenue,
          target_labor_percentage: b.target_labor_percentage,
          avg_hourly_wage_nok: b.avg_hourly_wage ?? null,
          base_price_per_guest_nok: b.base_price_per_guest ?? null,
          season_price_factor: b.season_price_factor ?? 1,
          budget_status: b.status,
        });
      },

      getFactorSummary: () => {
        const d = dataRef.current;
        const WEEKDAY_NAMES = ["man", "tir", "ons", "tor", "fre", "lør", "søn"];

        let dayPeak: { weekday: number; factor: number } | null = null;
        let dayTrough: { weekday: number; factor: number } | null = null;
        for (const df of d.dayFactors) {
          if (!dayPeak || df.factor > dayPeak.factor) dayPeak = df;
          if (!dayTrough || df.factor < dayTrough.factor) dayTrough = df;
        }

        let hourPeak: { hour: number; factor: number } | null = null;
        for (const hf of d.hourFactors) {
          if (!hourPeak || hf.factor > hourPeak.factor) hourPeak = hf;
        }

        return JSON.stringify({
          season_id: d.season.season_id,
          day_factors: {
            count: d.dayFactors.length,
            peak: dayPeak
              ? {
                  weekday: WEEKDAY_NAMES[dayPeak.weekday] ?? dayPeak.weekday,
                  factor: dayPeak.factor,
                }
              : null,
            trough: dayTrough
              ? {
                  weekday: WEEKDAY_NAMES[dayTrough.weekday] ?? dayTrough.weekday,
                  factor: dayTrough.factor,
                }
              : null,
            all: d.dayFactors.map((df) => ({
              weekday: WEEKDAY_NAMES[df.weekday] ?? df.weekday,
              factor: df.factor,
            })),
          },
          hour_factors: {
            count: d.hourFactors.length,
            peak_hour: hourPeak ? { hour: hourPeak.hour, factor: hourPeak.factor } : null,
          },
        });
      },

      proposeActivateSeason: async () => {
        const d = dataRef.current;
        const id = d.season.season_id;
        try {
          const result = await activateSeasonAction(id);
          if (!result.ok) {
            const msg: Record<string, string> = {
              unauthenticated: "Ikke innlogget.",
              insufficient_authority: "Mangler rettighet til å aktivere sesong.",
              missing_budget: "Budsjett mangler eller har ingen omsetning satt.",
              missing_day_factors: "Dagfaktorer (D4) er ikke konfigurert.",
              missing_hour_factors: "Timefaktorer (D4) er ikke konfigurert.",
              season_not_found: "Sesongen finnes ikke.",
              rpc_error: "Feil ved aktivering — prøv igjen.",
            };
            const label = msg[result.error] ?? "Ukjent feil.";
            toast.error(`Aktivering feilet: ${label}`);
            return JSON.stringify({ ok: false, error: result.error, message: label });
          }
          toast.success(
            result.skipped
              ? `${d.season.name} er allerede aktiv.`
              : `${d.season.name} er nå aktiv — ${result.departments_affected} avdelinger oppdatert.`,
          );
          return JSON.stringify({
            ok: true,
            season_id: id,
            skipped: result.skipped ?? false,
            departments_affected: result.departments_affected,
            rows_generated: result.rows_generated,
          });
        } catch {
          toast.error("Aktivering feilet — prøv igjen.");
          return JSON.stringify({ ok: false, error: "unexpected_error" });
        }
      },

      proposeArchiveSeason: async () => {
        const d = dataRef.current;
        const id = d.season.season_id;
        try {
          const result = await archiveSeasonAction(id);
          if (!result.ok) {
            const msg: Record<string, string> = {
              unauthenticated: "Ikke innlogget.",
              insufficient_authority: "Mangler rettighet til å arkivere sesong.",
              season_not_found: "Sesongen finnes ikke.",
              db_error: "Databasefeil — prøv igjen.",
            };
            const label = msg[result.error] ?? "Ukjent feil.";
            toast.error(`Arkivering feilet: ${label}`);
            return JSON.stringify({ ok: false, error: result.error, message: label });
          }
          if (result.was_already_archived) {
            toast.info(`${d.season.name} var allerede arkivert.`);
          } else {
            toast.success(`${d.season.name} er arkivert.`);
          }
          return JSON.stringify({
            ok: true,
            season_id: id,
            was_already_archived: result.was_already_archived,
          });
        } catch {
          toast.error("Arkivering feilet — prøv igjen.");
          return JSON.stringify({ ok: false, error: "unexpected_error" });
        }
      },
    }),
    [],
  );

  return useMemo(() => ({ definitions, implementations }), [definitions, implementations]);
}
