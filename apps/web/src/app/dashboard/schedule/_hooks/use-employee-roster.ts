"use client";

/**
 * TanStack Query hooks for employee_roster (turnus) CRUD + auto-fill.
 * Connected to: schedule-keys.ts (query keys)
 * Connected to: use-shifts.ts (auto-fill creates schedule_shift rows)
 * Connected to: use-absences.ts (auto-fill skips days with absences)
 */

import { useContext } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { useWorkspace } from "@/lib/workspace-context";
import { emit } from "@smartout/telemetry";
import { createClient } from "@smartout/supabase/client";
import type { Database } from "@smartout/supabase";

import { scheduleKeys } from "./schedule-keys";

type ShiftInsert = Database["public"]["Tables"]["schedule_shift"]["Insert"];

// ── Types ─────────────────────────────────────────────────────

/** Weekday keys for the roster pattern */
type Weekday = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

/** Pattern maps weekday to "HH:MM-HH:MM" or null (no shift) */
export type RosterPattern = Record<Weekday, string | null>;

/** Frontend representation of an employee roster */
export type Roster = {
  id: string;
  profileId: string;
  workspaceId: string;
  pattern: RosterPattern;
  periodStart: string; // DATE "YYYY-MM-DD"
  periodEnd: string | null; // null = ongoing
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

/** DB row shape (used until database.types.ts is regenerated) */
type RosterRow = {
  employee_roster_id: string;
  profile_id: string;
  workspace_id: string;
  pattern: unknown; // JSONB
  period_start: string;
  period_end: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

// ── Weekday helpers ───────────────────────────────────────────

const WEEKDAY_LABELS: Record<Weekday, string> = {
  mon: "Man",
  tue: "Tir",
  wed: "Ons",
  thu: "Tor",
  fri: "Fre",
  sat: "Lør",
  sun: "Søn",
};

export const WEEKDAYS: Weekday[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

export { WEEKDAY_LABELS };

/** Maps JS Date.getDay() (0=Sun) to Weekday key */
const DAY_INDEX_TO_WEEKDAY: Weekday[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

export function getWeekdayFromDate(date: Date): Weekday {
  return DAY_INDEX_TO_WEEKDAY[date.getDay()]!;
}

/** Creates a blank pattern (no shifts any day) */
export function emptyPattern(): RosterPattern {
  return { mon: null, tue: null, wed: null, thu: null, fri: null, sat: null, sun: null };
}

// ── Mappers ───────────────────────────────────────────────────

function fromDbRoster(row: RosterRow): Roster {
  return {
    id: row.employee_roster_id,
    profileId: row.profile_id,
    workspaceId: row.workspace_id,
    pattern: row.pattern as RosterPattern,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ══════════════════════════════════════════════════════════════
// Query: Fetch active roster for an employee
// ══════════════════════════════════════════════════════════════

export function useRoster(profileId: string | null) {
  const { workspace } = useWorkspace();

  return useQuery({
    queryKey: scheduleKeys.roster(workspace.workspace_id, profileId ?? ""),
    queryFn: async () => {
      if (!profileId) return null;
      const supabase = createClient();

      // employee_roster not yet in generated types — cast to bypass
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("employee_roster")
        .select("*")
        .eq("workspace_id", workspace.workspace_id)
        .eq("profile_id", profileId)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;

      return fromDbRoster(data as RosterRow);
    },
    enabled: !!profileId,
    staleTime: 5 * 60 * 1000,
  });
}

// ══════════════════════════════════════════════════════════════
// Mutation: Upsert roster (create or update)
// ══════════════════════════════════════════════════════════════

type UpsertRosterInput = {
  id?: string; // if present, update; otherwise insert
  profileId: string;
  pattern: RosterPattern;
  periodStart: string;
  periodEnd: string | null;
};

export function useUpsertRoster() {
  const queryClient = useQueryClient();
  const { workspace } = useWorkspace();
  const { profileId } = useContext(DashboardContext);

  return useMutation({
    mutationFn: async (input: UpsertRosterInput) => {
      const supabase = createClient();
      // employee_roster not yet in generated types — cast to bypass
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rosterTable = (supabase as any).from("employee_roster");

      if (input.id) {
        // Update existing roster
        const { data, error } = await rosterTable
          .update({
            pattern: input.pattern,
            period_start: input.periodStart,
            period_end: input.periodEnd,
          })
          .eq("employee_roster_id", input.id)
          .select()
          .single();

        if (error) throw error;
        return fromDbRoster(data as RosterRow);
      }

      // Deactivate any existing active rosters for this employee
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from("employee_roster")
        .update({ is_active: false })
        .eq("workspace_id", workspace.workspace_id)
        .eq("profile_id", input.profileId)
        .eq("is_active", true);

      // Insert new roster
      const { data, error } = await rosterTable
        .insert({
          profile_id: input.profileId,
          workspace_id: workspace.workspace_id,
          pattern: input.pattern,
          period_start: input.periodStart,
          period_end: input.periodEnd,
        })
        .select()
        .single();

      if (error) throw error;
      return fromDbRoster(data as RosterRow);
    },

    onSuccess: (data, input) => {
      void emit({
        event: input.id ? "roster updated" : "roster created",
        workspace_id: workspace.workspace_id,
        actor_id: profileId ?? "",
        properties: {
          data: { department_id: "" },
        },
      });
      toast.success("Turnus lagret");
      queryClient.invalidateQueries({
        queryKey: scheduleKeys.roster(workspace.workspace_id, input.profileId),
      });
    },

    onError: () => {
      toast.error("Kunne ikke lagre turnus");
    },
  });
}

// ══════════════════════════════════════════════════════════════
// Mutation: Auto-fill shifts from roster pattern
// ══════════════════════════════════════════════════════════════

type AutoFillInput = {
  profileId: string;
  pattern: RosterPattern;
  periodStart: string; // "YYYY-MM-DD"
  periodEnd: string; // "YYYY-MM-DD"
  role: string;
};

export function useAutoFillShifts() {
  const queryClient = useQueryClient();
  const { workspace } = useWorkspace();
  const { profileId } = useContext(DashboardContext);

  return useMutation({
    mutationFn: async (input: AutoFillInput) => {
      const supabase = createClient();

      // 1. Fetch existing absences for the period
      const { data: absences } = await supabase
        .from("schedule_absence")
        .select("shift_date")
        .eq("workspace_id", workspace.workspace_id)
        .eq("employee_id", input.profileId)
        .gte("shift_date", input.periodStart)
        .lte("shift_date", input.periodEnd)
        .in("status", ["pending", "approved"]);

      const absenceDates = new Set((absences ?? []).map((a) => a.shift_date));

      // 2. Fetch existing shifts to avoid duplicates
      const { data: existingShifts } = await supabase
        .from("schedule_shift")
        .select("shift_date")
        .eq("workspace_id", workspace.workspace_id)
        .eq("employee_id", input.profileId)
        .gte("shift_date", input.periodStart)
        .lte("shift_date", input.periodEnd);

      const existingDates = new Set((existingShifts ?? []).map((s) => s.shift_date));

      // 3. Generate shifts for each day in period
      const shiftsToInsert: ShiftInsert[] = [];

      const start = new Date(input.periodStart);
      const end = new Date(input.periodEnd);

      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().slice(0, 10);
        const weekday = getWeekdayFromDate(d);
        const timeRange = input.pattern[weekday];

        // Skip: no pattern for this weekday
        if (!timeRange) continue;
        // Skip: employee has absence
        if (absenceDates.has(dateStr)) continue;
        // Skip: shift already exists
        if (existingDates.has(dateStr)) continue;

        const [startTime, endTime] = timeRange.split("-");
        if (!startTime || !endTime) continue;

        // Calculate work hours
        const [sh, sm] = startTime.split(":").map(Number);
        const [eh, em] = endTime.split(":").map(Number);
        let workHours = eh! + em! / 60 - (sh! + sm! / 60);
        if (workHours < 0) workHours += 24; // overnight shift

        // Determine day category from start time
        type DayCat = Database["public"]["Enums"]["day_category"];
        const hour = sh!;
        let dayCategory: DayCat = "morning";
        if (hour >= 16) dayCategory = "evening";
        else if (hour >= 14) dayCategory = "afternoon";
        else if (hour >= 11) dayCategory = "midday";

        // Weekend override
        if (weekday === "sat" || weekday === "sun") dayCategory = "weekend";

        shiftsToInsert.push({
          workspace_id: workspace.workspace_id,
          employee_id: input.profileId,
          shift_date: dateStr,
          role: input.role,
          start_time: startTime,
          end_time: endTime,
          work_hours: Math.round(workHours * 100) / 100,
          breaks: 0,
          day_category: dayCategory,
          status: "created" as const,
          is_published: false,
          indicator: "blue",
        });
      }

      if (shiftsToInsert.length === 0) {
        return { count: 0 };
      }

      const { error } = await supabase.from("schedule_shift").insert(shiftsToInsert);
      if (error) throw error;

      return { count: shiftsToInsert.length };
    },

    onSuccess: (result) => {
      void emit({
        event: "roster created",
        workspace_id: workspace.workspace_id,
        actor_id: profileId ?? "",
        properties: {
          data: { department_id: "" },
        },
      });
      if (result.count > 0) {
        toast.success(`${result.count} vakter opprettet`);
      } else {
        toast.info("Ingen nye vakter å opprette for perioden");
      }
      // Invalidate all shifts queries to refresh the grid
      queryClient.invalidateQueries({ queryKey: ["schedule", "shifts"] });
    },

    onError: () => {
      toast.error("Kunne ikke auto-fylle vakter");
    },
  });
}
