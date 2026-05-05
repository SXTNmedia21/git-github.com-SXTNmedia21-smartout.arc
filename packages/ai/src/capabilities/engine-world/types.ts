// packages/ai/src/capabilities/engine-world/types.ts
//
// Phase 0: minimum-viable types for engine_world reader.
// engine_world is the shared world model — every agent reads from it before
// acting. Phase 0 ships READ tools only. Phase 1 adds report_observation
// (gated mutation per ADR-0099). Phase 2 wires heartbeat + counter-reports.
//
// L-0182 phantom-emit prevention: NO emit() calls until producer + consumer
// both ship. Phase 0 read-only emits nothing.

import { z } from "zod";

// ─── Surface type enum (mirrors public.engine_world_surface_type) ───────────
export const surfaceTypeSchema = z.enum([
  "service",
  "pr",
  "worktree",
  "migration",
  "cost",
  "ci_workflow",
  "campaign",
  "custom",
]);

export type SurfaceType = z.infer<typeof surfaceTypeSchema>;

// ─── Surface status enum (mirrors public.engine_world_status) ───────────────
export const surfaceStatusSchema = z.enum(["green", "yellow", "red", "unknown", "paused"]);

export type SurfaceStatus = z.infer<typeof surfaceStatusSchema>;

// ─── Read input schemas ──────────────────────────────────────────────────────

export const readSurfaceInputSchema = z.object({
  surface_id: z
    .string()
    .min(1)
    .max(200)
    .describe("Stable surface identifier. Examples: vercel.web, pr.323, wt.mobile-wt-2."),
});

export type ReadSurfaceInput = z.infer<typeof readSurfaceInputSchema>;

export const readSurfaceClassInputSchema = z.object({
  surface_type: surfaceTypeSchema.describe("Surface type to filter by."),
  include_stale: z
    .boolean()
    .default(false)
    .describe(
      "If true, returns rows whose observed_at + ttl_seconds is in the past (status would be unknown to a fresh reader). Default false — fresh observations only.",
    ),
});

export type ReadSurfaceClassInput = z.infer<typeof readSurfaceClassInputSchema>;

// ─── Read result shapes ──────────────────────────────────────────────────────

export type SurfaceRecord = {
  surface_id: string;
  surface_type: SurfaceType;
  status: SurfaceStatus;
  details: Record<string, unknown>;
  workspace_id: string | null;
  observed_at: string;
  observed_by: string;
  ttl_seconds: number;
  /** Computed: now > observed_at + ttl_seconds. Stale rows should be treated as `unknown` by readers. */
  is_stale: boolean;
};

export type ReadSurfaceOutput =
  | { found: true; surface: SurfaceRecord }
  | { found: false; surface_id: string };

export type ReadSurfaceClassOutput = {
  surface_type: SurfaceType;
  count: number;
  surfaces: ReadonlyArray<SurfaceRecord>;
};
