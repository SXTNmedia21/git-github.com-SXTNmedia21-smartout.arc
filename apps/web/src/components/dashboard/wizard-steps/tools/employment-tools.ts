"use client";

import { useMemo } from "react";
import type { ClientToolDefinition, ClientToolImplementation, ClientToolKit } from "@smartout/agent-sdk";
import { useSyncRef } from "@/lib/wizard-tools/shared";

type EmploymentFormSummary = {
  type: string;
  label: string;
  enabled: boolean;
};

/**
 * Tools Emma can use on the Employment setup step.
 *
 * Reads/writes via refs — never captures state in closure.
 * No nav tools — this step has custom props, not WizardStepProps.
 */
export function useEmploymentTools(
  forms: EmploymentFormSummary[],
  onToggleByLabel: (label: string) => void,
): ClientToolKit {
  const formsRef = useSyncRef(forms);
  const onToggleRef = useSyncRef(onToggleByLabel);

  const definitions = useMemo<ClientToolDefinition[]>(
    () => [
      {
        temporaryTool: {
          modelToolName: "toggle_employment_type",
          description:
            "Enable or toggle an employment type by name. " +
            "Call get_employment_status first to see what types are available.",
          dynamicParameters: [
            {
              name: "typeName",
              location: "PARAMETER_LOCATION_BODY" as const,
              schema: { type: "string", description: "Employment type label, e.g. 'Fast heltid'" },
              required: true,
            },
          ],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "get_employment_status",
          description:
            "Get current employment types: which are enabled and which are available.",
          dynamicParameters: [],
          client: {},
        },
      },
    ],
    [],
  );

  const implementations = useMemo<Record<string, ClientToolImplementation>>(
    () => ({
      toggle_employment_type: (params) => {
        const p = params as Record<string, string>;
        const input = p.typeName?.trim().toLowerCase();
        if (!input) return "Error: typeName is required.";

        const forms = formsRef.current;
        const match = forms.find((f) => f.label.toLowerCase().includes(input));
        if (!match) {
          return (
            `Employment type "${p.typeName}" not found. Available: ` +
            `${forms.map((f) => f.label).join(", ")}.`
          );
        }
        onToggleRef.current(match.label);
        const newState = !match.enabled;
        return `Employment type "${match.label}" is now ${newState ? "enabled" : "disabled"}.`;
      },
      get_employment_status: () => {
        const forms = formsRef.current;
        const enabled = forms.filter((f) => f.enabled).map((f) => f.label);
        const disabled = forms.filter((f) => !f.enabled).map((f) => f.label);
        return (
          `Employment types — enabled (${enabled.length}): ${enabled.join(", ") || "none"}. ` +
          `Disabled (${disabled.length}): ${disabled.join(", ") || "none"}.`
        );
      },
    }),
    [],
  );

  return useMemo(() => ({ definitions, implementations }), [definitions, implementations]);
}
