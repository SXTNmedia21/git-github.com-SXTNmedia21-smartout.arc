/**
 * useCreateTask — Enqueues a new session_task to the offline sync queue.
 *
 * Tasks are linked to a department_session (today's active session).
 * Goes through the sync queue so managers can create tasks even without
 * connectivity — the task will sync when the connection is restored.
 *
 * ADR-0134: identity (workspace_id, actor_id) is resolved via getProfileContext()
 * before emit — caller-supplied IDs were forgeable attribution (L-0083 / L-0177).
 */
import { useCallback, useState } from "react";
import { randomUUID } from "expo-crypto";

import { enqueue } from "@/lib/sync/queue";
import { getProfileContext } from "@/lib/profile-context";
import { emit } from "@smartout/telemetry";

export type CreateTaskPayload = {
  title: string;
  description: string | null;
  assigned_to: string | null;
  is_compliance_required: boolean;
  department_session_id: string;
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
      // ADR-0134: resolve identity from server before any write or emit.
      // Throws on unauthenticated / missing profile — fail fast, no corrupt telemetry.
      const { profileId, workspaceId } = await getProfileContext();

      const taskId = randomUUID();

      const rowId = await enqueue("create_task", {
        id: taskId,
        title: payload.title,
        description: payload.description,
        assigned_to: payload.assigned_to,
        is_compliance_required: payload.is_compliance_required,
        department_session_id: payload.department_session_id,
        workspace_id: workspaceId,
        status: "pending",
      });

      void emit({
        event: "session_task.created",
        workspace_id: workspaceId,
        actor_id: profileId,
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
