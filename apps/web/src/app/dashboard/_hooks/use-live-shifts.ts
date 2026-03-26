"use client";

/**
 * useLiveShifts — Queries today's shifts with their time_entry status.
 * Returns summary counts and individual shift entries for the live widget.
 * Subscribes to realtime changes on time_entry for instant updates.
 */

import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";

export type LiveShiftEntry = {
  shiftId: string;
  employeeName: string;
  initials: string;
  role: string;
  status: "clocked_in" | "on_break" | "waiting" | "late";
  duration?: string;
  startTime?: string;
  minutesLate?: number;
};

export type LiveShiftSummary = {
  clockedIn: number;
  onBreak: number;
  waiting: number;
  late: number;
  entries: LiveShiftEntry[];
};

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}t ${m}m` : `${m}m`;
}

export function useLiveShifts() {
  const { workspace } = useWorkspace();
  const queryClient = useQueryClient();
  const supabase = createClient();
  const workspaceId = workspace.workspace_id;
  const today = new Date().toISOString().slice(0, 10);

  const queryKey = ["live-shifts", workspaceId, today];

  const query = useQuery<LiveShiftSummary>({
    queryKey,
    staleTime: 15_000,
    refetchInterval: 30_000,
    queryFn: async () => {
      // Get today's published/active shifts with employee info
      const { data: shifts, error: shiftError } = await supabase
        .from("schedule_shift")
        .select(
          "schedule_shift_id, employee_id, start_time, role, status, profile:employee_id(display_name)",
        )
        .eq("workspace_id", workspaceId)
        .eq("shift_date", today)
        .in("status", ["published", "active"])
        .not("employee_id", "is", null);

      if (shiftError) throw shiftError;
      if (!shifts?.length) {
        return { clockedIn: 0, onBreak: 0, waiting: 0, late: 0, entries: [] };
      }

      // Get active time entries for these shifts
      const shiftIds = shifts.map((s) => s.schedule_shift_id);
      const { data: entries } = await supabase
        .schema("timesheet")
        .from("time_entry")
        .select("shift_id, punch_in, punch_out, breaks")
        .in("shift_id", shiftIds)
        .is("punch_out", null);

      const entryMap = new Map<string, typeof entries extends (infer T)[] | null ? T : never>();
      for (const e of entries ?? []) {
        entryMap.set(e.shift_id, e);
      }

      const now = Date.now();
      const result: LiveShiftEntry[] = [];

      for (const shift of shifts) {
        const profile = shift.profile as unknown as { display_name: string } | null;
        const name = profile?.display_name ?? "Ikke tildelt";
        const entry = entryMap.get(shift.schedule_shift_id);

        if (entry) {
          // Has an active time_entry — either clocked_in or on_break
          const breaks = (entry.breaks as Array<{ start: string; end: string | null }>) ?? [];
          const onBreak = breaks.some((b) => b.end === null);
          const punchInMs = new Date(entry.punch_in).getTime();
          const totalMinutes = Math.round((now - punchInMs) / 60_000);

          result.push({
            shiftId: shift.schedule_shift_id,
            employeeName: name,
            initials: getInitials(name),
            role: shift.role ?? "",
            status: onBreak ? "on_break" : "clocked_in",
            duration: formatDuration(totalMinutes),
          });
        } else {
          // No time_entry — waiting or late
          const shiftStart = new Date(shift.start_time).getTime();
          const minutesLate = Math.round((now - shiftStart) / 60_000);
          const isLate = minutesLate > 10; // Use default threshold

          result.push({
            shiftId: shift.schedule_shift_id,
            employeeName: name,
            initials: getInitials(name),
            role: shift.role ?? "",
            status: isLate ? "late" : "waiting",
            startTime: new Date(shift.start_time).toLocaleTimeString("nb-NO", {
              hour: "2-digit",
              minute: "2-digit",
            }),
            minutesLate: isLate ? minutesLate : undefined,
          });
        }
      }

      // Sort: late first, then clocked_in, then on_break, then waiting
      const order = { late: 0, clocked_in: 1, on_break: 2, waiting: 3 };
      result.sort((a, b) => order[a.status] - order[b.status]);

      return {
        clockedIn: result.filter((e) => e.status === "clocked_in").length,
        onBreak: result.filter((e) => e.status === "on_break").length,
        waiting: result.filter((e) => e.status === "waiting").length,
        late: result.filter((e) => e.status === "late").length,
        entries: result,
      };
    },
  });

  // Realtime subscription on time_entry changes
  useEffect(() => {
    const channel = supabase
      .channel("live-shifts")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "timesheet",
          table: "time_entry",
        },
        () => {
          void queryClient.invalidateQueries({ queryKey });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [workspaceId, supabase, queryClient, queryKey]);

  return query;
}
