import { cache } from "react";
import { createClient } from "@smartout/supabase/server";
import type { WorkspaceData } from "@/lib/workspace-context";

/**
 * Workspace field selection — matches WorkspaceData type exactly.
 * Shared constant to avoid divergence between queries.
 */
const WORKSPACE_SELECT =
  "workspace_id, company_id, name, slug, logo_url, currency, language, country, timezone, contract_status, onboarding_completed, setup_guide_completed" as const;

/**
 * Get the authenticated user for the current request.
 * Cached: only hits Supabase auth once per request regardless
 * of how many server components call it.
 */
export const getUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

/**
 * Get workspace by slug. Returns null if not found.
 * Cached: deduplicated across layout + page within one request.
 */
export const getWorkspaceBySlug = cache(async (slug: string) => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("workspace")
    .select(WORKSPACE_SELECT)
    .eq("slug", slug)
    .single();

  return data as unknown as WorkspaceData | null; // SAFETY: Supabase join returns union type; runtime shape matches the cast
});

/**
 * Get workspace by ID. Returns null if not found.
 * Cached: deduplicated across layout + page within one request.
 */
export const getWorkspaceById = cache(async (workspaceId: string) => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("workspace")
    .select(WORKSPACE_SELECT)
    .eq("workspace_id", workspaceId)
    .single();

  return data as unknown as WorkspaceData | null; // SAFETY: Supabase join returns union type; runtime shape matches the cast
});

/**
 * Get the user's profile in a specific workspace. Returns null if no access.
 * Cached: layout checks access, page can re-call without extra DB hit.
 */
export const getProfileInWorkspace = cache(async (userId: string, workspaceId: string) => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profile")
    .select("profile_id")
    .eq("user_id", userId)
    .eq("workspace_id", workspaceId)
    .single();

  return data;
});

/**
 * Get the user's best profile (for local dev / legacy routing without slug).
 * Prefers non-onboarding workspaces, then most recently created.
 * Returns workspace_id + profile_id, or null.
 * Cached: deduplicated within the request.
 */
export const getFirstProfile = cache(async (userId: string) => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profile")
    .select("workspace_id, profile_id, workspace:workspace!inner(onboarding_completed)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(10);

  if (!data || data.length === 0) return null;

  const profiles = data as Array<{
    workspace_id: string;
    profile_id: string;
    workspace: { onboarding_completed: boolean };
  }>;

  // Prefer onboarded workspace over ones still in onboarding
  const onboarded = profiles.find((p) => p.workspace.onboarding_completed);

  const best = onboarded ?? profiles[0]!;
  return { workspace_id: best.workspace_id, profile_id: best.profile_id };
});
