"use client";

// DEAD-PIPE-2026-05-14: client tool not delivered to LLM yet; see HANDOFF-2026-05-14 + ADR-0327 (HarnessAdapter pending)

/**
 * use-billing-settings-tools.ts — Botsson tools for /dashboard/billing/settings.
 *
 * Four read tools — no mutation tools.
 *   getBillingSettingsOverview      — workspace count, EHF on/off, opt-out workspace count
 *   listDispatchRulesSnapshot       — counts of platform + workspace rules (no per-rule detail)
 *   listDunningOptOutWorkspaces     — workspaces with active suppress rule
 *   getEhfStatus                    — enabled flag + peppol participant id
 *
 * Why no mutation tools:
 *   Dispatch rule CRUD + dunning opt-out toggle + EHF settings are
 *   server-action flows owned by the child components. Botsson reads;
 *   the admin clicks toggles + buttons to mutate.
 *
 * ADR-0151: caller's company resolved via auth in the server page.
 * ADR-0139: EHF enablement + Peppol participant ID surface.
 * ADR-0238: page does not own a domain chat surface.
 */

import { useEffect, useMemo, useRef } from "react";
import type {
  ClientToolDefinition,
  ClientToolImplementation,
  ClientToolKit,
} from "@smartout/agent-sdk";

/* ━━━ Types ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

export type BillingSettingsWorkspace = {
  workspace_id: string;
  name: string;
  optOutOfAutoDunning: boolean;
};

export type BillingSettingsToolInput = {
  workspaces: BillingSettingsWorkspace[];
  ehfEnabled: boolean;
  peppolParticipantId: string | null;
  platformRuleCount: number;
  workspaceRuleCount: number;
};

/* ━━━ Hook ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

export function useBillingSettingsTools(input: BillingSettingsToolInput): ClientToolKit {
  const dataRef = useRef(input);
  useEffect(() => {
    dataRef.current = input;
  });

  const definitions = useMemo<ClientToolDefinition[]>(
    () => [
      {
        temporaryTool: {
          modelToolName: "getBillingSettingsOverview",
          description:
            "Get an overview of billing settings — number of workspaces under this company, EHF (e-invoice) enabled status, and count of workspaces opted out of automatic dunning. Use as the first tool when the user asks 'hva er fakturainnstillingene mine?', 'er EHF på?', or 'har vi automatiske påminnelser?'.",
          dynamicParameters: [],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "listDispatchRulesSnapshot",
          description:
            "Get count of dispatch rules visible to this admin — platform rules (shared baseline) and workspace rules (company-specific overrides). Use when the user asks 'hvor mange regler har vi?' or 'finnes det egendefinerte regler?'.",
          dynamicParameters: [],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "listDunningOptOutWorkspaces",
          description:
            "List workspaces under this company that have an active suppress rule for automatic dunning (invoice dunning_escalated → email_customer = suppress). Use when the user asks 'hvilke arbeidsplasser har slått av purringer?', 'hvor er automatisk dunning av?', or 'hvilke selskaper har valgt bort?'.",
          dynamicParameters: [],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "getEhfStatus",
          description:
            "Get the EHF (Elektronisk Handelsformat — Norwegian e-invoice) status for this company — whether EHF is enabled and the Peppol participant id. ADR-0139. Use when the user asks 'er EHF på?', 'har vi Peppol-ID?', or 'kan vi sende elektronisk faktura?'.",
          dynamicParameters: [],
          client: {},
        },
      },
    ],
    [],
  );

  const implementations = useMemo<Record<string, ClientToolImplementation>>(
    () => ({
      getBillingSettingsOverview: () => {
        const d = dataRef.current;
        const optOutCount = d.workspaces.filter((w) => w.optOutOfAutoDunning).length;
        return Promise.resolve(
          JSON.stringify({
            ok: true,
            workspaceCount: d.workspaces.length,
            ehfEnabled: d.ehfEnabled,
            hasPeppolId: d.peppolParticipantId !== null,
            optOutWorkspaceCount: optOutCount,
            platformRuleCount: d.platformRuleCount,
            workspaceRuleCount: d.workspaceRuleCount,
          }),
        );
      },

      listDispatchRulesSnapshot: () => {
        const d = dataRef.current;
        return Promise.resolve(
          JSON.stringify({
            ok: true,
            platformRules: d.platformRuleCount,
            workspaceRules: d.workspaceRuleCount,
            note: "Detaljert regelvisning skjer i WorkspaceDispatchRulesPanel.",
          }),
        );
      },

      listDunningOptOutWorkspaces: () => {
        const d = dataRef.current;
        const optedOut = d.workspaces.filter((w) => w.optOutOfAutoDunning);
        return Promise.resolve(
          JSON.stringify({
            ok: true,
            count: optedOut.length,
            workspaces: optedOut.map((w) => ({
              workspaceId: w.workspace_id,
              name: w.name,
            })),
          }),
        );
      },

      getEhfStatus: () => {
        const d = dataRef.current;
        return Promise.resolve(
          JSON.stringify({
            ok: true,
            enabled: d.ehfEnabled,
            peppolParticipantId: d.peppolParticipantId,
            hint: d.ehfEnabled
              ? "EHF er på. Fakturaer kan sendes elektronisk via Peppol."
              : "EHF er av. Aktivere i innstillingene for å sende elektroniske fakturaer.",
          }),
        );
      },
    }),
    [],
  );

  return useMemo(() => ({ definitions, implementations }), [definitions, implementations]);
}
