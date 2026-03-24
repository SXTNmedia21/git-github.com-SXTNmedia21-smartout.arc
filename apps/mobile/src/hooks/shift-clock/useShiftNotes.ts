/**
 * useShiftNotes — Shift notes query and offline-first note creation.
 *
 * Shift notes are brief annotations an employee attaches to a shift
 * (e.g. "fridge temperature was off", "trained the new hire on POS").
 * They live in public.shift_note and are visible to managers.
 *
 * Adding a note works offline: the note is enqueued via the sync queue
 * and optimistically prepended to the cache so the employee sees it
 * immediately, regardless of connectivity.
 */

import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { randomUUID } from "expo-crypto";

import { supabase } from "@/lib/supabase";
import { enqueue } from "@/lib/sync/queue";

/** Shape of a shift_note row — mirrors public.shift_note */
export type ShiftNote = {
  shift_note_id: string;
  shift_id: string;
  profile_id: string;
  workspace_id: string;
  content: string;
  /** True while the note is queued but not yet confirmed by Supabase */
  _isPending?: boolean;
  created_at: string;
  updated_at: string;
};

const STALE_TIME_MS = 2 * 60 * 1_000;

function shiftNotesKey(shiftId: string) {
  return ["shift-notes", shiftId] as const;
}

async function fetchShiftNotes(shiftId: string): Promise<ShiftNote[]> {
  // shift_note is in public schema — safe to use generated types path
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const { data, error } = await (supabase as any)
    .from("shift_note")
    .select("*")
    .eq("shift_id", shiftId)
    .order("created_at", { ascending: false });
  /* eslint-enable @typescript-eslint/no-explicit-any */

  if (error) throw error;
  return (data ?? []) as ShiftNote[];
}

export type ShiftNotesActions = {
  notes: ShiftNote[];
  isLoading: boolean;
  /**
   * Adds a shift note. Works offline — enqueues to sync queue with
   * optimistic cache update so the note appears instantly.
   */
  addNote: (params: { content: string; profileId: string; workspaceId: string }) => Promise<void>;
};

/**
 * Hook: provides shift notes list and addNote mutation for a given shift.
 *
 * Notes are ordered newest-first. The addNote function is instant from the
 * user's perspective — it optimistically updates the cache before the sync
 * worker has a chance to flush the queue to Supabase.
 */
export function useShiftNotes(shiftId: string): ShiftNotesActions {
  const queryClient = useQueryClient();

  const { data: notes, isLoading } = useQuery<ShiftNote[]>({
    queryKey: shiftNotesKey(shiftId),
    queryFn: () => fetchShiftNotes(shiftId),
    staleTime: STALE_TIME_MS,
    enabled: !!shiftId,
    retry: 1,
  });

  /**
   * Adds a note to the shift.
   *
   * 1. Generates a client-side UUID for the shift_note_id
   * 2. Optimistically prepends the note to the cache with _isPending = true
   * 3. Enqueues a shift_note_add action in the SQLite sync queue
   */
  const addNote = useCallback(
    async (params: { content: string; profileId: string; workspaceId: string }) => {
      const { content, profileId, workspaceId } = params;
      const noteId = randomUUID();
      const now = new Date().toISOString();

      const optimistic: ShiftNote = {
        shift_note_id: noteId,
        shift_id: shiftId,
        profile_id: profileId,
        workspace_id: workspaceId,
        content,
        _isPending: true,
        created_at: now,
        updated_at: now,
      };

      queryClient.setQueryData<ShiftNote[]>(shiftNotesKey(shiftId), (old) => {
        return old ? [optimistic, ...old] : [optimistic];
      });

      await enqueue("shift_note_add", {
        shift_note_id: noteId,
        shift_id: shiftId,
        profile_id: profileId,
        workspace_id: workspaceId,
        content,
        created_at: now,
        updated_at: now,
      });
    },
    [shiftId, queryClient],
  );

  return {
    notes: notes ?? [],
    isLoading,
    addNote,
  };
}
