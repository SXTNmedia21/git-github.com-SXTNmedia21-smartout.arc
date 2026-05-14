"use client";

/**
 * use-awaiting-signature-tools.ts — Botsson tools for
 * /dashboard/contracts/awaiting-my-signature.
 *
 * Three tools: 2 read, 1 navigate.
 *   getAwaitingSignatureCount       — number of contracts requiring employer signature
 *   listAwaitingSignatureContracts  — full list with employee + position + signing url
 *   openContractForSigning          — navigates to /sign/<signing_url> for a contract
 *
 * Why a client bridge for a server page:
 *   The host page is a Server Component (server-side auth + RLS query).
 *   useRegisterTools is client-only. The page passes the serialized list
 *   to this bridge, which hands it to the tool hook.
 *
 * ADR-0151: query is keyed on auth.getUser() in the server page — workspace
 * isolation is implicit via RLS on contract + employment_contract joins.
 * ADR-0238: page does not own a domain chat surface.
 */

import { useEffect, useMemo, useRef } from "react";
import type {
  ClientToolDefinition,
  ClientToolImplementation,
  ClientToolKit,
} from "@smartout/agent-sdk";

/* ━━━ Types ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

export type AwaitingSignatureRow = {
  contractId: string;
  title: string | null;
  sentAt: string | null;
  signingUrl: string | null;
  employeeName: string;
  positionTitle: string | null;
  employeeSignedAt: string | null;
};

export type AwaitingSignatureToolInput = {
  contracts: AwaitingSignatureRow[];
  navigateTo: (href: string) => void;
};

/* ━━━ Hook ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

export function useAwaitingSignatureTools(input: AwaitingSignatureToolInput): ClientToolKit {
  const dataRef = useRef(input);
  useEffect(() => {
    dataRef.current = input;
  });

  const definitions = useMemo<ClientToolDefinition[]>(
    () => [
      {
        temporaryTool: {
          modelToolName: "getAwaitingSignatureCount",
          description:
            "Get the count of employee contracts that require the current admin's signature as employer (signed_by_employer_at IS NULL). Use as the first tool when the user asks 'hvor mange venter min signatur?' or 'har jeg noe å signere?'.",
          dynamicParameters: [],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "listAwaitingSignatureContracts",
          description:
            "List all contracts waiting for the admin's signature — id, title, employee name, position title, sent_at, and whether the employee has already signed. Use when the user asks 'vis kontraktene som venter', 'hva må jeg signere?', or 'hvilke har ansatt signert allerede?'.",
          dynamicParameters: [],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "openContractForSigning",
          description:
            "Open the DocuSeal signing flow for a specific contract — navigates to /sign/<signing_url>. Use when the user says 'signer kontrakten for [navn]', 'åpne signering for [id]', or right after the admin picks one from the list.",
          dynamicParameters: [
            {
              name: "contractId",
              location: "PARAMETER_LOCATION_BODY" as const,
              schema: {
                type: "string",
                description: "UUID of the contract row to sign.",
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
      getAwaitingSignatureCount: () => {
        const d = dataRef.current;
        return Promise.resolve(
          JSON.stringify({
            ok: true,
            count: d.contracts.length,
            hint:
              d.contracts.length === 0
                ? "Ingen kontrakter venter signatur."
                : `${d.contracts.length} kontrakt(er) venter din signatur.`,
          }),
        );
      },

      listAwaitingSignatureContracts: () => {
        const d = dataRef.current;
        return Promise.resolve(
          JSON.stringify({
            ok: true,
            count: d.contracts.length,
            contracts: d.contracts.map((c) => ({
              id: c.contractId,
              title: c.title,
              employee: c.employeeName,
              positionTitle: c.positionTitle,
              sentAt: c.sentAt,
              employeeSignedAt: c.employeeSignedAt,
              employeeHasSigned: c.employeeSignedAt !== null,
              canSignNow: c.signingUrl !== null,
            })),
          }),
        );
      },

      openContractForSigning: (params: Record<string, unknown>) => {
        const d = dataRef.current;
        const id = String(params.contractId ?? "");
        if (!id) {
          return Promise.resolve(JSON.stringify({ ok: false, error: "contractId required" }));
        }
        const row = d.contracts.find((c) => c.contractId === id);
        if (!row) {
          return Promise.resolve(
            JSON.stringify({ ok: false, error: "contract not in awaiting list", id }),
          );
        }
        if (!row.signingUrl) {
          return Promise.resolve(
            JSON.stringify({ ok: false, error: "contract has no signing_url", id }),
          );
        }
        const href = `/sign/${row.signingUrl}`;
        d.navigateTo(href);
        return Promise.resolve(JSON.stringify({ ok: true, navigatedTo: href }));
      },
    }),
    [],
  );

  return useMemo(() => ({ definitions, implementations }), [definitions, implementations]);
}
