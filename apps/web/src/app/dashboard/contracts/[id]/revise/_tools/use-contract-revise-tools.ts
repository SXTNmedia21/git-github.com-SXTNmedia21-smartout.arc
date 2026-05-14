"use client";

/**
 * use-contract-revise-tools.ts — Botsson tools for /dashboard/contracts/[id]/revise.
 *
 * Two tools: 1 read, 1 navigate.
 *   getRevisionContext      — returns the contract id being revised
 *   navigateBackToContract  — go back to /dashboard/contracts/[id]
 *
 * Why minimal:
 *   CompositionWizard owns all composition state internally. Tools here
 *   only expose which contract is being revised + nav.
 *
 * ADR-0238: page does not own a domain chat surface.
 */

import { useEffect, useMemo, useRef } from "react";
import type {
  ClientToolDefinition,
  ClientToolImplementation,
  ClientToolKit,
} from "@smartout/agent-sdk";

export type ContractReviseToolInput = {
  contractId: string;
  navigateTo: (href: string) => void;
};

export function useContractReviseTools(input: ContractReviseToolInput): ClientToolKit {
  const dataRef = useRef(input);
  useEffect(() => {
    dataRef.current = input;
  });

  const definitions = useMemo<ClientToolDefinition[]>(
    () => [
      {
        temporaryTool: {
          modelToolName: "getRevisionContext",
          description:
            "Get the id of the contract currently being revised. Use when the user asks 'hvilken kontrakt redigerer jeg?' or 'hva er konteksten her?'.",
          dynamicParameters: [],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "navigateBackToContract",
          description:
            "Navigate back to the original contract detail view (/dashboard/contracts/[id]). Use when the user says 'tilbake til kontrakten', 'avbryt revisjon', or 'lukk redigering'.",
          dynamicParameters: [],
          client: {},
        },
      },
    ],
    [],
  );

  const implementations = useMemo<Record<string, ClientToolImplementation>>(
    () => ({
      getRevisionContext: () => {
        const d = dataRef.current;
        return Promise.resolve(
          JSON.stringify({
            ok: true,
            contractId: d.contractId,
            hint: "Du redigerer et utkast. CompositionWizard styrer alle vilkår.",
          }),
        );
      },

      navigateBackToContract: () => {
        const d = dataRef.current;
        const href = `/dashboard/contracts/${d.contractId}`;
        d.navigateTo(href);
        return Promise.resolve(JSON.stringify({ ok: true, navigatedTo: href }));
      },
    }),
    [],
  );

  return useMemo(() => ({ definitions, implementations }), [definitions, implementations]);
}
