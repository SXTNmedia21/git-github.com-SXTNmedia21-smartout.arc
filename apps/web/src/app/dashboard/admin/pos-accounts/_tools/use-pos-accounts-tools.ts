"use client";

/**
 * use-pos-accounts-tools.ts — Botsson read-only tools for /dashboard/admin/pos-accounts.
 *
 * Two tools, no mutations (ADR-0244: disconnect is chat-only, connect uses the
 * existing modal + POST /api/botsson/pos/connect — no LLM-initiated writes here).
 *
 *   getPosAccountsState — count + per-account public metadata
 *   getPosActionState   — gating flags + Norwegian hint
 *
 * ADR-0077: oauth_token and refresh_token are NEVER included in tool output.
 * ADR-0151: workspace_id resolved server-side via RLS — not a tool parameter.
 * ADR-0288: disconnect is chat-only; no disconnect tool registered here.
 *
 * dataRef pattern keeps definitions stable across renders while reading live
 * data on every invocation (same pattern as use-my-salary-tools.ts).
 */

import { useEffect, useMemo, useRef } from "react";
import type {
  ClientToolDefinition,
  ClientToolImplementation,
  ClientToolKit,
} from "@smartout/agent-sdk";

/* ━━━ Types ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

export type PosAccountsToolInput = {
  accounts: Array<{
    pos_account_id: string;
    name: string;
    external_account_id: string;
    connected_at: string | null;
    is_active: boolean;
  }>;
  workspaceIsActive: boolean;
};

/* ━━━ Hook ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

export function usePosAccountsTools(input: PosAccountsToolInput): ClientToolKit {
  const dataRef = useRef(input);
  useEffect(() => {
    dataRef.current = input;
  });

  const definitions = useMemo<ClientToolDefinition[]>(
    () => [
      {
        temporaryTool: {
          modelToolName: "getPosAccountsState",
          description:
            "Get the current POS account inventory for this workspace — total count and per-account public metadata (name, external ID, connected date, active status). Use when the admin asks 'hvor mange POS er tilkoblet?', 'hvilke POS-kontoer har vi?', or wants a status overview of integrations. Never exposes oauth_token or credentials.",
          dynamicParameters: [],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "getPosActionState",
          description:
            "Get the action-gate state for POS management — whether the admin can connect a new account and whether at least one active account already exists. Use when the admin asks 'kan jeg koble til Lightspeed?', 'er det noe som blokkerer tilkobling?', or before proposing a connect action. Returns a Norwegian hint for the current state.",
          dynamicParameters: [],
          client: {},
        },
      },
    ],
    [],
  );

  const implementations = useMemo<Record<string, ClientToolImplementation>>(
    () => ({
      getPosAccountsState: () => {
        const { accounts } = dataRef.current;

        return JSON.stringify({
          ok: true,
          count: accounts.length,
          accounts: accounts.map((a) => ({
            name: a.name,
            external_account_id: a.external_account_id,
            connected_at: a.connected_at,
            is_active: a.is_active,
          })),
        });
      },

      getPosActionState: () => {
        const { accounts, workspaceIsActive } = dataRef.current;

        const hasActiveAccount = accounts.some((a) => a.is_active);

        // canConnect: admin role is enforced by middleware; workspace must be active.
        const canConnect = workspaceIsActive;

        let hint: string;
        if (!workspaceIsActive) {
          hint = "Arbeidsplassen er ikke aktiv — POS-tilkobling er ikke tilgjengelig.";
        } else if (!hasActiveAccount) {
          hint = "Ingen aktive POS-kontoer. Bruk 'Koble til Lightspeed'-knappen for å koble til.";
        } else {
          hint = "Aktiv POS-konto koblet til. Du kan legge til flere via modalvinduet.";
        }

        return JSON.stringify({
          ok: true,
          canConnect,
          hasActiveAccount,
          hint,
        });
      },
    }),
    [],
  );

  return useMemo(() => ({ definitions, implementations }), [definitions, implementations]);
}
