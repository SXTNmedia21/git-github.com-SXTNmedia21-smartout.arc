/**
 * Fetches the current user's profile (name, avatar, department, etc.).
 *
 * Used across the app for displaying the user's name and resolving their
 * profile_id for shift/task queries. Long stale time since profile data
 * rarely changes during a session.
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Database } from "@smartout/supabase/database.types";

type Profile = Database["public"]["Tables"]["profile"]["Row"];

const CACHE_KEY = "cache:profile";
const STALE_TIME_MS = 30 * 60 * 1000;

function getPlaceholderData(): Profile | undefined {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { mmkvStorage } = require("@/lib/cache/persister");
    const cached = mmkvStorage?.getString(CACHE_KEY);
    return cached ? (JSON.parse(cached) as Profile) : undefined;
  } catch {
    return undefined;
  }
}

function persistToCache(data: Profile): void {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { mmkvStorage } = require("@/lib/cache/persister");
    mmkvStorage?.set(CACHE_KEY, JSON.stringify(data));
  } catch {
    // Cache module not available
  }
}

async function fetchMyProfile(): Promise<Profile> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("profile")
    .select("*")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  if (error) throw error;

  persistToCache(data);
  return data;
}

/**
 * Hook: returns the current user's profile.
 * Used for greeting, profile_id resolution, and avatar display.
 */
export function useMyProfile() {
  return useQuery<Profile>({
    queryKey: ["my-profile"],
    queryFn: fetchMyProfile,
    staleTime: STALE_TIME_MS,
    placeholderData: getPlaceholderData,
  });
}
