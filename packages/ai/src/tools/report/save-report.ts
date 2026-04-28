// ============================================
// save-report.ts
// Persists a report configuration to the custom_report table.
// Called after the user approves a preview from preview_report.
// Connected to: supabase/migrations/20260301150000_create_custom_report.sql
// ============================================

import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Json } from "@smartout/supabase";
import { defineTool } from "../../types";
import { gatedMutation } from "../../gate/gatedMutation";
import type { ReportToolContext } from "./types";

/**
 * save_report — Saves a named report to the database.
 * Requires a name, description, and the full config object.
 * Returns the saved report record with its ID.
 *
 * SS-5 (ADR-0204): routed through `gatedMutation()` so both C4 authority
 * (Pathway A, `gate_action`) and C1 cascade data-rule (Pathway B,
 * `cascade_gate_write`) evaluate before the INSERT lands. The `reports`
 * capability has no explicit seed in `engine_authority_config` — `gate_action`
 * falls through to default-allow (ADR-0189 warned branch) which preserves
 * existing behaviour. Invariant 13 (every mutation preceded by gate) holds.
 */
export const saveReport = defineTool({
  name: "save_report",
  description:
    "Save a report to the database so the user can access it later. Call this AFTER preview_report confirms the data looks correct. Returns the saved report with its ID.",
  schema: z.object({
    name: z.string().min(1).max(200).describe("Report name — short and descriptive"),
    description: z
      .string()
      .max(500)
      .optional()
      .describe("Optional description of what this report shows"),
    config: z
      .record(z.unknown())
      .describe("The full report configuration object from preview_report"),
  }),
  execute: async ({ name, description, config }, ctx: ReportToolContext) => {
    const proposed = {
      workspace_id: ctx.workspaceId,
      name,
      description: description ?? null,
      config,
      created_by: ctx.profileId,
      updated_by: ctx.profileId,
    };

    let savedRow: unknown = null;

    const result = await gatedMutation(ctx.supabase as unknown as SupabaseClient, {
      workspace_id: ctx.workspaceId,
      actor_profile_id: ctx.profileId,
      capability: "reports",
      channel: ctx.channel ?? "chat",
      action_type: "save",
      entity_id: null,
      entity_type: "custom_report",
      action: "create",
      proposed_data: proposed as unknown as Json,
      current_data: null,
      execute: async (db) => {
        /* eslint-disable-next-line smartout/no-direct-supabase-write --
           Domain write inside gatedMutation().execute callback — ADR-0204 §3:
           gatedMutation is the canonical composition site; the enclosed write
           runs only after both Pathway A (gate_action) and Pathway B
           (cascade_gate_write) have returned applied. ADR-0196 Invariant 13
           satisfied at the orchestrator layer, not per-write. */
        const { data, error } = await db
          .from("custom_report")
          .insert(proposed)
          .select("report_id, name, description, is_pinned, created_at")
          .single();
        if (error) return { ok: false, reason: error.message };
        savedRow = data;
        return { ok: true };
      },
    });

    if (!result.ok) {
      return JSON.stringify({
        error: `Kunne ikke lagre rapporten: ${result.reason}`,
        denied_by: result.denied_by,
        four_eyes_required: result.four_eyes_required ?? false,
      });
    }

    if (result.proposal_id) {
      return JSON.stringify({
        saved: false,
        outcome: "proposed",
        proposal_id: result.proposal_id,
        message: `Rapporten "${name}" er sendt til godkjenning (proposal ${result.proposal_id}).`,
      });
    }

    return JSON.stringify({
      saved: true,
      report: savedRow,
      gate_evaluation_id: result.gate_evaluation_id,
      message: `Rapporten "${name}" er lagret!`,
    });
  },
});
