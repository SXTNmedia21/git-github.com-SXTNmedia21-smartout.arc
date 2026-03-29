"use client";

/**
 * summary-tools.ts — Emma's tool kit for the ConfirmSummary step.
 *
 * Provides tools to read the full onboarding state and finalize by
 * calling next(), which triggers onComplete in the wizard definition.
 * Mirrors finalizeOnboarding from Botsson.
 */

import { useMemo } from "react";
import type {
  ClientToolDefinition,
  ClientToolImplementation,
  ClientToolKit,
} from "@smartout/agent-sdk";
import { useSyncRef, useWizardToolKit } from "@/lib/wizard-tools/shared";
import type { OnboardingConfirmState } from "../../types-v2";

export function useSummaryTools(
  state: OnboardingConfirmState,
  updateState: (patch: Partial<OnboardingConfirmState>) => void,
  next: () => void | Promise<void>,
  back: () => void,
): ClientToolKit {
  const stateRef = useSyncRef(state);
  // updateState not used in summary — included for consistent signature
  void useSyncRef(updateState);
  const nextRef = useSyncRef(next);
  const backRef = useSyncRef(back);

  const definitions = useMemo<ClientToolDefinition[]>(
    () => [
      {
        temporaryTool: {
          modelToolName: "get_onboarding_summary",
          description:
            "Get a full summary of everything the user has confirmed: business info, departments, locations, procedures, and professions.",
          dynamicParameters: [],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "finalize_onboarding",
          description:
            "Finalize the onboarding and activate the workspace. Call this only when the user confirms they are ready. Triggers workspace activation and redirects to the dashboard.",
          dynamicParameters: [],
          client: {},
        },
      },
    ],
    [],
  );

  const implementations = useMemo<Record<string, ClientToolImplementation>>(
    () => ({
      get_onboarding_summary: () => {
        const s = stateRef.current;
        const b = s.business;

        const selectedDepts = s.departments.filter((d) => d.selected);
        const selectedProcs = s.procedures.filter((p) => p.selected);
        const totalZones = s.locations.reduce((sum, loc) => sum + loc.zones.length, 0);

        const professionSummary = s.professions
          .filter((p) => p.positions.some((pos) => pos.selected))
          .map((p) => {
            const selected = p.positions.filter((pos) => pos.selected);
            return `${p.name}: ${selected.map((pos) => pos.name).join(", ")}`;
          });

        const lines = [
          `Business: "${b.name || "(not set)"}" | Org: ${b.orgNumber || "unknown"} | City: ${b.city || "unknown"} | Industry: ${b.industry || "unknown"}`,
          `Departments: ${selectedDepts.length} selected — ${selectedDepts.map((d) => d.name).join(", ") || "none"}`,
          `Locations: ${s.locations.length} total, ${totalZones} zone(s) — ${s.locations.map((l) => l.name).join(", ") || "none"}`,
          `Procedures: ${selectedProcs.length} enabled — ${selectedProcs.map((p) => p.name).join(", ") || "none"}`,
          professionSummary.length > 0
            ? `Professions: ${professionSummary.join(" | ")}`
            : "Professions: none configured",
        ];

        return lines.join("\n");
      },

      finalize_onboarding: async () => {
        try {
          await nextRef.current?.();
          return "Onboarding finalized. Activating workspace and redirecting to dashboard.";
        } catch (err) {
          const message = err instanceof Error ? err.message : "Unknown error";
          return `Error finalizing onboarding: ${message}`;
        }
      },
    }),
    [],
  );

  return useWizardToolKit(definitions, implementations, nextRef, backRef);
}
