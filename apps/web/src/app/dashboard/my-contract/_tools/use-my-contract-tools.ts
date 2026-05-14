"use client";

/**
 * use-my-contract-tools.ts — Botsson tools for the /dashboard/my-contract surface.
 *
 * Three tools: 2 read, 1 nav.
 *   getMyContractSummary  — returns active contract fields + status
 *   getMyContractHistory  — returns previous (non-active) contracts
 *   downloadMyContract    — triggers PDF download for the active contract
 *
 * The page does not have TanStack mutations that require tool wrappers — the only
 * mutations (amendment accept/decline) are intentional UI actions that Botsson
 * should NOT automate without explicit user confirmation; they are exposed as
 * read-only context here. Direct amendment actions are not wired to tools per
 * ADR-0151 (no unilateral employee-impacting writes without C4 gate).
 *
 * dataRef pattern (same as use-notifications-tools.ts) keeps definitions stable
 * while reading live state on every invocation.
 */

import { useEffect, useMemo, useRef } from "react";
import type {
  ClientToolDefinition,
  ClientToolImplementation,
  ClientToolKit,
} from "@smartout/agent-sdk";

/* ━━━ Types ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

export type ContractSummary = {
  contract_id: string;
  position_title: string | null;
  status: string;
  start_date: string;
  hourly_rate: number | null;
  monthly_salary: number | null;
  employment_percentage: number | null;
  document_url: string | null;
};

export type MyContractToolInput = {
  /** The employee's active (or latest pending) contract. Null if none loaded. */
  activeContract: ContractSummary | null;
  /** Previous (non-active) contracts in descending order. */
  history: ContractSummary[];
  /** Whether the page data is still loading. */
  loading: boolean;
  /** Payday from payroll profile — null if not set. */
  paydayRegular: number | null;
  /** Whether a pending amendment awaits employee response. */
  hasPendingAmendment: boolean;
};

/* ━━━ Hook ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

export function useMyContractTools(input: MyContractToolInput): ClientToolKit {
  const dataRef = useRef(input);
  useEffect(() => {
    dataRef.current = input;
  });

  const definitions = useMemo<ClientToolDefinition[]>(
    () => [
      {
        temporaryTool: {
          modelToolName: "getMyContractSummary",
          description:
            "Get the employee's active contract — position, status, start date, compensation, employment percentage, and whether a pending amendment awaits response. Use when user asks 'hva er min kontrakt?', 'hva tjener jeg?', 'hva er stillingsprosenten min?', or anything about current employment terms.",
          dynamicParameters: [],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "getMyContractHistory",
          description:
            "Get the employee's previous contracts in reverse chronological order. Use when user asks 'hva er historikken min?', 'har jeg hatt andre kontrakter?', or wants to see earlier employment terms.",
          dynamicParameters: [],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "downloadMyContract",
          description:
            "Trigger PDF download for the active contract. Use when user asks 'last ned kontrakten min', 'kan jeg få en kopi?', or 'eksporter PDF'. Only works if the contract has a document_url.",
          dynamicParameters: [],
          client: {},
        },
      },
    ],
    [],
  );

  const implementations = useMemo<Record<string, ClientToolImplementation>>(
    () => ({
      getMyContractSummary: () => {
        const d = dataRef.current;
        if (d.loading) {
          return JSON.stringify({ ok: false, reason: "Contract data is still loading." });
        }
        if (!d.activeContract) {
          return JSON.stringify({ ok: true, found: false, message: "No active contract found." });
        }
        return JSON.stringify({
          ok: true,
          found: true,
          contract: {
            contractId: d.activeContract.contract_id,
            position: d.activeContract.position_title,
            status: d.activeContract.status,
            startDate: d.activeContract.start_date,
            hourlyRate: d.activeContract.hourly_rate,
            monthlySalary: d.activeContract.monthly_salary,
            employmentPercentage: d.activeContract.employment_percentage,
            hasDocument: !!d.activeContract.document_url,
            paydayRegular: d.paydayRegular,
            hasPendingAmendment: d.hasPendingAmendment,
          },
        });
      },

      getMyContractHistory: () => {
        const d = dataRef.current;
        if (d.loading) {
          return JSON.stringify({ ok: false, reason: "Contract data is still loading." });
        }
        if (d.history.length === 0) {
          return JSON.stringify({ ok: true, count: 0, history: [] });
        }
        return JSON.stringify({
          ok: true,
          count: d.history.length,
          history: d.history.map((c) => ({
            contractId: c.contract_id,
            position: c.position_title,
            status: c.status,
            startDate: c.start_date,
            hourlyRate: c.hourly_rate,
            monthlySalary: c.monthly_salary,
          })),
        });
      },

      downloadMyContract: () => {
        const d = dataRef.current;
        if (!d.activeContract?.document_url) {
          return JSON.stringify({
            ok: false,
            reason: "No downloadable PDF found for the active contract.",
          });
        }
        // Trigger browser download by dispatching a window event — the page's
        // <a download> anchor handles the actual fetch. This avoids creating a
        // direct DOM reference inside the tool implementation.
        window.dispatchEvent(
          new CustomEvent("my-contract:download", {
            detail: { url: d.activeContract.document_url },
          }),
        );
        return JSON.stringify({ ok: true, triggered: true });
      },
    }),
    [],
  );

  return useMemo(() => ({ definitions, implementations }), [definitions, implementations]);
}
