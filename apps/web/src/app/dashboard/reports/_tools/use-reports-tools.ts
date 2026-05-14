"use client";

// DEAD-PIPE-2026-05-14: client tool not delivered to LLM yet; see HANDOFF-2026-05-14 + ADR-0327 (HarnessAdapter pending)

/**
 * use-reports-tools.ts — Botsson tools for the /dashboard/reports page.
 *
 * Seven tools — five read, one navigation, one drawer-open:
 *
 *   getReportsState        — active tab, available tabs, workspace context
 *   getKpiSummary          — overview KPIs: ansatte, beredskap, vaktdekning, opplæring
 *   getReportByTab         — structured data for a specific tab (overview/people/staffing/training)
 *   listSavedReports       — saved custom reports for this workspace
 *   getUnfilledShifts      — unfilled shifts in the next 7 days (staffing gap alert)
 *   switchReportTab        — navigate between overview / people / staffing / training / saved
 *   openAiReportAssistant  — open the AI report-builder drawer (no direct mutation)
 *
 * Pattern follows use-calendar-tools.ts:
 *   - stable useMemo([], []) definitions
 *   - dataRef pattern (useRef + useEffect sync every render)
 *   - JSON.stringify results
 *   - useRegisterTools("reports", tools)
 *
 * Reports = read-mostly C1 calibration + C3 commercial surface. No writes from
 * this bridge — AI report generation happens inside AiReportDrawer (own flow).
 * ADR-0238: owns_chat_surface=false — reports page does NOT declare chat ownership.
 * ADR-0151: workspace_id always auth-derived (from workspaceId prop, never body-supplied).
 */

import { useEffect, useMemo, useRef } from "react";
import type {
  ClientToolDefinition,
  ClientToolImplementation,
  ClientToolKit,
} from "@smartout/agent-sdk";
import type { OverviewData } from "../_hooks/use-report-overview";
import type { PeopleData } from "../_hooks/use-report-people";
import type { StaffingData } from "../_hooks/use-report-staffing";
import type { TrainingData } from "../_hooks/use-report-training";

/* ━━━ Tab type ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

export type ReportsTab = "overview" | "people" | "staffing" | "training" | "saved";

const TAB_LABELS: Record<ReportsTab, string> = {
  overview: "Oversikt",
  people: "Medarbeidere",
  staffing: "Bemanning",
  training: "Opplæring",
  saved: "Mine rapporter",
};

/* ━━━ Input type ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

export type ReportsToolInput = {
  /** Auth-derived workspace ID — never body-supplied (ADR-0151). */
  workspaceId: string;
  /** Currently visible tab. */
  activeTab: ReportsTab;
  /** Pre-loaded overview data (may be undefined if tab not yet loaded). */
  overviewData: OverviewData | undefined;
  /** Pre-loaded people data. */
  peopleData: PeopleData | undefined;
  /** Pre-loaded staffing data. */
  staffingData: StaffingData | undefined;
  /** Pre-loaded training data. */
  trainingData: TrainingData | undefined;
  /** Saved custom reports count (from SavedReportsGrid state). */
  savedReportsCount: number;
  /** UI actions — Botsson navigates, never mutates data directly. */
  uiActions: {
    setActiveTab: (tab: ReportsTab) => void;
    openAiDrawer: () => void;
  };
};

