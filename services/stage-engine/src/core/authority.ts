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
 * Row shape returned by `engine_authority_config` for this reducer. Exported
 * for test harnesses that want to drive `buildAuthorityConfig` without going
 * through Supabase.
 */
export type AuthorityConfigRow = {
  capability: string;
  level: AuthorityLevel;
  min_role: MinRoleConfig[string];
};

/**
 * Pure reducer — turn raw `engine_authority_config` rows into the two maps
 * (`levels`, `minRoles`) that the router and tool-selector consume.
 *
 * ADR-0195 / L-0122: DO NOT FOLD `journey.*` rows to a base `"journey"` key.
 *
 * History: the original loader stored every dotted row under both the full
 * key AND the base before the first `.`, guarded by `if (!levels[base])`.
 * For workspaces with multiple rows sharing a base (the journey seed writes
 * four — three `suggest` + one `autonomous`), the base-key level was whichever
 * row Postgres happened to return first. The `.select()` call had no
 * `ORDER BY`, so row order for equal-priority rows is undefined. Result:
 * `levels["journey"]` silently collapsed to any of the 4 per-tool levels,
 * and `tool-selector` (which looked up by the short capability name) applied
 * that single collapsed level to EVERY journey tool — flipping `run_guided`
 * down to `suggest` (confirmation required) or flipping `publish_mission`
 * up to `autonomous` (no confirmation). This is a CVE-class drift of the
 * seeded authority surface.
 *
 * Fix: skip the base-key fold for `journey.*`. Tool-selector reads the
 * dotted `tool.capability` directly, so per-tool semantics survive.
 *
 * Legacy behaviour is preserved for non-journey dotted capabilities
 * (e.g. `session.*`, `shift.*`, `observer_request.*`, `recorder.*`) —
 * those are called through `callGateAction` in Server Actions, not through
 * tool-selector / agent-router map lookup, so the fold is a no-op for them
 * today, but removing it universally would need a broader sweep. That's
 * a follow-up; this PR fixes the journey-specific leak.
 */
export function buildAuthorityConfig(
  rows: ReadonlyArray<AuthorityConfigRow>,
): LoadedAuthorityConfig {
  const levels: AuthorityConfig = {};
  const minRoles: MinRoleConfig = {};

  for (const row of rows) {
    // Always store the full dotted (or plain) key verbatim — this is the
    // key tool-selector will read post-ADR-0195.
    levels[row.capability] = row.level;
    minRoles[row.capability] = row.min_role;

    const dotIndex = row.capability.indexOf(".");
    if (dotIndex < 0) continue; // plain key — nothing to fold.

    const base = row.capability.slice(0, dotIndex);

    // ADR-0195 / L-0122: journey is the known-broken family. NEVER fold
    // journey.* into a "journey" short key — that collapses the deliberate
    // 3× suggest + 1× autonomous seed into a non-deterministic single level.
    if (base === "journey") continue;

    // Legacy fold for other dotted capabilities. The guard `!levels[base]`
    // keeps this behaviour pinned to "first row wins" (unchanged) for
    // capabilities that have never had a per-tool authority split. If a new
    // dotted family needs per-tool levels, add it to the skip list above.
    if (!levels[base]) {
      levels[base] = row.level;
      minRoles[base] = row.min_role;
    }
  }

  return { levels, minRoles };
}

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

  return buildAuthorityConfig(data as ReadonlyArray<AuthorityConfigRow>);
}
