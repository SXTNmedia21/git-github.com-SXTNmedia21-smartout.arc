/**
 * C4 permission matrix — role-based access control for entity operations.
 *
 * Implements the Smartout role hierarchy (employee → manager → admin → owner)
 * with an own-data shortcut: employees can self-service their own profile,
 * absences, and hours confirmations without requiring a higher role.
 */

export type ProfileRole = "employee" | "manager" | "admin" | "owner";
export type CrudOperation = "create" | "read" | "update" | "delete";
export type Ownership = "own" | "team" | "workspace";
export type PermissionResult = "allowed" | "denied" | "needs_approval";

/** Numeric level for role comparison — higher = more authority. */
export const ROLE_HIERARCHY: Record<ProfileRole, number> = {
  employee: 0,
  manager: 1,
  admin: 2,
  owner: 3,
} as const;

type PermissionRule = {
  /** Minimum role required for workspace-wide access. */
  minRole: ProfileRole;
  /** If set, this (lower) role can operate on their own data. */
  ownDataRole?: ProfileRole;
};

/**
 * Permission matrix: entity × operation → access rule.
 *
 * Key format: "entity:operation" (e.g. "profile:update").
 * When ownDataRole is set, a user with that role can act on rows they own
 * without meeting the minRole threshold.
 */
export const PERMISSION_MATRIX: Record<string, PermissionRule> = {
  // ── Profile ───────────────────────────────────────────────────────
  "profile:read": { minRole: "employee" },
  "profile:update": { minRole: "admin", ownDataRole: "employee" },

  // ── Absences ──────────────────────────────────────────────────────
  "schedule_absence:create": { minRole: "manager", ownDataRole: "employee" },
  "schedule_absence:read": { minRole: "employee" },
  "schedule_absence:update": { minRole: "manager", ownDataRole: "employee" },
  "schedule_absence:delete": { minRole: "manager", ownDataRole: "employee" },

  // ── Time entries / hours confirmation ─────────────────────────────
  "time_entry:create": { minRole: "manager", ownDataRole: "employee" },
  "time_entry:read": { minRole: "employee" },
  "time_entry:update": { minRole: "manager", ownDataRole: "employee" },

  // ── Shifts ────────────────────────────────────────────────────────
  "schedule_shift:create": { minRole: "admin" },
  "schedule_shift:read": { minRole: "employee" },
  "schedule_shift:update": { minRole: "admin" },
  "schedule_shift:delete": { minRole: "admin" },

  // ── Departments ───────────────────────────────────────────────────
  "department:create": { minRole: "admin" },
  "department:read": { minRole: "employee" },
  "department:update": { minRole: "admin" },
  "department:delete": { minRole: "admin" },

  // ── Teams ─────────────────────────────────────────────────────────
  "team:create": { minRole: "admin" },
  "team:read": { minRole: "employee" },
  "team:update": { minRole: "manager" },
  "team:delete": { minRole: "admin" },

  // ── Governance (owner-only) ───────────────────────────────────────
  "employment_contract:create": { minRole: "owner" },
  "employment_contract:read": { minRole: "manager" },
  "employment_contract:update": { minRole: "owner" },
  "employment_contract:delete": { minRole: "owner" },

  "regulatory_framework:create": { minRole: "owner" },
  "regulatory_framework:read": { minRole: "manager" },
  "regulatory_framework:update": { minRole: "owner" },
  "regulatory_framework:delete": { minRole: "owner" },

  "framework_rule:create": { minRole: "owner" },
  "framework_rule:read": { minRole: "manager" },
  "framework_rule:update": { minRole: "owner" },
  "framework_rule:delete": { minRole: "owner" },

  "tariff_rate_table:create": { minRole: "owner" },
  "tariff_rate_table:read": { minRole: "manager" },
  "tariff_rate_table:update": { minRole: "owner" },
  "tariff_rate_table:delete": { minRole: "owner" },

  // ── Content (admin manages website) ───────────────────────────────
  "website_page:create": { minRole: "admin" },
  "website_page:read": { minRole: "employee" },
  "website_page:update": { minRole: "admin" },
  "website_page:delete": { minRole: "admin" },

  "website_section:create": { minRole: "admin" },
  "website_section:read": { minRole: "employee" },
  "website_section:update": { minRole: "admin" },
  "website_section:delete": { minRole: "admin" },

  // ── Chat ──────────────────────────────────────────────────────────
  "chat_message:create": { minRole: "employee" },
  "chat_message:read": { minRole: "employee" },

  // ── Deviations / HACCP ────────────────────────────────────────────
  "deviation:create": { minRole: "employee" },
  "deviation:read": { minRole: "employee" },
  "deviation:update": { minRole: "manager" },

  "haccp_log:create": { minRole: "employee" },
  "haccp_log:read": { minRole: "employee" },
} as const;

/**
 * Check whether a role is allowed to perform an operation on an entity.
 *
 * @param role - the acting user's profile role
 * @param entity - the target entity name (e.g. "profile", "schedule_shift")
 * @param operation - CRUD operation
 * @param isOwnData - true when the user is operating on their own row
 * @returns 'allowed', 'denied', or 'needs_approval'
 */
export function checkPermission(
  role: ProfileRole,
  entity: string,
  operation: CrudOperation,
  isOwnData = false,
): PermissionResult {
  const key = `${entity}:${operation}`;
  const rule = PERMISSION_MATRIX[key];

  // Unknown entity/operation combination — deny by default
  if (!rule) return "denied";

  const userLevel = ROLE_HIERARCHY[role];
  const minLevel = ROLE_HIERARCHY[rule.minRole];

  // Fast path: user meets or exceeds the minimum role
  if (userLevel >= minLevel) return "allowed";

  // Own-data shortcut: a lower role can self-service if the rule allows it
  if (isOwnData && rule.ownDataRole) {
    const ownLevel = ROLE_HIERARCHY[rule.ownDataRole];
    if (userLevel >= ownLevel) return "allowed";
  }

  return "denied";
}
