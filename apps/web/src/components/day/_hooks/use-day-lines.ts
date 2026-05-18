"use client";

/**
 * use-day-lines.ts
 *
 * TanStack Query hook that fetches all day_line rows for a given workspace +
 * date, optionally filtered by department or location. Joins location.name and
 * department.name so callers never need a secondary lookup.
 *
 * Sort order: location.name ASC → planned_open ASC (consistent strip ordering).
 * staleTime: 30 s — day-lines rarely change during a session; this avoids
 * hammering Supabase on every render cycle.
 *
 * References: ADR-0367 §4.1, ADR-0099.
 */

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";
import type { DayLineRow } from "./use-day-lines.types";

type UseDayLinesParams = {
  workspaceId: string | null;
  date: string; // ISO "YYYY-MM-DD"
  departmentIds?: string[];
  locationIds?: string[];
};

// Stable query-key factory — collocated with the hook (no dashboard-keys dep
// needed here since this is a day-component concern, not a dashboard-wide one).
export const dayLineKeys = {
  all: ["day-line"] as const,
  list: (workspaceId: string, date: string, deptIds?: string[], locIds?: string[]) =>
    ["day-line", "list", workspaceId, date, ...(deptIds ?? []), ...(locIds ?? [])] as const,
};

async function fetchDayLines(
  workspaceId: string,
  date: string,
  departmentIds?: string[],
  locationIds?: string[],
): Promise<DayLineRow[]> {
  const supabase = createClient();

  // Supabase PostgREST join syntax for related table columns.
  // "location!inner(name)" and "department!inner(name)" guarantee non-null joins.
  let query = supabase
    .from("day_line")
    .select(
      `
      day_line_id,
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
      created_by,
      created_at,
      updated_at,
      location!inner ( name ),
      department!inner ( name )
      `.trim(),
    )
    .eq("workspace_id", workspaceId)
    .eq("business_date", date);

  if (departmentIds && departmentIds.length > 0) {
    query = query.in("department_id", departmentIds);
  }
  if (locationIds && locationIds.length > 0) {
    query = query.in("location_id", locationIds);
  }

  const { data, error } = await query;

  if (error) throw new Error(error.message);

  // PostgREST embedded-resource select returns GenericStringError in inferred
  // type when joins are present — cast via unknown to the shape we know is real.
  type RawRow = {
    day_line_id: string;
    workspace_id: string;
    department_session_id: string | null;
    department_id: string;
    location_id: string;
    business_date: string;
    planned_open: string;
    planned_close: string;
    source_template_id: string | null;
    notes: string | null;
    cancelled_at: string | null;
    is_backfilled: boolean;
    created_by: string | null;
    created_at: string;
    updated_at: string;
    location: { name: string } | null;
    department: { name: string } | null;
  };
  const rows = (data ?? []) as unknown as RawRow[];

  // Flatten joined relation objects into flat DayLineRow fields.
  return rows
    .map((row) => {
      const loc = row.location;
      const dept = row.department;
      return {
        day_line_id: row.day_line_id,
        workspace_id: row.workspace_id,
        department_session_id: row.department_session_id,
        department_id: row.department_id,
        location_id: row.location_id,
        business_date: row.business_date,
        planned_open: row.planned_open,
        planned_close: row.planned_close,
        source_template_id: row.source_template_id ?? null,
        notes: row.notes ?? null,
        cancelled_at: row.cancelled_at ?? null,
        is_backfilled: row.is_backfilled,
        created_by: row.created_by ?? null,
        created_at: row.created_at,
        updated_at: row.updated_at,
        location_name: loc?.name ?? "",
        department_name: dept?.name ?? "",
      } satisfies DayLineRow;
    })
    .sort((a, b) => {
      // Primary: location name ASC
      const locCmp = a.location_name.localeCompare(b.location_name, "nb");
      if (locCmp !== 0) return locCmp;
      // Secondary: planned_open ASC (time string comparison is stable for HH:MM:SS)
      return a.planned_open.localeCompare(b.planned_open);
    });
}

/**
 * Returns day_line rows for the given workspace + date.
 *
 * - Enabled only when workspaceId is non-null.
 * - 30 s staleTime to avoid redundant refetches within a session.
 */
export function useDayLines({ workspaceId, date, departmentIds, locationIds }: UseDayLinesParams) {
  return useQuery({
    queryKey: dayLineKeys.list(workspaceId ?? "none", date, departmentIds, locationIds),
    queryFn: () => fetchDayLines(workspaceId!, date, departmentIds, locationIds),
    enabled: workspaceId !== null,
    staleTime: 30_000,
  });
}
