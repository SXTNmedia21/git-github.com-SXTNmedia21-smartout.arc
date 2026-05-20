"use client";

/**
 * use-complete-task.ts — Thin TanStack mutation wrapper for session_task completion.
 *
 * WHY: Previously performed `supabase.from("session_task").update(...)` directly
 * from the browser anon client with fire-and-forget `void emit()`. This violated:
 *   - ADR-0099: no gate_action() RPC
 *   - ADR-0114: client-side DB write
 *   - ADR-0151: workspace_id + actor resolved client-side
 *   - ADR-0134: fire-and-forget emit
 *
 * NOW: Delegates to `completeTaskAction` Server Action in `_actions/complete-task-action.ts`.
 * All gate_action, admin-client write, server-resolved IDs, and awaited emit
 * live in the Server Action (via task.complete capability tool body per ADR-0298).
 * This hook is a thin TanStack mutation adapter only.
 *
 * Sortie 1 of M5 HMS 4-sortie sequence. Council-verified 2026-05-17.
 * ADR refs: 0099, 0114, 0134, 0151, 0204, 0298.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { completeTaskAction } from "@/app/dashboard/_actions/complete-task-action";
import { toast } from "sonner";

type CompleteTaskInput = {
  taskId: string;
  sessionId: string;
  evidence?: Record<string, unknown>;
};

export function useCompleteTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ taskId }: CompleteTaskInput) => {
      // evidence is not forwarded — task.complete tool body handles evidence
      // via its own completion payload. Server-side gate + admin write + emit.
      const result = await completeTaskAction(taskId, "chat");
      if (!result.ok) throw new Error(result.error);
      return taskId;
    },
    onSuccess: (_taskId, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["hms", "session-tasks", variables.sessionId],
      });
      toast.success("Oppgave fullfort");
    },
    onError: (error: Error) => {
      toast.error(`Kunne ikke fullforeoppgave: ${error.message}`);
    },
  });
}
