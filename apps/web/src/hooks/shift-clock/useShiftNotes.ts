"use client";

/**
 * useShiftNotes.ts — CRUD hook for shift-scoped notes.
 *
 * Notes are persisted in public.shift_note and are visible to the employee
 * and their managers. Each note belongs to a shift, profile, and workspace.
 * Telemetry is emitted on every new note for audit and analytics.
 *
 * Connected to: ShiftClock notes tab component
 */

import { useContext } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { emit } from "@smartout/telemetry";

// ── Types ─────────────────────────────────────────────────────

type ShiftNote = {
  id: string;
  shift_id: string;
  profile_id: string;
  workspace_id: string;
  content: string;
  created_at: string;
  updated_at: string;
};

// ── Hook ──────────────────────────────────────────────────────

export function useShiftNotes(shiftId: string | null) {
  const queryClient = useQueryClient();
  const { workspace } = useWorkspace();
  const { profileId } = useContext(DashboardContext);

  const workspaceId = workspace.workspace_id;

  // ── Query: fetch all notes for this shift ─────────────────

  const notesQuery = useQuery<ShiftNote[]>({
    queryKey: ["shift-notes", shiftId],
    enabled: !!shiftId,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("shift_note")
        .select("id, shift_id, profile_id, workspace_id, content, created_at, updated_at")
        .eq("shift_id", shiftId!)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data ?? [];
    },
  });

  // ── Mutation: add a note ──────────────────────────────────

  const addNoteMutation = useMutation({
    mutationFn: async (content: string) => {
      if (!shiftId || !profileId) throw new Error("Missing shift or profile");

      const supabase = createClient();
      const { data, error } = await supabase
        .from("shift_note")
        .insert({
          shift_id: shiftId,
          profile_id: profileId,
          workspace_id: workspaceId,
          content,
        })
        .select("id")
        .single();

      if (error) throw error;
      return data;
    },

    onSuccess: (data) => {
      void emit({
        event: "shift note_added",
        workspace_id: workspaceId,
        actor_id: profileId ?? "",
        properties: {
          entity_type: "shift" as const,
          entity_id: shiftId ?? "",
          data: { shift_id: shiftId ?? "", note_id: data.id },
        },
      });

      void queryClient.invalidateQueries({ queryKey: ["shift-notes", shiftId] });
    },
  });

  // ── Public API ────────────────────────────────────────────

  return {
    notes: notesQuery.data ?? [],
    addNote: (content: string) => addNoteMutation.mutateAsync(content),
    isLoading: notesQuery.isLoading || addNoteMutation.isPending,
  };
}
