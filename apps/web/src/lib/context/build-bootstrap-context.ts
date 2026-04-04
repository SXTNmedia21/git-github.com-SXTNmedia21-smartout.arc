import { createClient } from "@smartout/supabase/server";
import type { BootstrapInput, BootstrapResponse, WorkspaceRole } from "./bootstrap-contract";

// ---------------------------------------------------------------------------
// Permission mapping per role (additive)
// ---------------------------------------------------------------------------

const ROLE_PERMISSIONS: Record<WorkspaceRole, readonly string[]> = {
  employee: ["view:own_profile", "view:own_schedule", "view:own_assignments"],
  manager: [
    "view:own_profile",
    "view:own_schedule",
    "view:own_assignments",
    "view:team_profiles",
    "view:team_schedule",
    "edit:team_schedule",
    "view:team_reports",
  ],
  admin: [
    "view:own_profile",
    "view:own_schedule",
    "view:own_assignments",
    "view:team_profiles",
    "view:team_schedule",
    "edit:team_schedule",
    "view:team_reports",
    "manage:workspace_settings",
    "manage:policies",
    "manage:protocols",
    "view:all_reports",
  ],
  owner: [
    "view:own_profile",
    "view:own_schedule",
    "view:own_assignments",
    "view:team_profiles",
    "view:team_schedule",
    "edit:team_schedule",
    "view:team_reports",
    "manage:workspace_settings",
    "manage:policies",
    "manage:protocols",
    "view:all_reports",
    "manage:billing",
    "manage:api_keys",
    "manage:members",
  ],
} as const;

// ---------------------------------------------------------------------------
// Suggested queries per page context
// ---------------------------------------------------------------------------

const PAGE_SUGGESTIONS: Record<string, string[]> = {
  schedule: ["Who is working today?", "Open shifts this week"],
  people: ["Employees not yet ready", "Overdue training"],
  reports: ["Daily reconciliation", "Readiness overview"],
  season: ["Current season budget", "Day factor settings"],
};

const DEFAULT_SUGGESTIONS = ["Search policies", "Find a protocol"];

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

/**
 * Builds the deterministic bootstrap context on the server side.
 *
 * Called once per page load (API route) and returns everything the client
 * needs to render the initial UI state without extra round-trips.
 */
export async function buildBootstrapContext(input: BootstrapInput): Promise<BootstrapResponse> {
  const { workspaceId, profileId, pageId } = input;

  const supabase = await createClient();

  // Fetch actual role from profile table — falls back to "employee" if not found
  const { data: profileRow } = await supabase
    .from("profile")
    .select("role")
    .eq("profile_id", profileId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  const role: WorkspaceRole = (profileRow?.role as WorkspaceRole) ?? "employee";
  const permissions = [...ROLE_PERMISSIONS[role]];

  // Query protocol_assignment to compute readiness score.
  // All assignments for this profile — count completed vs total.
  const { data: assignments } = await supabase
    .from("protocol_assignment")
    .select("status")
    .eq("profile_id", profileId);

  const totalAssignments = assignments?.length ?? 0;
  const completedAssignments =
    assignments?.filter((a: { status: string }) => a.status === "completed").length ?? 0;
  const expiredAssignments =
    assignments?.filter((a: { status: string }) => a.status === "expired").length ?? 0;

  const readinessScore =
    totalAssignments === 0 ? 0 : Math.round((completedAssignments / totalAssignments) * 100);

  const verificationFlags = {
    all_policies_learned: false, // policy learning tracking not yet implemented
    all_protocols_completed: totalAssignments > 0 && completedAssignments === totalAssignments,
    has_overdue_assignments: expiredAssignments > 0,
  };

  // No user search history table exists yet — return empty array
  const recentSearches: string[] = [];

  const suggestedQueries = PAGE_SUGGESTIONS[pageId] ?? DEFAULT_SUGGESTIONS;

  return {
    system: {
      page_id: pageId,
      workspace_id: workspaceId,
      profile_id: profileId,
      role,
      permissions,
    },
    intelligence: {
      readiness_score: readinessScore,
      verification_flags: verificationFlags,
    },
    search_hints: {
      recent_searches: recentSearches,
      suggested_queries: suggestedQueries,
    },
  };
}
