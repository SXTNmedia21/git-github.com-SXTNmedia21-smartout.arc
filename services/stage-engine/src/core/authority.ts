// ============================================
// authority.ts
// Loads workspace-specific authority configuration from the database.
// Authority levels control what capabilities the agent can use and how.
// Connected to: engine_authority_config table (Supabase)
// Connected to: @smartout/ai capabilities/types (AuthorityLevel)
// ============================================

import { supabaseAdmin } from "../lib/supabase.js";
import type { MinRoleConfig } from "@smartout/ai/router/min-role";

export type AuthorityLevel = "autonomous" | "confirm" | "suggest" | "read_only" | "disabled";
export type AuthorityConfig = Record<string, AuthorityLevel>;

export type LoadedAuthorityConfig = {
  levels: AuthorityConfig;
  minRoles: MinRoleConfig;
};

/**
 * Loads the authority configuration for a workspace.
 * Returns parallel maps of capability -> level and capability -> min_role.
 * If no config exists, returns empty maps (defaults applied by tool selector).
 *
 * min_role enforcement is applied by the caller via
 * `applyMinRoleDowngrade` from `@smartout/ai/router/min-role` — this keeps
 * the loader pure I/O and the downgrade logic pure CPU (both testable).
 */
export async function loadAuthorityConfig(workspaceId: string): Promise<LoadedAuthorityConfig> {
  const { data, error } = await supabaseAdmin
    .from("engine_authority_config")
    .select("capability, level, min_role")
    .eq("workspace_id", workspaceId);

  if (error || !data) return { levels: {}, minRoles: {} };

  const levels: AuthorityConfig = {};
  const minRoles: MinRoleConfig = {};
  for (const row of data) {
    const level = row.level as AuthorityLevel;
    const minRole = row.min_role as MinRoleConfig[string];
    // Store both the full key ("schedule.read") and the base capability name ("schedule").
    // Tool-selector looks up by base name; this ensures authority config matches regardless
    // of whether the DB uses dotted or plain keys.
    levels[row.capability] = level;
    minRoles[row.capability] = minRole;
    const base = row.capability.split(".")[0];
    if (base !== row.capability && !levels[base]) {
      levels[base] = level;
      minRoles[base] = minRole;
    }
  }
  return { levels, minRoles };
}
