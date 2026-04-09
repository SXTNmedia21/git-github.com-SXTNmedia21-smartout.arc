"use client";

/**
 * useBroadcastRecipients — Returns profile IDs and names for a recipient group.
 *
 * Three groups:
 *   on_duty   — currently clocked in (open time_entry with no punch_out)
 *   incoming  — scheduled for today but not yet clocked in
 *   yesterday — anyone who clocked out yesterday
 *
 * The time_entry table lives in the "timesheet" schema; use .schema("timesheet").
 */

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";

type RecipientGroup = "on_duty" | "incoming" | "yesterday";

type Recipient = {
  profile_id: string;
  display_name: string | null;
};

export function useBroadcastRecipients(group: RecipientGroup) {
  const { workspace } = useWorkspace();
  const wsId = workspace.workspace_id;
  const today = new Date().toISOString().split("T")[0]!;
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().split("T")[0]!;

  return useQuery({
    queryKey: ["dashboard", "broadcast-recipients", wsId, group],
    staleTime: 30_000,
    queryFn: async (): Promise<Recipient[]> => {
      const supabase = createClient();

      if (group === "on_duty") {
        // Employees currently clocked in — open punch with no punch_out.
        // Two-step query: cross-schema FK joins (timesheet→public) fail in PostgREST.
        const { data: entries, error: entryError } = await supabase
          .schema("timesheet")
          .from("time_entry")
          .select("profile_id")
          .is("punch_out", null)
          .limit(50);

        if (entryError) throw entryError;
        const profileIds = (entries ?? []).map((e) => e.profile_id).filter(Boolean);
        if (profileIds.length === 0) return [];

        const { data: profiles } = await supabase
          .from("profile")
          .select("profile_id, display_name")
          .in("profile_id", profileIds);

        const nameMap = new Map((profiles ?? []).map((p) => [p.profile_id, p.display_name]));
        return profileIds.map((id) => ({ profile_id: id, display_name: nameMap.get(id) ?? null }));
      }

      if (group === "incoming") {
        // Scheduled for today but not yet clocked in
        const { data, error } = await supabase
          .from("schedule_shift")
          .select("employee_id, profile:employee_id(display_name)")
          .eq("shift_date", today)
          .eq("status", "published")
          .not("employee_id", "is", null)
          .limit(50);

        if (error) throw error;

        // Exclude anyone already clocked in
        const { data: clockedIn } = await supabase
          .schema("timesheet")
          .from("time_entry")
          .select("profile_id")
          .is("punch_out", null);

        const clockedSet = new Set(
          (clockedIn ?? []).map((r: { profile_id: string }) => r.profile_id),
        );

        return (data ?? [])
          .filter((r) => !clockedSet.has(r.employee_id as string))
          .map((r) => ({
            profile_id: r.employee_id as string,
            display_name:
              (r.profile as unknown as { display_name: string | null } | null)?.display_name ?? // SAFETY: Supabase join returns union type; runtime shape matches the cast
              null,
          }));
      }

      // yesterday group — anyone who clocked out yesterday
      const { data, error } = await supabase
        .schema("timesheet" as "public") // SAFETY: timesheet is a valid Postgres schema not represented as "public" in Supabase client types
        // SAFETY: "time_entry" exists in timesheet schema at runtime; cast to a known public table to satisfy TS
        .from("time_entry" as "profile")
        .select("profile_id")
        .gte("punch_out", `${yesterday}T00:00:00`)
        .lt("punch_out", `${today}T00:00:00`)
        .limit(50);

      if (error) throw error;

      // SAFETY: data shape is { profile_id: string }[] at runtime; cast through unknown to bypass TS overlap check
      return ((data ?? []) as unknown as Array<{ profile_id: string }>).map((r) => ({
        profile_id: r.profile_id,
        display_name: null as string | null,
      }));
    },
  });
}
