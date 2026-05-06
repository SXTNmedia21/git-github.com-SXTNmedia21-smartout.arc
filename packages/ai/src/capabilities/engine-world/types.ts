// packages/ai/src/capabilities/engine-world/types.ts
//
// Phase 0 + Phase 1: types for engine_world tools.
// engine_world is the shared world model — every agent reads from it before
// acting. Phase 0 shipped READ tools only. Phase 1 adds report_observation
// (gated mutation per ADR-0099 + ADR-0204) and its output types.
//
// L-0182 phantom-emit prevention: Phase 0 read-only emits nothing.
// Phase 1 emits use existing registry names (council F1):
//   "engine_world observation_written" + "engine_world status_changed".

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

// ─── Write input/output shapes (Phase 1) ────────────────────────────────────

export const reportObservationInputSchema = z.object({
  surface_id: z
    .string()
    .min(1)
    .max(200)
    .describe(
      "Stable surface identifier. Examples: vercel.web, pr.323, wt.mobile-wt-2, ci.workflow.harness-invariants.",
    ),
  surface_type: surfaceTypeSchema.describe(
    "Classification of the surface. Must match engine_world_surface_type enum.",
  ),
  status: surfaceStatusSchema.describe(
    "Current observed status. green=healthy, yellow=degraded, red=broken, unknown=not-observed, paused=intentionally-off.",
  ),
  details: z
    .record(z.unknown())
    .default({})
    .describe(
      "JSONB bag of additional context (e.g. last_commit, p95_ms, error_message). " +
        "Never include PII. Content is NOT injected into agent prompts (F6 whitelist).",
    ),
  ttl_seconds: z
    .number()
    .int()
    .positive()
    .default(1800)
    .describe("Seconds before this observation is considered stale. Default 1800 (30 min)."),
});

export type ReportObservationInput = z.infer<typeof reportObservationInputSchema>;

export type ReportObservationOutput = {
  success: true;
  surface_id: string;
  status: SurfaceStatus;
  /** True when the status changed vs the prior row in the DB. */
  status_changed: boolean;
  /** Prior status when status_changed=true, null on first insert. */
  prior_status: SurfaceStatus | null;
  gate_evaluation_id: string | null;
};
