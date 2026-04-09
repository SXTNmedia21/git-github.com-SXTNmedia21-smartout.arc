// ============================================
// authority.ts
// Loads workspace-specific authority configuration from the database.
// Authority levels control what capabilities the agent can use and how.
// Connected to: engine_authority_config table (Supabase)
// Connected to: @smartout/ai capabilities/types (AuthorityLevel)
// ============================================

import { supabaseAdmin } from "../lib/supabase.js";

export type AuthorityLevel = "autonomous" | "confirm" | "suggest" | "read_only" | "disabled";
export type AuthorityConfig = Record<string, AuthorityLevel>;

/**
 * Loads the authority configuration for a workspace.
 * Returns a map of capability name -> authority level.
 * If no config exists, returns empty object (defaults applied by tool selector).
 */
export async function loadAuthorityConfig(workspaceId: string): Promise<AuthorityConfig> {
  const { data, error } = await supabaseAdmin
    .from("engine_authority_config")
    .select("capability, level")
    .eq("workspace_id", workspaceId);

  if (error || !data) return {};

  const config: AuthorityConfig = {};
  for (const row of data) {
    const level = row.level as AuthorityLevel;
    // Store both the full key ("schedule.read") and the base capability name ("schedule").
    // Tool-selector looks up by base name; this ensures authority config matches regardless
    // of whether the DB uses dotted or plain keys.
    config[row.capability] = level;
    const base = row.capability.split(".")[0];
    if (base !== row.capability && !config[base]) {
      config[base] = level;
    }
  }
  return config;
}
