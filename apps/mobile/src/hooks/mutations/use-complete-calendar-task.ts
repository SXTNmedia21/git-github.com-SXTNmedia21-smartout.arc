/**
 * useCompleteCalendarTask — Posts a task-complete request to the BFF.
 *
 * Mobile NEVER writes directly to session_task / personal_task / etc.
 * All writes route through the web BFF (ADR-0132 — mobile thin client).
 * Identity (workspace_id, profile_id) is ALWAYS derived server-side from
 * the Bearer JWT (ADR-0151 / ADR-0176 Invariant 3).
 *
 * Telemetry contract (ADR-0134): do NOT emit() here. The BFF invokes the
 * task capability tool (complete.execute()), which owns gate_action +
 * mutation + "task completed" emit. Emitting on the client would produce
 * a double-count in activity_trail / PostHog.
 *
 * References: ADR-0078, ADR-0099, ADR-0114, ADR-0132, ADR-0134,
 *             ADR-0151, ADR-0266, ADR-0298.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { getWebApiUrl } from "@/lib/web-api";

// ─── Input type ───────────────────────────────────────────────────────────────

export type CompleteCalendarTaskInput = {
  id: string;
  source: "session" | "personal" | "day_ad_hoc" | "emma";
};

// ─── Mutation function ────────────────────────────────────────────────────────

async function completeCalendarTask(input: CompleteCalendarTaskInput): Promise<void> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error("Ikke innlogget.");

  const url = `${getWebApiUrl()}/api/mobile/tasks/${input.id}/complete`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ source: input.source }),
  });

  if (!res.ok) {
    // Attempt to extract structured error from BFF response
    let msg = `task complete failed: ${res.status}`;
    try {
      const parsed = (await res.json()) as { error?: string };
      if (parsed?.error) msg = parsed.error;
    } catch {
      const text = await res.text().catch(() => "");
      if (text) msg = text;
    }
    throw new Error(msg);
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * TanStack mutation hook for completing a calendar task.
 *
 * On success, invalidates the three relevant query caches:
 *   - ["my-tasks"]       — re-fetches fn_list_my_tasks RPC
 *   - ["operations-feed"] — re-fetches operations/tasks composites
 *   - ["calendar-items"] — re-fetches unified calendar data
 *
 * Usage:
 *   const mutation = useCompleteCalendarTask();
 *   await mutation.mutateAsync({ id: task.id, source: 'session' });
 */
export function useCompleteCalendarTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: completeCalendarTask,
    onSuccess: () => {
      // Invalidate all task/calendar caches so the UI reflects completion.
      void queryClient.invalidateQueries({ queryKey: ["my-tasks"] });
      void queryClient.invalidateQueries({ queryKey: ["operations-feed"] });
      void queryClient.invalidateQueries({ queryKey: ["calendar-items"] });
    },
  });
}
