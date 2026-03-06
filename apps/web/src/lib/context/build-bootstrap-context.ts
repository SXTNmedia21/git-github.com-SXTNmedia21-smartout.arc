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
 * This function is called once per page load (server component or API route)
 * and returns everything the client needs to render the initial UI state
 * without extra round-trips.
 */
export async function buildBootstrapContext(input: BootstrapInput): Promise<BootstrapResponse> {
  const { workspaceId, profileId, pageId } = input;

  // TODO: Fetch actual role from DB via profile + company_member lookup
  // For now default to "employee" — the safest (least-privileged) role
  const role: WorkspaceRole = "employee";

  const permissions = [...ROLE_PERMISSIONS[role]];

  // TODO: Query protocol_assignment + policy tables to compute real readiness
  const readinessScore = 0;

  // TODO: Query protocol_assignment for overdue / completion status
  const verificationFlags = {
    all_policies_learned: false,
    all_protocols_completed: false,
    has_overdue_assignments: false,
  };

  // TODO: Query a user_search_history table or similar for recent searches
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
