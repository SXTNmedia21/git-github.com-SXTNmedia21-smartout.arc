/**
 * Fetches the current user's profile (name, avatar, department, etc.).
 *
 * Used across the app for displaying the user's name and resolving their
 * profile_id for shift/task queries. Long stale time since profile data
 * rarely changes during a session.
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useWorkspaceStore } from "@/hooks/stores/use-workspace-store";
import type { Database } from "@smartout/supabase/database.types";

type ProfileRow = Database["public"]["Tables"]["profile"]["Row"];

/** Profile with joined workspace and department names */
export type ProfileWithJoins = ProfileRow & {
  workspace: { name: string } | null;
  department: { name: string } | null;
};

/** Select string that joins workspace and department names onto the profile */
const PROFILE_SELECT = "*, workspace:workspace_id(name), department:department_id(name)" as const;

const CACHE_KEY = "cache:profile";
const STALE_TIME_MS = 30 * 60 * 1000;

function getPlaceholderData(): ProfileWithJoins | undefined {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { mmkvStorage } = require("@/lib/cache/persister");
    const cached = mmkvStorage?.getString(CACHE_KEY);
    return cached ? (JSON.parse(cached) as ProfileWithJoins) : undefined;
  } catch {
    return undefined;
  }
}

function persistToCache(data: ProfileWithJoins): void {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { mmkvStorage } = require("@/lib/cache/persister");
    mmkvStorage?.set(CACHE_KEY, JSON.stringify(data));
  } catch {
    // Cache module not available
  }
}

async function fetchMyProfile(selectedProfileId: string | null): Promise<ProfileWithJoins> {
  // If we have a selected profile (from workspace-select), fetch that specific one
  if (selectedProfileId) {
    const { data, error } = await supabase
      .from("profile")
      .select(PROFILE_SELECT)
      .eq("profile_id", selectedProfileId)
      .single();

    if (error) throw error;
    const profile = data as unknown as ProfileWithJoins;
    persistToCache(profile);
    return profile;
  }

  // Fallback: fetch first active profile for the user
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("profile")
    .select(PROFILE_SELECT)
    .eq("user_id", user.id)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("No active profile found. Your account may have been deactivated.");

  const profile = data as unknown as ProfileWithJoins;
  persistToCache(profile);
  return profile;
}

/**
 * Hook: returns the current user's profile.
 * Uses the selected profile from workspace-select (persisted in MMKV).
 * Falls back to first active profile if no selection stored.
 */
export function useMyProfile() {
  const selectedProfileId = useWorkspaceStore((s) => s.selectedProfileId);

  return useQuery<ProfileWithJoins>({
    queryKey: ["my-profile", selectedProfileId],
    queryFn: () => fetchMyProfile(selectedProfileId),
    staleTime: STALE_TIME_MS,
    placeholderData: getPlaceholderData,
  });
}
