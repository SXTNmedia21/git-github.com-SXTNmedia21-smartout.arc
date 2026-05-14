"use client";

/**
 * use-contract-detail-tools.ts — Botsson tools for /dashboard/contracts/[id].
 *
 * Five tools: 3 read, 2 navigate.
 *   getContractDetail              — full contract record (status, terms, employee, overrides)
 *   getContractTerms               — pay terms only (rate, salary, %, start date)
 *   getContractComplianceOverrides — list of ADR-0244 compliance overrides with level + message
 *   navigateToReviseContract       — open /dashboard/contracts/[id]/revise (draft only)
 *   navigateToCompleteEmployeeData — open /dashboard/people/[profile_id]/complete-data
 *
 * Why no signing/sending tools:
 *   Contract send + sign live in CompositionWizard + DocuSeal flow. Page tools
 *   are read + nav only — humans drive composition/signing.
 *
 * ADR-0151: workspace_id auth-derived via /api/employment-contracts/{id}.
 * ADR-0244: compliance overrides are signed admin acknowledgements; tools
 * expose them read-only so Botsson can answer 'why does this contract have
 * a yellow rate override?'.
 * ADR-0238: page does not own a domain chat surface.
 */

import { useEffect, useMemo, useRef } from "react";
import type {
  ClientToolDefinition,
  ClientToolImplementation,
  ClientToolKit,
} from "@smartout/agent-sdk";
import type { ComplianceLevel } from "@smartout/utils";

