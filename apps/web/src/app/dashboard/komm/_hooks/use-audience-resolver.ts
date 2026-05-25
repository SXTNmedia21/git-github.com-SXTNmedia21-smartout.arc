"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";

export type AudienceKind = "all" | "on_duty" | "on_shift" | "department" | "role" | "individuals";

export type AudienceInput =
  | { kind: "all" }
  | { kind: "on_duty" }
  | {
      kind: "on_shift";
      /** Minutes before/after NOW to include shifts. Defaults to 120 (2h window). */
      windowMinutes?: number;
    }
  | { kind: "department"; departmentIds: string[] }
  | { kind: "role"; roles: string[] }
  | { kind: "individuals"; profileIds: string[] };

export type AudienceResolved = {
  profileIds: string[];
  count: number;
  kind: AudienceKind;
};

export function useAudienceResolver(input: AudienceInput) {
  const { workspace } = useWorkspace();
  const wsId = workspace.workspace_id;

  return useQuery({
    queryKey: ["dashboard", "audience-resolver", wsId, input],
    staleTime: 30_000,
    queryFn: async (): Promise<AudienceResolved> => {
      const supabase = createClient();

      if (input.kind === "all") {
        const { data, error } = await supabase
          .from("profile")
          .select("profile_id, display_name")
          .eq("workspace_id", wsId)
          .eq("status", "active");
        if (error) throw error;
        return {
          kind: "all",
          profileIds: (data ?? []).map((p) => p.profile_id),
          count: data?.length ?? 0,
        };
      }

      if (input.kind === "on_duty") {
        // Mirror the canonical pattern from use-broadcast-recipients.ts:37-58.
        // SAFETY: timesheet schema FK joins to public.profile fail in PostgREST,
        // so query time_entry rows then re-resolve profile_ids. No display_name
        // needed here (caller only needs IDs for targeting).
        // workspace_id scoping required here — same as all/department/role branches.
        const { data: entries, error } = await supabase
          .schema("timesheet")
          .from("time_entry")
          .select("profile_id")
          .eq("workspace_id", wsId)
          .is("punch_out", null)
          .limit(500);
        if (error) throw error;
        const ids = Array.from(
          new Set((entries ?? []).map((e: { profile_id: string }) => e.profile_id).filter(Boolean)),
        );
        return { kind: "on_duty", profileIds: ids, count: ids.length };
      }

      if (input.kind === "on_shift") {
        // BUG-SIM-17: on_shift queries schedule_shift for shifts overlapping the
        // current window (NOW ± windowMinutes). Distinct from on_duty (clocked in).
        const windowMs = (input.windowMinutes ?? 120) * 60_000;
        const now = Date.now();
        const windowStart = new Date(now - windowMs).toISOString();
        const windowEnd = new Date(now + windowMs).toISOString();
        const { data, error } = await supabase
          .from("schedule_shift")
          .select("profile_id")
          .eq("workspace_id", wsId)
          .lte("start_time", windowEnd)
          .gte("end_time", windowStart);
        if (error) throw error;
        const ids = Array.from(
          new Set((data ?? []).map((s: { profile_id: string }) => s.profile_id).filter(Boolean)),
        );
        return { kind: "on_shift", profileIds: ids, count: ids.length };
      }

      if (input.kind === "department") {
        if (input.departmentIds.length === 0) {
          return { kind: "department", profileIds: [], count: 0 };
        }
        const { data, error } = await supabase
          .from("profile")
          .select("profile_id, department_id")
          .eq("workspace_id", wsId)
          .eq("status", "active")
          .in("department_id", input.departmentIds);
        if (error) throw error;
        const ids = (data ?? []).map((p) => p.profile_id);
        return { kind: "department", profileIds: ids, count: ids.length };
      }

      if (input.kind === "role") {
        if (input.roles.length === 0) {
          return { kind: "role", profileIds: [], count: 0 };
        }
        // SAFETY: caller supplies role strings from the domain model; cast to
        // satisfy the Supabase-generated enum type without narrowing the public API.
        type ProfileRole = "admin" | "manager" | "employee" | "owner" | "system";
        const { data, error } = await supabase
          .from("profile")
          .select("profile_id, role")
          .eq("workspace_id", wsId)
          .eq("status", "active")
          .in("role", input.roles as ProfileRole[]);
        if (error) throw error;
        const ids = (data ?? []).map((p) => p.profile_id);
        return { kind: "role", profileIds: ids, count: ids.length };
      }

      // individuals — no DB call, just deduplicate
      const deduped = Array.from(new Set(input.profileIds));
      return { kind: "individuals", profileIds: deduped, count: deduped.length };
    },
  });
}
