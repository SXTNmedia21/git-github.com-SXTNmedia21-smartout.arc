"use client";

/**
 * procedures-tools.ts — Emma's tool kit for the ConfirmProcedures step.
 *
 * Provides tools to toggle procedures by name and get a status summary.
 * Mirrors addProcedures from Botsson but uses updateState() instead of
 * direct callbacks. Recommended procedures can be toggled — the UI
 * handles the deselect-warning separately.
 */

import { useMemo } from "react";
import type {
  ClientToolDefinition,
  ClientToolImplementation,
  ClientToolKit,
} from "@smartout/agent-sdk";
import { useSyncRef, useWizardToolKit } from "@/lib/wizard-tools/shared";
import type { OnboardingConfirmState } from "../../types-v2";

export function useProceduresTools(
  state: OnboardingConfirmState,
  updateState: (patch: Partial<OnboardingConfirmState>) => void,
  next: () => void | Promise<void>,
  back: () => void,
): ClientToolKit {
  const stateRef = useSyncRef(state);
  const updateRef = useSyncRef(updateState);
  const nextRef = useSyncRef(next);
  const backRef = useSyncRef(back);

  const definitions = useMemo<ClientToolDefinition[]>(
    () => [
      {
        temporaryTool: {
          modelToolName: "toggle_procedure",
          description:
            "Enable or disable a procedure by name. Existing procedures are toggled; unknown names are added as new custom procedures (selected by default). Example: 'Temperaturkontroll'",
          dynamicParameters: [
            {
              name: "name",
              location: "PARAMETER_LOCATION_BODY" as const,
              schema: { type: "string", description: "Procedure name to toggle" },
              required: true,
            },
          ],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "get_procedures_status",
          description: "Get a summary of all procedures: selected count, total count, and names.",
          dynamicParameters: [],
          client: {},
        },
      },
    ],
    [],
  );

  const implementations = useMemo<Record<string, ClientToolImplementation>>(
    () => ({
      toggle_procedure: (params) => {
        const p = params as Record<string, string>;
        const name = p.name?.trim();
        if (!name) return "Error: name is required.";

        const procs = stateRef.current.procedures;
        const existing = procs.find((p) => p.name.toLowerCase() === name.toLowerCase());

        if (existing) {
          const newState = !existing.selected;
          updateRef.current({
            procedures: procs.map((proc) =>
              proc.id === existing.id ? { ...proc, selected: newState } : proc,
            ),
          });
          return `Procedure "${existing.name}" is now ${newState ? "enabled" : "disabled"}.`;
        }

        // Add as a new custom procedure
        const newProc = {
          id: `proc-custom-${Date.now()}-${procs.length}`,
          name,
          selected: true,
          isCustom: true,
        };
        updateRef.current({ procedures: [...procs, newProc] });
        return `Added new procedure "${name}" (enabled).`;
      },

      get_procedures_status: () => {
        const procs = stateRef.current.procedures;
        if (procs.length === 0) return "No procedures configured yet.";
        const selected = procs.filter((p) => p.selected);
        const lines = procs.map(
          (p) =>
            `• ${p.name}${p.recommended ? " [anbefalt]" : ""}${p.isCustom ? " [egendefinert]" : ""} — ${p.selected ? "enabled" : "disabled"}`,
        );
        return `Procedures: ${selected.length}/${procs.length} enabled.\n${lines.join("\n")}`;
      },
    }),
    [],
  );

  return useWizardToolKit(definitions, implementations, nextRef, backRef);
}
