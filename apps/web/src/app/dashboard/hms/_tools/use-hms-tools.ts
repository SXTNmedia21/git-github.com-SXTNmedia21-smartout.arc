"use client";

/**
 * use-hms-tools.ts — Botsson tools for the /dashboard/hms umbrella.
 *
 * HMS is a 6-tab umbrella (oversikt | drift | training | documents |
 * deviations | governance). These tools cover the ROOT "oversikt" tab
 * and umbrella-level cross-tab navigation + summary reads.
 *
 * NOT duplicating governance-tab tools (already shipped in governance/_tools).
 * HMS-scope = umbrella overview state, open-count summaries, and
 * switching between the six HMS sub-tabs.
 *
 * Tools (4):
 *   getHmsOverview       — counts: open deviations, governance readiness%,
 *                          overdue protocols, upcoming reviews (30d)
 *   listOverdueProtocols — protocols with expiredCount > 0
 *   switchHmsTab         — navigate to any of the 6 HMS sub-tabs
 *   focusDeviation       — navigate to deviations tab for a specific deviation id
 *
 * Removed tools (ADR-0360 collision fix — M5 Sortie 2, 2026-05-17):
 *   listOpenDeviations — REMOVED: single owner is hms/deviations sub-tab
 *                        (use-hms-deviations-tools.ts). HMS umbrella users
 *                        must navigate to the deviations tab first.
 *   getDriftStatus     — REMOVED: single owner is hms/drift sub-tab
 *                        (use-hms-drift-tools.ts). Object.assign last-wins
 *                        collision with drift scope resolved.
 *
 * Pattern: dataRef (refreshed every render) + stable useMemo definitions.
 * Scope: useRegisterTools("hms", tools) — distinct from "governance" scope.
 *
 * Why separate from governance scope: governance tools drill into D3-layer
 * protocols + assignments. HMS tools surface the umbrella KPI bar (C4 + D3
 * combined) and cross-tab navigation for manager's first question
 * "how is HMS today?".
 */

import { useEffect, useMemo, useRef } from "react";
import type {
  ClientToolDefinition,
  ClientToolImplementation,
  ClientToolKit,
} from "@smartout/agent-sdk";
import type { DeviationRow } from "@smartout/hms";

/** The 6 HMS sub-tabs, matching HmsSubNav hrefs. */
export type HmsTab = "oversikt" | "drift" | "training" | "documents" | "deviations" | "governance";

export type HmsToolInput = {
  /** Overall governance readiness % (avgCompletion from useGovernanceFiltered). */
  readinessPercent: number;
  /** Total protocol count. */
  totalProtocols: number;
  /** Count of protocols with expiredCount > 0. */
  overdueProtocolCount: number;
  /** Count of upcoming reviews within next 30 days. */
  upcomingReviewCount: number;
  /** Open/acknowledged/escalated deviations (list for detail, length for count). */
  openDeviations: DeviationRow[];
  /** UI actions for navigation. */
  uiActions: {
    /** Navigate to a specific HMS sub-tab by routing to its href. */
    navigateToTab: (tab: HmsTab) => void;
  };
};

