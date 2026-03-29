"use client";

/**
 * TanStack Query hook to fetch workspace employees from the profile table.
 * Replaces the old dummyEmployees array with real Supabase data.
 * Connected to: schedule-keys.ts (query keys), workspace-context.tsx (workspace ID)
 * Connected to: profile, team_member, team tables
 */

import { useQuery } from "@tanstack/react-query";

import { useWorkspace } from "@/lib/workspace-context";
import { createClient } from "@smartout/supabase/client";

import { scheduleKeys } from "./schedule-keys";

// ── Exported type ────────────────────────────────────────────

export type ScheduleEmployee = {
  id: string;
  name: string;
  role: string;
  jobTitle: string;
  team: string;
  departmentId: string;
  departmentName: string;
  locationName: string;
  avatarColor: string;
  initials: string;
};

// ── Avatar colors ────────────────────────────────────────────

const AVATAR_COLORS = [
  "bg-blue-500/20 text-blue-400 border-blue-500/30",
  "bg-orange-500/20 text-orange-400 border-orange-500/30",
  "bg-purple-500/20 text-purple-400 border-purple-500/30",
  "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  "bg-pink-500/20 text-pink-400 border-pink-500/30",
  "bg-zinc-500/20 text-zinc-400 border-zinc-500/30",
  "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
  "bg-amber-500/20 text-amber-400 border-amber-500/30",
];

/**
 * Derives a deterministic avatar color from a profile ID.
 * Uses a simple hash to pick from the palette so the same
 * person always gets the same color.
 */
function getAvatarColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) - hash + id.charCodeAt(i)) | 0;
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]!;
}

/**
 * Extracts up to 2 initials from a display name.
 * "Lars Erik Johansen" → "LJ" (first + last), "Ahmad" → "AH" (first 2).
 */
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0]![0]}${parts[parts.length - 1]![0]}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

// ── Hook ─────────────────────────────────────────────────────

export function useEmployees() {
  const { workspace } = useWorkspace();
  const workspaceId = workspace.workspace_id;

  return useQuery({
    queryKey: scheduleKeys.employees(workspaceId),
    queryFn: async () => {
      const supabase = createClient();

      // 1. Fetch active/trainee profiles with department and location joins
      const { data: profiles, error: profileError } = await supabase
        .from("profile")
        .select(
          "profile_id, display_name, role, job_title, status, department_id, location_id, department:department_id(name), location:location_id(name)",
        )
        .eq("workspace_id", workspaceId)
        .in("status", ["active", "trainee"])
        .order("display_name");

      if (profileError) throw profileError;
      if (!profiles || profiles.length === 0) return [] as ScheduleEmployee[];

      type ProfileRow = (typeof profiles)[number];

      // 2. Fetch team memberships for all these profiles in one query
      const profileIds = profiles.map((p: ProfileRow) => p.profile_id);
      const { data: teamMembers, error: teamError } = await supabase
        .from("team_member")
        .select("profile_id, team:team(name)")
        .in("profile_id", profileIds);

      if (teamError) throw teamError;

      // Build a profile_id → team name lookup
      const teamByProfile = new Map<string, string>();
      if (teamMembers) {
        for (const tm of teamMembers) {
          // Take the first team membership found per profile
          if (!teamByProfile.has(tm.profile_id)) {
            const teamData = tm.team;
            const teamName =
              teamData && typeof teamData === "object" && "name" in teamData
                ? (teamData as { name: string }).name
                : "";
            if (teamName) {
              teamByProfile.set(tm.profile_id, teamName);
            }
          }
        }
      }

      // Helper to extract name from a PostgREST join result (object or null)
      const extractName = (joined: unknown): string => {
        if (joined && typeof joined === "object" && "name" in joined) {
          return (joined as { name: string }).name;
        }
        return "";
      };

      // 3. Map to ScheduleEmployee
      return profiles.map((p: ProfileRow): ScheduleEmployee => {
        const name = p.display_name || "Ukjent";
        return {
          id: p.profile_id,
          name,
          role: p.role ?? "",
          jobTitle: p.job_title ?? "",
          team: teamByProfile.get(p.profile_id) ?? "",
          departmentId: p.department_id ?? "",
          departmentName: extractName(p.department),
          locationName: extractName(p.location),
          avatarColor: getAvatarColor(p.profile_id),
          initials: getInitials(name),
        };
      });
    },
    staleTime: 5 * 60 * 1000, // 5 minutes — employees don't change often
  });
}
