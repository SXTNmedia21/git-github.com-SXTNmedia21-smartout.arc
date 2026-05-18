"use client";

/**
 * use-day-lines.ts
 *
 * Fetches day_line rows for a given workspace + date, with optional
 * department and location filters (OR-within-dimension filtering).
 *
 * Used by AggregatedDayLineList and any per-scope day-line view.
 * Results include joined location.name and department.name for display.
 */

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";
import type { DayLineRow } from "./use-day-lines.types";

type UseDayLinesParams = {
  workspaceId: string;
  date: string;
  departmentIds?: string[];
  locationIds?: string[];
};

export function useDayLines(p: UseDayLinesParams) {
  const supabase = createClient();

  return useQuery({
    queryKey: [
      "day-lines",
      {
        wid: p.workspaceId,
        date: p.date,
        depts: p.departmentIds,
        locs: p.locationIds,
      },
    ],
    queryFn: async (): Promise<DayLineRow[]> => {
      let q = supabase
        .from("day_line")
        .select(
          `day_line_id,
           workspace_id,
           department_session_id,
           department_id,
           location_id,
           business_date,
           planned_open,
           planned_close,
           source_template_id,
           notes,
           cancelled_at,
           is_backfilled,
           location:location_id(name),
           department:department_id(name)`,
        )
        .eq("workspace_id", p.workspaceId)
        .eq("business_date", p.date)
        .order("planned_open", { ascending: true });

      if (p.departmentIds?.length) {
        q = q.in("department_id", p.departmentIds);
      }
      if (p.locationIds?.length) {
        q = q.in("location_id", p.locationIds);
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as DayLineRow[];
    },
    staleTime: 30_000,
  });
}
