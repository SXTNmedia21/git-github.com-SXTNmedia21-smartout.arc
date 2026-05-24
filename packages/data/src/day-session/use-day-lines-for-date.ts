"use client";

/**
 * use-day-lines-for-date.ts
 *
 * TanStack Query hook that fetches all day_line rows for a given workspace +
 * date. Mobile-parity implementation per ADR-0133 / ADR-0134.
 *
 * Lives in packages/data so both:
 * - apps/web (ManagerTimelineShell, Task 4.4)
 * - apps/mobile (future day-planner surface)
 * can consume the same query layer without duplicating the PostgREST call.
 *
 * Query shape mirrors apps/web/src/components/day/_hooks/use-day-lines.ts
 * (the web-local hook). Both join location.name and department.name so callers
 * never need a secondary lookup.
 *
 * Sort order: location_name ASC → planned_open ASC.
 * staleTime: 30 s — day-lines rarely change during a session.
 *
 * L-0177: workspaceId empty → throw immediately. No silent fallback.
 *
 * References: ADR-0133, ADR-0134, ADR-0367 §4.1.
 */

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";

/**
 * Full day_line row with joined area metadata.
 * Field order mirrors the database columns (ADR-0367 §4.1).
 */
export type DayLineRow = {
  day_line_id: string;
  workspace_id: string;
  department_session_id: string | null;
  department_id: string;
  location_id: string;
  /** ISO date string "YYYY-MM-DD" */
  business_date: string;
  /** "HH:MM:SS" */
  planned_open: string;
  /** "HH:MM:SS" */
  planned_close: string;
  source_template_id: string | null;
  notes: string | null;
  cancelled_at: string | null;
  is_backfilled: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  /** Joined from location.name */
  location_name: string;
  /** Joined from department.name */
  department_name: string;
};

/** Stable query-key factory for day-session hooks. */
export const daySessionKeys = {
  all: ["day-session"] as const,
  linesForDate: (workspaceId: string, dateISO: string) =>
    ["day-session", "lines", workspaceId, dateISO] as const,
};

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

async function fetchDayLinesForDate(workspaceId: string, dateISO: string): Promise<DayLineRow[]> {
  // L-0177: fail fast — never silently fall through to wrong workspace
  if (!workspaceId) throw new Error("useDayLinesForDate: workspaceId required");
  if (!dateISO) throw new Error("useDayLinesForDate: dateISO required");

  const supabase = createClient();

  const { data, error } = await supabase
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
    .eq("business_date", dateISO);

  if (error) throw new Error(error.message);

  // PostgREST embedded-resource select returns GenericStringError in inferred
  // type when joins are present — cast via unknown to the shape we know is real.
  const rows = (data ?? []) as unknown as RawRow[];

  return rows
    .map(
      (row): DayLineRow => ({
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
        location_name: row.location?.name ?? "",
        department_name: row.department?.name ?? "",
      }),
    )
    .sort((a, b) => {
      // Primary: location name ASC
      const locCmp = a.location_name.localeCompare(b.location_name, "nb");
      if (locCmp !== 0) return locCmp;
      // Secondary: planned_open ASC (time string "HH:MM:SS" — lexicographic is stable)
      return a.planned_open.localeCompare(b.planned_open);
    });
}

/**
 * Returns day_line rows for the given workspace + date.
 *
 * - Enabled only when both workspaceId and dateISO are non-empty.
 * - 30 s staleTime to avoid redundant refetches within a session.
 * - L-0177: queryFn throws on empty workspaceId — enabled guard prevents the
 *   call, but the throw is a second line of defence.
 */
export function useDayLinesForDate(workspaceId: string, dateISO: string) {
  return useQuery({
    queryKey: daySessionKeys.linesForDate(workspaceId, dateISO),
    queryFn: () => fetchDayLinesForDate(workspaceId, dateISO),
    enabled: workspaceId.length > 0 && dateISO.length > 0,
    staleTime: 30_000,
  });
}
