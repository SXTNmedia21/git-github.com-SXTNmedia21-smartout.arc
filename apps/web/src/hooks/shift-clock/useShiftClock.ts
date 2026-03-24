"use client";

/**
 * useShiftClock.ts — Main context hook for the ShiftClock feature.
 * Manages ShiftClockState, provides mutation functions for punch-in/out
 * and break start/end, calls the compliance Edge Function, writes to
 * timesheet.time_entry, and emits telemetry for every action.
 *
 * State is derived from the active time_entry for the current profile.
 * Phase transitions are validated via the shared state machine before dispatch.
 *
 * Connected to: ShiftClock page, PunchButton, BreakButton, ShiftSummary
 */

import { useContext, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createClient } from "@smartout/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { emit } from "@smartout/telemetry";
import {
  canTransition,
  getNextPhase,
  type ShiftClockState,
  type GPSSnapshot,
  type PunchResult,
  type BreakEntry,
} from "@smartout/shift-clock";
import type { Json } from "@smartout/supabase";
import { shiftClockKeys } from "./useShiftClockConfig";

// ══════════════════════════════════════════════════════════════
// Internal helpers
// ══════════════════════════════════════════════════════════════

/** Derive the current phase from an active time_entry row (or null if none). */
function deriveState(entry: ActiveTimeEntry | null): ShiftClockState {
  if (!entry) {
    return {
      phase: "idle",
      shiftId: null,
      timeEntryId: null,
      punchInTime: null,
      punchOutTime: null,
      currentBreak: null,
      breaks: [],
      gpsConfig: null,
    };
  }

  const breaks = (entry.breaks as BreakEntry[] | null) ?? [];
  const openBreak = breaks.find((b) => b.end === null) ?? null;

  if (entry.punch_out) {
    return {
      phase: "summary",
      shiftId: entry.shift_id,
      timeEntryId: entry.time_entry_id,
      punchInTime: entry.punch_in,
      punchOutTime: entry.punch_out,
      currentBreak: null,
      breaks,
      gpsConfig: null,
    };
  }

  return {
    phase: openBreak ? "on_break" : "clocked_in",
    shiftId: entry.shift_id,
    timeEntryId: entry.time_entry_id,
    punchInTime: entry.punch_in,
    punchOutTime: null,
    currentBreak: openBreak,
    breaks,
    gpsConfig: null,
  };
}

// ══════════════════════════════════════════════════════════════
// Types
// ══════════════════════════════════════════════════════════════

type ActiveTimeEntry = {
  time_entry_id: string;
  shift_id: string;
  profile_id: string;
  punch_in: string;
  punch_out: string | null;
  breaks: Json;
  punch_in_location: Json | null;
  punch_out_location: Json | null;
};

// ══════════════════════════════════════════════════════════════
// Hook
// ══════════════════════════════════════════════════════════════

