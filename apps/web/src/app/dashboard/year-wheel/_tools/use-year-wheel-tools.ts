"use client";

// DEAD-PIPE-2026-05-14: client tool not delivered to LLM yet; see HANDOFF-2026-05-14 + ADR-0327 (HarnessAdapter pending)

/**
 * use-year-wheel-tools.ts — Botsson tools for /dashboard/year-wheel.
 *
 * Seven tools — five read, two write proposals:
 *
 *   getYearWheelState        — current year, visible season count, active season, filter
 *   listSeasons              — all seasons (optionally filtered by status)
 *   getSeasonDetail          — single season: dates, status, seeded state, budget readiness
 *   listPlanningEvents       — D4 planning events visible in the current year
 *   getSeasonProgress        — activation readiness for a specific season (D4 gaps check)
 *   proposeActivateSeason    — invoke activateSeasonAction server-side; user sees toast result
 *   proposeArchiveSeason     — invoke archiveSeasonAction server-side; user sees toast result
 *
 * Write tools call the authoritative Server Actions directly.
 * workspace_id is resolved server-side by each action (ADR-0151).
 * The tool body NEVER passes workspace_id.
 *
 * Pattern follows use-calendar-tools.ts / use-governance-tools.ts:
 *   - `useYearWheelTools(input): ClientToolKit` exported
 *   - `dataRef = useRef(input)` refreshed every render via useEffect
 *   - definitions + implementations memoised independently
 *   - implementations return `JSON.stringify({ ok, ... })`
 *
 * Cascade vocabulary:
 *   - Seasons are the canonical D4 (demand signal) and D5 (service concept) authoring surface.
 *   - Planning events live in D4 (demand signal) alongside day_factor / hour_factor / season_budget.
 */

import { useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";
import type {
  ClientToolDefinition,
  ClientToolImplementation,
  ClientToolKit,
} from "@smartout/agent-sdk";
import type { Season } from "@/app/dashboard/year-wheel/_hooks";
import type { PlanningEventRow } from "@smartout/year-wheel/hooks";
import { activateSeasonAction } from "@/app/dashboard/_actions/activate-season-action";
import { archiveSeasonAction } from "@/app/dashboard/_actions/archive-season-action";

const PARAMETER_LOCATION_BODY = "PARAMETER_LOCATION_BODY" as const;

// ── Types ──────────────────────────────────────────────────────────────────

export type YearWheelToolInput = {
  /** Currently displayed calendar year. */
  year: number;
  /** All seasons for this workspace. */
  seasons: Season[];
  /** All planning events for this workspace (year-filtered by canvas). */
  events: PlanningEventRow[];
  /** Set of season_ids whose D1 fanout (department_operating_hours) is seeded. */
  seededSet: ReadonlySet<string>;
  /** Current sidebar filter. */
  filter: "all" | "active" | "draft" | "archived";
  /** UI action — navigate year. */
  uiActions: {
    setYear: (y: number) => void;
    setFilter: (f: "all" | "active" | "draft" | "archived") => void;
    openSeason: (id: string) => void;
  };
};

// ── Helpers ────────────────────────────────────────────────────────────────

function summarizeSeason(s: Season, seededSet: ReadonlySet<string>) {
  return {
    id: s.season_id,
    name: s.name,
    status: s.status,
    start_date: s.start_date ?? null,
    end_date: s.end_date ?? null,
    seeded: seededSet.has(s.season_id),
  };
}

function summarizeEvent(e: PlanningEventRow) {
  return {
    id: e.planning_event_id,
    name: e.name,
    date: e.event_date,
    category: e.category,
    demand_multiplier: e.demand_multiplier,
    source: e.source,
  };
}

function isValidSeasonStatus(v: unknown): v is "all" | "active" | "draft" | "archived" {
  return v === "all" || v === "active" || v === "draft" || v === "archived";
}

// ── Hook ───────────────────────────────────────────────────────────────────

export function useYearWheelTools(input: YearWheelToolInput): ClientToolKit {
  const dataRef = useRef(input);
  useEffect(() => {
    dataRef.current = input;
  });

  const definitions = useMemo<ClientToolDefinition[]>(
    () => [
      {
        temporaryTool: {
          modelToolName: "getYearWheelState",
          description:
            "Get the year wheel's current state — displayed year, active season name, sidebar filter, total season and planning event counts. Call first when answering open-ended questions about the season calendar (D4 demand signal surface).",
          dynamicParameters: [],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "listSeasons",
          description:
            "List seasons for the current workspace, optionally filtered by status (active/draft/archived). Use when user asks 'hvilke sesonger finnes?', 'vis utkast', or 'hva er den aktive sesongen?'. Seasons are the D4/D5 authoring unit — they carry revenue budget, day factors, and hour factors.",
          dynamicParameters: [
            {
              name: "status",
              location: PARAMETER_LOCATION_BODY,
              schema: {
                type: "string",
                description: "'all' | 'active' | 'draft' | 'archived'. Default: 'all'.",
              },
            },
          ],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "getSeasonDetail",
          description:
            "Get full detail for a specific season — dates, status, whether D1 operating-hours have been seeded, and a short activation-readiness note. Use when user asks about a specific season by name or when proposing to activate/archive one.",
          dynamicParameters: [
            {
              name: "season_id",
              location: PARAMETER_LOCATION_BODY,
              schema: {
                type: "string",
                description: "UUID of the season. Resolve from listSeasons if not known.",
              },
              required: true,
            },
          ],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "listPlanningEvents",
          description:
            "List D4 planning events visible in the current year — holidays, campaigns, demand peaks. Use when user asks 'hva skjer i høst?', 'vis hendelser i desember', or needs context for season demand planning.",
          dynamicParameters: [
            {
              name: "category",
              location: PARAMETER_LOCATION_BODY,
              schema: {
                type: "string",
                description:
                  "Optional filter: 'internal' | 'cultural_commercial' | 'business_critical'. Omit for all.",
              },
            },
          ],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "getSeasonProgress",
          description:
            "Check activation readiness for a draft season — returns whether budget, day factors, and hour factors are configured (D4 completeness). Use when user asks 'kan jeg aktivere [sesong]?' or 'hva mangler for å aktivere?'.",
          dynamicParameters: [
            {
              name: "season_id",
              location: PARAMETER_LOCATION_BODY,
              schema: { type: "string", description: "UUID of the season." },
              required: true,
            },
          ],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "proposeActivateSeason",
          description:
            "Activate a draft season — calls the server action, archives the currently active season atomically, and seeds D1 operating hours fanout. Use when user explicitly says 'aktiver [sesong]' or confirms activation after getSeasonProgress. Requires the season to have budget + day factors + hour factors set.",
          dynamicParameters: [
            {
              name: "season_id",
              location: PARAMETER_LOCATION_BODY,
              schema: { type: "string", description: "UUID of the season to activate." },
              required: true,
            },
          ],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "proposeArchiveSeason",
          description:
            "Archive a season (draft or active → archived). Use when user says 'arkiver [sesong]' or wants to move a draft to archived state. Idempotent — safe to call on already-archived seasons.",
          dynamicParameters: [
            {
              name: "season_id",
              location: PARAMETER_LOCATION_BODY,
              schema: { type: "string", description: "UUID of the season to archive." },
              required: true,
            },
          ],
          client: {},
        },
      },
    ],
    [],
  );

  const implementations = useMemo<Record<string, ClientToolImplementation>>(
    () => ({
      getYearWheelState: () => {
        const d = dataRef.current;
        const activeSeason = d.seasons.find((s) => s.status === "active") ?? null;
        const eventsThisYear = d.events.filter((e) => e.event_date.startsWith(String(d.year)));
        return JSON.stringify({
          year: d.year,
          filter: d.filter,
          season_counts: {
            total: d.seasons.length,
            active: d.seasons.filter((s) => s.status === "active").length,
            draft: d.seasons.filter((s) => s.status === "draft").length,
            archived: d.seasons.filter((s) => s.status === "archived").length,
          },
          active_season: activeSeason ? summarizeSeason(activeSeason, d.seededSet) : null,
          planning_events_this_year: eventsThisYear.length,
        });
      },

      listSeasons: (params) => {
        const d = dataRef.current;
        const statusFilter = isValidSeasonStatus(params.status) ? params.status : "all";
        const filtered =
          statusFilter === "all" ? d.seasons : d.seasons.filter((s) => s.status === statusFilter);
        return JSON.stringify({
          filter: statusFilter,
          count: filtered.length,
          seasons: filtered.map((s) => summarizeSeason(s, d.seededSet)),
        });
      },

      getSeasonDetail: (params) => {
        const d = dataRef.current;
        const id = params.season_id;
        if (typeof id !== "string" || !id) {
          return JSON.stringify({ error: "season_id er påkrevd." });
        }
        const season = d.seasons.find((s) => s.season_id === id);
        if (!season) {
          return JSON.stringify({ error: `Sesong ${id} ikke funnet.` });
        }
        const seeded = d.seededSet.has(id);
        const note =
          season.status === "draft"
            ? "Utkast — krev budsjett + dagfaktorer + timefaktorer for aktivering."
            : season.status === "active"
              ? "Aktiv sesong — D1 åpningstider er i bruk."
              : "Arkivert sesong.";
        return JSON.stringify({
          ...summarizeSeason(season, d.seededSet),
          seeded,
          activation_note: note,
        });
      },

      listPlanningEvents: (params) => {
        const d = dataRef.current;
        const categoryFilter = typeof params.category === "string" ? params.category : null;
        const eventsThisYear = d.events.filter((e) => e.event_date.startsWith(String(d.year)));
        const filtered = categoryFilter
          ? eventsThisYear.filter((e) => e.category === categoryFilter)
          : eventsThisYear;
        const sorted = [...filtered].sort((a, b) => a.event_date.localeCompare(b.event_date));
        return JSON.stringify({
          year: d.year,
          category_filter: categoryFilter ?? "all",
          count: sorted.length,
          events: sorted.map(summarizeEvent),
        });
      },

      getSeasonProgress: (params) => {
        const d = dataRef.current;
        const id = params.season_id;
        if (typeof id !== "string" || !id) {
          return JSON.stringify({ error: "season_id er påkrevd." });
        }
        const season = d.seasons.find((s) => s.season_id === id);
        if (!season) {
          return JSON.stringify({ error: `Sesong ${id} ikke funnet.` });
        }
        const seeded = d.seededSet.has(id);
        // NOTE: budget / day_factor / hour_factor completeness is enforced
        // server-side by activateSeasonAction. Here we report what we know
        // from client state (seeded = D1 fanout complete post-activation).
        return JSON.stringify({
          season_id: id,
          name: season.name,
          status: season.status,
          seeded,
          ready_to_activate: season.status === "draft",
          note: seeded
            ? "Åpningstider er seedet fra forrige aktivering."
            : "Åpningstider genereres automatisk ved aktivering (D1 fanout trigger).",
        });
      },

      proposeActivateSeason: async (params) => {
        const d = dataRef.current;
        const id = params.season_id;
        if (typeof id !== "string" || !id) {
          return JSON.stringify({ error: "season_id er påkrevd." });
        }
        const season = d.seasons.find((s) => s.season_id === id);
        if (!season) {
          return JSON.stringify({ error: `Sesong ${id} ikke funnet.` });
        }
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
              ? `${season.name} er allerede aktiv.`
              : `${season.name} er nå aktiv — ${result.departments_affected} avdelinger oppdatert.`,
          );
          d.uiActions.openSeason(id);
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

      proposeArchiveSeason: async (params) => {
        const d = dataRef.current;
        const id = params.season_id;
        if (typeof id !== "string" || !id) {
          return JSON.stringify({ error: "season_id er påkrevd." });
        }
        const season = d.seasons.find((s) => s.season_id === id);
        if (!season) {
          return JSON.stringify({ error: `Sesong ${id} ikke funnet.` });
        }
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
            toast.info(`${season.name} var allerede arkivert.`);
          } else {
            toast.success(`${season.name} er arkivert.`);
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
