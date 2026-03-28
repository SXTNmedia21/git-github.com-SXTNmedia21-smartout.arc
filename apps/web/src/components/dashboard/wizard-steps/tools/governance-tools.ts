"use client";

import { useMemo } from "react";
import type { ClientToolDefinition, ClientToolImplementation, ClientToolKit } from "@smartout/agent-sdk";
import { useSyncRef } from "@/lib/wizard-tools/shared";
import type { FilterKey } from "@/app/dashboard/governance/_hooks/use-governance-templates";

/**
 * Tools Emma can use on the Governance setup step.
 *
 * Reads/writes via refs — never captures state in closure.
 * No nav tools — this step has custom props, not WizardStepProps.
 */
export function useGovernanceTools(
  filters: Record<FilterKey, boolean>,
  createdCount: number,
  totalCount: number,
  onFilterToggle: (key: FilterKey) => void,
): ClientToolKit {
  const filtersRef = useSyncRef(filters);
  const createdCountRef = useSyncRef(createdCount);
  const totalCountRef = useSyncRef(totalCount);
  const onFilterToggleRef = useSyncRef(onFilterToggle);

  const definitions = useMemo<ClientToolDefinition[]>(
    () => [
      {
        temporaryTool: {
          modelToolName: "set_filter",
          description:
            "Toggle a governance filter question on or off. " +
            "Valid keys: food, alcohol, overnight, delivery, nightwork, minors, foreignWorkers, cashHandling, tips.",
          dynamicParameters: [
            {
              name: "filterKey",
              location: "PARAMETER_LOCATION_BODY" as const,
              schema: {
                type: "string",
                description:
                  "Filter key to toggle: food | alcohol | overnight | delivery | nightwork | minors | foreignWorkers | cashHandling | tips",
              },
              required: true,
            },
            {
              name: "value",
              location: "PARAMETER_LOCATION_BODY" as const,
              schema: { type: "boolean", description: "True to enable, false to disable" },
              required: true,
            },
          ],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "get_governance_status",
          description: "Get current governance status: active filters and how many policies are activated.",
          dynamicParameters: [],
          client: {},
        },
      },
    ],
    [],
  );

  const implementations = useMemo<Record<string, ClientToolImplementation>>(
    () => ({
      set_filter: (params) => {
        const p = params as Record<string, unknown>;
        const key = p.filterKey as FilterKey;
        const value = p.value as boolean;

        const validKeys: FilterKey[] = [
          "food", "alcohol", "overnight", "delivery", "nightwork",
          "minors", "foreignWorkers", "cashHandling", "tips",
        ];
        if (!validKeys.includes(key)) {
          return `Error: unknown filter key "${key}". Valid keys: ${validKeys.join(", ")}.`;
        }

        const current = filtersRef.current[key];
        // Only toggle if the current value differs from the desired value
        if (current !== value) {
          onFilterToggleRef.current(key);
        }
        return `Filter "${key}" is now ${value ? "enabled" : "disabled"}.`;
      },
      get_governance_status: () => {
        const filters = filtersRef.current;
        const activeFilters = Object.entries(filters)
          .filter(([, v]) => v)
          .map(([k]) => k);
        const created = createdCountRef.current;
        const total = totalCountRef.current;
        return (
          `Governance status: ${created}/${total} policies activated. ` +
          `Active filters: ${activeFilters.length > 0 ? activeFilters.join(", ") : "none"}.`
        );
      },
    }),
    [],
  );

  return useMemo(() => ({ definitions, implementations }), [definitions, implementations]);
}
