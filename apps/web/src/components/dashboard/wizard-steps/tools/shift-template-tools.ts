"use client";

import { useMemo } from "react";
import type { ClientToolDefinition, ClientToolImplementation, ClientToolKit } from "@smartout/agent-sdk";
import { useSyncRef } from "@/lib/wizard-tools/shared";

type TemplateEntry = {
  id: string;
  departmentName: string;
  name: string;
  startTime: string;
  endTime: string;
};

type SavedTemplate = {
  schedule_template_id: string;
  name: string;
  department: string | null;
};

/**
 * Tools Emma can use on the Shift Template setup step.
 *
 * Reads/writes via refs — never captures state in closure.
 * No nav tools — this step has custom props, not WizardStepProps.
 */
export function useShiftTemplateTools(
  pendingEntries: TemplateEntry[],
  savedTemplates: SavedTemplate[],
  departments: { department_id: string; name: string }[],
  onAddEntry: (departmentName: string, name: string, startTime: string, endTime: string) => void,
): ClientToolKit {
  const pendingRef = useSyncRef(pendingEntries);
  const savedRef = useSyncRef(savedTemplates);
  const departmentsRef = useSyncRef(departments);
  const onAddRef = useSyncRef(onAddEntry);

  const definitions = useMemo<ClientToolDefinition[]>(
    () => [
      {
        temporaryTool: {
          modelToolName: "add_shift_template",
          description:
            "Add a new shift template for a department. Times use HH:MM format. " +
            "Call get_shift_status first to see available departments.",
          dynamicParameters: [
            {
              name: "departmentName",
              location: "PARAMETER_LOCATION_BODY" as const,
              schema: { type: "string", description: "Department name" },
              required: true,
            },
            {
              name: "templateName",
              location: "PARAMETER_LOCATION_BODY" as const,
              schema: { type: "string", description: "Template name, e.g. 'Dagvakt'" },
              required: true,
            },
            {
              name: "startTime",
              location: "PARAMETER_LOCATION_BODY" as const,
              schema: { type: "string", description: "Start time (HH:MM), e.g. '07:00'" },
              required: true,
            },
            {
              name: "endTime",
              location: "PARAMETER_LOCATION_BODY" as const,
              schema: { type: "string", description: "End time (HH:MM), e.g. '15:00'" },
              required: true,
            },
          ],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "get_shift_status",
          description:
            "Get current shift template status: departments, saved templates, and pending unsaved entries.",
          dynamicParameters: [],
          client: {},
        },
      },
    ],
    [],
  );

  const implementations = useMemo<Record<string, ClientToolImplementation>>(
    () => ({
      add_shift_template: (params) => {
        const p = params as Record<string, string>;
        const deptInput = p.departmentName?.trim();
        const name = p.templateName?.trim();
        const start = p.startTime?.trim();
        const end = p.endTime?.trim();

        if (!deptInput || !name || !start || !end) {
          return "Error: departmentName, templateName, startTime, and endTime are all required.";
        }

        const depts = departmentsRef.current;
        const dept = depts.find(
          (d) => d.name.toLowerCase() === deptInput.toLowerCase(),
        );
        if (!dept) {
          return (
            `Department "${deptInput}" not found. Available: ` +
            `${depts.map((d) => d.name).join(", ") || "none yet"}.`
          );
        }

        onAddRef.current(dept.name, name, start, end);
        return `Shift template "${name}" added for department "${dept.name}" (${start}–${end}). Click Save to persist.`;
      },
      get_shift_status: () => {
        const depts = departmentsRef.current;
        const saved = savedRef.current;
        const pending = pendingRef.current;

        if (depts.length === 0) {
          return "No departments set up yet. Complete the department step first.";
        }

        const savedByDept = depts.map((d) => {
          const count = saved.filter((t) => t.department === d.name).length;
          return `${d.name}: ${count} saved`;
        });

        const pendingCount = pending.filter((e) => e.name.trim()).length;
        return (
          `Departments: ${savedByDept.join(", ")}. ` +
          `Pending (unsaved): ${pendingCount}.`
        );
      },
    }),
    [],
  );

  return useMemo(() => ({ definitions, implementations }), [definitions, implementations]);
}
