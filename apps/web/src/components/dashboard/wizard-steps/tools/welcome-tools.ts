"use client";

import { useMemo } from "react";
import type { ClientToolDefinition, ClientToolImplementation, ClientToolKit } from "@smartout/agent-sdk";

/**
 * Tools Emma can use on the Welcome step.
 *
 * WelcomeStep has no local state — it just displays value props.
 * The single read-only tool lets Emma explain to the user what Smartout does.
 * No nav tools — this step has custom props, not WizardStepProps.
 */
export function useWelcomeTools(): ClientToolKit {
  const definitions = useMemo<ClientToolDefinition[]>(
    () => [
      {
        temporaryTool: {
          modelToolName: "get_setup_status",
          description: "Get a summary of what Smartout does and what the setup wizard covers.",
          dynamicParameters: [],
          client: {},
        },
      },
    ],
    [],
  );

  const implementations = useMemo<Record<string, ClientToolImplementation>>(
    () => ({
      get_setup_status: () => {
        return (
          "Welcome to Smartout setup. The wizard covers: " +
          "1) Document upload to pre-fill data, " +
          "2) Governance policies, " +
          "3) Payroll & tariff, " +
          "4) Employment types, " +
          "5) Team invites, " +
          "6) Shift templates, " +
          "7) Season setup, " +
          "8) Employee handbook. " +
          "Ask the user if they're ready to start."
        );
      },
    }),
    [],
  );

  return useMemo(() => ({ definitions, implementations }), [definitions, implementations]);
}
