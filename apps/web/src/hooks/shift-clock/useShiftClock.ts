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
import { insertOutboxNotification } from "@smartout/notifications/client";
import {
  canTransition,
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

/**
 * Fire-and-forget: notify department managers/admins about a shift event.
 * Resolves manager profile IDs, then inserts one outbox row per recipient.
 */
async function notifyDepartmentManagers(
  supabase: ReturnType<typeof createClient>,
  opts: {
    workspaceId: string;
    departmentId: string;
    eventKey: string;
    metadata: Record<string, unknown>;
  },
): Promise<void> {
  const { data: managers } = await supabase
    .from("profile")
    .select("profile_id")
    .eq("workspace_id", opts.workspaceId)
    .eq("department_id", opts.departmentId)
    .in("role", ["manager", "admin", "owner"])
    .eq("is_active", true);

  if (!managers?.length) return;

  await Promise.all(
    managers.map((m) =>
      insertOutboxNotification(supabase, {
        workspace_id: opts.workspaceId,
        recipient_id: m.profile_id,
        event_key: opts.eventKey,
        metadata: opts.metadata,
      }),
    ),
  );
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

      // Call compliance via same-origin proxy first — it may block the punch (ADR-0179)
      const response = await fetch("/api/shift-clock/compliance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "punch_in",
          shift_id: shiftId,
          profile_id: profileId,
          workspace_id: workspace.workspace_id,
          gps_snapshot: gps ?? null,
        }),
      });
      if (!response.ok) {
        const { error } = (await response.json()) as { error?: string };
        throw new Error(error || "Compliance check failed");
      }
      const complianceData = await response.json();

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
          punch_in_location: (gps as unknown as Json) ?? null, // SAFETY: GPSSnapshot is a valid JSON object
          breaks: [] as unknown as Json, // SAFETY: empty array is a valid JSON value
        })
        .select("time_entry_id")
        .single();

      if (insertError) throw insertError;

      // Update shift status to active
      await supabase
        .from("schedule_shift")
        .update({ status: "active" })
        .eq("schedule_shift_id", shiftId);

      // Emit telemetry
      void emit({
        event: "shift punched_in",
        workspace_id: workspace.workspace_id,
        actor_id: profileId ?? "",
        properties: {
          entity_type: "shift" as const,
          entity_id: shiftId,
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

      // Notify department managers (fire-and-forget)
      void (async () => {
        const { data: shift } = await supabase
          .from("schedule_shift")
          .select("department_id, role, employee_id, profile:employee_id(display_name)")
          .eq("schedule_shift_id", shiftId)
          .single();
        if (shift?.department_id) {
          // SAFETY: Supabase join returns a union type; runtime shape matches { display_name: string }
          const profile = shift.profile as unknown as { display_name: string } | null; // SAFETY: Supabase join returns union type; runtime shape matches the cast
          void notifyDepartmentManagers(supabase, {
            workspaceId: workspace.workspace_id,
            departmentId: shift.department_id,
            eventKey: "shift.punched_in",
            metadata: { name: profile?.display_name ?? "Ansatt", role: shift.role ?? "" },
          });
        }
      })();

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
      const breakMinutes = state.breaks.reduce((sum: number, b: BreakEntry) => {
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
          punch_out_location: (gps as unknown as Json) ?? null, // SAFETY: GPSSnapshot is a valid JSON object
          ...(comment ? { notes: comment } : {}),
          status: "completed" as const,
        })
        .eq("time_entry_id", state.timeEntryId);

      if (updateError) throw updateError;

      // Update shift status to completed
      await supabase
        .from("schedule_shift")
        .update({ status: "completed" })
        .eq("schedule_shift_id", state.shiftId);

      void emit({
        event: "shift punched_out",
        workspace_id: workspace.workspace_id,
        actor_id: profileId ?? "",
        properties: {
          entity_type: "shift" as const,
          entity_id: state.shiftId,
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

      // Notify department managers + emit "shift completed" (fire-and-forget).
      // The admin-side completeShift mutation emits "shift completed" but the
      // employee punch-out path was missing it — both paths set status=completed.
      const workMinutes = totalMinutes - breakMinutes;
      const hours = (workMinutes / 60).toFixed(1);
      void (async () => {
        const { data: shift } = await supabase
          .from("schedule_shift")
          .select("department_id, profile:employee_id(display_name)")
          .eq("schedule_shift_id", state.shiftId!)
          .single();
        if (shift?.department_id) {
          void emit({
            event: "shift completed",
            workspace_id: workspace.workspace_id,
            actor_id: profileId ?? "",
            properties: {
              entity_type: "shift" as const,
              entity_id: state.shiftId!,
              data: {
                shift_ids: [state.shiftId!],
                department_id: shift.department_id,
              },
            },
          });

          // SAFETY: Supabase join returns a union type; runtime shape matches { display_name: string }
          const profile = shift.profile as unknown as { display_name: string } | null; // SAFETY: Supabase join returns union type; runtime shape matches the cast
          void notifyDepartmentManagers(supabase, {
            workspaceId: workspace.workspace_id,
            departmentId: shift.department_id,
            eventKey: "shift.punched_out",
            metadata: { name: profile?.display_name ?? "Ansatt", hours },
          });
        }
      })();
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
        .update({ breaks: updatedBreaks as unknown as Json }) // SAFETY: BreakEntry[] is a valid JSON array
        .eq("time_entry_id", state.timeEntryId);

      if (error) throw error;

      void emit({
        event: "shift break_started",
        workspace_id: workspace.workspace_id,
        actor_id: profileId ?? "",
        properties: {
          entity_type: "shift" as const,
          entity_id: state.shiftId,
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
        .update({ breaks: updatedBreaks as unknown as Json }) // SAFETY: BreakEntry[] is a valid JSON array
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
          entity_type: "shift" as const,
          entity_id: state.shiftId,
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

  // ── Mutation: Create Ad-hoc Shift ────────────────────────
  //
  // Creates a new schedule_shift with is_adhoc=true, assigns it to the
  // current profile, then punches in immediately. If adhocRequiresApproval
  // is true the adhoc_approved_by column is left null (pending leader sign-off).
  const createAdhocShiftMutation = useMutation({
    mutationFn: async ({
      departmentId,
      adhocRequiresApproval,
      gps,
    }: {
      departmentId: string | null;
      adhocRequiresApproval: boolean;
      gps?: GPSSnapshot | null;
    }): Promise<PunchResult> => {
      if (!canTransition(state.phase, "punch_in")) {
        return { allowed: false, warnings: [], blockReason: "Invalid phase for punch-in" };
      }

      const supabase = createClient();
      const now = new Date().toISOString();
      const today = now.slice(0, 10); // YYYY-MM-DD

      // Derive a simple day_category from the current hour to satisfy the NOT NULL constraint
      const hour = new Date().getHours();
      const dayCategory =
        hour < 10
          ? ("morning" as const)
          : hour < 14
            ? ("midday" as const)
            : hour < 17
              ? ("afternoon" as const)
              : hour < 22
                ? ("evening" as const)
                : ("night" as const);

      // Create the ad-hoc shift record
      const { data: newShift, error: shiftError } = await supabase
        .from("schedule_shift")
        .insert({
          workspace_id: workspace.workspace_id,
          employee_id: profileId!,
          department_id: departmentId,
          shift_date: today,
          start_time: now,
          // End time is unknown — default 8 hours ahead; managers can adjust later
          end_time: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
          status: "active",
          is_adhoc: true,
          is_published: false,
          day_category: dayCategory,
          role: "employee",
          // Leave adhoc_approved_by as null when approval is required — signals pending state
          adhoc_approved_by: adhocRequiresApproval ? null : profileId!,
          adhoc_approved_at: adhocRequiresApproval ? null : now,
        })
        .select("schedule_shift_id")
        .single();

      if (shiftError) throw shiftError;

      const shiftId = newShift.schedule_shift_id;

      // Punch in immediately after creating the shift
      const { data: entry, error: insertError } = await supabase
        .schema("timesheet")
        .from("time_entry")
        .insert({
          shift_id: shiftId,
          profile_id: profileId!,
          workspace_id: workspace.workspace_id,
          punch_in: now,
          punch_in_location: (gps as unknown as Json) ?? null, // SAFETY: GPSSnapshot is a valid JSON object
          breaks: [] as unknown as Json, // SAFETY: empty array is a valid JSON value
        })
        .select("time_entry_id")
        .single();

      if (insertError) throw insertError;

      void emit({
        event: "shift adhoc_created",
        workspace_id: workspace.workspace_id,
        actor_id: profileId ?? "",
        properties: {
          entity_type: "shift" as const,
          entity_id: shiftId,
          data: {
            shift_id: shiftId,
            department_id: departmentId ?? workspace.workspace_id,
            requires_approval: adhocRequiresApproval,
          },
        },
      });

      void emit({
        event: "shift punched_in",
        workspace_id: workspace.workspace_id,
        actor_id: profileId ?? "",
        properties: {
          entity_type: "shift" as const,
          entity_id: shiftId,
          data: {
            shift_id: shiftId,
            time_entry_id: entry.time_entry_id,
            punch_time: now,
            is_adhoc: true,
            gps_verified: !!gps,
            gps_distance_meters: null,
          },
        },
      });

      // Notify department managers about adhoc shift needing approval
      if (adhocRequiresApproval && departmentId) {
        void (async () => {
          const { data: profile } = await supabase
            .from("profile")
            .select("display_name")
            .eq("profile_id", profileId!)
            .single();
          void notifyDepartmentManagers(supabase, {
            workspaceId: workspace.workspace_id,
            departmentId,
            eventKey: "shift.adhoc_pending",
            metadata: { name: profile?.display_name ?? "Ansatt" },
          });
        })();
      }

      return {
        allowed: true,
        blockReason: null,
        warnings: adhocRequiresApproval
          ? [
              {
                code: "approval_required",
                message: "Vakten krever godkjenning fra leder",
                severity: "warning" as const,
              },
            ]
          : [],
      } satisfies PunchResult;
    },

    onSuccess: (result) => {
      if (result.allowed) {
        toast.success("Ad-hoc vakt startet");
        void queryClient.invalidateQueries({
          queryKey: shiftClockKeys.activeEntry(profileId ?? ""),
        });
      } else {
        toast.error(result.blockReason ?? "Kunne ikke starte ad-hoc vakt");
      }
    },

    onError: () => {
      toast.error("Kunne ikke opprette ad-hoc vakt");
    },
  });

  // ── Mutation: Take Open Shift ─────────────────────────────
  //
  // Claims an unassigned open shift for the current profile, then punches in.
  const takeOpenShiftMutation = useMutation({
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
      const now = new Date().toISOString();

      // Claim the open shift — assign to current profile and mark active.
      // The .is("employee_id", null) acts as an optimistic lock: if another employee
      // already claimed this shift, the WHERE clause won't match and 0 rows are returned.
      const { data: claimData, error: claimError } = await supabase
        .from("schedule_shift")
        .update({ employee_id: profileId!, status: "active" })
        .eq("schedule_shift_id", shiftId)
        .is("employee_id", null) // Optimistic lock: only update if still unclaimed
        .select("schedule_shift_id");

      if (claimError) throw claimError;
      if (!claimData || claimData.length === 0) {
        throw new Error("Vakten er allerede tatt av en annen ansatt");
      }

      // Punch in
      const { data: entry, error: insertError } = await supabase
        .schema("timesheet")
        .from("time_entry")
        .insert({
          shift_id: shiftId,
          profile_id: profileId!,
          workspace_id: workspace.workspace_id,
          punch_in: now,
          punch_in_location: (gps as unknown as Json) ?? null, // SAFETY: GPSSnapshot is a valid JSON object
          breaks: [] as unknown as Json, // SAFETY: empty array is a valid JSON value
        })
        .select("time_entry_id")
        .single();

      if (insertError) throw insertError;

      void emit({
        event: "shift punched_in",
        workspace_id: workspace.workspace_id,
        actor_id: profileId ?? "",
        properties: {
          entity_type: "shift" as const,
          entity_id: shiftId,
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

      return { allowed: true, blockReason: null, warnings: [] } satisfies PunchResult;
    },

    onSuccess: (result) => {
      if (result.allowed) {
        toast.success("Stemplet inn på åpen vakt");
        void queryClient.invalidateQueries({
          queryKey: shiftClockKeys.activeEntry(profileId ?? ""),
        });
      } else {
        toast.error(result.blockReason ?? "Kunne ikke ta vakten");
      }
    },

    onError: () => {
      toast.error("Vakten er allerede tatt");
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

  const createAdhocShift = async (
    departmentId: string | null,
    adhocRequiresApproval: boolean,
    gps?: GPSSnapshot | null,
  ): Promise<PunchResult> => {
    return createAdhocShiftMutation.mutateAsync({ departmentId, adhocRequiresApproval, gps });
  };

  const takeOpenShift = async (shiftId: string, gps?: GPSSnapshot | null): Promise<PunchResult> => {
    return takeOpenShiftMutation.mutateAsync({ shiftId, gps });
  };

  const isLoading =
    activeEntryQuery.isLoading ||
    punchInMutation.isPending ||
    punchOutMutation.isPending ||
    startBreakMutation.isPending ||
    endBreakMutation.isPending ||
    createAdhocShiftMutation.isPending ||
    takeOpenShiftMutation.isPending;

  return {
    state,
    punchIn,
    punchOut,
    startBreak,
    endBreak,
    createAdhocShift,
    takeOpenShift,
    isLoading,
  };
}
