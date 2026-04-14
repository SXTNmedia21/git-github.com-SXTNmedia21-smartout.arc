// packages/ai/src/router/min-role.ts
//
// Enforces `engine_authority_config.min_role` on the tool-selector's
// AuthorityConfig. Per migration 20260410000001_add_min_role_to_authority_config.sql:
//
//   "Profiles with lower roles get downgraded to suggest level regardless
//   of workspace config."
//
// This is the pure transformation step. It is called before `selectTools` so
// the selector itself remains oblivious to role — it just sees an already-
// resolved AuthorityConfig.
//
// Prerequisite for Phase E / WP4 (Authority Config ↔ Cascade). The council
// review (2026-04-14) flagged that the min_role column shipped without an
// enforcement code path; this module closes that gap.

import type { AuthorityLevel, ProfileRole } from "../capabilities/types.js";
import type { AuthorityConfig } from "./tool-selector.js";

/** Role ranking, lowest privilege first. */
const ROLE_ORDER: ReadonlyArray<ProfileRole> = ["employee", "manager", "admin", "owner"];

/** Per-capability minimum-role requirement. Parallel to AuthorityConfig. */
export type MinRoleConfig = Record<string, ProfileRole>;

/** The level a profile is downgraded to when its role is below min_role. */
export const MIN_ROLE_DOWNGRADE_LEVEL: AuthorityLevel = "suggest";

/** True if `userRole` meets or exceeds `requiredMinRole`. */
export function isRoleSufficient(userRole: ProfileRole, requiredMinRole: ProfileRole): boolean {
  return ROLE_ORDER.indexOf(userRole) >= ROLE_ORDER.indexOf(requiredMinRole);
}

/**
 * Applies min_role downgrades to an AuthorityConfig. For every capability
 * whose `min_role` exceeds the caller's role, the configured level is
 * overridden with `suggest`. Capabilities without a `min_role` entry are
 * left unchanged (default behavior: `employee` → always allowed).
 *
 * Pure. No I/O, no mutation of inputs.
 */
export function applyMinRoleDowngrade(
  authorityConfig: AuthorityConfig,
  minRoleConfig: MinRoleConfig,
  userRole: ProfileRole,
): AuthorityConfig {
  const resolved: AuthorityConfig = {};
  for (const [capability, level] of Object.entries(authorityConfig)) {
    const required = minRoleConfig[capability];
    resolved[capability] =
      required && !isRoleSufficient(userRole, required) ? MIN_ROLE_DOWNGRADE_LEVEL : level;
  }
  return resolved;
}
