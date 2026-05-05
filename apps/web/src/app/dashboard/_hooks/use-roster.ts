"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";
import { useWorkspaceOptional } from "@/lib/workspace-context";

export type RosterRow = {
  shiftId: string;
  employeeName: string;
  initials: string;
  role: string;
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  plannedHours: number;
  actualHours: number;
  status: "upcoming" | "active" | "completed";
  live: boolean;
  onBreak: boolean;
};

function toInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0] ?? "")
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function toHHMM(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toTimeString().slice(0, 5);
}

/**
 * Roster selector — joins `schedule_shift` against `timesheet.time_entry` to
 * produce the row shape RosterTab renders (planned vs actual hours, live
 * clocked-in state). Department-scoped.
 */
export function useRoster(departmentId: string | null, dateISO: string) {
  const ctx = useWorkspaceOptional();
  const wsId = ctx?.workspace.workspace_id;

  return useQuery({
    queryKey: ["day-control", "roster", wsId, departmentId, dateISO],
    enabled: !!wsId && !!departmentId,
    staleTime: 20 * 1000,
    queryFn: async (): Promise<RosterRow[]> => {
      const supabase = createClient();

      // Per memory L-`useRoster`-deptfilter: `schedule_shift.department_id`
      // is denormalized and often NULL. Canonical dept link goes through
      // `position_id → position.department_id`. Filtering on the inner
      // join recovers shifts that have no department_id but a position.
      const { data: shifts, error: shiftErr } = await supabase
        .from("schedule_shift")
        .select(
          `
          schedule_shift_id, shift_date, start_time, end_time, work_hours, status, role, employee_id,
          employee:profile!employee_id(display_name),
          position!inner(department_id)
        `,
        )
        .eq("workspace_id", wsId!)
        .eq("position.department_id", departmentId!)
        .eq("shift_date", dateISO)
        .order("start_time", { ascending: true });

      if (shiftErr) throw shiftErr;

      if (!shifts || shifts.length === 0) return [];

      // Pull today's time_entry rows so we can attach actual clock-in state.
      // Column names per migrations: `shift_id` FK (not schedule_shift_id),
      // `punch_in` / `punch_out` timestamps (not started_at/ended_at).
      const shiftIds = shifts.map((s) => s.schedule_shift_id);
      const { data: entries, error: entryErr } = await supabase
        .schema("timesheet")
        .from("time_entry")
        .select("shift_id, status, punch_in, punch_out, breaks")
        .in("shift_id", shiftIds);

      if (entryErr) throw entryErr;

      const entryByShift = new Map((entries ?? []).map((e) => [e.shift_id, e] as const));

      return shifts.map((s) => {
        const employee = s.employee as unknown as { display_name: string } | null;
        const name = employee?.display_name ?? "Ukjent";
        const entry = entryByShift.get(s.schedule_shift_id);

        const actualMs =
          entry?.punch_in && entry.punch_out
            ? new Date(entry.punch_out).getTime() - new Date(entry.punch_in).getTime()
            : entry?.punch_in
              ? Date.now() - new Date(entry.punch_in).getTime()
              : 0;
        const actualHours = actualMs > 0 ? actualMs / 3_600_000 : 0;

        // Derive status from punch timestamps (truth source) — not from
        // `time_entry.status` enum which can lag. Completed = punch_out set,
        // active = punch_in but no punch_out, upcoming = no entry. Workflow
        // statuses ("completed") on schedule_shift override.
        const shiftStatus: RosterRow["status"] =
          s.status === "completed"
            ? "completed"
            : entry?.punch_out
              ? "completed"
              : entry?.punch_in
                ? "active"
                : "upcoming";

        const breaksArr =
          (entry?.breaks as Array<{ start: string; end: string | null }> | null) ?? [];
        const onBreak = breaksArr.some((b) => b.end === null);

        return {
          shiftId: s.schedule_shift_id,
          employeeName: name,
          initials: toInitials(name),
          role: s.role ?? "—",
          startTime: toHHMM(s.start_time),
          endTime: toHHMM(s.end_time),
          plannedHours: Number(s.work_hours ?? 0),
          actualHours,
          status: shiftStatus,
          live: shiftStatus === "active",
          onBreak,
        };
      });
    },
  });
}