/* ━━━ Types ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

export type ContractDetailComplianceOverride = {
  rule_id: string;
  level: ComplianceLevel;
  message: string;
};

export type ContractDetailRow = {
  contract_id: string;
  profile_id: string | null;
  status: string;
  position_title: string;
  hourly_rate: number | null;
  monthly_salary: number | null;
  employment_percentage: number | null;
  start_date: string;
  compliance_overrides: ContractDetailComplianceOverride[] | null;
  parent_contract_id: string | null;
  decline_reason_code: string | null;
  decline_reason_text: string | null;
  employee_display_name: string | null;
};

export type ContractDetailToolInput = {
  loading: boolean;
  contractId: string;
  contract: ContractDetailRow | null;
  navigateTo: (href: string) => void;
};

/* ━━━ Hook ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

export function useContractDetailTools(input: ContractDetailToolInput): ClientToolKit {
  const dataRef = useRef(input);
  useEffect(() => {
    dataRef.current = input;
  });

  const definitions = useMemo<ClientToolDefinition[]>(
    () => [
      {
        temporaryTool: {
          modelToolName: "getContractDetail",
          description:
            "Get the full detail of the contract currently open — id, status (draft/sent/viewed/signed/expired/declined/cancelled/pending_data), employee display name, position title, terms summary, and lineage (parent_contract_id). Use as the first tool when the user asks 'hva slags kontrakt er dette?', 'hvilken status har den?', or 'hva er dette?'.",
          dynamicParameters: [],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "getContractTerms",
          description:
            "Get the pay-related terms of this contract — hourly_rate (kr/t), monthly_salary (kr), employment_percentage (%), and start_date. Use when the user asks 'hva tjener han?', 'hvor mye er stillingen?', 'når starter avtalen?', or about contractual money/time terms.",
          dynamicParameters: [],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "getContractComplianceOverrides",
          description:
            "Get the AML §14-6 / Riksavtalen compliance overrides on this contract — each override's rule_id, severity level (info/warn/block), and the admin-signed acknowledgement message. Use when the user asks 'er det noen avvik på avtalen?', 'hvorfor er denne gul?', or 'hvilke regler er overstyrt?'.",
          dynamicParameters: [],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "navigateToReviseContract",
          description:
            "Navigate to the contract revision composer at /dashboard/contracts/[id]/revise. Only allowed when status is draft. Use when the user says 'rediger kontrakten', 'endre vilkår', or 'gjør om utkastet'.",
          dynamicParameters: [],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "navigateToCompleteEmployeeData",
          description:
            "Navigate to /dashboard/people/[profile_id]/complete-data for the employee on this contract — used when contract is pending_data (missing PII before send). Use when the user says 'fyll inn manglende data', 'gå til ansattprofilen for fullføring'.",
          dynamicParameters: [],
          client: {},
        },
      },
    ],
    [],
  );

  const implementations = useMemo<Record<string, ClientToolImplementation>>(
    () => ({
      getContractDetail: () => {
        const d = dataRef.current;
        if (d.loading) {
          return Promise.resolve(JSON.stringify({ ok: true, status: "loading" }));
        }
        if (!d.contract) {
          return Promise.resolve(
            JSON.stringify({ ok: false, error: "contract not found", id: d.contractId }),
          );
        }
        const c = d.contract;
        return Promise.resolve(
          JSON.stringify({
            ok: true,
            contract: {
              id: c.contract_id,
              status: c.status,
              employee: c.employee_display_name,
              positionTitle: c.position_title,
              employmentPercentage: c.employment_percentage,
              startDate: c.start_date,
              parentContractId: c.parent_contract_id,
              declined:
                c.status === "declined"
                  ? {
                      reasonCode: c.decline_reason_code,
                      reasonText: c.decline_reason_text,
                    }
                  : null,
              hasComplianceOverrides: (c.compliance_overrides?.length ?? 0) > 0,
            },
          }),
        );
      },

      getContractTerms: () => {
        const d = dataRef.current;
        if (d.loading) {
          return Promise.resolve(JSON.stringify({ ok: true, status: "loading" }));
        }
        if (!d.contract) {
          return Promise.resolve(JSON.stringify({ ok: false, error: "contract not found" }));
        }
        const c = d.contract;
        return Promise.resolve(
          JSON.stringify({
            ok: true,
            terms: {
              hourlyRate: c.hourly_rate,
              monthlySalary: c.monthly_salary,
              employmentPercentage: c.employment_percentage,
              startDate: c.start_date,
            },
          }),
        );
      },

      getContractComplianceOverrides: () => {
        const d = dataRef.current;
        if (d.loading) {
          return Promise.resolve(JSON.stringify({ ok: true, status: "loading" }));
        }
        const overrides = d.contract?.compliance_overrides ?? [];
        return Promise.resolve(
          JSON.stringify({
            ok: true,
            count: overrides.length,
            overrides: overrides.map((o) => ({
              ruleId: o.rule_id,
              level: o.level,
              message: o.message,
            })),
          }),
        );
      },

      navigateToReviseContract: () => {
        const d = dataRef.current;
        if (!d.contract) {
          return Promise.resolve(JSON.stringify({ ok: false, error: "contract not loaded" }));
        }
        if (d.contract.status !== "draft") {
          return Promise.resolve(
            JSON.stringify({
              ok: false,
              error: "revise only allowed on draft contracts",
              currentStatus: d.contract.status,
            }),
          );
        }
        const href = `/dashboard/contracts/${d.contract.contract_id}/revise`;
        d.navigateTo(href);
        return Promise.resolve(JSON.stringify({ ok: true, navigatedTo: href }));
      },

      navigateToCompleteEmployeeData: () => {
        const d = dataRef.current;
        if (!d.contract) {
          return Promise.resolve(JSON.stringify({ ok: false, error: "contract not loaded" }));
        }
        if (!d.contract.profile_id) {
          return Promise.resolve(
            JSON.stringify({ ok: false, error: "contract has no profile_id" }),
          );
        }
        const href = `/dashboard/people/${d.contract.profile_id}/complete-data`;
        d.navigateTo(href);
        return Promise.resolve(JSON.stringify({ ok: true, navigatedTo: href }));
      },
    }),
    [],
  );

  return useMemo(() => ({ definitions, implementations }), [definitions, implementations]);
}
