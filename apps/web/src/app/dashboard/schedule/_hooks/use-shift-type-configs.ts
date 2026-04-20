/**
 * Hook to fetch department_shift_type_config rows for the active department.
 * Returns shift type configs with resolved names/colors from payroll.shift_type.
 * Used by the shift modal to populate the shift type dropdown and auto-fill defaults.
 *
 * Connected to: schedule-keys.ts (query keys)
 * Connected to: shift-modal.tsx (consumer)
 */

"use client";

import { useQuery } from "@tanstack/react-query";

import { useWorkspace } from "@/lib/workspace-context";
import { createClient } from "@smartout/supabase/client";

import { scheduleKeys } from "./schedule-keys";

/** Resolved shift type config with name/color from payroll.shift_type */
export type ShiftTypeConfig = {
  configId: string;
  shiftTypeId: string;
  label: string;
  shiftTypeName: string;
  shiftTypeColor: string | null;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  slotCount: number;
  sortOrder: number;
  departmentId: string;
  departmentName: string;
};

/**
 * Fetches all active shift type configs for the workspace, joined with
 * payroll.shift_type for names/colors and department for department names.
 * Used by the shift modal to populate the shift type dropdown.
 *
 * @returns Sorted list of shift type configs ready for the shift type selector.
 */
export function useShiftTypeConfigs() {
  const { workspace } = useWorkspace();
  const supabase = createClient();

  return useQuery({
    queryKey: scheduleKeys.shiftTypeConfigs(workspace.workspace_id, "all"),
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data: configs, error: configError } = await supabase
        .from("department_shift_type_config")
        .select(
          `
          id,
          department_id,
          shift_type_id,
          label,
          default_start_time,
          default_end_time,
          default_break_minutes,
          slot_count,
          sort_order
        `,
        )
        .eq("workspace_id", workspace.workspace_id)
        .eq("is_active", true)
        .order("sort_order");

      if (configError) throw configError;
      if (!configs || configs.length === 0) return [];

      const shiftTypeIds = [...new Set(configs.map((c) => c.shift_type_id))];
      const departmentIds = [...new Set(configs.map((c) => c.department_id))];

      const [shiftTypesRes, departmentsRes] = await Promise.all([
        supabase
          .schema("payroll")
          .from("shift_type")
          .select("id, name, color")
          .in("id", shiftTypeIds),
        supabase
          .from("department")
          .select("department_id, name")
          .in("department_id", departmentIds),
      ]);

      if (shiftTypesRes.error) throw shiftTypesRes.error;
      if (departmentsRes.error) throw departmentsRes.error;

      const stById = new Map((shiftTypesRes.data ?? []).map((st) => [st.id, st]));
      const deptById = new Map((departmentsRes.data ?? []).map((d) => [d.department_id, d.name]));

      return configs.map((cfg): ShiftTypeConfig => {
        const st = stById.get(cfg.shift_type_id);
        return {
          configId: cfg.id,
          shiftTypeId: cfg.shift_type_id,
          label: cfg.label,
          shiftTypeName: st?.name ?? cfg.label,
          shiftTypeColor: st?.color ?? null,
          startTime: cfg.default_start_time.slice(0, 5),
          endTime: cfg.default_end_time.slice(0, 5),
          breakMinutes: cfg.default_break_minutes,
          slotCount: cfg.slot_count,
          sortOrder: cfg.sort_order,
          departmentId: cfg.department_id,
          departmentName: deptById.get(cfg.department_id) ?? "",
        };
      });
    },
  });
}
