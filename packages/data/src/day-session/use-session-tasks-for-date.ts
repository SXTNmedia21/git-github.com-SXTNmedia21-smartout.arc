"use client";

/**
 * use-session-tasks-for-date.ts
 *
 * TanStack Query hook — manager-scope read of ALL session_task rows for a
 * workspace + calendar date. Drives the multi-area Gantt at
 * /dashboard/oppgaver (P11 Task 4.2).
 *
 * Join strategy (Option A — no new migration, no RPC):
 *   session_task
 *     → department_session!inner (session_date, department_id)
 *         → department!inner (name)
 *
 *   Filter: workspace_id = :workspaceId AND session_date = :dateISO
 *
 *   session_task.department_session_id is a single FK → PostgREST embed
 *   on "department_session" is unambiguous.
 *
 * Manager scope: NOT filtered by department_id. The caller (ManagerTimeline
 * Shell, Task 4.4) receives the full cross-department task set and partitions
 * by area. Single-department scope (P10 TidslinjeTab) uses a separate hook.
 *
 * Task ontology (ADR-0298): this hook consumes the `session` source only.
 * Personal, emma, and runtime task sources are profile-scoped and irrelevant
 * to a multi-area manager Gantt.
 *
 * RLS: relies on the existing workspace_id JWT policy on session_task (no
 * new migration needed). Manager role gating is enforced by the sidebar guard
 * installed in Task 1.2 — this hook itself does not re-check role.
 *
 * L-0177: workspaceId or dateISO empty → throw immediately inside queryFn.
 *         TanStack enabled guard prevents the call; the throw is a second
 *         line of defence against regressions.
 *
 * staleTime: 15 s — tasks change more frequently than day_line structural data.
 *
 * References: ADR-0298 (task ontology), ADR-0133 (mobile parity), ADR-0134
 * (mobile telemetry contract), ADR-0367 (D6 tri-layer model).
 */

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * session_task_status enum values as defined in the DB schema
 * (session_infrastructure migration + database.types.ts).
 */
export type SessionTaskStatus =
  | "pending"
  | "available"
  | "in_progress"
  | "completed"
  | "skipped"
  | "overdue"
  | "escalated";

/**
 * Flat row returned by the hook — all fields sourced from real DB columns.
 * department_name and department_id are surfaced from the joined
 * department_session so callers can group/sort by area without a second query.
 *
 * Wave 1a (feat/dayplanner-dnd-and-views): added `scheduled_at` to support
 * time-anchored task rendering in ManagerTimelineShell + future DnD re-timing
 * (TA2, Wave 1b). `assigned_to` was already selected but is now also listed
 * explicitly in the type docs for DnD assignee-swap telemetry (oppgaver.task_re_timed).
 */
export type ManagerTimelineTaskRow = {
  /** session_task.id */
  id: string;
  workspace_id: string;
  department_session_id: string;
  session_hook_id: string | null;
  title: string;
  description: string | null;
  status: SessionTaskStatus;
  /**
   * When the task is scheduled to start (ISO 8601 with timezone).
   * Null for tasks without a specific time anchor — callers should fall back
   * to a sensible placeholder (e.g. "12:00") and mark the task visually.
   */
  scheduled_at: string | null;
  /** FK → profile.profile_id (the assignee). Column name is `assigned_to` in DB. */
  assigned_to: string | null;
  completed_by: string | null;
  completed_at: string | null;
  is_compliance_required: boolean;
  created_at: string;
  updated_at: string;
  /** Surfaced from department_session join */
  department_session_date: string;
  /** Surfaced from department_session join */
  department_id: string;
  /** Surfaced from department join */
  department_name: string;
};

// ---------------------------------------------------------------------------
// Query key factory
// ---------------------------------------------------------------------------

/**
 * Stable key factory — co-located with the hook so the Gantt shell (Task 4.4)
 * can invalidate this query after a task mutation without importing the hook.
 */
export const sessionTaskKeys = {
  forDate: (workspaceId: string, date: string) =>
    ["session-task", "for-date", workspaceId, date] as const,
};

// ---------------------------------------------------------------------------
// Raw PostgREST shape (cast intermediary — avoids GenericStringError)
// ---------------------------------------------------------------------------

type RawDepartmentSession = {
  session_date: string;
  department_id: string;
  department: { name: string } | null;
};

type RawSessionTaskRow = {
  id: string;
  workspace_id: string;
  department_session_id: string;
  session_hook_id: string | null;
  title: string;
  description: string | null;
  status: string;
  scheduled_at: string | null;
  assigned_to: string | null;
  completed_by: string | null;
  completed_at: string | null;
  is_compliance_required: boolean;
  created_at: string;
  updated_at: string;
  department_session: RawDepartmentSession | null;
};

// ---------------------------------------------------------------------------
// Fetch function (extracted for testability)
// ---------------------------------------------------------------------------

async function fetchSessionTasksForDate(
  workspaceId: string,
  dateISO: string,
): Promise<ReadonlyArray<ManagerTimelineTaskRow>> {
  // L-0177: fail fast — never silently fall through to wrong workspace
  if (!workspaceId) throw new Error("useSessionTasksForDate: workspaceId required");
  if (!dateISO) throw new Error("useSessionTasksForDate: dateISO required");

  const supabase = createClient();

  const { data, error } = await supabase
    .from("session_task")
    .select(
      `
      id,
      workspace_id,
      department_session_id,
      session_hook_id,
      title,
      description,
      status,
      scheduled_at,
      assigned_to,
      completed_by,
      completed_at,
      is_compliance_required,
      created_at,
      updated_at,
      department_session!inner (
        session_date,
        department_id,
        department!inner ( name )
      )
      `.trim(),
    )
    .eq("workspace_id", workspaceId)
    .eq("department_session.session_date", dateISO);

  if (error) throw new Error(error.message);

  // PostgREST embedded-resource selects produce GenericStringError in inferred
  // types when joins are present — cast via unknown to the shape we know is real.
  const rows = (data ?? []) as unknown as RawSessionTaskRow[];

  return rows.map(
    (row): ManagerTimelineTaskRow => ({
      id: row.id,
      workspace_id: row.workspace_id,
      department_session_id: row.department_session_id,
      session_hook_id: row.session_hook_id ?? null,
      title: row.title,
      description: row.description ?? null,
      status: row.status as SessionTaskStatus,
      scheduled_at: row.scheduled_at ?? null,
      assigned_to: row.assigned_to ?? null,
      completed_by: row.completed_by ?? null,
      completed_at: row.completed_at ?? null,
      is_compliance_required: row.is_compliance_required,
      created_at: row.created_at,
      updated_at: row.updated_at,
      department_session_date: row.department_session?.session_date ?? dateISO,
      department_id: row.department_session?.department_id ?? "",
      department_name: row.department_session?.department?.name ?? "",
    }),
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Returns all session_task rows for the given workspace + date (all
 * departments). Filtered to the `session` task source only (ADR-0298).
 *
 * - enabled only when both workspaceId and dateISO are non-empty strings.
 * - 15 s staleTime — tasks update frequently during an open session.
 * - L-0177: queryFn throws on empty inputs (belt + suspenders with enabled).
 */
export function useSessionTasksForDate(workspaceId: string | null, dateISO: string) {
  return useQuery({
    queryKey: sessionTaskKeys.forDate(workspaceId ?? "none", dateISO),
    queryFn: () => fetchSessionTasksForDate(workspaceId ?? "", dateISO),
    enabled: workspaceId !== null && workspaceId.length > 0 && dateISO.length > 0,
    staleTime: 15_000,
  });
}
