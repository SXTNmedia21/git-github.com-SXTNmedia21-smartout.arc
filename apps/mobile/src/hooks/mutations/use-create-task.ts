/**
 * useCreateTask — Enqueues a new session_task to the offline sync queue.
 *
 * Tasks are linked to a department_session (today's active session).
 * Goes through the sync queue so managers can create tasks even without
 * connectivity — the task will sync when the connection is restored.
 */
import { useCallback, useState } from "react";
import { randomUUID } from "expo-crypto";

import { enqueue } from "@/lib/sync/queue";
import { emit } from "@smartout/telemetry";

export type CreateTaskPayload = {
  title: string;
  description: string | null;
  assigned_to: string | null;
  is_compliance_required: boolean;
  department_session_id: string;
  workspace_id: string;
  created_by: string;
};

type UseCreateTaskReturn = {
  createTask: (payload: CreateTaskPayload) => Promise<string>;
  isSubmitting: boolean;
};

export function useCreateTask(): UseCreateTaskReturn {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const createTask = useCallback(async (payload: CreateTaskPayload): Promise<string> => {
    setIsSubmitting(true);

    try {
      const taskId = randomUUID();

      const rowId = await enqueue("create_task", {
        id: taskId,
        title: payload.title,
        description: payload.description,
        assigned_to: payload.assigned_to,
        is_compliance_required: payload.is_compliance_required,
        department_session_id: payload.department_session_id,
        workspace_id: payload.workspace_id,
        status: "pending",
      });

      void emit({
        event: "session_task.created",
        workspace_id: payload.workspace_id,
        actor_id: payload.created_by,
        properties: {
          entity: { entity_type: "session_task", entity_id: taskId },
          metadata: { source: "mobile" },
        },
      });

      return rowId;
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  return { createTask, isSubmitting };
}
