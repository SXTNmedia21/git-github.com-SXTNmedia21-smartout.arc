"use client";

// DEAD-PIPE-2026-05-14: client tool not delivered to LLM yet; see HANDOFF-2026-05-14 + ADR-0327 (HarnessAdapter pending)

/**
 * use-contracts-tools.ts — Botsson tools for /dashboard/contracts.
 *
 * Six tools — read + navigation:
 *
 *   listContracts          — list contracts with optional status/bucket filter
 *   getContractCounts      — counts per status bucket (ready_for_action / waiting_employee / completed / all)
 *   getPendingMine         — contracts awaiting action from the current user (pending signature)
 *   searchContracts        — search by employee display name substring
 *   openContractDetail     — navigate to /dashboard/contracts/[id]
 *   openNewContractFlow    — open the new-contract compose drawer (sets ?open=compose)
 *   switchStatusFilter     — switch the active bucket tab in KontrakterTab
 *
 * NO write tools at list-level. Writes (send, cancel, sign) live in [id] detail
 * and new/ flow — separate scope per task brief.
 *
 * Pattern follows use-calendar-tools.ts:
 *  - useMemo([], []) stable definitions
 *  - dataRef pattern keeps implementations reading live state without re-memoising
 *  - JSON.stringify result
 *  - useRegisterTools("contracts", tools) in the bridge
 *
 * D2 (Resource Availability) surface — employment_contract rows.
 */

import { useEffect, useMemo, useRef } from "react";
import type {
  ClientToolDefinition,
  ClientToolImplementation,
  ClientToolKit,
} from "@smartout/agent-sdk";
import type { ContractStatus, DashboardBucket } from "../filters";
import { getContractBucket, groupByBucket } from "../filters";

/* ━━━ Types ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

export type ContractRow = {
  contract_id: string;
  profile_id: string | null;
  status: ContractStatus;
  position_title: string | null;
  employment_category: string | null;
  employment_percentage: number | null;
  created_at: string;
  signed_at: string | null;
  profile: { display_name: string } | null;
};

export type BucketFilter = "all" | DashboardBucket;

export type ContractsToolInput = {
  /** All loaded contracts (flat list, workspace-scoped). */
  contracts: ContractRow[];
  /** Whether the contract list query is still loading. */
  isLoading: boolean;
  /** Currently active bucket filter. */
  activeBucket: BucketFilter;
  /** profile_id of the currently logged-in manager (for pending-mine filter). */
  actorProfileId: string | null;
  /** UI actions — Botsson opens flows, never writes directly. */
  uiActions: {
    /** Open a contract detail page. */
    openContractDetail: (contractId: string) => void;
    /** Open the new-contract compose drawer. */
    openNewContractFlow: () => void;
    /** Switch the active bucket sub-filter tab. */
    switchStatusFilter: (bucket: BucketFilter) => void;
  };
};

/* ━━━ Helpers ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

const VALID_BUCKET_FILTERS: BucketFilter[] = [
  "all",
  "ready_for_action",
  "waiting_employee",
  "completed",
];

const BUCKET_LABEL: Record<BucketFilter, string> = {
  all: "Alle",
  ready_for_action: "Klare for handling",
  waiting_employee: "Venter på ansatt",
  completed: "Fullførte",
};

/** Summarise a contract row for LLM consumption — strip large/irrelevant fields. */
function summarizeContract(c: ContractRow) {
  return {
    contract_id: c.contract_id,
    employee: c.profile?.display_name ?? "(ukjent)",
    status: c.status,
    bucket: getContractBucket(c.status),
    position_title: c.position_title ?? null,
    employment_category: c.employment_category ?? null,
    employment_percentage: c.employment_percentage ?? null,
    created_at: c.created_at,
    signed_at: c.signed_at ?? null,
  };
}

function isValidBucket(v: unknown): v is BucketFilter {
  return typeof v === "string" && VALID_BUCKET_FILTERS.includes(v as BucketFilter);
}