export function useShiftClock() {
  const queryClient = useQueryClient();
  const { workspace } = useWorkspace();
  const { profileId } = useContext(DashboardContext);

  // ── Query: active time entry for current profile ──────────
  const activeEntryQuery = useQuery<ActiveTimeEntry | null>({
    queryKey: shiftClockKeys.activeEntry(profileId ?? ""),
    enabled: !!profileId,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .schema("timesheet")
        .from("time_entry")
        .select(
          "time_entry_id, shift_id, profile_id, punch_in, punch_out, breaks, punch_in_location, punch_out_location",
        )
        .eq("profile_id", profileId!)
        .is("punch_out", null)
        .order("punch_in", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    refetchInterval: 30_000, // Poll every 30s to catch external updates
  });

  // ── Derived state from the active entry ───────────────────
  const state: ShiftClockState = useMemo(
    () => deriveState(activeEntryQuery.data ?? null),
    [activeEntryQuery.data],
  );

  // ── Mutation: Punch In ────────────────────────────────────
  const punchInMutation = useMutation({
    mutationFn: async ({
      shiftId,
      gps,
    }: {
      shiftId: string;
      gps?: GPSSnapshot | null;
    }): Promise<PunchResult> => {
      if (!canTransition(state.phase, "punch_in")) {
        return { allowed: false, warnings: [], blockReason: "Invalid phase for punch-in" };
      }

      const supabase = createClient();

      // Call compliance Edge Function first — it may block the punch
      const { data: complianceData, error: complianceError } = await supabase.functions.invoke(
        "shift-clock-compliance",
        {
          body: {
            action: "punch_in",
            shift_id: shiftId,
            profile_id: profileId,
            workspace_id: workspace.workspace_id,
            gps_snapshot: gps ?? null,
          },
        },
      );

      if (complianceError) throw complianceError;

      const result = complianceData as PunchResult;
      if (!result.allowed) return result;

      // Insert time_entry in timesheet schema
      const now = new Date().toISOString();
      const { data: entry, error: insertError } = await supabase
        .schema("timesheet")
        .from("time_entry")
        .insert({
          shift_id: shiftId,
          profile_id: profileId!,
          workspace_id: workspace.workspace_id,
          punch_in: now,
          punch_in_location: (gps as unknown as Json) ?? null,
          breaks: [] as unknown as Json,
        })
        .select("time_entry_id")
        .single();

      if (insertError) throw insertError;

      // Update shift status to in_progress
      await supabase
        .from("schedule_shift")
        .update({ status: "in_progress" })
        .eq("shift_id", shiftId);

      // Emit telemetry
      void emit({
        event: "shift punched_in",
        workspace_id: workspace.workspace_id,
        actor_id: profileId ?? "",
        properties: {
          entity: { entity_type: "shift" as const, entity_id: shiftId },
          data: {
            shift_id: shiftId,
            time_entry_id: entry.time_entry_id,
            punch_time: now,
            is_adhoc: false,
            gps_verified: !!gps,
            gps_distance_meters: null,
          },
        },
      });

      return result;
    },

    onSuccess: (result) => {
      if (result.allowed) {
        toast.success("Stemplet inn");
        void queryClient.invalidateQueries({
          queryKey: shiftClockKeys.activeEntry(profileId ?? ""),
        });
      } else {
        toast.error(result.blockReason ?? "Innstemplingen ble blokkert");
      }
    },

    onError: () => {
      toast.error("Kunne ikke stemple inn");
    },
  });

  // ── Mutation: Punch Out ───────────────────────────────────
  const punchOutMutation = useMutation({
    mutationFn: async ({ comment, gps }: { comment?: string; gps?: GPSSnapshot | null }) => {
      if (!canTransition(state.phase, "punch_out")) {
        throw new Error("Invalid phase for punch-out");
      }
      if (!state.timeEntryId || !state.shiftId) {
        throw new Error("No active time entry");
      }

      const supabase = createClient();
      const now = new Date().toISOString();

      // Calculate work and break minutes for telemetry
      const punchInMs = state.punchInTime ? new Date(state.punchInTime).getTime() : Date.now();
      const totalMinutes = Math.round((Date.now() - punchInMs) / 60_000);
      const breakMinutes = state.breaks.reduce((sum, b) => {
        if (!b.end) return sum;
        const start = new Date(b.start).getTime();
        const end = new Date(b.end).getTime();
        return sum + Math.round((end - start) / 60_000);
      }, 0);

      const { error: updateError } = await supabase
        .schema("timesheet")
        .from("time_entry")
        .update({
          punch_out: now,
          punch_out_location: (gps as unknown as Json) ?? null,
          ...(comment ? { comment } : {}),
        })
        .eq("time_entry_id", state.timeEntryId);

      if (updateError) throw updateError;

      // Update shift status to completed
      await supabase
        .from("schedule_shift")
        .update({ status: "completed" })
        .eq("shift_id", state.shiftId);

      void emit({
        event: "shift punched_out",
        workspace_id: workspace.workspace_id,
        actor_id: profileId ?? "",
        properties: {
          entity: { entity_type: "shift" as const, entity_id: state.shiftId },
          data: {
            shift_id: state.shiftId,
            time_entry_id: state.timeEntryId,
            punch_time: now,
            work_minutes: totalMinutes - breakMinutes,
            break_minutes: breakMinutes,
            gps_verified: !!gps,
          },
        },
      });
    },

    onSuccess: () => {
      toast.success("Stemplet ut");
      void queryClient.invalidateQueries({
        queryKey: shiftClockKeys.activeEntry(profileId ?? ""),
      });
    },

    onError: () => {
      toast.error("Kunne ikke stemple ut");
    },
  });

  // ── Mutation: Start Break ─────────────────────────────────
  const startBreakMutation = useMutation({
    mutationFn: async ({ gps }: { gps?: GPSSnapshot | null }) => {
      if (!canTransition(state.phase, "start_break")) {
        throw new Error("Invalid phase for starting break");
      }
      if (!state.timeEntryId || !state.shiftId) {
        throw new Error("No active time entry");
      }

      const supabase = createClient();
      const now = new Date().toISOString();

      const newBreak: BreakEntry = {
        start: now,
        end: null,
        startLocation: gps ?? null,
        endLocation: null,
      };

      const updatedBreaks = [...state.breaks, newBreak];

      const { error } = await supabase
        .schema("timesheet")
        .from("time_entry")
        .update({ breaks: updatedBreaks as unknown as Json })
        .eq("time_entry_id", state.timeEntryId);

      if (error) throw error;

      void emit({
        event: "shift break_started",
        workspace_id: workspace.workspace_id,
        actor_id: profileId ?? "",
        properties: {
          entity: { entity_type: "shift" as const, entity_id: state.shiftId },
          data: {
            shift_id: state.shiftId,
            time_entry_id: state.timeEntryId,
          },
        },
      });
    },

    onSuccess: () => {
      toast.success("Pause startet");
      void queryClient.invalidateQueries({
        queryKey: shiftClockKeys.activeEntry(profileId ?? ""),
      });
    },

    onError: () => {
      toast.error("Kunne ikke starte pause");
    },
  });

  // ── Mutation: End Break ───────────────────────────────────
  const endBreakMutation = useMutation({
    mutationFn: async ({ gps }: { gps?: GPSSnapshot | null }) => {
      if (!canTransition(state.phase, "end_break")) {
        throw new Error("Invalid phase for ending break");
      }
      if (!state.timeEntryId || !state.shiftId || !state.currentBreak) {
        throw new Error("No active break");
      }

      const supabase = createClient();
      const now = new Date().toISOString();

      // Close the open break by updating its end time
      const updatedBreaks = state.breaks.map((b) =>
        b.start === state.currentBreak?.start && b.end === null
          ? { ...b, end: now, endLocation: gps ?? null }
          : b,
      );

      const { error } = await supabase
        .schema("timesheet")
        .from("time_entry")
        .update({ breaks: updatedBreaks as unknown as Json })
        .eq("time_entry_id", state.timeEntryId);

      if (error) throw error;

      // Calculate break duration for telemetry
      const breakStart = new Date(state.currentBreak.start).getTime();
      const breakEnd = Date.now();
      const breakMinutes = Math.round((breakEnd - breakStart) / 60_000);

      void emit({
        event: "shift break_ended",
        workspace_id: workspace.workspace_id,
        actor_id: profileId ?? "",
        properties: {
          entity: { entity_type: "shift" as const, entity_id: state.shiftId },
          data: {
            shift_id: state.shiftId,
            time_entry_id: state.timeEntryId,
            break_minutes: breakMinutes,
            is_paid: false, // Determined by break classifier at settlement time
          },
        },
      });
    },

    onSuccess: () => {
      toast.success("Pause avsluttet");
      void queryClient.invalidateQueries({
        queryKey: shiftClockKeys.activeEntry(profileId ?? ""),
      });
    },

    onError: () => {
      toast.error("Kunne ikke avslutte pause");
    },
  });

  // ── Public API ────────────────────────────────────────────

  const punchIn = async (shiftId: string, gps?: GPSSnapshot | null): Promise<PunchResult> => {
    return punchInMutation.mutateAsync({ shiftId, gps });
  };

  const punchOut = async (comment?: string, gps?: GPSSnapshot | null): Promise<void> => {
    await punchOutMutation.mutateAsync({ comment, gps });
  };

  const startBreak = async (gps?: GPSSnapshot | null): Promise<void> => {
    await startBreakMutation.mutateAsync({ gps });
  };

  const endBreak = async (gps?: GPSSnapshot | null): Promise<void> => {
    await endBreakMutation.mutateAsync({ gps });
  };

  const isLoading =
    activeEntryQuery.isLoading ||
    punchInMutation.isPending ||
    punchOutMutation.isPending ||
    startBreakMutation.isPending ||
    endBreakMutation.isPending;

  return {
    state,
    punchIn,
    punchOut,
    startBreak,
    endBreak,
    isLoading,
  };
}
