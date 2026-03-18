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

      return rowId;
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  return { submitHandoff, isSubmitting };
}
