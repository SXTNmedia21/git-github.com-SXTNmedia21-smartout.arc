"use client";

// Full CRUD hooks for payroll.holiday_calendar and payroll.holiday_entry.
//
// Split into logical groups:
//   - Calendar CRUD (useHolidayCalendars, useCreateCalendar, useUpdateCalendar, useDeleteCalendar)
//   - Entry CRUD per calendar (useHolidayEntries, useCreateHolidayEntry, useUpdateHolidayEntry, useDeleteHolidayEntry)
//   - Public holidays read (usePublicHolidays) — platform-owned, no workspace filter
//   - Bulk import (useImportHolidays) — upserts public holidays into a calendar's entries

import { useContext } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { useWorkspaceOptional } from "@/lib/workspace-context";
import { createClient } from "@smartout/supabase/client";
import { emit } from "@smartout/telemetry";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { toast } from "sonner";

// ─── Schema ─────────────────────────────────────────────────────────────────

export const holidayCalendarSchema = z.object({
  name: z.string().min(1, "Navn er påkrevd"),
  is_default: z.boolean(),
});

export type HolidayCalendarInput = z.infer<typeof holidayCalendarSchema>;

export const holidayEntrySchema = z.object({
  holiday_date: z.string().min(1, "Dato er påkrevd"),
  name: z.string().min(1, "Navn er påkrevd"),
  name_no: z.string().nullable(),
  hours: z.number().min(0).max(24),
  is_full_day: z.boolean(),
});

export type HolidayEntryInput = z.infer<typeof holidayEntrySchema>;

// ─── Row types (match DB columns) ────────────────────────────────────────────

export type HolidayCalendarRow = HolidayCalendarInput & {
  id: string;
  workspace_id: string;
  created_at: string;
  updated_at: string;
  // Joined count — injected client-side from related entry query result
  entry_count?: number;
};

export type HolidayEntryRow = HolidayEntryInput & {
  id: string;
  workspace_id: string;
  calendar_id: string;
  created_at: string;
  updated_at: string;
};

// Public holiday — platform table, no workspace_id
export type PublicHolidayRow = {
  country_code: string;
  holiday_date: string;
  name: string;
  name_no: string | null;
  is_full_day: boolean;
};

// ─── Query Keys ──────────────────────────────────────────────────────────────

function calendarsKey(workspaceId: string) {
  return ["settings", "holiday-calendars", workspaceId] as const;
}

function entriesKey(calendarId: string) {
  return ["settings", "holiday-entries", calendarId] as const;
}

function publicHolidaysKey(year: number) {
  return ["platform", "public-holidays", year] as const;
}

// ─── Calendar Hooks ──────────────────────────────────────────────────────────

/**
 * Fetches all holiday calendars for the workspace, each with an entry_count
 * derived from a separate entries query. Ordered by name.
 */
export function useHolidayCalendars() {
  const ctx = useWorkspaceOptional();
  const wsId = ctx?.workspace.workspace_id;
  const supabase = createClient();

  return useQuery({
    queryKey: calendarsKey(wsId ?? "none"),
    queryFn: async (): Promise<HolidayCalendarRow[]> => {
      const { data, error } = await supabase
        .schema("payroll")
        .from("holiday_calendar")
        .select("*, holiday_entry(count)")
        .eq("workspace_id", wsId!)
        .order("name", { ascending: true });

      if (error) throw new Error(error.message);

      // Map the Postgres aggregate into a flat entry_count field
      return (data ?? []).map((row) => ({
        ...row,
        entry_count: Array.isArray(row.holiday_entry)
          ? ((row.holiday_entry[0] as { count: number } | undefined)?.count ?? 0)
          : 0,
      })) as HolidayCalendarRow[];
    },
    enabled: !!wsId,
    staleTime: 5 * 60 * 1000,
  });
}

/** Creates a new holiday calendar for the workspace. */
export function useCreateCalendar() {
  const ctx = useWorkspaceOptional();
  const wsId = ctx?.workspace.workspace_id;
  const { profileId } = useContext(DashboardContext);
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (values: HolidayCalendarInput) => {
      const { data, error } = await supabase
        .schema("payroll")
        .from("holiday_calendar")
        .insert({ workspace_id: wsId!, ...values })
        .select()
        .single();

      if (error) throw new Error(error.message);
      return data as HolidayCalendarRow;
    },
    onSuccess: (created) => {
      void emit({
        event: "holiday_calendar created",
        workspace_id: wsId ?? null,
        actor_id: profileId ?? "",
        properties: {
          data: {
            calendar_id: created.id,
            name: created.name,
          },
        },
      });
      void queryClient.invalidateQueries({ queryKey: calendarsKey(wsId!) });
      toast.success("Kalender opprettet");
    },
    onError: (error: Error) => {
      toast.error(`Kunne ikke opprette: ${error.message}`);
    },
  });
}

