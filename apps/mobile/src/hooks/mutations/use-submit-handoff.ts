/**
 * useSubmitHandoff — Enqueues a handoff note to the offline sync queue.
 *
 * Handoff notes are submitted as session_note with note_type = 'handoff'.
 * Non-blocking: if the employee skips handoff, it's flagged to the leader
 * but does NOT block hours confirmation.
 */
import { useCallback, useState } from "react";
import { randomUUID } from "expo-crypto";

import { enqueue } from "@/lib/sync/queue";
import { emit } from "@smartout/telemetry";

export type HandoffPayload = {
  department_session_id: string;
  created_by: string;
  workspace_id: string;
  content: string;
};

type UseSubmitHandoffReturn = {
  submitHandoff: (payload: HandoffPayload) => Promise<string>;
  isSubmitting: boolean;
};

export function useSubmitHandoff(): UseSubmitHandoffReturn {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submitHandoff = useCallback(async (payload: HandoffPayload): Promise<string> => {
    setIsSubmitting(true);

    try {
      const noteId = randomUUID();

      const rowId = await enqueue("submit_handoff", {
        id: noteId,
        department_session_id: payload.department_session_id,
        created_by: payload.created_by,
        workspace_id: payload.workspace_id,
        content: payload.content,
        note_type: "handoff",
      });

      void emit({
        event: "handoff submitted",
        workspace_id: payload.workspace_id,
        actor_id: payload.created_by,
        properties: {
          entity: { entity_type: "department_session", entity_id: payload.department_session_id },
          data: { session_id: payload.department_session_id },
        },
      });

      return rowId;
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  return { submitHandoff, isSubmitting };
}
