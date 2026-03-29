"use client";

/**
 * departments-tools.ts — Emma's tool kit for the ConfirmDepartments step.
 *
 * Provides tools to add departments by name, toggle selection, and
 * get a status summary. Mirrors addDepartments from Botsson but
 * uses updateState() instead of direct callbacks.
 */

import { useMemo } from "react";
import type {
  ClientToolDefinition,
  ClientToolImplementation,
  ClientToolKit,
} from "@smartout/agent-sdk";
import { useSyncRef, useWizardToolKit } from "@/lib/wizard-tools/shared";
import type { OnboardingConfirmState } from "../../types-v2";

export function useDepartmentsTools(
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
          modelToolName: "add_departments",
          description:
            'Add departments by name. Pass a JSON array of department name strings, e.g. ["Kjøkken", "Bar", "Sal"]. Existing suggestions are enabled; new names are created.',
          dynamicParameters: [
            {
              name: "names",
              location: "PARAMETER_LOCATION_BODY" as const,
              schema: { type: "string", description: "JSON array of department name strings" },
              required: true,
            },
          ],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "toggle_department",
          description:
            "Toggle a department's selected state by its ID. Use get_departments_status to see available IDs.",
          dynamicParameters: [
            {
              name: "id",
              location: "PARAMETER_LOCATION_BODY" as const,
              schema: { type: "string", description: "Department ID to toggle" },
              required: true,
            },
          ],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "get_departments_status",
          description: "Get a summary of all departments: which are selected, total count.",
          dynamicParameters: [],
          client: {},
        },
      },
    ],
    [],
  );

  const implementations = useMemo<Record<string, ClientToolImplementation>>(
    () => ({
      add_departments: (params) => {
        const p = params as Record<string, string>;
        if (!p.names) return "Error: names is required.";

        let names: string[];
        try {
          names = JSON.parse(p.names) as string[];
        } catch {
          return "Error: names must be a valid JSON array of strings.";
        }
        if (!Array.isArray(names) || names.length === 0) {
          return "Error: names must be a non-empty array.";
        }

        const current = stateRef.current.departments;
        const updated = [...current];

        for (const name of names) {
          const trimmed = name.trim();
          if (!trimmed) continue;

          // Enable existing suggestion if it matches by name (case-insensitive)
          const existing = updated.find((d) => d.name.toLowerCase() === trimmed.toLowerCase());
          if (existing) {
            existing.selected = true;
          } else {
            // Add new custom department
            const id = `custom-${Date.now()}-${updated.length}`;
            updated.push({ id, name: trimmed, icon: "plus", selected: true, positions: [] });
          }
        }

        updateRef.current({ departments: updated });
        return `Added/enabled ${names.length} department(s): ${names.join(", ")}.`;
      },

      toggle_department: (params) => {
        const p = params as Record<string, string>;
        const id = p.id?.trim();
        if (!id) return "Error: id is required.";

        const depts = stateRef.current.departments;
        const target = depts.find((d) => d.id === id);
        if (!target)
          return `Error: no department with id "${id}". Use get_departments_status to see available departments.`;

        updateRef.current({
          departments: depts.map((d) => (d.id === id ? { ...d, selected: !d.selected } : d)),
        });
        return `Department "${target.name}" is now ${!target.selected ? "selected" : "deselected"}.`;
      },

      get_departments_status: () => {
        const depts = stateRef.current.departments;
        if (depts.length === 0) return "No departments configured yet.";
        const selected = depts.filter((d) => d.selected);
        const lines = depts.map(
          (d) => `• ${d.name} (id: ${d.id}) — ${d.selected ? "selected" : "not selected"}`,
        );
        return `Departments: ${selected.length}/${depts.length} selected.\n${lines.join("\n")}`;
      },
    }),
    [],
  );

  return useWizardToolKit(definitions, implementations, nextRef, backRef);
}
