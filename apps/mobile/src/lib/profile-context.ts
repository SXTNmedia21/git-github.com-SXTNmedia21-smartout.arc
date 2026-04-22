/**
 * Shared profile-context resolver for mobile mutations.
 *
 * Returns `{ profileId, workspaceId }` for the current authenticated user.
 * Required for every mobile mutation per ADR-0134 (Mobile Telemetry Contract):
 * `emit()` MUST receive non-null, non-empty `workspace_id` and `actor_id`.
 *
 * Throws on missing auth / missing profile — mutations fail fast rather than
 * emitting corrupt telemetry.
 *
 * M5.2 (ADR-0132 / R5.2-3): empty-string fallback is explicitly banned here.
 * Any `?? ""` pattern on the caller side is a merge blocker. Callers should
 * either catch and render an error screen via `safeGetProfileContext()` OR
 * let the throw propagate up to an error boundary.
 */

import { supabase } from "@/lib/supabase";

export type ProfileContext = {
  profileId: string;
  workspaceId: string;
};

/** Structured error result — for screens that want to render a fallback UI. */
export type ProfileContextResult =
  | { ok: true; context: ProfileContext }
  | { ok: false; error: string };

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
  // Defence-in-depth: also refuse empty-string workspace_id / profile_id
  // (R5.2-3). The earlier falsy check catches null/undefined/empty already,
  // but an explicit `.trim() === ""` guard future-proofs against whitespace.
  if (profile.profile_id.trim() === "" || profile.workspace_id.trim() === "") {
    throw new Error("Profile identity fields are empty (ADR-0134 Invariant 2)");
  }

  return {
    profileId: profile.profile_id,
    workspaceId: profile.workspace_id,
  };
}

/**
 * Wrapper for UI call sites that want a typed result instead of try/catch.
 * Never falls back to empty strings — ADR-0134 Invariant 2 / R5.2-3.
 */
export async function safeGetProfileContext(): Promise<ProfileContextResult> {
  try {
    const context = await getProfileContext();
    return { ok: true, context };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