/* ━━━ Helpers ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function isValidTab(v: unknown): v is ReportsTab {
  return (
    v === "overview" || v === "people" || v === "staffing" || v === "training" || v === "saved"
  );
}

/* ━━━ Hook ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

export function useReportsTools(input: ReportsToolInput): ClientToolKit {
  const dataRef = useRef(input);
  useEffect(() => {
    dataRef.current = input;
  });

  const definitions = useMemo<ClientToolDefinition[]>(
    () => [
      {
        temporaryTool: {
          modelToolName: "getReportsState",
          description:
            "Get the current state of the reports page — active tab, available tabs, workspace ID. Call first when the manager asks any open-ended question about rapporter or statistikk.",
          dynamicParameters: [],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "getKpiSummary",
          description:
            "Get the four top-level KPIs for the workspace: ansatte (headcount), beredskap (readiness %), vaktdekning (shift coverage %), and opplæring (training %). Use when manager asks 'hvordan står vi?', 'hva er beredskapen?', or wants a quick pulse check.",
          dynamicParameters: [],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "getReportByTab",
          description:
            "Get structured analytics data for a specific tab. Use when manager asks about medarbeidere (role/status/tenure), bemanning (shift coverage, unfilled shifts, labor hours), or opplæring (protocol compliance, overdue assignments). Specify which tab to fetch.",
          dynamicParameters: [
            {
              name: "tab",
              location: "PARAMETER_LOCATION_BODY",
              schema: {
                type: "string",
                description:
                  "'overview' | 'people' | 'staffing' | 'training'. Use 'overview' for KPI + trends, 'people' for medarbeider-data, 'staffing' for vaktplan-data, 'training' for opplæring.",
              },
              required: true,
            },
          ],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "listSavedReports",
          description:
            "List saved custom reports for this workspace — count only (full list requires opening Mine rapporter tab). Use when manager asks 'har jeg lagret noen rapporter?' or 'finn min rapport om X'.",
          dynamicParameters: [],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "getUnfilledShifts",
          description:
            "Get unfilled shifts (no employee assigned) in the next 7 days. Use when manager asks 'hvilke vakter mangler folk?', 'hvem er det hull i vakta?', or wants to see staffing gaps.",
          dynamicParameters: [],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "switchReportTab",
          description:
            "Switch the active reports tab — 'overview' (Oversikt), 'people' (Medarbeidere), 'staffing' (Bemanning), 'training' (Opplæring), 'saved' (Mine rapporter). Use when manager says 'vis bemanning', 'åpne opplæring', 'gå til medarbeidere'.",
          dynamicParameters: [
            {
              name: "tab",
              location: "PARAMETER_LOCATION_BODY",
              schema: {
                type: "string",
                description:
                  "'overview' | 'people' | 'staffing' | 'training' | 'saved'. Norwegian aliases: 'oversikt' → overview, 'medarbeidere' → people, 'bemanning' → staffing, 'opplæring' → training, 'mine rapporter' → saved.",
              },
              required: true,
            },
          ],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "openAiReportAssistant",
          description:
            "Open the AI report-builder drawer so the manager can generate a custom report. Use when manager says 'lag en rapport', 'generer statistikk', 'åpne AI-assistenten', or asks for data not covered by the standard tabs.",
          dynamicParameters: [],
          client: {},
        },
      },
    ],
    [],
  );

  const implementations = useMemo<Record<string, ClientToolImplementation>>(
    () => ({
      getReportsState: () => {
        const d = dataRef.current;
        return JSON.stringify({
          workspaceId: d.workspaceId,
          activeTab: d.activeTab,
          activeTabLabel: TAB_LABELS[d.activeTab],
          availableTabs: Object.entries(TAB_LABELS).map(([value, label]) => ({ value, label })),
          savedReportsCount: d.savedReportsCount,
          dataLoaded: {
            overview: d.overviewData !== undefined,
            people: d.peopleData !== undefined,
            staffing: d.staffingData !== undefined,
            training: d.trainingData !== undefined,
          },
        });
      },

      getKpiSummary: () => {
        const d = dataRef.current;
        if (!d.overviewData) {
          return JSON.stringify({
            error: "KPI-data ikke lastet ennå. Prøv igjen om et øyeblikk.",
          });
        }
        return JSON.stringify({
          kpis: d.overviewData.kpis,
          insights: d.overviewData.insights,
        });
      },

      getReportByTab: (params) => {
        const d = dataRef.current;
        const tab = params.tab;

        // Normalize Norwegian aliases to tab keys
        const aliases: Record<string, ReportsTab> = {
          oversikt: "overview",
          overview: "overview",
          medarbeidere: "people",
          people: "people",
          bemanning: "staffing",
          staffing: "staffing",
          opplæring: "training",
          opplaering: "training",
          training: "training",
          "mine rapporter": "saved",
          saved: "saved",
        };

        const resolvedTab = typeof tab === "string" ? aliases[tab.toLowerCase()] : undefined;
        if (!resolvedTab) {
          return JSON.stringify({
            error: "tab må være overview | people | staffing | training | saved.",
          });
        }

        if (resolvedTab === "overview") {
          if (!d.overviewData) {
            return JSON.stringify({ error: "Oversikt-data ikke lastet ennå." });
          }
          return JSON.stringify({
            tab: "overview",
            kpis: d.overviewData.kpis,
            trend7d: d.overviewData.trend7d,
            departmentStats: d.overviewData.departmentStats,
            insights: d.overviewData.insights,
          });
        }

        if (resolvedTab === "people") {
          if (!d.peopleData) {
            return JSON.stringify({
              error: "Medarbeider-data ikke lastet ennå. Åpne Medarbeidere-fanen.",
            });
          }
          return JSON.stringify({
            tab: "people",
            roleDistribution: d.peopleData.roleDistribution,
            statusBreakdown: d.peopleData.statusBreakdown,
            tenureDistribution: d.peopleData.tenureDistribution,
          });
        }

        if (resolvedTab === "staffing") {
          if (!d.staffingData) {
            return JSON.stringify({
              error: "Bemanning-data ikke lastet ennå. Åpne Bemanning-fanen.",
            });
          }
          return JSON.stringify({
            tab: "staffing",
            weeklyCoverage: d.staffingData.weeklyCoverage,
            shiftTypes: d.staffingData.shiftTypes,
            laborHours4w: d.staffingData.laborHours4w,
            unfilledShiftsCount: d.staffingData.unfilledShifts.length,
          });
        }

        if (resolvedTab === "training") {
          if (!d.trainingData) {
            return JSON.stringify({
              error: "Opplæring-data ikke lastet ennå. Åpne Opplæring-fanen.",
            });
          }
          return JSON.stringify({
            tab: "training",
            protocolCompliance: d.trainingData.protocolCompliance,
            trainingTrend30d: d.trainingData.trainingTrend30d,
            overdueCount: d.trainingData.overdueAssignments.length,
          });
        }

        // saved tab — count only, no raw data
        return JSON.stringify({
          tab: "saved",
          savedReportsCount: d.savedReportsCount,
          note: "Åpne Mine rapporter-fanen for å se alle lagrede rapporter.",
        });
      },

      listSavedReports: () => {
        const d = dataRef.current;
        return JSON.stringify({
          savedReportsCount: d.savedReportsCount,
          note:
            d.savedReportsCount > 0
              ? `Det finnes ${d.savedReportsCount} lagrede rapporter. Åpne Mine rapporter-fanen for å se dem.`
              : "Ingen lagrede rapporter ennå. Bruk AI-assistenten til å lage og lagre en rapport.",
        });
      },

      getUnfilledShifts: () => {
        const d = dataRef.current;
        if (!d.staffingData) {
          return JSON.stringify({
            error: "Bemanning-data ikke lastet ennå. Åpne Bemanning-fanen og prøv igjen.",
          });
        }
        const unfilled = d.staffingData.unfilledShifts;
        return JSON.stringify({
          count: unfilled.length,
          unfilledShifts: unfilled,
          message:
            unfilled.length === 0
              ? "Ingen ubemannede vakter de neste 7 dagene."
              : `${unfilled.length} ubemannet vakt${unfilled.length > 1 ? "er" : ""} de neste 7 dagene.`,
        });
      },

      switchReportTab: (params) => {
        const d = dataRef.current;
        const rawTab = typeof params.tab === "string" ? params.tab.toLowerCase() : "";

        const aliases: Record<string, ReportsTab> = {
          oversikt: "overview",
          overview: "overview",
          medarbeidere: "people",
          people: "people",
          bemanning: "staffing",
          staffing: "staffing",
          opplæring: "training",
          opplaering: "training",
          training: "training",
          "mine rapporter": "saved",
          saved: "saved",
        };

        const tab = aliases[rawTab];
        if (!isValidTab(tab)) {
          return JSON.stringify({
            error: "tab må være overview | people | staffing | training | saved.",
          });
        }

        d.uiActions.setActiveTab(tab);
        return JSON.stringify({
          ok: true,
          tab,
          tabLabel: TAB_LABELS[tab],
        });
      },

      openAiReportAssistant: () => {
        const d = dataRef.current;
        d.uiActions.openAiDrawer();
        return JSON.stringify({
          ok: true,
          message: "Åpnet AI-rapport-assistenten. Beskriv hvilken rapport du vil lage.",
        });
      },
    }),
    [],
  );

  return useMemo(() => ({ definitions, implementations }), [definitions, implementations]);
}
