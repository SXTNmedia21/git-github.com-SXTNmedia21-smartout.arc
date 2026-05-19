"use client";

/**
 * use-governance-tools.ts — Botsson tools for the /dashboard/governance surface.
 *
 * Seven tools — four read, two write proposals, one navigation:
 *
 *   getGovernanceState       — overall readiness + deviation summary + tab state
 *   listProtocols            — D3-layer protocols with completion % + policy type
 *   getProtocolDetail        — single protocol: assignee list + status breakdown
 *   listOverdueItems         — protocols with expired or low-completion assignments
 *   proposeAssignProtocol    — open AssignProtocolSheet pre-filled for a protocol
 *   proposeCreateDeviation   — navigate to /dashboard/hms/deviations with form hint
 *   switchGovernanceTab      — navigate to a sub-tab (oversikt/drift/training/documents/deviations/governance)
 *
 * Removed tools (ADR-0365 collision fix — M5 Sortie 2, 2026-05-17):
 *   listOpenDeviations — REMOVED: single owner is hms/deviations sub-tab
 *                        (use-hms-deviations-tools.ts). Governance surface
 *                        surfaces deviation counts via getGovernanceState;
 *                        for full list, manager navigates to hms/deviations.
 *
 * Write tools follow the proposal pattern — Botsson opens the sheet/form and
 * the user confirms + saves. No direct DB writes from tool handlers (workspace_id
 * is resolved server-side by the action per ADR-0151; tool does NOT pass it in body).
 *
 * Pattern: useCalendarTools / use-notifications-tools — dataRef refreshed every
 * render, definitions stable via useMemo([], []).
 *
 * Cascade vocabulary:
 *   D3 (Rules & Constraints) — policy → protocol → procedure/knowledge_test/confirmation
 *   C4 (Policy & Governance) — engine_authority_config, deviation, change_proposal
 */

import { useMemo, useRef, useEffect } from "react";
import type {
  ClientToolDefinition,
  ClientToolImplementation,
  ClientToolKit,
} from "@smartout/agent-sdk";

/* ━━━ Constants ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

const PARAMETER_LOCATION_BODY = "PARAMETER_LOCATION_BODY" as const;

const HMS_TAB_IDS = [
  "oversikt",
  "drift",
  "training",
  "documents",
  "deviations",
  "governance",
] as const;
type HmsTabId = (typeof HMS_TAB_IDS)[number];

const HMS_TAB_HREFS: Record<HmsTabId, string> = {
  oversikt: "/dashboard/hms",
  drift: "/dashboard/hms/drift",
  training: "/dashboard/hms/training",
  documents: "/dashboard/hms/documents",
  deviations: "/dashboard/hms/deviations",
  governance: "/dashboard/hms/governance",
};

/* ━━━ Types ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

export type GovernanceProtocolSummary = {
  protocolId: string;
  protocolName: string;
  policyType: string;
  totalAssigned: number;
  completedCount: number;
  completionPercent: number;
  expiredCount: number;
  notStartedCount: number;
  inProgressCount: number;
  waivedCount: number;
};

export type GovernanceDeviationSummary = {
  deviationId: string;
  title: string;
  severity: string;
  status: string;
  domain: string | null;
  departmentName: string | null;
  blocksDayApproval: boolean;
  createdAt: string;
};

export type GovernanceToolInput = {
  /** D3-layer protocol list with per-protocol completion stats. */
  protocols: GovernanceProtocolSummary[];
  /** C4-layer open deviations (open + acknowledged + escalated). */
  openDeviations: GovernanceDeviationSummary[];
  /** Overall workspace readiness % (avg across all protocols). */
  avgCompletion: number;
  /** Count of protocols with expiredCount > 0. */
  overdueCount: number;
  /** Current HMS sub-tab id. */
  activeTab: HmsTabId;
  /** Navigation action — router.push to sub-tab href. */
  navigateTo: (href: string) => void;
  /** Open the assign-protocol sheet for a given protocol id. */
  openAssignSheet: (protocolId: string) => void;
};

