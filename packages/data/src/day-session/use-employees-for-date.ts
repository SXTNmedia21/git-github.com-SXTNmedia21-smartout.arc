/**
 * useEmployeesForDate — the real roster on a given day (ADR-0367 D6).
 *
 * PLAN-4a: the Manager Timeline previously derived "employees" from task
 * assignees only (role "—", no shift window). This hook reads the day's
 * published schedule_shift rows joined to profile (display_name, role) and
 * exposes each employee's shift window + area (department) so bands can render
 * the real EmpStrip and the rail can derive on-shift counts.
 *
 * Lives in packages/data per ADR-0133 mobile-parity (web is the only consumer
 * today; the logic is shareable). Workspace scope enforced by RLS.
 */

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";

/** One rostered employee for the day. */
export type RosterEmployee = {
  /** profile_id (the assignee key the timeline uses for emp matching). */
  id: string;
  name: string;
  role: string;
  /** department_id — the band/area this shift belongs to (D6). */
  area: string;
  /** [start "HH:MM", end "HH:MM"] wall-clock window. */
  shift: [string, string];
};

export const rosterKeys = {
  forDate: (workspaceId: string, dateISO: string) =>
    ["day-session", "roster", workspaceId, dateISO] as const,
};

type RawRosterRow = {
  schedule_shift_id: string;
  employee_id: string | null;
  department_id: string | null;
  start_time: string;
  end_time: string;
  profile: { display_name: string | null; role: string | null } | null;
};

async function fetchEmployeesForDate(
  workspaceId: string,
  dateISO: string,
): Promise<RosterEmployee[]> {
  // L-0177: fail fast — never silently resolve the wrong workspace.
  if (!workspaceId) throw new Error("useEmployeesForDate: workspaceId required");
  if (!dateISO) throw new Error("useEmployeesForDate: dateISO required");

  const supabase = createClient();

  const { data, error } = await supabase
    .from("schedule_shift")
    .select(
      `
      schedule_shift_id,
      employee_id,
      department_id,
      start_time,
      end_time,
      profile:employee_id ( display_name, role )
      `.trim(),
    )
    .eq("workspace_id", workspaceId)
    .eq("shift_date", dateISO)
    .eq("is_published", true);

  if (error) throw new Error(error.message);

  const rows = (data ?? []) as unknown as RawRosterRow[];

  // One entry per assigned employee. Unassigned shifts (no employee_id) are not
  // roster members — they surface as unassigned wells in the chart, not the strip.
  const byEmployee = new Map<string, RosterEmployee>();
  for (const r of rows) {
    if (!r.employee_id || !r.department_id) continue;
    // Keep the first shift per employee for the strip (V1: one band per emp/day).
    if (byEmployee.has(r.employee_id)) continue;
    byEmployee.set(r.employee_id, {
      id: r.employee_id,
      name: r.profile?.display_name ?? "Ukjent",
      role: r.profile?.role ?? "—",
      area: r.department_id,
      shift: [r.start_time.slice(0, 5), r.end_time.slice(0, 5)],
    });
  }

  return Array.from(byEmployee.values());
}

/** Hook: real roster for the workspace + date. */
export function useEmployeesForDate(workspaceId: string | null | undefined, dateISO: string) {
  return useQuery({
    queryKey: rosterKeys.forDate(workspaceId ?? "", dateISO),
    enabled: !!workspaceId && !!dateISO,
    staleTime: 30 * 1000,
    queryFn: () => fetchEmployeesForDate(workspaceId!, dateISO),
  });
}
