"use client";

// DEAD-PIPE-2026-05-14: client tool not delivered to LLM yet; see HANDOFF-2026-05-14 + ADR-0327 (HarnessAdapter pending)

/**
 * use-hms-governance-tools.ts — Botsson tools for /dashboard/hms/governance.
 *
 * Three read tools. Surface owns: protocol overview (D3 governance read) +
 * maintenance procedure form (admin write surface, separate component-local
 * state — no tool exposure beyond a status flag).
 *
 *   getHmsGovernanceOverview  — counts: total protocols, avg completion, worst, blocking
 *   listGovernanceProtocols   — name + policy type + completion% + assignee counts
 *   getProtocolDetail         — single protocol by id with all count breakdowns
 *
 * Why no protocol-mutation tools:
 *   Protocol authoring + assignment lives under the platform `journey_authoring`
 *   and `governance.assign` capabilities (ADR-0240 cross-namespace boundary).
 *   Tools here are read-only. Maintenance procedure submission goes through
 *   MaintenanceProcedureForm's own submit (component-local).
 *
 * Distinct from /dashboard/governance scope:
 *   The standalone /dashboard/governance route is a redirect-shell with its
 *   own `governance` scope. This is the HMS sub-page with `hms-governance`
 *   scope — different surface, different tools, same data source.
 *
 * ADR-0151: workspace_id resolved server-side by useGovernanceOverview.
 * ADR-0238: page does not own a domain chat surface.
 */

import { useEffect, useMemo, useRef } from "react";
import type {
  ClientToolDefinition,
  ClientToolImplementation,
  ClientToolKit,
} from "@smartout/agent-sdk";
import type { ProtocolOverviewItem } from "@/app/dashboard/_hooks/dashboard-types";

/* ━━━ Types ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

export type HmsGovernanceToolInput = {
  loading: boolean;
  protocols: ProtocolOverviewItem[];
};

/* ━━━ Hook ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

export function useHmsGovernanceTools(input: HmsGovernanceToolInput): ClientToolKit {
  const dataRef = useRef(input);
  useEffect(() => {
    dataRef.current = input;
  });

  const definitions = useMemo<ClientToolDefinition[]>(
    () => [
      {
        temporaryTool: {
          modelToolName: "getHmsGovernanceOverview",
          description:
            "Get a counts summary of governance protocols under HMS — total active protocols, average completion percent, count of protocols with any expired assignments, and the worst-performing protocol (lowest completion). Use as the first tool when the user asks 'hva er status på opplæring?', 'hvilke protokoller står svakest?', or 'er noen utløpt?'.",
          dynamicParameters: [],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "listGovernanceProtocols",
          description:
            "List all active protocols with name, policy type (handbook/training/procedure/custom), completion percent, and assignee counts (total/completed/expired/in_progress/not_started/waived). Sorted by worst completion first. Use when the user asks 'vis alle protokoller', 'hvilke har jeg?', or 'list opp opplæring'.",
          dynamicParameters: [],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "getProtocolDetail",
          description:
            "Get the full count breakdown for one specific protocol — total assigned, completed, in_progress, not_started, expired, waived, plus policy type and completion percent. Use when the user asks about a specific protocol by name or id, or after listing.",
          dynamicParameters: [
            {
              name: "protocolId",
              location: "PARAMETER_LOCATION_BODY" as const,
              schema: {
                type: "string",
                description: "UUID of the protocol to read.",
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
      getHmsGovernanceOverview: () => {
        const d = dataRef.current;
        if (d.loading) {
          return Promise.resolve(JSON.stringify({ ok: true, status: "loading" }));
        }
        const list = d.protocols;
        if (list.length === 0) {
          return Promise.resolve(
            JSON.stringify({
              ok: true,
              available: false,
              reason: "Ingen aktive protokoller ennå.",
            }),
          );
        }
        const totalCompletion = list.reduce((sum, p) => sum + p.completionPercent, 0);
        const avgCompletion = Math.round(totalCompletion / list.length);
        const withExpired = list.filter((p) => p.expiredCount > 0).length;
        const worst = list[0]; // already sorted worst-first
        return Promise.resolve(
          JSON.stringify({
            ok: true,
            available: true,
            totalProtocols: list.length,
            avgCompletion,
            protocolsWithExpired: withExpired,
            worstProtocol: worst
              ? {
                  id: worst.protocolId,
                  name: worst.protocolName,
                  completionPercent: worst.completionPercent,
                  policyType: worst.policyType,
                }
              : null,
          }),
        );
      },

      listGovernanceProtocols: () => {
        const d = dataRef.current;
        if (d.loading) {
          return Promise.resolve(JSON.stringify({ ok: true, status: "loading" }));
        }
        return Promise.resolve(
          JSON.stringify({
            ok: true,
            count: d.protocols.length,
            protocols: d.protocols.map((p) => ({
              id: p.protocolId,
              name: p.protocolName,
              policyType: p.policyType,
              completionPercent: p.completionPercent,
              totalAssigned: p.totalAssigned,
              completedCount: p.completedCount,
              expiredCount: p.expiredCount,
              inProgressCount: p.inProgressCount,
              notStartedCount: p.notStartedCount,
              waivedCount: p.waivedCount,
            })),
          }),
        );
      },

      getProtocolDetail: (params: Record<string, unknown>) => {
        const d = dataRef.current;
        const id = String(params.protocolId ?? "");
        if (!id) {
          return Promise.resolve(JSON.stringify({ ok: false, error: "protocolId required" }));
        }
        const protocol = d.protocols.find((p) => p.protocolId === id);
        if (!protocol) {
          return Promise.resolve(JSON.stringify({ ok: false, error: "protocol not found", id }));
        }
        return Promise.resolve(
          JSON.stringify({
            ok: true,
            protocol: {
              id: protocol.protocolId,
              name: protocol.protocolName,
              description: protocol.protocolDescription,
              policyType: protocol.policyType,
              completionPercent: protocol.completionPercent,
              counts: {
                total: protocol.totalAssigned,
                completed: protocol.completedCount,
                pending: protocol.pendingCount,
                inProgress: protocol.inProgressCount,
                notStarted: protocol.notStartedCount,
                expired: protocol.expiredCount,
                waived: protocol.waivedCount,
              },
            },
          }),
        );
      },
    }),
    [],
  );

  return useMemo(() => ({ definitions, implementations }), [definitions, implementations]);
}
