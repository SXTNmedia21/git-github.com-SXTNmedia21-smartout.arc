/**
 * Bootstrap Context Contract
 *
 * Defines the shape of the server-built context that every dashboard page
 * receives on load. This is the single source of truth for what the client
 * knows about the current workspace, user role, readiness state, and
 * search affordances.
 */

// ---------------------------------------------------------------------------
// Core role type (mirrors DB enum)
// ---------------------------------------------------------------------------

export type WorkspaceRole = "employee" | "manager" | "admin" | "owner";

// ---------------------------------------------------------------------------
// System Context — deterministic, server-resolved
// ---------------------------------------------------------------------------

export type SystemContext = {
  /** Current page identifier (e.g. "schedule", "people", "reports") */
  page_id: string;
  /** Workspace the user is operating in */
  workspace_id: string;
  /** Profile ID of the authenticated user */
  profile_id: string;
  /** Resolved role for this workspace */
  role: WorkspaceRole;
  /** Flat list of permission strings the role grants */
  permissions: string[];
};

// ---------------------------------------------------------------------------
// Intelligence Snapshot — readiness & verification state
// ---------------------------------------------------------------------------

export type VerificationFlags = {
  /** True when all assigned policies are marked as learned */
  all_policies_learned: boolean;
  /** True when all assigned protocols are completed */
  all_protocols_completed: boolean;
  /** True when any assignment is past its due date */
  has_overdue_assignments: boolean;
};

export type IntelligenceSnapshot = {
  /** 0-100 readiness percentage */
  readiness_score: number;
  /** Quick boolean checks for readiness gates */
  verification_flags: VerificationFlags;
};

// ---------------------------------------------------------------------------
// Search Hints — personalised search affordances
// ---------------------------------------------------------------------------

export type SearchHints = {
  /** Last N searches by this user (empty on first visit) */
  recent_searches: string[];
  /** Server-suggested queries based on role / page context */
  suggested_queries: string[];
};

// ---------------------------------------------------------------------------
// Full Bootstrap Response
// ---------------------------------------------------------------------------

export type BootstrapResponse = {
  system: SystemContext;
  intelligence: IntelligenceSnapshot;
  search_hints: SearchHints;
};

// ---------------------------------------------------------------------------
// Builder input
// ---------------------------------------------------------------------------

export type BootstrapInput = {
  workspaceId: string;
  profileId: string;
  pageId: string;
};
