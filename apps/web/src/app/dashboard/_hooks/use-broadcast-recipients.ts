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
        // Employees currently clocked in — open punch with no punch_out
        const { data, error } = await supabase
          .schema("timesheet")
          .from("time_entry")
          .select("profile_id, profile:profile!inner(display_name)")
          .is("punch_out", null)
          .limit(50);

        if (error) throw error;

        return (data ?? []).map((r) => ({
          profile_id: r.profile_id,
          display_name:
            (r.profile as unknown as { display_name: string | null } | null)?.display_name ?? null,
        }));
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
              (r.profile as unknown as { display_name: string | null } | null)?.display_name ??
              null,
          }));
      }

      // yesterday group — anyone who clocked out yesterday
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .schema("timesheet")
        .from("time_entry")
        .select("profile_id")
        .gte("punch_out", `${yesterday}T00:00:00`)
        .lt("punch_out", `${today}T00:00:00`)
        .limit(50);

      if (error) throw error;

      return ((data ?? []) as Array<{ profile_id: string }>).map((r) => ({
        profile_id: r.profile_id,
        display_name: null as string | null,
      }));
    },
  });
}
