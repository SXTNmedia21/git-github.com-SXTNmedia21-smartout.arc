"use client";

/**
 * use-website-setup-tools.ts — Botsson tools for /dashboard/website/setup.
 *
 * Two read-only tools:
 *
 *   getSetupStatus       — current wizard step, which steps are completed, missing prereqs
 *   getTemplateOptions   — available templates with name and type hint (no full template body)
 *
 * The setup wizard is a 3-step creation flow (template → customize → confirm).
 * No mutations are exposed — createWebsiteFromTemplate is a user-confirmed form action.
 *
 * Pattern follows use-year-wheel-tools.ts:
 *   - `useWebsiteSetupTools(input): ClientToolKit` exported
 *   - `dataRef = useRef(input)` refreshed every render via useEffect
 *   - definitions + implementations memoised on `[]`
 *
 * ADR-0238: /dashboard/website/setup has no embedded domain chat surface.
 * ADR-0151: workspace_id never passed as a prop — resolved server-side via RLS.
 */

import { useEffect, useMemo, useRef } from "react";
import type {
  ClientToolDefinition,
  ClientToolImplementation,
  ClientToolKit,
} from "@smartout/agent-sdk";

const PARAMETER_LOCATION_BODY = "PARAMETER_LOCATION_BODY" as const;

// ── Input type ────────────────────────────────────────────────────────────

export type WebsiteSetupToolInput = {
  /** Current wizard step. */
  currentStep: "template" | "customize" | "confirm";
  /** Whether a template has been selected. */
  templateSelected: boolean;
  /** Key of the selected template, or null. */
  templateKey: string | null;
  /** Whether the site name has been filled in. */
  hasName: boolean;
  /** Available template keys from the template gallery. */
  availableTemplates: Array<{ key: string; name: string }>;
};

// ── Helper ────────────────────────────────────────────────────────────────

const STEP_ORDER: Array<"template" | "customize" | "confirm"> = [
  "template",
  "customize",
  "confirm",
];

const STEP_LABELS: Record<string, string> = {
  template: "Velg mal (steg 1 av 3)",
  customize: "Tilpass utseende (steg 2 av 3)",
  confirm: "Bekreft og opprett (steg 3 av 3)",
};

// ── Hook ──────────────────────────────────────────────────────────────────

export function useWebsiteSetupTools(input: WebsiteSetupToolInput): ClientToolKit {
  const dataRef = useRef(input);
  useEffect(() => {
    dataRef.current = input;
  });

  const definitions = useMemo<ClientToolDefinition[]>(
    () => [
      {
        temporaryTool: {
          modelToolName: "getSetupStatus",
          description:
            "Get the current state of the website setup wizard — which step the user is on, which steps are completed, and what is missing before proceeding. Use when the user asks 'hvor langt er jeg?', 'hva gjenstår?', 'kan jeg gå videre?', or needs guidance in the wizard.",
          dynamicParameters: [],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "getTemplateOptions",
          description:
            "List available website templates with name and key. Use when the user asks 'hvilke maler finnes?', 'vis malalternativene', 'hva slags nettside kan jeg lage?'. Does NOT return full template content — names and keys only.",
          dynamicParameters: [],
          client: {},
        },
      },
    ],
    [],
  );

  const implementations = useMemo<Record<string, ClientToolImplementation>>(
    () => ({
      getSetupStatus: (_params: Record<string, unknown>): Promise<string> => {
        const d = dataRef.current;
        const currentIndex = STEP_ORDER.indexOf(d.currentStep);
        const completedSteps = STEP_ORDER.slice(0, currentIndex);

        const missingForCurrent: string[] = [];
        if (d.currentStep === "template" && !d.templateSelected) {
          missingForCurrent.push("Velg en mal for å gå videre til steg 2.");
        }
        if (d.currentStep === "customize" && !d.hasName) {
          missingForCurrent.push("Skriv inn et navn på nettsiden for å gå videre til steg 3.");
        }

        return Promise.resolve(
          JSON.stringify({
            current_step: d.currentStep,
            current_step_label: STEP_LABELS[d.currentStep],
            step_number: currentIndex + 1,
            total_steps: STEP_ORDER.length,
            completed_steps: completedSteps,
            template_selected: d.templateSelected,
            template_key: d.templateKey,
            has_name: d.hasName,
            missing_for_current_step: missingForCurrent.length > 0 ? missingForCurrent : null,
            ready_to_proceed: missingForCurrent.length === 0,
          }),
        );
      },

      getTemplateOptions: (_params: Record<string, unknown>): Promise<string> => {
        const d = dataRef.current;
        return Promise.resolve(
          JSON.stringify({
            count: d.availableTemplates.length,
            templates: d.availableTemplates,
            selected_key: d.templateKey,
          }),
        );
      },
    }),
    [],
  );

  return useMemo(() => ({ definitions, implementations }), [definitions, implementations]);
}