/* ━━━ Hook ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

export function useContractsTools(input: ContractsToolInput): ClientToolKit {
  const dataRef = useRef(input);
  useEffect(() => {
    dataRef.current = input;
  });

  const definitions = useMemo<ClientToolDefinition[]>(
    () => [
      {
        temporaryTool: {
          modelToolName: "listContracts",
          description:
            "List employment contracts in this workspace. Filter by bucket: all | ready_for_action (draft/declined/expired) | waiting_employee (sent/viewed/pending_data) | completed (signed/cancelled). Use when manager asks 'hvilke kontrakter har vi?', 'hva er status?', or wants to see a specific group.",
          dynamicParameters: [
            {
              name: "bucket",
              location: "PARAMETER_LOCATION_BODY" as const,
              schema: {
                type: "string",
                enum: ["all", "ready_for_action", "waiting_employee", "completed"],
                description: "Bucket to filter by. Omit or pass 'all' to return every contract.",
              },
              required: false,
            },
          ],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "getContractCounts",
          description:
            "Get contract counts per dashboard bucket (all, ready_for_action, waiting_employee, completed). Use when manager asks 'hvor mange kontrakter venter på signering?' or wants a summary overview.",
          dynamicParameters: [],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "getPendingMine",
          description:
            "Get contracts that are actively waiting for something — i.e. in sent, viewed, or pending_data status. Use when manager asks 'hva venter på svar fra ansatt?' or 'hvem har ikke signert?'.",
          dynamicParameters: [],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "searchContracts",
          description:
            "Search contracts by employee display name (case-insensitive substring). Use when manager asks 'finn kontrakt for [navn]' or 'har vi kontrakt på [ansatt]?'.",
          dynamicParameters: [
            {
              name: "query",
              location: "PARAMETER_LOCATION_BODY" as const,
              schema: {
                type: "string",
                description:
                  "Employee name substring to search. Matches display_name case-insensitively.",
              },
              required: true,
            },
          ],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "openContractDetail",
          description:
            "Navigate to the contract detail page for a specific contract_id. Use when manager wants to view, send, or manage a specific contract. Requires a valid contract_id — call listContracts or searchContracts first if you only have a name.",
          dynamicParameters: [
            {
              name: "contractId",
              location: "PARAMETER_LOCATION_BODY" as const,
              schema: {
                type: "string",
                description: "UUID of the employment_contract row.",
              },
              required: true,
            },
          ],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "openNewContractFlow",
          description:
            "Open the new-contract compose drawer. The manager selects an employee and fills in position + terms — Botsson does NOT create the contract directly. Use when manager says 'lag kontrakt', 'opprett kontrakt for ny ansatt', or 'start ansettelsesprosess'.",
          dynamicParameters: [],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "switchStatusFilter",
          description:
            "Switch the active contract list sub-filter. Buckets: all | ready_for_action | waiting_employee | completed. Use when manager says 'vis bare kontrakter klare for sending' or 'vis fullførte'.",
          dynamicParameters: [
            {
              name: "bucket",
              location: "PARAMETER_LOCATION_BODY" as const,
              schema: {
                type: "string",
                enum: ["all", "ready_for_action", "waiting_employee", "completed"],
                description: "The bucket filter to activate.",
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
      listContracts: (params: Record<string, unknown>) => {
        const d = dataRef.current;
        if (d.isLoading) {
          return JSON.stringify({ loading: true, message: "Laster kontrakter …" });
        }
        const bucket = (params.bucket as BucketFilter | undefined) ?? "all";
        let rows = d.contracts;
        if (bucket !== "all") {
          rows = rows.filter((c) => getContractBucket(c.status) === bucket);
        }
        return JSON.stringify({
          bucket,
          bucketLabel: BUCKET_LABEL[bucket],
          total: rows.length,
          contracts: rows.map(summarizeContract),
        });
      },

      getContractCounts: () => {
        const d = dataRef.current;
        if (d.isLoading) {
          return JSON.stringify({ loading: true });
        }
        const grouped = groupByBucket(d.contracts);
        return JSON.stringify({
          all: d.contracts.length,
          ready_for_action: grouped.ready_for_action.length,
          waiting_employee: grouped.waiting_employee.length,
          completed: grouped.completed.length,
          activeBucket: d.activeBucket,
        });
      },

      getPendingMine: () => {
        const d = dataRef.current;
        if (d.isLoading) {
          return JSON.stringify({ loading: true });
        }
        // "Pending mine" = contracts in waiting_employee bucket (employee must act).
        // At list-level Botsson cannot distinguish "the manager sent it" from another
        // workspace admin — all waiting_employee contracts are surfaced.
        const pending = d.contracts.filter(
          (c) => getContractBucket(c.status) === "waiting_employee",
        );
        return JSON.stringify({
          count: pending.length,
          contracts: pending.map(summarizeContract),
        });
      },

      searchContracts: (params: Record<string, unknown>) => {
        const d = dataRef.current;
        const query = typeof params.query === "string" ? params.query.toLowerCase().trim() : "";
        if (!query) {
          return JSON.stringify({ error: "query is required and must be a non-empty string." });
        }
        if (d.isLoading) {
          return JSON.stringify({ loading: true });
        }
        const rows = d.contracts.filter((c) =>
          (c.profile?.display_name ?? "").toLowerCase().includes(query),
        );
        return JSON.stringify({
          query: params.query,
          count: rows.length,
          contracts: rows.map(summarizeContract),
        });
      },

      openContractDetail: (params: Record<string, unknown>) => {
        const d = dataRef.current;
        const contractId = params.contractId;
        if (typeof contractId !== "string" || !contractId) {
          return JSON.stringify({ ok: false, reason: "contractId is required." });
        }
        const exists = d.contracts.find((c) => c.contract_id === contractId);
        if (!exists) {
          return JSON.stringify({
            ok: false,
            reason: `Kontrakten '${contractId}' finnes ikke i gjeldende liste. Prøv listContracts eller searchContracts for å finne riktig contract_id.`,
          });
        }
        d.uiActions.openContractDetail(contractId);
        return JSON.stringify({
          ok: true,
          contractId,
          employee: exists.profile?.display_name ?? "(ukjent)",
          message: `Navigerer til kontrakt for ${exists.profile?.display_name ?? contractId}.`,
        });
      },

      openNewContractFlow: () => {
        const d = dataRef.current;
        d.uiActions.openNewContractFlow();
        return JSON.stringify({
          ok: true,
          message:
            "Åpnet lag-kontrakt-flyten. Velg ansatt og fyll inn stilling + vilkår for å opprette kontrakten.",
        });
      },

      switchStatusFilter: (params: Record<string, unknown>) => {
        const d = dataRef.current;
        const bucket = params.bucket;
        if (!isValidBucket(bucket)) {
          return JSON.stringify({
            ok: false,
            reason: `Ugyldig bucket '${String(bucket)}'. Bruk: all | ready_for_action | waiting_employee | completed.`,
          });
        }
        d.uiActions.switchStatusFilter(bucket);
        return JSON.stringify({
          ok: true,
          bucket,
          bucketLabel: BUCKET_LABEL[bucket],
        });
      },
    }),
    [],
  );

  return useMemo(() => ({ definitions, implementations }), [definitions, implementations]);
}
