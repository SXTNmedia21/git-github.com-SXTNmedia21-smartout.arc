// ============================================
// delete-report.ts
// Deletes a saved report from the custom_report table.
// RLS ensures only workspace members can delete their own reports.
// Connected to: supabase/migrations/20260301150000_create_custom_report.sql
// ============================================

import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Json } from "@smartout/supabase";
import { defineTool } from "../../types";
import { gatedMutation } from "../../gate/gatedMutation";
import type { ReportToolContext } from "./types";

/**
 * delete_report — Removes a saved report by ID.
 * The Supabase RLS policy ensures the user has workspace access.
 *
 * SS-5 (ADR-0204): routed through `gatedMutation()` so both C4 authority
 * (Pathway A) and C1 cascade data-rule (Pathway B) evaluate before the
 * DELETE lands. The existence pre-check feeds `current_data` into Pathway B
 * so framework-trigger diffs can compare against the row being removed.
 */
export const deleteReport = defineTool({
  name: "delete_report",
  description:
    "Delete a saved report by its ID. Use this when the user wants to remove a report they no longer need. Always confirm with the user before deleting.",
  schema: z.object({
    report_id: z.string().uuid().describe("The UUID of the report to delete"),
  }),
  execute: async ({ report_id }, ctx: ReportToolContext) => {
    // First check the report exists and belongs to this workspace
    const { data: existing, error: fetchError } = await ctx.supabase
      .from("custom_report")
      .select("report_id, name")
      .eq("report_id", report_id)
      .eq("workspace_id", ctx.workspaceId)
      .single();

    if (fetchError || !existing) {
      return JSON.stringify({ error: "Fant ikke rapporten. Sjekk at ID-en er riktig." });
    }

    const result = await gatedMutation(ctx.supabase as unknown as SupabaseClient, {
      workspace_id: ctx.workspaceId,
      actor_profile_id: ctx.profileId,
      capability: "reports",
      channel: ctx.channel ?? "chat",
      action_type: "delete",
      entity_id: report_id,
      entity_type: "custom_report",
      action: "delete",
      proposed_data: null,
      current_data: existing as unknown as Json,
      execute: async (db) => {
        /* eslint-disable-next-line smartout/no-direct-supabase-write --
           Domain write inside gatedMutation().execute callback — ADR-0204 §3:
           gatedMutation is the canonical composition site; the enclosed write
           runs only after both Pathway A (gate_action) and Pathway B
           (cascade_gate_write) have returned applied. ADR-0196 Invariant 13
           satisfied at the orchestrator layer, not per-write. */
        const { error } = await db
          .from("custom_report")
          .delete()
          .eq("report_id", report_id)
          .eq("workspace_id", ctx.workspaceId);
        if (error) return { ok: false, reason: error.message };
        return { ok: true };
      },
    });

    if (!result.ok) {
      return JSON.stringify({
        error: `Kunne ikke slette rapporten: ${result.reason}`,
        denied_by: result.denied_by,
        four_eyes_required: result.four_eyes_required ?? false,
      });
    }

    if (result.proposal_id) {
      return JSON.stringify({
        deleted: false,
        outcome: "proposed",
        proposal_id: result.proposal_id,
        message: `Sletting av "${existing.name}" er sendt til godkjenning (proposal ${result.proposal_id}).`,
      });
    }

    return JSON.stringify({
      deleted: true,
      gate_evaluation_id: result.gate_evaluation_id,
      message: `Rapporten "${existing.name}" er slettet.`,
    });
  },
});
