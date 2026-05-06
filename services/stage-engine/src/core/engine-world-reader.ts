// ============================================
// engine-world-reader.ts
// Fetches engine_world surface snapshots for injection into the agent prompt.
//
// Council mandates (Phase 1D):
//   F5 — hook point: agent-router.ts between fetchActiveStateSummary + selectTools
//   F6 — whitelist scalars only: surface_id, surface_type, status, is_stale
//        NEVER inject details JSONB (prompt-injection vector per ADR-0283 notes)
//
// Render contract:
//   <world_state>
//   surface_id|surface_type|status|is_stale
//   vercel.web|service|green|false
//   ...
//   </world_state>
//
//   Empty  → <world_state>empty</world_state>
//   Error  → <world_state>unavailable</world_state>
// ============================================

import { supabaseAdmin } from "../lib/supabase.js";
import { baseLogger } from "../lib/logger.js";

const log = baseLogger.child({ module: "engine-world-reader" });

/** Whitelisted scalar snapshot — F6: no details JSONB. */
export type EngineWorldSurfaceSnapshot = {
  surface_id: string;
  surface_type: string;
  status: string;
  is_stale: boolean;
};

/**
 * Fetches engine_world surfaces relevant to the current agent context.
 *
 * Returns up to 50 rows:
 * - Platform-level (workspace_id IS NULL) — CI, deploy, prod-DB observations
 * - Workspace-scoped (workspace_id = workspaceId) — workspace-specific surfaces
 *
 * Staleness: computed in TypeScript post-fetch.
 * `is_stale = (now - observed_at) > ttl_seconds * 1000 ms`
 *
 * Stale rows are filtered out UNLESS no fresh rows remain — in that case all
 * rows are returned with is_stale=true so the prompt can signal "all data stale".
 *
 * On DB error: returns null (caller renders <world_state>unavailable</world_state>).
 */
export async function fetchEngineWorldSurfaces(
  workspaceId: string | null,
): Promise<EngineWorldSurfaceSnapshot[] | null> {
  try {
    // Explicit column list — F6: never select details JSONB.
    // OR-filter: platform-level (NULL) + workspace-scoped rows.
    const query = supabaseAdmin
      .from("engine_world")
      .select("surface_id, surface_type, status, ttl_seconds, observed_at")
      .or(
        workspaceId
          ? `workspace_id.is.null,workspace_id.eq.${workspaceId}`
          : "workspace_id.is.null",
      )
      .order("observed_at", { ascending: false })
      .limit(50);

    const { data, error } = await query;

    if (error) {
      log.warn({ err: error.message, workspaceId }, "engine_world fetch failed");
      return null;
    }

    if (!data || data.length === 0) {
      return [];
    }

    const nowMs = Date.now();

    // Compute staleness per row.
    const snapshots: EngineWorldSurfaceSnapshot[] = data.map((row) => {
      const observedAtMs = new Date(row.observed_at as string).getTime();
      const ttlMs = (row.ttl_seconds as number) * 1000;
      const is_stale = nowMs - observedAtMs > ttlMs;
      return {
        surface_id: row.surface_id as string,
        surface_type: row.surface_type as string,
        status: row.status as string,
        is_stale,
      };
    });

    // Filter out stale rows. If ALL are stale, return them anyway with
    // is_stale=true so the prompt can say "all data stale" rather than "no data".
    const freshRows = snapshots.filter((s) => !s.is_stale);
    return freshRows.length > 0 ? freshRows : snapshots;
  } catch (err) {
    log.warn({ err }, "engine_world fetch threw unexpectedly");
    return null;
  }
}

/**
 * Renders engine_world snapshot as a compact <world_state> prompt block.
 *
 * Format:
 *   <world_state>
 *   surface_id|surface_type|status|is_stale
 *   vercel.web|service|green|false
 *   ...
 *   </world_state>
 *
 * Empty table  → <world_state>empty</world_state>
 * Fetch error  → <world_state>unavailable</world_state>
 */
export function renderWorldStateBlock(surfaces: EngineWorldSurfaceSnapshot[] | null): string {
  if (surfaces === null) {
    return "<world_state>unavailable</world_state>";
  }
  if (surfaces.length === 0) {
    return "<world_state>empty</world_state>";
  }

  const header = "surface_id|surface_type|status|is_stale";
  const rows = surfaces.map((s) => `${s.surface_id}|${s.surface_type}|${s.status}|${s.is_stale}`);

  return `<world_state>\n${header}\n${rows.join("\n")}\n</world_state>`;
}