/* ━━━ Helpers ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function isValidTab(v: unknown): v is HmsTabId {
  return typeof v === "string" && (HMS_TAB_IDS as readonly string[]).includes(v);
}

function summarizeProtocol(p: GovernanceProtocolSummary) {
  return {
    protocolId: p.protocolId,
    name: p.protocolName,
    policyType: p.policyType,
    totalAssigned: p.totalAssigned,
    completedCount: p.completedCount,
    completionPercent: p.completionPercent,
    expiredCount: p.expiredCount,
    notStartedCount: p.notStartedCount,
    inProgressCount: p.inProgressCount,
    waivedCount: p.waivedCount,
  };
}

/* ━━━ Hook ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

export function useGovernanceTools(input: GovernanceToolInput): ClientToolKit {
  const dataRef = useRef(input);
  useEffect(() => {
    dataRef.current = input;
  });

  const definitions = useMemo<ClientToolDefinition[]>(
    () => [
      {
        temporaryTool: {
          modelToolName: "getGovernanceState",
          description:
            "Get the current governance dashboard state — overall workspace readiness %, total protocol count, overdue count, open deviation count, and active sub-tab. Call first when manager asks any open-ended governance or HMS question.",
          dynamicParameters: [],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "listProtocols",
          description:
            "List all active D3-layer protocols with completion %, assignment counts, and policy type (haccp/safety/hr/operational/access/payroll/custom). Use when manager asks 'hvilke protokoller har vi?', 'hva er status på opplæringen?', or wants a compliance overview.",
          dynamicParameters: [
            {
              name: "policy_type",
              location: PARAMETER_LOCATION_BODY,
              schema: {
                type: "string",
                description:
                  "Optional filter: 'haccp' | 'safety' | 'hr' | 'operational' | 'access' | 'payroll' | 'custom'. Omit to list all.",
              },
            },
            {
              name: "sort",
              location: PARAMETER_LOCATION_BODY,
              schema: {
                type: "string",
                description:
                  "Optional sort: 'worst_first' (default) | 'best_first' | 'name'. worst_first surfaces protocols with lowest completion.",
              },
            },
          ],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "getProtocolDetail",
          description:
            "Get detailed status breakdown for a single D3-layer protocol — completed / in_progress / not_started / expired / waived counts. Use when manager asks 'hvem har ikke fullfort [protokollnavn]?' or wants to drill into one protocol.",
          dynamicParameters: [
            {
              name: "protocol_id",
              location: PARAMETER_LOCATION_BODY,
              schema: {
                type: "string",
                description: "UUID of the protocol. Get from listProtocols if unknown.",
              },
              required: true,
            },
          ],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "listOverdueItems",
          description:
            "List D3-layer protocols that have expired assignments or completion below 80%. Use when manager asks 'hva er på etterskudd?', 'hvem mangler opplæring?', or needs to identify C4-compliance gaps.",
          dynamicParameters: [
            {
              name: "threshold",
              location: PARAMETER_LOCATION_BODY,
              schema: {
                type: "number",
                description:
                  "Completion percent below which a protocol is flagged. Default 80. Range 0–100.",
              },
            },
          ],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "proposeAssignProtocol",
          description:
            "Open the assign-protocol sheet pre-filled for a protocol so manager can select employees and confirm. Use when manager says 'tildel [protokollnavn] til ansatte' or wants to assign training. NEVER assigns directly — sheet requires manual confirmation.",
          dynamicParameters: [
            {
              name: "protocol_id",
              location: PARAMETER_LOCATION_BODY,
              schema: {
                type: "string",
                description: "UUID of the protocol to assign. Get from listProtocols if unknown.",
              },
              required: true,
            },
          ],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "proposeCreateDeviation",
          description:
            "Navigate to the deviations tab so manager can create a new C4-layer deviation. Use when manager says 'meld et avvik' or 'logg et avvik'. Does not pre-fill the form — opens the deviation tab where the DeviationForm is accessible.",
          dynamicParameters: [],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "switchGovernanceTab",
          description:
            "Navigate to a specific HMS sub-tab. Use when manager asks to go to opplæring, avvik, drift, dokumenter, or governance admin. Accepts: oversikt | drift | training | documents | deviations | governance.",
          dynamicParameters: [
            {
              name: "tab",
              location: PARAMETER_LOCATION_BODY,
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
    ],
    [],
  );

  const implementations = useMemo<Record<string, ClientToolImplementation>>(
    () => ({
      getGovernanceState: () => {
        const d = dataRef.current;
        return JSON.stringify({
          avgCompletion: d.avgCompletion,
          totalProtocols: d.protocols.length,
          overdueProtocols: d.overdueCount,
          openDeviations: d.openDeviations.length,
          blockingDeviations: d.openDeviations.filter((x) => x.blocksDayApproval).length,
          activeTab: d.activeTab,
        });
      },

      listProtocols: (params) => {
        const d = dataRef.current;
        let list = [...d.protocols];

        if (typeof params.policy_type === "string" && params.policy_type.trim() !== "") {
          list = list.filter((p) => p.policyType === params.policy_type);
        }

        const sort = typeof params.sort === "string" ? params.sort : "worst_first";
        if (sort === "worst_first") {
          list.sort((a, b) => a.completionPercent - b.completionPercent);
        } else if (sort === "best_first") {
          list.sort((a, b) => b.completionPercent - a.completionPercent);
        } else if (sort === "name") {
          list.sort((a, b) => a.protocolName.localeCompare(b.protocolName));
        }

        return JSON.stringify({
          count: list.length,
          protocols: list.map(summarizeProtocol),
        });
      },

      getProtocolDetail: (params) => {
        const d = dataRef.current;
        const id = params.protocol_id;
        if (typeof id !== "string" || id.trim() === "") {
          return JSON.stringify({ error: "protocol_id er påkrevd." });
        }
        const p = d.protocols.find((x) => x.protocolId === id);
        if (!p) {
          return JSON.stringify({ error: `Fant ingen protokoll med id ${id}.` });
        }
        return JSON.stringify({
          protocol: summarizeProtocol(p),
          statusBreakdown: {
            completed: p.completedCount,
            inProgress: p.inProgressCount,
            notStarted: p.notStartedCount,
            expired: p.expiredCount,
            waived: p.waivedCount,
            total: p.totalAssigned,
          },
        });
      },

      listOverdueItems: (params) => {
        const d = dataRef.current;
        const raw = typeof params.threshold === "number" ? params.threshold : 80;
        const threshold = Math.max(0, Math.min(100, raw));

        const overdue = d.protocols.filter(
          (p) => p.expiredCount > 0 || (p.totalAssigned > 0 && p.completionPercent < threshold),
        );

        return JSON.stringify({
          threshold,
          count: overdue.length,
          items: overdue.map((p) => ({
            protocolId: p.protocolId,
            name: p.protocolName,
            completionPercent: p.completionPercent,
            expiredCount: p.expiredCount,
            reason: p.expiredCount > 0 ? "expired_assignments" : "low_completion",
          })),
        });
      },

      proposeAssignProtocol: (params) => {
        const d = dataRef.current;
        const id = params.protocol_id;
        if (typeof id !== "string" || id.trim() === "") {
          return JSON.stringify({ error: "protocol_id er påkrevd." });
        }
        const p = d.protocols.find((x) => x.protocolId === id);
        if (!p) {
          return JSON.stringify({ error: `Fant ingen protokoll med id ${id}.` });
        }
        d.openAssignSheet(id);
        return JSON.stringify({
          ok: true,
          message: `Åpnet tildeling for "${p.protocolName}". Velg ansatte og bekreft.`,
        });
      },

      proposeCreateDeviation: () => {
        const d = dataRef.current;
        d.navigateTo(HMS_TAB_HREFS.deviations);
        return JSON.stringify({
          ok: true,
          message: "Navigerte til avvik-fanen. Klikk '+ Nytt avvik' for å logge.",
        });
      },

      switchGovernanceTab: (params) => {
        const d = dataRef.current;
        const tab = params.tab;
        if (!isValidTab(tab)) {
          return JSON.stringify({
            error: "tab må være oversikt | drift | training | documents | deviations | governance.",
          });
        }
        d.navigateTo(HMS_TAB_HREFS[tab]);
        return JSON.stringify({ ok: true, tab });
      },
    }),
    [],
  );

  return useMemo(() => ({ definitions, implementations }), [definitions, implementations]);
}
