// packages/ai/src/capabilities/engine-world/tools.ts
//
// Phase 0 + Phase 1: engine_world tools.
//
// Phase 0 (read-only):
//   - read_surface: get one surface by ID
//   - read_surface_class: list all surfaces of a type
//
// Phase 1 (write):
//   - report_observation: UPSERT one surface row via gatedMutation (ADR-0204).
//     Gate slug: engine.world_observe (confirmed in Phase 1 migration).
//     Emits: "engine_world observation_written" + conditionally "engine_world status_changed"
//     (existing space-form names per council F1 — no parallel dot-form set).
//     Channel: chat + system only (ADR-0078 council F3 — voice never writes).
//
// RLS enforces tenant isolation: workspace-scoped rows visible only to
// workspace members; platform-level rows (workspace_id IS NULL) visible to
// any authenticated session. Anon callers see nothing.
//
// Per ADR-0151: workspace_id is server-derived (ctx.workspaceId), NEVER from input.
// Per ADR-0204: every mutation routes through gatedMutation().
// Per ADR-0078: read tools allow chat+voice; report_observation rejects voice (Layer 3).
// Per L-0094: read tools do not emit — pure observation surface.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Json } from "@smartout/supabase";
import { emit } from "@smartout/telemetry";
import { defineTool } from "../../types.js";
import { gatedMutation } from "../../gate/gatedMutation.js";
import type { AgentToolContext } from "../types.js";
import {
  readSurfaceInputSchema,
  readSurfaceClassInputSchema,
  reportObservationInputSchema,
  type ReadSurfaceOutput,
  type ReadSurfaceClassOutput,
  type ReportObservationOutput,
  type SurfaceRecord,
  type SurfaceStatus,
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

// ─── report_observation (Phase 1 write) ─────────────────────────────────────

/** Capability slug for gate_action (dot-form per migration seed). NOT a CapabilityName —
 *  CapabilityName uses "engine_world" (no dot). The dot-form is the authority-registry key
 *  that maps to the engine_authority_config + capability_default_registry rows seeded in
 *  20260526000000_engine_world_phase_1.sql.
 *
 *  Export is intentional: index.ts imports it for JSDoc; any future
 *  caller that needs the slug for an explicit gatedMutation args object
 *  should import from here rather than hardcode the string. */
export const ENGINE_WORLD_OBSERVE_CAPABILITY_SLUG = "engine.world_observe";

export const reportObservationTool = defineTool<
  AgentToolContext,
  typeof reportObservationInputSchema
>({
  name: "report_observation",
  description:
    "UPSERT a surface observation into engine_world. Use when an agent or system component " +
    "has fresh truth about a surface (e.g. 'CI is now red', 'PR #323 was merged'). " +
    "The surface_id must be a stable dot-notation key (vercel.web, pr.323, ci.workflow.X). " +
    "Chat and system-channel only — voice cannot write observations (ADR-0078 council F3). " +
    "Requires confirm authority (engine.world_observe). gate_action: engine.world_observe.",
  capability: CAPABILITY,
  schema: reportObservationInputSchema,
  async execute(input, ctx: AgentToolContext): Promise<string> {
    // ADR-0134 fail-fast: IDs must be non-empty before any gate or emit call.
    if (!ctx.workspaceId) throw new Error("workspaceId required (ADR-0134)");
    if (!ctx.profileId) throw new Error("profileId required (ADR-0134)");

    // ADR-0078 council F3: voice never writes engine_world observations.
    // The capability allowedChannels includes "voice" for READ tools (chat+voice),
    // but report_observation is write-only. Layer 3 per-tool guard enforces this.
    if (ctx.channel === "voice") {
      return JSON.stringify({
        success: false,
        error: "Av sikkerhetshensyn kan ikke observasjoner rapporteres via stemme. Bruk chat.",
      });
    }

    const supabase = ctx.supabaseAdmin as SupabaseClient;
    const effectiveChannel = ctx.channel ?? "chat";

    // ── Pre-UPSERT read: capture prior status for status_changed emit ──────
    // Read the existing row before we overwrite it so we can detect a status
    // transition. We do this BEFORE gatedMutation so we never materialise a
    // change_proposal or gate_evaluation row based on stale data.
    let priorStatus: SurfaceStatus | null = null;
    {
      const { data: priorRow } = await supabase
        .from("engine_world")
        .select("status")
        .eq("surface_id", input.surface_id)
        .maybeSingle();
      if (priorRow && typeof priorRow.status === "string") {
        priorStatus = priorRow.status as SurfaceStatus;
      }
    }

    // ── gatedMutation (ADR-0204) ──────────────────────────────────────────
    // Pathway A: gate_action with capability slug "engine.world_observe".
    // Pathway B: cascade_gate_write (framework trigger matching).
    // Domain write runs only when both pathways return applied.
    let upsertedRow: { surface_id: string; status: string } | null = null;

    const gateResult = await gatedMutation(supabase, {
      workspace_id: ctx.workspaceId,
      actor_profile_id: ctx.profileId,
      // gate_action capability key — dot-form matches the row seeded in
      // 20260526000000_engine_world_phase_1.sql. NOT a CapabilityName union member.
      capability: ENGINE_WORLD_OBSERVE_CAPABILITY_SLUG,
      channel: effectiveChannel,
      action_type: "observe",
      entity_id: null, // no single entity — surface_id is a string PK
      entity_type: "engine_world",
      action: priorStatus !== null ? "update" : "create",
      proposed_data: {
        surface_id: input.surface_id,
        surface_type: input.surface_type,
        status: input.status,
        details: input.details,
        workspace_id: ctx.workspaceId, // ADR-0151: server-derived, not from input
        observed_at: new Date().toISOString(),
        observed_by: ctx.profileId,
        ttl_seconds: input.ttl_seconds,
      } as unknown as Json,
      current_data:
        priorStatus !== null
          ? ({ surface_id: input.surface_id, status: priorStatus } as unknown as Json)
          : null,
      execute: async (db: SupabaseClient) => {
        /* eslint-disable-next-line smartout/no-direct-supabase-write --
           Domain write inside gatedMutation().execute callback — ADR-0204 §3:
           gatedMutation is the canonical composition site; the enclosed write
           runs only after both Pathway A (gate_action) and Pathway B
           (cascade_gate_write) have returned applied. */
        const { data, error } = await db
          .from("engine_world")
          .upsert(
            {
              surface_id: input.surface_id,
              surface_type: input.surface_type,
              status: input.status,
              details: input.details as Record<string, unknown>,
              // ADR-0151: workspace_id is server-derived, never from input.
              workspace_id: ctx.workspaceId,
              observed_at: new Date().toISOString(),
              observed_by: ctx.profileId,
              observed_by_profile_id: ctx.profileId,
              ttl_seconds: input.ttl_seconds,
            },
            { onConflict: "surface_id" },
          )
          .select("surface_id, status")
          .single();

        if (error) return { ok: false, reason: error.message };
        upsertedRow = data as { surface_id: string; status: string };
        return { ok: true };
      },
    });

    if (!gateResult.ok) {
      return JSON.stringify({
        success: false,
        error: `Ikke tillatt: ${gateResult.reason}`,
        denied_by: gateResult.denied_by,
        four_eyes_required: gateResult.four_eyes_required ?? false,
        gate_evaluation_id: gateResult.gate_evaluation_id ?? null,
      });
    }

    if (gateResult.proposal_id) {
      return JSON.stringify({
        success: false,
        outcome: "proposed",
        proposal_id: gateResult.proposal_id,
        message: `Observasjon for "${input.surface_id}" er sendt til godkjenning (proposal ${gateResult.proposal_id}).`,
      });
    }

    // ── Telemetry (council F1: existing space-form names, no parallel dot-form) ──
    const statusChanged = priorStatus !== null && priorStatus !== input.status;

    // ADR-0134: emit with non-empty workspaceId + profileId (fail-fast above guarantees this).
    void emit({
      event: "engine_world observation_written",
      workspace_id: ctx.workspaceId,
      actor_id: ctx.profileId,
      properties: {
        data: {
          surface_id: input.surface_id,
          surface_type: input.surface_type,
          status: input.status,
          observed_by: ctx.profileId,
        },
      },
    });

    if (statusChanged) {
      void emit({
        event: "engine_world status_changed",
        workspace_id: ctx.workspaceId,
        actor_id: ctx.profileId,
        properties: {
          data: {
            surface_id: input.surface_id,
            surface_type: input.surface_type,
            from_status: priorStatus,
            to_status: input.status,
          },
        },
      });
    }

    const output: ReportObservationOutput = {
      success: true,
      surface_id: upsertedRow
        ? (upsertedRow as { surface_id: string }).surface_id
        : input.surface_id,
      status: input.status,
      status_changed: statusChanged,
      prior_status: statusChanged ? priorStatus : null,
      gate_evaluation_id: gateResult.gate_evaluation_id ?? null,
    };

    return JSON.stringify(output);
  },
});
