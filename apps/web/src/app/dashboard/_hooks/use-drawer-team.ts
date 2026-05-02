"use client";

/**
 * Hook for TeamRichCard: parallel queries for team details, members,
 * upcoming shifts (next 7d), and season binding.
 */

import { useQuery } from "@tanstack/react-query";
import { useWorkspaceOptional } from "@/lib/workspace-context";
import { createClient } from "@smartout/supabase/client";

export function useDrawerTeam(teamId: string) {
  const ctx = useWorkspaceOptional();
  const wsId = ctx?.workspace.workspace_id;
  const supabase = createClient();

  return useQuery({
    queryKey: ["dashboard", "entity-drawer", "team", wsId ?? "none", teamId] as const,
    queryFn: async () => {
      const now = new Date().toISOString();
      const in7d = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      const [teamRes, membersRes, seasonRes] = await Promise.all([
        supabase
          .from("team")
          .select(
            "team_id, name, description, team_type, is_active, color, leader_profile_id, season_id, department_id, created_at, leader:profile!leader_profile_id(display_name), department:department!department_id(name)",
          )
          .eq("team_id", teamId)
          .single(),

        supabase
          .from("team_member")
          .select(
            "team_member_id, profile_id, profile:profile!profile_id(display_name, role, status)",
          )
          .eq("team_id", teamId),

        supabase
          .from("season")
          .select("season_id, name, status, start_date, end_date")
          .eq("workspace_id", wsId!)
          .or(`status.eq.active,status.eq.draft`)
          .maybeSingle(),
      ]);

      if (teamRes.error) throw teamRes.error;

      // Fetch upcoming shift count for member profile IDs
      const memberProfileIds = (membersRes.data ?? []).map((m) => m.profile_id);
      let upcomingShiftCount = 0;

      if (memberProfileIds.length > 0) {
        const shiftRes = await supabase
          .from("schedule_shift")
          .select("shift_id", { count: "exact", head: true })
          .in("profile_id", memberProfileIds)
          .gte("start_at", now)
          .lt("start_at", in7d);
        upcomingShiftCount = shiftRes.count ?? 0;
      }

      const team = teamRes.data;
      const leader = team?.leader as { display_name: string } | null;
      const department = team?.department as { name: string } | null;

      // Resolve season name — from team.season_id if present
      let seasonName: string | null = null;
      if (team?.season_id) {
        const { data: teamSeason } = await supabase
          .from("season")
          .select("name, status")
          .eq("season_id", team.season_id)
          .single();
        seasonName = teamSeason?.name ?? null;
      }

      return {
        team,
        leaderName: leader?.display_name ?? null,
        departmentName: department?.name ?? null,
        members: (membersRes.data ?? []).map((m) => ({
          profile_id: m.profile_id,
          team_member_id: m.team_member_id,
          display_name:
            (m.profile as { display_name: string; role: string; status: string } | null)
              ?.display_name ?? "—",
          role:
            (m.profile as { display_name: string; role: string; status: string } | null)?.role ??
            "employee",
          status:
            (m.profile as { display_name: string; role: string; status: string } | null)?.status ??
            "active",
        })),
        memberCount: (membersRes.data ?? []).length,
        upcomingShiftCount,
        seasonName: seasonName ?? (team?.season_id ? "Sesong" : "Permanent"),
      };
    },
    enabled: !!wsId && !!teamId,
    staleTime: 30_000,
  });
}

export type DrawerTeamData = ReturnType<typeof useDrawerTeam>["data"];