/** Updates an existing calendar's name or is_default flag. */
export function useUpdateCalendar() {
  const ctx = useWorkspaceOptional();
  const wsId = ctx?.workspace.workspace_id;
  const { profileId } = useContext(DashboardContext);
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, values }: { id: string; values: HolidayCalendarInput }) => {
      const { error } = await supabase
        .schema("payroll")
        .from("holiday_calendar")
        .update({ ...values, updated_at: new Date().toISOString() })
        .eq("id", id)
        .eq("workspace_id", wsId!);

      if (error) throw new Error(error.message);
    },
    onSuccess: (_data, { id, values }) => {
      void emit({
        event: "holiday_calendar updated",
        workspace_id: wsId ?? null,
        actor_id: profileId ?? "",
        properties: {
          data: {
            calendar_id: id,
            name: values.name,
          },
        },
      });
      void queryClient.invalidateQueries({ queryKey: calendarsKey(wsId!) });
      toast.success("Kalender oppdatert");
    },
    onError: (error: Error) => {
      toast.error(`Kunne ikke oppdatere: ${error.message}`);
    },
  });
}

/** Hard-deletes a calendar and all its entries (cascade expected at DB level). */
export function useDeleteCalendar() {
  const ctx = useWorkspaceOptional();
  const wsId = ctx?.workspace.workspace_id;
  const { profileId } = useContext(DashboardContext);
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { error } = await supabase
        .schema("payroll")
        .from("holiday_calendar")
        .delete()
        .eq("id", id)
        .eq("workspace_id", wsId!);

      if (error) throw new Error(error.message);
      return { id, name };
    },
    onSuccess: (_data, { id, name }) => {
      void emit({
        event: "holiday_calendar deleted",
        workspace_id: wsId ?? null,
        actor_id: profileId ?? "",
        properties: {
          data: {
            calendar_id: id,
            name,
          },
        },
      });
      void queryClient.invalidateQueries({ queryKey: calendarsKey(wsId!) });
      toast.success("Kalender slettet");
    },
    onError: (error: Error) => {
      toast.error(`Kunne ikke slette: ${error.message}`);
    },
  });
}

// ─── Entry Hooks ─────────────────────────────────────────────────────────────

/** Fetches all entries for a given calendar, ordered by date ascending. */
export function useHolidayEntries(calendarId: string | null) {
  const supabase = createClient();

  return useQuery({
    queryKey: entriesKey(calendarId ?? "none"),
    queryFn: async (): Promise<HolidayEntryRow[]> => {
      const { data, error } = await supabase
        .schema("payroll")
        .from("holiday_entry")
        .select("*")
        .eq("calendar_id", calendarId!)
        .order("holiday_date", { ascending: true });

      if (error) throw new Error(error.message);
      return (data ?? []) as HolidayEntryRow[];
    },
    enabled: !!calendarId,
    staleTime: 5 * 60 * 1000,
  });
}

/** Creates a single holiday entry in the specified calendar. */
export function useCreateHolidayEntry() {
  const ctx = useWorkspaceOptional();
  const wsId = ctx?.workspace.workspace_id;
  const { profileId } = useContext(DashboardContext);
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      calendarId,
      values,
    }: {
      calendarId: string;
      values: HolidayEntryInput;
    }) => {
      const { error } = await supabase
        .schema("payroll")
        .from("holiday_entry")
        .insert({
          workspace_id: wsId!,
          calendar_id: calendarId,
          ...values,
          name_no: values.name_no || null,
        });

      if (error) throw new Error(error.message);
    },
    onSuccess: (_data, { calendarId }) => {
      void emit({
        event: "holiday_entry created",
        workspace_id: wsId ?? null,
        actor_id: profileId ?? "",
        properties: { data: { calendar_id: calendarId } },
      });
      void queryClient.invalidateQueries({ queryKey: entriesKey(calendarId) });
      // Also refresh calendars so the entry_count badge updates
      void queryClient.invalidateQueries({ queryKey: calendarsKey(wsId!) });
      toast.success("Helligdag lagt til");
    },
    onError: (error: Error) => {
      toast.error(`Kunne ikke legge til: ${error.message}`);
    },
  });
}

