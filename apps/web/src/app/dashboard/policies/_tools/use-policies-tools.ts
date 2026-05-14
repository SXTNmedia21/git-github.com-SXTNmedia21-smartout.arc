"use client";

// DEAD-PIPE-2026-05-14: client tool not delivered to LLM yet; see HANDOFF-2026-05-14 + ADR-0327 (HarnessAdapter pending)

/**
 * use-policies-tools.ts — Botsson tools for the /dashboard/policies surface.
 *
 * Five tools — 3 read, 1 write-propose, 1 nav:
 *   listPolicies          — list active workspace policies with optional type filter
 *   getPolicySummary      — aggregate counts by type and enforcement status
 *   filterByType          — narrow the visible policy list to a specific type
 *   proposeCreatePolicy   — open the policy create dialog pre-selected to a type
 *   openPolicyDetail      — navigate/scroll to a specific policy row by id or name
 *
 * Write tool follows the proposal pattern — Botsson opens the dialog and the
 * user reviews + confirms. No direct DB writes from tool handlers. workspace_id
 * and created_by are resolved server-side by createPolicy per ADR-0151.
 *
 * Pattern: useNotificationsTools / use-governance-tools — dataRef refreshed
 * every render, definitions stable via useMemo([], []).
 *
 * Cascade vocabulary:
 *   D3 (Rules & Constraints) — policy → protocol → procedure / knowledge_test / confirmation
 *   policies surface = D3 authoring entry point
 */

import { useMemo, useRef, useEffect } from "react";
import type {
  ClientToolDefinition,
  ClientToolImplementation,
  ClientToolKit,
} from "@smartout/agent-sdk";
import type { PolicyRow } from "../_actions/policy-actions";

/* ━━━ Constants ━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

const PARAMETER_LOCATION_BODY = "PARAMETER_LOCATION_BODY" as const;

const VALID_POLICY_TYPES = [
  "operational",
  "haccp",
  "hr",
  "safety",
  "access",
  "payroll",
  "custom",
] as const;

type PolicyType = (typeof VALID_POLICY_TYPES)[number];

function isValidPolicyType(v: unknown): v is PolicyType {
  return typeof v === "string" && (VALID_POLICY_TYPES as readonly string[]).includes(v);
}

/* ━━━ Types ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

export type PoliciesToolInput = {
  /** Active policies from the server-rendered initial data. */
  policies: PolicyRow[];
  /** Open the create-policy dialog, optionally pre-selecting a type. */
  openCreateDialog: (policyType?: PolicyType) => void;
  /** Navigate to a policy detail view by policy_id. No-op in Phase 1 (detail not yet built). */
  openPolicyById: (policyId: string) => void;
};

