"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";
import { useWorkspaceOptional } from "@/lib/workspace-context";

const HOOK_TYPE_LABEL: Record<string, string> = {
  pre_open: "Pre-open",
  open: "Åpning",
  scheduled: "Rutine",
  pre_close: "Pre-close",
  close: "Stenging",
};

// Coarse-to-fine UI state derived from per-task statuses on the hook row.
export type DayHookState = "completed" | "in_progress" | "upcoming";

export type DayHookTaskRow = {
  id: string;
  title: string;
  note: string | null;
  owner: string | null;
  assignedTo: string | null;
  completedAt: string | null;
  isComplianceRequired: boolean;
  evidence: unknown;
  done: boolean;
  active: boolean;
  overdue: boolean;
};

export type DayHookRow = {
  hookId: string | null; // null bucket for orphan tasks (no session_hook_id)
  hookType: string | null;
  typeLabel: string;
  title: string;
  time: string; // HH:MM
  offset: string;
  state: DayHookState;
  progress: string; // "2/4"
  tasks: DayHookTaskRow[];
};

/**
 * Fetches session_task rows for a given session, grouped by session_hook_id.
 *
 * Returns the shape the WebDayControl Oppgaver / Dagslinjen tabs expect:
 * an ordered list of hooks, each carrying its tasks and a derived state.
 *
 * Hooks are department-level templates (ADR-0156 §3 clarification). A hook
 * instance here is "the tasks from this template that exist in this session".
 * Tasks without `session_hook_id` land in a synthetic null-bucket displayed
 * as "Andre oppgaver".
 */
export function useSessionHooksWithTasks(sessionId: string | null) {
  const ctx = useWorkspaceOptional();
  const wsId = ctx?.workspace.workspace_id;

  return useQuery({
    queryKey: ["day-control", "session-hooks-with-tasks", wsId, sessionId],
    enabled: !!wsId && !!sessionId,
    staleTime: 30 * 1000,
    queryFn: async (): Promise<DayHookRow[]> => {
      const supabase = createClient();

      const { data: tasks, error } = await supabase
        .from("session_task")
        .select(
          `
          id, title, description, status, assigned_to, completed_by, completed_at,
          evidence, is_compliance_required, session_hook_id,
          assignee:assigned_to(display_name),
          hook:session_hook_id(id, hook_type, trigger_offset_min)
        `,
        )
        .eq("workspace_id", wsId!)
        .eq("department_session_id", sessionId!)
        .order("created_at", { ascending: true });

      if (error) throw error;

      const buckets = new Map<string | null, DayHookRow>();
      for (const t of tasks ?? []) {
        const hookData = t.hook as unknown as {
          id: string;
          hook_type: string;
          trigger_offset_min: number;
        } | null;
        const assignee = t.assignee as unknown as { display_name: string } | null;
        const hookId = hookData?.id ?? null;

        let bucket = buckets.get(hookId);
        if (!bucket) {
          const hookType = hookData?.hook_type ?? null;
          const offsetMin = hookData?.trigger_offset_min ?? 0;
          bucket = {
            hookId,
            hookType,
            typeLabel: hookType ? (HOOK_TYPE_LABEL[hookType] ?? hookType) : "Oppgave",
            title: hookType ? `${HOOK_TYPE_LABEL[hookType] ?? hookType}-rutine` : "Andre oppgaver",
            time: formatOffset(offsetMin),
            offset: signedOffsetLabel(offsetMin),
            state: "upcoming",
            progress: "0/0",
            tasks: [],
          };
          buckets.set(hookId, bucket);
        }

        const done = t.status === "completed" || !!t.completed_at;
        const active = t.status === "in_progress" || t.status === "available";
        const overdue = t.status === "overdue" || t.status === "escalated";

        bucket.tasks.push({
          id: t.id,
          title: t.title,
          note: t.description ?? null,
          owner: assignee?.display_name ?? null,
          assignedTo: t.assigned_to,
          completedAt: t.completed_at,
          isComplianceRequired: t.is_compliance_required,
          evidence: t.evidence,
          done,
          active,
          overdue,
        });
      }

      // Derive per-hook state + progress
      const rows = [...buckets.values()];
      for (const row of rows) {
        const total = row.tasks.length;
        const done = row.tasks.filter((t) => t.done).length;
        const anyActive = row.tasks.some((t) => t.active);
        row.progress = `${done}/${total}`;
        row.state =
          done === total && total > 0 ? "completed" : anyActive ? "in_progress" : "upcoming";
      }

      // Sort: orphan last, others by offset
      rows.sort((a, b) => {
        if (a.hookId === null) return 1;
        if (b.hookId === null) return -1;
        return a.time.localeCompare(b.time);
      });

      return rows;
    },
  });
}

/** Convert a trigger_offset_min (e.g. 30 before open, -30 before close) to HH:MM. */
function formatOffset(offsetMin: number): string {
  // We don't have session open time here — use a rough midnight-offset fallback.
  // Real time is rendered by PhaseTimeline which receives session.plannedOpen/Close.
  const total = (offsetMin + 24 * 60) % (24 * 60);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function signedOffsetLabel(offsetMin: number): string {
  if (offsetMin === 0) return "0m";
  if (offsetMin > 0) return `+${offsetMin}m`;
  return `${offsetMin}m`;
}
