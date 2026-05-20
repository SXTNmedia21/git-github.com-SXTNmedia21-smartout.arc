/**
 * useSubmitNote — Enqueues a generic shift-note to the offline sync queue.
 *
 * Distinct from useSubmitHandoff:
 * - note_type='note' (vs 'handoff') — ordinary shift annotations
 * - Multiple notes per shift allowed (vs handoff which is per-session)
 * - Surfaces in the in-shift feed and after-shift summary
 *
 * Reuses the `submit_handoff` queue action since both write to session_note;
 * the action inserts payload as-is, so note_type='note' routes correctly.
 *
 * ADR-0134: identity resolved server-side via getProfileContext().
 */
import { useCallback, useState } from "react";
import { randomUUID } from "expo-crypto";

import { enqueue } from "@/lib/sync/queue";
import { getProfileContext } from "@/lib/profile-context";
import { emit } from "@smartout/telemetry";

export type NotePayload = {
  department_session_id: string;
  content: string;
};

type UseSubmitNoteReturn = {
  submitNote: (payload: NotePayload) => Promise<string>;
  isSubmitting: boolean;
};

export function useSubmitNote(): UseSubmitNoteReturn {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submitNote = useCallback(async (payload: NotePayload): Promise<string> => {
    setIsSubmitting(true);
    try {
      const { profileId, workspaceId } = await getProfileContext();
      const noteId = randomUUID();

      await enqueue("submit_handoff", {
        id: noteId,
        department_session_id: payload.department_session_id,
        created_by: profileId,
        workspace_id: workspaceId,
        content: payload.content,
        note_type: "note",
      });

      void emit({
        event: "shift note_added",
        workspace_id: workspaceId,
        actor_id: profileId,
        properties: {
          entity_type: "shift",
          entity_id: payload.department_session_id,
          data: { shift_id: payload.department_session_id, note_id: noteId },
        },
      });

      return noteId;
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  return { submitNote, isSubmitting };
}