/* ━━━ Helpers ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

const TAB_HREFS: Record<HmsTab, string> = {
  oversikt: "/dashboard/hms",
  drift: "/dashboard/hms/drift",
  training: "/dashboard/hms/training",
  documents: "/dashboard/hms/documents",
  deviations: "/dashboard/hms/deviations",
  governance: "/dashboard/hms/governance",
};

function isValidHmsTab(value: unknown): value is HmsTab {
  return (
    value === "oversikt" ||
    value === "drift" ||
    value === "training" ||
    value === "documents" ||
    value === "deviations" ||
    value === "governance"
  );
}

/* ━━━ Hook ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

export function useHmsTools(input: HmsToolInput): ClientToolKit {
  const dataRef = useRef(input);
  useEffect(() => {
    dataRef.current = input;
  });

  const definitions = useMemo<ClientToolDefinition[]>(
    () => [
      {
        temporaryTool: {
          modelToolName: "getHmsOverview",
          description:
            "Get the HMS umbrella KPI summary — governance readiness %, total protocols, overdue protocol count, upcoming reviews (next 30 days), open deviation count, and blocking deviation count. Call first when manager asks any open-ended HMS status question like 'hvordan er HMS i dag?' or 'er alt greit?'.",
          dynamicParameters: [],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "listOverdueProtocols",
          description:
            "List D3-layer protocols that have expired assignments — employees whose certification has lapsed. Use when manager asks 'hvem er utgått på opplæring?', 'hvilke protokoller er overdue?', or needs compliance gap overview.",
          dynamicParameters: [],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "switchHmsTab",
          description:
            "Navigate to one of the 6 HMS sub-tabs: oversikt | drift | training | documents | deviations | governance. Use when manager says 'gå til avvik', 'åpne opplæring', 'vis dokumenter', 'vis drift', or 'gå til governance'.",
          dynamicParameters: [
            {
              name: "tab",
              location: "PARAMETER_LOCATION_BODY",
              schema: {
                type: "string",
                description:
                  "'oversikt' | 'drift' | 'training' | 'documents' | 'deviations' | 'governance'",
              },
              required: true,
            },
          ],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "focusDeviation",
          description:
            "Navigate to the deviations tab. Optionally pass a deviation ID to bring that deviation into focus. Use when manager asks about a specific avvik or says 'åpne avvik X'.",
          dynamicParameters: [
            {
              name: "deviation_id",
              location: "PARAMETER_LOCATION_BODY",
              schema: {
                type: "string",
                description: "UUID of the deviation to focus. Optional.",
              },
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
      getHmsOverview: () => {
        const d = dataRef.current;
        const blockingCount = d.openDeviations.filter((dev) => dev.blocksDayApproval).length;
        return JSON.stringify({
          readinessPercent: d.readinessPercent,
          totalProtocols: d.totalProtocols,
          overdueProtocolCount: d.overdueProtocolCount,
          upcomingReviewCount: d.upcomingReviewCount,
          openDeviationCount: d.openDeviations.length,
          blockingDeviationCount: blockingCount,
          statusSummary:
            d.readinessPercent >= 90 ? "green" : d.readinessPercent >= 70 ? "warning" : "critical",
        });
      },

      listOverdueProtocols: () => {
        // HMS overview doesn't carry the full protocol list — returns counts only.
        // For full list, manager should switchHmsTab("governance") to see detail.
        const d = dataRef.current;
        return JSON.stringify({
          overdueProtocolCount: d.overdueProtocolCount,
          note:
            d.overdueProtocolCount > 0
              ? `${d.overdueProtocolCount} protokoll(er) har utgåtte sertifiseringer. Gå til Training-fanen for full liste.`
              : "Ingen utgåtte protokoller.",
        });
      },

      switchHmsTab: (params) => {
        const d = dataRef.current;
        const tab = params.tab;
        if (!isValidHmsTab(tab)) {
          return JSON.stringify({
            error: "tab må være oversikt | drift | training | documents | deviations | governance.",
          });
        }
        d.uiActions.navigateToTab(tab);
        return JSON.stringify({ ok: true, tab, href: TAB_HREFS[tab] });
      },

      focusDeviation: (params) => {
        const d = dataRef.current;
        d.uiActions.navigateToTab("deviations");
        return JSON.stringify({
          ok: true,
          tab: "deviations",
          deviation_id: params.deviation_id ?? null,
          message: params.deviation_id
            ? `Navigerte til avvik-fanen. Avvik-ID: ${params.deviation_id}.`
            : "Navigerte til avvik-fanen.",
        });
      },
    }),
    [],
  );

  return useMemo(() => ({ definitions, implementations }), [definitions, implementations]);
}
