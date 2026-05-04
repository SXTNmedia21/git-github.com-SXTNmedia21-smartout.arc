import { cache } from "react";
import { createClient } from "@smartout/supabase/server";
import { timed } from "@/lib/perf";
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
export const getUser = cache(() =>
  timed("query.getUser", async () => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user;
  }),
);

/**
 * Get workspace by slug. Returns null if not found.
 * Cached: deduplicated across layout + page within one request.
 */
export const getWorkspaceBySlug = cache((slug: string) =>
  timed("query.getWorkspaceBySlug", async () => {
    const supabase = await createClient();
    const { data } = await supabase
      .from("workspace")
      .select(WORKSPACE_SELECT)
      .eq("slug", slug)
      .single();

    return data as unknown as WorkspaceData | null; // SAFETY: Supabase join returns union type; runtime shape matches the cast
  }),
);

/**
 * Get workspace by ID. Returns null if not found.
 * Cached: deduplicated across layout + page within one request.
 */
export const getWorkspaceById = cache((workspaceId: string) =>
  timed("query.getWorkspaceById", async () => {
    const supabase = await createClient();
    const { data } = await supabase
      .from("workspace")
      .select(WORKSPACE_SELECT)
      .eq("workspace_id", workspaceId)
      .single();

    return data as unknown as WorkspaceData | null; // SAFETY: Supabase join returns union type; runtime shape matches the cast
  }),
);

/**
 * Get the user's profile in a specific workspace. Returns null if no access.
 * Cached: layout checks access, page can re-call without extra DB hit.
 */
export const getProfileInWorkspace = cache((userId: string, workspaceId: string) =>
  timed("query.getProfileInWorkspace", async () => {
    const supabase = await createClient();
    const { data } = await supabase
      .from("profile")
      .select("profile_id, status, role")
      .eq("user_id", userId)
      .eq("workspace_id", workspaceId)
      .single();

    return data;
  }),
);

/**
 * Get the user's best profile (for local dev / legacy routing without slug).
 * Prefers non-onboarding workspaces, then most recently created.
 * Returns workspace_id + profile_id, or null.
 * Cached: deduplicated within the request.
 */
export const getFirstProfile = cache((userId: string) =>
  timed("query.getFirstProfile", async () => {
    const supabase = await createClient();
    const { data } = await supabase
      .from("profile")
      .select(
        "workspace_id, profile_id, status, role, workspace:workspace!inner(onboarding_completed)",
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(10);

    if (!data || data.length === 0) return null;

    const profiles = data as Array<{
      workspace_id: string;
      profile_id: string;
      status: string;
      role: string;
      workspace: { onboarding_completed: boolean };
    }>;

    // Prefer onboarded workspace over ones still in onboarding
    const onboarded = profiles.find((p) => p.workspace.onboarding_completed);

    const best = onboarded ?? profiles[0]!;
    return {
      workspace_id: best.workspace_id,
      profile_id: best.profile_id,
      status: best.status,
      role: best.role,
    };
  }),
);

/**
 * Get welcome-wizard completion status for a profile.
 * Returns null if column missing (pre-migration) or row not found.
 * Cached: deduplicated within the request.
 */
export const getProfileWelcomeStatus = cache((profileId: string) =>
  timed("query.getProfileWelcomeStatus", async () => {
    const supabase = await createClient();
    const { data } = await supabase
      .from("profile")
      .select("is_welcome_complete")
      .eq("profile_id", profileId)
      .maybeSingle();
    return data as { is_welcome_complete: boolean | null } | null;
  }),
);

/**
 * Get newest pending employment_contract for a profile in a workspace.
 * Used by dashboard layout to redirect employees with pending contracts to /walt.
 * Returns the contract_id (string) or null.
 * Cached: deduplicated within the request.
 */
export const getPendingEmploymentContract = cache((profileId: string, workspaceId: string) =>
  timed("query.getPendingEmploymentContract", async () => {
    const supabase = await createClient();
    const { data } = await supabase
      .from("employment_contract")
      .select("contract_id")
      .eq("profile_id", profileId)
      .eq("workspace_id", workspaceId)
      .in("status", ["sent", "viewed", "ready_to_send", "pending_signature"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return data?.contract_id ?? null;
  }),
);
