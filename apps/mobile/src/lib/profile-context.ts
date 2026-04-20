/**
 * Shared profile-context resolver for mobile mutations.
 *
 * Returns `{ profileId, workspaceId }` for the current authenticated user.
 * Required for every mobile mutation per ADR-0134 (Mobile Telemetry Contract):
 * `emit()` MUST receive non-null, non-empty `workspace_id` and `actor_id`.
 *
 * Throws on missing auth / missing profile — mutations fail fast rather than
 * emitting corrupt telemetry.
 */

import { supabase } from "@/lib/supabase";

export type ProfileContext = {
  profileId: string;
  workspaceId: string;
};

export async function getProfileContext(): Promise<ProfileContext> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: profile, error } = await supabase
    .from("profile")
    .select("profile_id, workspace_id")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  if (error || !profile) throw error ?? new Error("Profile not found");
  if (!profile.profile_id) throw new Error("Profile missing profile_id");
  if (!profile.workspace_id) throw new Error("Profile missing workspace_id");

  return {
    profileId: profile.profile_id,
    workspaceId: profile.workspace_id,
  };
}
