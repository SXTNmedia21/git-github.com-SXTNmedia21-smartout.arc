"use client";

/**
 * use-tariff-tools.ts — Botsson tools for /dashboard/payroll/tariff.
 *
 * Three read-only tools:
 *   getCurrentTariffBinding  — returns active union binding details
 *   changeTariffBinding      — no-op stub; ADR-0244 blocks financial mutations
 *   addSupplementOverride    — no-op stub; ADR-0244 blocks financial mutations
 *
 * Why read-only:
 *   ADR-0244 prohibits Botsson from mutating financial state. Tariff binding
 *   changes and supplement overrides are admin-driven explicit actions — the
 *   human uses the form on the page. Botsson reads the current state and
 *   describes what actions are AVAILABLE (not blocked), but never fires them.
 *
 * dataRef pattern (Phase 7.5 §1): definitions are stable (useMemo([], []));
 * implementations read live state via dataRef refreshed each render.
 *
 * ADR-0238: page does not own a domain chat surface.
 * ADR-0151: workspace_id is workspace-context derived, never from client body.
 * ADR-0357: part of Phase 7 tool-registration requirement.
 */

import { useEffect, useMemo, useRef } from "react";
import type {
  ClientToolDefinition,
  ClientToolImplementation,
  ClientToolKit,
} from "@smartout/agent-sdk";

/* ━━━ Input contract ━━━━━━━━━━━━━━━━━━━━━━━━ */

export type TariffToolInput = {
  /** Whether the tariff data is still loading. */
  isLoading: boolean;
  /** Whether the workspace has an active tariff binding. */
  isBound: boolean;
  /** Union name for the current binding. Null when not bound. */
  unionName: string | null;
  /** Riksavtalen / overenskomst version. Null when not bound. */
  lawVersion: string | null;
  /** ISO date the current binding took effect. Null when not bound. */
  effectiveFrom: string | null;
  /** Whether the current user has admin role (can change binding). */
  isAdmin: boolean;
};

/* ━━━ Hook ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

export function useTariffTools(input: TariffToolInput): ClientToolKit {
  const dataRef = useRef<TariffToolInput>(input);
  useEffect(() => {
    dataRef.current = input;
  });

  const definitions = useMemo<ClientToolDefinition[]>(
    () => [
      {
        temporaryTool: {
          modelToolName: "getCurrentTariffBinding",
          description:
            "Get the current tariff binding for this workspace — union name, law version, effective date, and paragraf references. Call first when the user asks 'hvilken tariff er vi på?', 'hva er tariffversjon?', or 'vis tariffbinding'.",
          dynamicParameters: [
            {
              name: "includeHistory",
              location: "PARAMETER_LOCATION_BODY" as const,
              schema: {
                type: "boolean",
                description:
                  "Set to true to indicate that the user also wants historical binding changes.",
              },
              required: false,
            },
          ],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "changeTariffBinding",
          description:
            "Change (or set up) the workspace tariff binding. Requires admin role. Use when the user says 'bytt tariff', 'oppdater overenskomst', 'ny tariffversjon', or 'endre tariffbinding'. Requires: union_id (UUID), law_version, official_effective_date.",
          dynamicParameters: [
            {
              name: "union_id",
              location: "PARAMETER_LOCATION_BODY" as const,
              schema: {
                type: "string",
                description: "UUID of the union / overenskomst to bind to.",
              },
              required: true,
            },
          ],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "addSupplementOverride",
          description:
            "Add a workspace-level supplement override on top of the tariff baseline. Use when the user says 'legg til tillegg', 'kveldstillegg', 'helgetillegg', or 'lokalt tillegg'. The supplement cannot be set below the tariff floor.",
          dynamicParameters: [
            {
              name: "supplement_name",
              location: "PARAMETER_LOCATION_BODY" as const,
              schema: {
                type: "string",
                description: "Name of the supplement override to add (e.g. 'Kveldstillegg').",
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
      getCurrentTariffBinding: () => {
        const d = dataRef.current;
        if (d.isLoading) {
          return Promise.resolve(JSON.stringify({ ok: false, reason: "Laster tariffdata…" }));
        }
        if (!d.isBound) {
          return Promise.resolve(
            JSON.stringify({
              ok: true,
              isBound: false,
              hint: "Ingen tariffbinding er satt opp for denne arbeidsplassen. Bruk 'Sett opp tariffbinding'-skjemaet på siden for å koble til en overenskomst.",
            }),
          );
        }
        return Promise.resolve(
          JSON.stringify({
            ok: true,
            isBound: true,
            unionName: d.unionName,
            lawVersion: d.lawVersion,
            effectiveFrom: d.effectiveFrom,
          }),
        );
      },

      // ADR-0244: financial mutations are human-driven only — Botsson describes
      // the action and directs the user to the on-page form.
      changeTariffBinding: () => {
        const d = dataRef.current;
        if (!d.isAdmin) {
          return Promise.resolve(
            JSON.stringify({
              ok: false,
              reason: "Kun admin kan endre tariffbinding. Ta kontakt med en administrator.",
            }),
          );
        }
        return Promise.resolve(
          JSON.stringify({
            ok: false,
            reason:
              "Tariffbytter er en sensitiv finansiell operasjon som krever manuell bekreftelse. Bruk 'Endre tariffbinding'-skjemaet på siden for å gjøre endringen.",
            canChange: true,
            hint: "Fyll inn tariffskjemaet nedenfor for å fullføre byttet.",
          }),
        );
      },

      // ADR-0244: same as changeTariffBinding — no financial mutations via Botsson.
      addSupplementOverride: () => {
        const d = dataRef.current;
        if (!d.isAdmin) {
          return Promise.resolve(
            JSON.stringify({
              ok: false,
              reason: "Kun admin kan legge til tillegg. Ta kontakt med en administrator.",
            }),
          );
        }
        return Promise.resolve(
          JSON.stringify({
            ok: false,
            reason:
              "Tillegg legges til via 'Legg til tillegg'-skjemaet på siden. Merk at tillegget ikke kan settes under tariffgulvet.",
            canAdd: true,
            hint: "Bruk skjemaet nedenfor for å legge til et lokalt tillegg.",
          }),
        );
      },
    }),
    [],
  );

  return useMemo(() => ({ definitions, implementations }), [definitions, implementations]);
}
