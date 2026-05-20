/**
 * Resolves the team leader's phone number for the current user.
 *
 * Data path:
 *   profile (current user) → team_member → team (leader_profile_id)
 *   → profile (leader) → user_identity (phone)
 *
 * Returns null when the user has no team, the team has no leader assigned,
 * or the leader has no phone number on file.
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

const STALE_TIME_MS = 5 * 60 * 1000;

/**
 * Walks the team → leader → phone chain for a given profile.
 * Returns the leader's phone string, or null if any step is missing.
 *
 * Exported for use as a `LeaderPhoneResolver` factory in `botsson-tools.ts`
 * (ADR-0378 R7: phone resolved locally, never on the voice wire).
 */
export async function fetchLeaderPhone(profileId: string): Promise<string | null> {
  // Step 1: Find the team this profile belongs to
  const { data: membership, error: memberError } = await supabase
    .from("team_member")
    .select("team_id")
    .eq("profile_id", profileId)
    .limit(1)
    .maybeSingle();

  if (memberError) throw memberError;
  if (!membership?.team_id) return null;

  // Step 2: Get the leader's profile_id from the team
  const { data: team, error: teamError } = await supabase
    .from("team")
    .select("leader_profile_id")
    .eq("team_id", membership.team_id)
    .maybeSingle();

  if (teamError) throw teamError;
  if (!team?.leader_profile_id) return null;

  // Step 3: Get the leader's user_id from their profile
  const { data: leaderProfile, error: profileError } = await supabase
    .from("profile")
    .select("user_id")
    .eq("profile_id", team.leader_profile_id)
    .maybeSingle();

  if (profileError) throw profileError;
  if (!leaderProfile?.user_id) return null;

  // Step 4: Get the leader's phone from user_identity
  const { data: identity, error: identityError } = await supabase
    .from("user_identity")
    .select("phone")
    .eq("user_id", leaderProfile.user_id)
    .maybeSingle();

  if (identityError) throw identityError;
  return identity?.phone ?? null;
}

/**
 * Hook: returns the team leader's phone number for the current user.
 * Disabled when profileId is not yet available.
 *
 * @param profileId - The current user's profile_id from useMyProfile()
 */
export function useLeaderPhone(profileId: string | null | undefined) {
  return useQuery<string | null>({
    queryKey: ["leader-phone", profileId],
    queryFn: () => fetchLeaderPhone(profileId!),
    enabled: Boolean(profileId),
    staleTime: STALE_TIME_MS,
  });
}
