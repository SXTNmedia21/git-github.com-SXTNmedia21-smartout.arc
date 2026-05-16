"use client";

// use-shift-time-entries.ts
// Fetches timesheet.time_entry rows for a list of shift IDs.
// Used to display punch-in / punch-out timestamps in the schedule shift-card tooltip.

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";

export type ShiftTimeEntry = {
  shiftId: string;
  punchIn: string | null;
  punchOut: string | null;
  status: "clocked_in" | "completed" | "edited";
};

/**
 * Returns a Map<shiftId, ShiftTimeEntry> for fast lookup.
 * Empty entries (no punch yet) are omitted.
 */
export function useShiftTimeEntries(shiftIds: string[]) {
  const { workspace } = useWorkspace();
  const sortedKey = [...shiftIds].sort().join(",");

  return useQuery({
    queryKey: ["schedule", "time-entries", workspace.workspace_id, sortedKey],
    enabled: shiftIds.length > 0,
    staleTime: 60 * 1000,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .schema("timesheet")
        .from("time_entry")
        .select("shift_id, punch_in, punch_out, status")
        .eq("workspace_id", workspace.workspace_id)
        .in("shift_id", shiftIds);

      if (error) throw error;

      const map = new Map<string, ShiftTimeEntry>();
      for (const row of data) {
        map.set(row.shift_id, {
          shiftId: row.shift_id,
          punchIn: row.punch_in,
          punchOut: row.punch_out,
          status: row.status,
        });
      }
      return map;
    },
  });
}