/* ━━━ Helpers ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function summarizePolicy(p: PolicyRow) {
  return {
    policyId: p.policy_id,
    name: p.name,
    type: p.policy_type,
    scope: p.policy_scope,
    enforcement: p.enforcement_status,
    isActive: p.is_active,
    createdAt: p.created_at,
  };
}

/* ━━━ Hook ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

export function usePoliciesTools(input: PoliciesToolInput): ClientToolKit {
  const dataRef = useRef(input);
  useEffect(() => {
    dataRef.current = input;
  });

  const definitions = useMemo<ClientToolDefinition[]>(
    () => [
      {
        temporaryTool: {
          modelToolName: "listPolicies",
          description:
            "List active workspace policies. Filter by type (operational|haccp|hr|safety|access|payroll|custom) or leave empty for all. Use when manager asks 'hvilke policies har vi?', 'vis HR-policies', or wants a compliance overview.",
          dynamicParameters: [
            {
              name: "policy_type",
              location: PARAMETER_LOCATION_BODY,
              schema: {
                type: "string",
                description:
                  "Optional type filter: 'operational' | 'haccp' | 'hr' | 'safety' | 'access' | 'payroll' | 'custom'. Omit to return all active policies.",
              },
              required: false,
            },
          ],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "getPolicySummary",
          description:
            "Get aggregate policy counts — total, by type, and by enforcement status. Use when manager asks 'hvor mange policies har vi?', 'hva slags policies finnes?', or needs a quick compliance snapshot.",
          dynamicParameters: [],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "filterByType",
          description:
            "Return the subset of policies matching a given type. Use when the manager asks to narrow the list, e.g. 'vis bare sikkerhetspolicies' or 'list lønns-policies'.",
          dynamicParameters: [
            {
              name: "policy_type",
              location: PARAMETER_LOCATION_BODY,
              schema: {
                type: "string",
                enum: ["operational", "haccp", "hr", "safety", "access", "payroll", "custom"],
                description: "The policy type to filter to.",
              },
              required: true,
            },
          ],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "proposeCreatePolicy",
          description:
            "Open the 'Ny policy' dialog so manager can fill in name, description, and type. Use when user says 'lag ny policy', 'opprett en HR-policy', or wants to add a workplace rule. NEVER creates directly — dialog requires manual confirmation.",
          dynamicParameters: [
            {
              name: "policy_type",
              location: PARAMETER_LOCATION_BODY,
              schema: {
                type: "string",
                enum: ["operational", "haccp", "hr", "safety", "access", "payroll", "custom"],
                description:
                  "Optional: pre-select the policy type in the dialog. Omit if user hasn't specified a type.",
              },
              required: false,
            },
          ],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "openPolicyDetail",
          description:
            "Find and highlight a specific policy by name or id. Use when manager refers to a policy by name, e.g. 'vis fraværspolicyen' or 'åpne policy X'. Returns not_found if no match.",
          dynamicParameters: [
            {
              name: "query",
              location: PARAMETER_LOCATION_BODY,
              schema: {
                type: "string",
                description:
                  "Policy id (UUID) or a substring of the policy name (case-insensitive match).",
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
      listPolicies: (params: Record<string, unknown>) => {
        const d = dataRef.current;
        const typeFilter = params.policy_type;
        let rows = d.policies;

        if (typeof typeFilter === "string" && typeFilter.trim() !== "") {
          rows = rows.filter((p) => p.policy_type === typeFilter);
        }

        return JSON.stringify({
          filter: typeFilter ?? "all",
          count: rows.length,
          policies: rows.map(summarizePolicy),
        });
      },

      getPolicySummary: () => {
        const d = dataRef.current;
        const byType: Record<string, number> = {};
        const byEnforcement: Record<string, number> = {};

        for (const p of d.policies) {
          byType[p.policy_type] = (byType[p.policy_type] ?? 0) + 1;
          byEnforcement[p.enforcement_status] = (byEnforcement[p.enforcement_status] ?? 0) + 1;
        }

        return JSON.stringify({
          total: d.policies.length,
          byType,
          byEnforcement,
        });
      },

      filterByType: (params: Record<string, unknown>) => {
        const d = dataRef.current;
        const policyType = params.policy_type;

        if (!isValidPolicyType(policyType)) {
          return JSON.stringify({
            error: `Ugyldig type '${String(policyType)}'. Gyldige typer: ${VALID_POLICY_TYPES.join(", ")}`,
          });
        }

        const filtered = d.policies.filter((p) => p.policy_type === policyType);

        return JSON.stringify({
          policy_type: policyType,
          count: filtered.length,
          policies: filtered.map(summarizePolicy),
        });
      },

      proposeCreatePolicy: (params: Record<string, unknown>) => {
        const d = dataRef.current;
        const policyType = params.policy_type;
        const typeArg = isValidPolicyType(policyType) ? policyType : undefined;

        d.openCreateDialog(typeArg);

        return JSON.stringify({
          ok: true,
          message: typeArg
            ? `Åpnet 'Ny policy'-dialogen med type '${typeArg}' forhåndsvalgt. Fyll inn tittel og beskrivelse, deretter 'Lagre policy'.`
            : "Åpnet 'Ny policy'-dialogen. Velg type, fyll inn tittel og beskrivelse, deretter 'Lagre policy'.",
        });
      },

      openPolicyDetail: (params: Record<string, unknown>) => {
        const d = dataRef.current;
        const query = params.query;

        if (typeof query !== "string" || query.trim() === "") {
          return JSON.stringify({ error: "query er påkrevd (policy-id eller navnsøk)." });
        }

        const q = query.trim().toLowerCase();

        // UUID match first, then name substring
        const match =
          d.policies.find((p) => p.policy_id === query.trim()) ??
          d.policies.find((p) => p.name.toLowerCase().includes(q));

        if (!match) {
          return JSON.stringify({
            found: false,
            query,
            message: `Fant ingen policy som matcher '${query}'. Prøv listPolicies for full oversikt.`,
          });
        }

        d.openPolicyById(match.policy_id);

        return JSON.stringify({
          found: true,
          policy: summarizePolicy(match),
          message: `Navigerte til policy '${match.name}'.`,
        });
      },
    }),
    [],
  );

  return useMemo(() => ({ definitions, implementations }), [definitions, implementations]);
}
