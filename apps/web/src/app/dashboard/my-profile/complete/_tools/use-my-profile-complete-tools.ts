"use client";

/**
 * use-my-profile-complete-tools.ts — Botsson tools for the
 * /dashboard/my-profile/complete surface (employee self-service PII intake).
 *
 * Three read-only status tools. NO write tools, NO value-exposing tools.
 *
 *   getCompleteProfileStatus     — overall state: submitted | filling | unsupported
 *   getCompleteProfileFieldState — per-field filled flag (boolean only, no values)
 *   getCompleteProfileFieldHelp  — explains what each field is and why it's needed
 *
 * PII handling (ADR-0077):
 *   The form collects personnummer + address. These are sensitive PII fields.
 *   Tools NEVER return the actual values — only boolean filled-state. Botsson
 *   must not echo a personnummer back through agent context, and a leaked
 *   tool-result containing the value would be the same class of leak.
 *
 * Channel restriction (ADR-0078):
 *   This surface is chat-only — voice is forbidden. Tool descriptions are
 *   safe-by-default text only; no voice-specific guidance.
 *
 * Submit happens via the form's own ctaClick handler (`submit_own_pii` RPC).
 * Botsson does not have a "submit my PII" tool — the human must press the
 * button. No unilateral mutation surface for PII.
 *
 * ADR-0238: page does not own a domain chat surface. Orb interactive mode.
 *
 * dataRef pattern: stable definitions (useMemo []), live reads from ref each
 * invocation. Same as use-my-cv-tools.ts and use-my-contract-tools.ts.
 */

import { useEffect, useMemo, useRef } from "react";
import type {
  ClientToolDefinition,
  ClientToolImplementation,
  ClientToolKit,
} from "@smartout/agent-sdk";

/* ━━━ Types ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

export type MyProfileCompleteToolInput = {
  /** True once the employee has submitted their data. */
  submitted: boolean;
  /** True while the form is mid-submit (RPC in flight). */
  submitting: boolean;
  /** Per-field filled state — boolean only. NEVER include actual values here. */
  fields: {
    personalNumberFilled: boolean;
    addressFilled: boolean;
    postalCodeFilled: boolean;
    cityFilled: boolean;
  };
};

/* ━━━ Hook ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

export function useMyProfileCompleteTools(input: MyProfileCompleteToolInput): ClientToolKit {
  const dataRef = useRef(input);
  useEffect(() => {
    dataRef.current = input;
  });

  const definitions = useMemo<ClientToolDefinition[]>(
    () => [
      {
        temporaryTool: {
          modelToolName: "getCompleteProfileStatus",
          description:
            "Get the overall state of the profile-completion form — submitted, filling (any field has content), or empty. Use as the first tool when the user asks 'er jeg ferdig?', 'hva mangler?', 'har jeg sendt inn?', or anything about their PII-intake progress.",
          dynamicParameters: [],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "getCompleteProfileFieldState",
          description:
            "Get per-field filled-state for the PII intake form. Returns only booleans — never the actual personnummer, address, postnummer, or by. Use when the user asks 'hvilke felt mangler?' or 'har jeg fylt ut adressen?'. PRIVACY: do not echo back the values themselves to the user — only confirm what is filled.",
          dynamicParameters: [],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "getCompleteProfileFieldHelp",
          description:
            "Explain what each field on the profile-completion form is and why it is required for the employment contract. Use when the user asks 'hva er personnummer til?', 'hvorfor trenger dere adressen min?', or 'hva må jeg fylle inn?'.",
          dynamicParameters: [],
          client: {},
        },
      },
    ],
    [],
  );

  const implementations = useMemo<Record<string, ClientToolImplementation>>(
    () => ({
      getCompleteProfileStatus: () => {
        const d = dataRef.current;
        if (d.submitted) {
          return Promise.resolve(
            JSON.stringify({
              ok: true,
              status: "submitted",
              hint: "Informasjonen er sendt inn. Siden kan lukkes.",
            }),
          );
        }
        if (d.submitting) {
          return Promise.resolve(JSON.stringify({ ok: true, status: "submitting" }));
        }
        const f = d.fields;
        const filledCount =
          (f.personalNumberFilled ? 1 : 0) +
          (f.addressFilled ? 1 : 0) +
          (f.postalCodeFilled ? 1 : 0) +
          (f.cityFilled ? 1 : 0);
        return Promise.resolve(
          JSON.stringify({
            ok: true,
            status: filledCount > 0 ? "filling" : "empty",
            filledCount,
            totalFields: 4,
            hint:
              filledCount > 0
                ? "Trykk 'Send inn' når alle felt er klare."
                : "Fyll inn så mye du kan — alle felt er valgfrie, men vi trenger dem for kontrakten.",
          }),
        );
      },

      getCompleteProfileFieldState: () => {
        const d = dataRef.current;
        return Promise.resolve(
          JSON.stringify({
            ok: true,
            fields: {
              personalNumber: { filled: d.fields.personalNumberFilled },
              address: { filled: d.fields.addressFilled },
              postalCode: { filled: d.fields.postalCodeFilled },
              city: { filled: d.fields.cityFilled },
            },
            note: "Verdier vises ikke i agent-konteksten av personvernhensyn.",
          }),
        );
      },

      getCompleteProfileFieldHelp: () => {
        return Promise.resolve(
          JSON.stringify({
            ok: true,
            fields: [
              {
                key: "personalNumber",
                label: "Personnummer",
                purpose:
                  "Brukes for å identifisere deg entydig i arbeidskontrakten og for A-meldingen til Skatteetaten. 11 siffer.",
              },
              {
                key: "address",
                label: "Adresse",
                purpose:
                  "Gateadresse hvor du bor. Brukes i kontrakten og for ev. utsending av lønnsgrunnlag/dokumenter.",
              },
              {
                key: "postalCode",
                label: "Postnummer",
                purpose: "4-sifret postnummer som hører til adressen.",
              },
              {
                key: "city",
                label: "Poststed",
                purpose: "By eller tettsted som hører til postnummeret.",
              },
            ],
          }),
        );
      },
    }),
    [],
  );

  return useMemo(() => ({ definitions, implementations }), [definitions, implementations]);
}
