// packages/ai/src/capabilities/engine-world/tools.ts
//
// Phase 0: Read-only engine_world tools.
//
// engine_world is the shared world model that every agent reads from before
// acting. Phase 0 ships two read tools:
//   - read_surface: get one surface by ID
//   - read_surface_class: list all surfaces of a type
//
// RLS enforces tenant isolation: workspace-scoped rows visible only to
// workspace members; platform-level rows (workspace_id IS NULL) visible to
// any authenticated session. Anon callers see nothing.
//
// Per L-0182: NO emit() calls in Phase 0 (no producer + consumer registered).
// Per ADR-0151: workspace_id is server-derived in writes (Phase 1 sortie).
// Per L-0094: read tools do not emit either — pure observation surface.

import { z } from "zod";
import { defineTool } from "../../types.js";
import type { AgentToolContext } from "../types.js";
import {
  readSurfaceInputSchema,
  readSurfaceClassInputSchema,
  type ReadSurfaceOutput,
  type ReadSurfaceClassOutput,
  type SurfaceRecord,
} from "./types.js";

const CAPABILITY = "engine_world";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function computeIsStale(observed_at: string, ttl_seconds: number): boolean {
  const observedMs = new Date(observed_at).getTime();
  const expiresMs = observedMs + ttl_seconds * 1000;
  return Date.now() > expiresMs;
}

type EngineWorldRow = {
  surface_id: string;
  surface_type: SurfaceRecord["surface_type"];
  status: SurfaceRecord["status"];
  details: Record<string, unknown>;
  workspace_id: string | null;
  observed_at: string;
  observed_by: string;
  ttl_seconds: number;
};

function rowToRecord(row: EngineWorldRow): SurfaceRecord {
  return {
    ...row,
    is_stale: computeIsStale(row.observed_at, row.ttl_seconds),
  };
}

// ─── read_surface ────────────────────────────────────────────────────────────

export const readSurfaceTool = defineTool<AgentToolContext, typeof readSurfaceInputSchema>({
  name: "read_surface",
  description:
    "Read a single engine_world surface by ID. Returns the latest observation plus an is_stale flag (true if observed_at + ttl_seconds is in the past). Stale rows should be treated as status=unknown by callers. Read-only; no mutation, no emit.",
  capability: CAPABILITY,
  schema: readSurfaceInputSchema,
  async execute(input, ctx): Promise<string> {
    const { data, error } = await ctx.supabaseAdmin
      .from("engine_world")
      .select(
        "surface_id, surface_type, status, details, workspace_id, observed_at, observed_by, ttl_seconds",
      )
      .eq("surface_id", input.surface_id)
      .maybeSingle();

    if (error) {
      throw new Error(`engine_world read failed: ${error.message}`);
    }

    const result: ReadSurfaceOutput = data
      ? { found: true, surface: rowToRecord(data as EngineWorldRow) }
      : { found: false, surface_id: input.surface_id };

    return JSON.stringify(result);
  },
});

// ─── read_surface_class ──────────────────────────────────────────────────────

export const readSurfaceClassTool = defineTool<
  AgentToolContext,
  typeof readSurfaceClassInputSchema
>({
  name: "read_surface_class",
  description:
    "List all engine_world surfaces of a given type (service, pr, worktree, migration, cost, ci_workflow, campaign, custom). Returns up to 200 most-recently-observed rows. Default excludes stale rows (observed_at + ttl_seconds in the past) unless include_stale=true.",
  capability: CAPABILITY,
  schema: readSurfaceClassInputSchema,
  async execute(input, ctx): Promise<string> {
    let query = ctx.supabaseAdmin
      .from("engine_world")
      .select(
        "surface_id, surface_type, status, details, workspace_id, observed_at, observed_by, ttl_seconds",
      )
      .eq("surface_type", input.surface_type)
      .order("observed_at", { ascending: false })
      .limit(200);

    const { data, error } = await query;
    if (error) {
      throw new Error(`engine_world list failed: ${error.message}`);
    }

    const rows = (data ?? []) as ReadonlyArray<EngineWorldRow>;
    const records = rows.map(rowToRecord);
    const filtered = input.include_stale ? records : records.filter((r) => !r.is_stale);

    const result: ReadSurfaceClassOutput = {
      surface_type: input.surface_type,
      count: filtered.length,
      surfaces: filtered,
    };

    return JSON.stringify(result);
  },
});