/** Updates an existing holiday entry by ID. */
export function useUpdateHolidayEntry() {
  const ctx = useWorkspaceOptional();
  const wsId = ctx?.workspace.workspace_id;
  const { profileId } = useContext(DashboardContext);
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      calendarId,
      values,
    }: {
      id: string;
      calendarId: string;
      values: HolidayEntryInput;
    }) => {
      const { error } = await supabase
        .schema("payroll")
        .from("holiday_entry")
        .update({
          ...values,
          name_no: values.name_no || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .eq("workspace_id", wsId!);

      if (error) throw new Error(error.message);
      return { calendarId };
    },
    onSuccess: (_data, { id, calendarId }) => {
      void emit({
        event: "holiday_entry updated",
        workspace_id: wsId ?? null,
        actor_id: profileId ?? "",
        properties: { data: { entry_id: id, calendar_id: calendarId } },
      });
      void queryClient.invalidateQueries({ queryKey: entriesKey(calendarId) });
      toast.success("Helligdag oppdatert");
    },
    onError: (error: Error) => {
      toast.error(`Kunne ikke oppdatere: ${error.message}`);
    },
  });
}

/** Hard-deletes a holiday entry by ID. */
export function useDeleteHolidayEntry() {
  const ctx = useWorkspaceOptional();
  const wsId = ctx?.workspace.workspace_id;
  const { profileId } = useContext(DashboardContext);
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, calendarId }: { id: string; calendarId: string }) => {
      const { error } = await supabase
        .schema("payroll")
        .from("holiday_entry")
        .delete()
        .eq("id", id)
        .eq("workspace_id", wsId!);

      if (error) throw new Error(error.message);
      return { id, calendarId };
    },
    onSuccess: (_data, { calendarId }) => {
      void emit({
        event: "holiday_entry deleted",
        workspace_id: wsId ?? null,
        actor_id: profileId ?? "",
        properties: { data: { calendar_id: calendarId } },
      });
      void queryClient.invalidateQueries({ queryKey: entriesKey(calendarId) });
      void queryClient.invalidateQueries({ queryKey: calendarsKey(wsId!) });
      toast.success("Helligdag slettet");
    },
    onError: (error: Error) => {
      toast.error(`Kunne ikke slette: ${error.message}`);
    },
  });
}

// ─── Public Holidays Hook ────────────────────────────────────────────────────

/**
 * Fetches platform-owned public holidays for Norway for the given year.
 * Uses the public schema (no workspace_id filter needed).
 */
export function usePublicHolidays(year: number) {
  const supabase = createClient();

  return useQuery({
    queryKey: publicHolidaysKey(year),
    queryFn: async (): Promise<PublicHolidayRow[]> => {
      const { data, error } = await supabase
        .from("public_holiday")
        .select("*")
        .eq("country_code", "NO")
        .gte("holiday_date", `${year}-01-01`)
        .lte("holiday_date", `${year}-12-31`)
        .order("holiday_date", { ascending: true });

      if (error) throw new Error(error.message);
      return (data ?? []) as PublicHolidayRow[];
    },
    staleTime: 24 * 60 * 60 * 1000, // Public holidays don't change — cache for 24h
  });
}

// ─── Bulk Import Hook ─────────────────────────────────────────────────────────

/**
 * Bulk-upserts a selection of public holidays into a calendar's entries.
 * Uses ON CONFLICT (calendar_id, holiday_date) DO NOTHING so already-existing
 * entries are skipped without an error — the count in the toast reflects
 * how many were actually inserted (not already present).
 */
export function useImportHolidays() {
  const ctx = useWorkspaceOptional();
  const wsId = ctx?.workspace.workspace_id;
  const { profileId } = useContext(DashboardContext);
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      calendarId,
      holidays,
    }: {
      calendarId: string;
      holidays: PublicHolidayRow[];
    }) => {
      const rows = holidays.map((h) => ({
        workspace_id: wsId!,
        calendar_id: calendarId,
        holiday_date: h.holiday_date,
        name: h.name,
        name_no: h.name_no,
        hours: 8,
        is_full_day: h.is_full_day,
      }));

      const { error, count } = await supabase
        .schema("payroll")
        .from("holiday_entry")
        .upsert(rows, { onConflict: "calendar_id,holiday_date", ignoreDuplicates: true })
        .select("id");

      if (error) throw new Error(error.message);
      return { count: count ?? 0, calendarId };
    },
    onSuccess: ({ count, calendarId }, variables) => {
      void emit({
        event: "holidays imported",
        workspace_id: wsId ?? null,
        actor_id: profileId ?? "",
        properties: {
          data: {
            calendar_id: calendarId,
            count: variables.holidays.length,
            inserted: count,
          },
        },
      });
      void queryClient.invalidateQueries({ queryKey: entriesKey(calendarId) });
      void queryClient.invalidateQueries({ queryKey: calendarsKey(wsId!) });
      toast.success(`${variables.holidays.length} helligdager importert`);
    },
    onError: (error: Error) => {
      toast.error(`Import feilet: ${error.message}`);
    },
  });
}
