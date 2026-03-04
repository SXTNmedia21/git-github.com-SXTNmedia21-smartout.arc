// ============================================
// delete-report.ts
// Deletes a saved report from the custom_report table.
// RLS ensures only workspace members can delete their own reports.
// Connected to: supabase/migrations/20260301150000_create_custom_report.sql
// ============================================

import { z } from "zod";
import { defineTool } from "../../types";
import type { ReportToolContext } from "./types";

/**
 * delete_report — Removes a saved report by ID.
 * The Supabase RLS policy ensures the user has workspace access.
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

    const { error: deleteError } = await ctx.supabase
      .from("custom_report")
      .delete()
      .eq("report_id", report_id)
      .eq("workspace_id", ctx.workspaceId);

    if (deleteError) {
      return JSON.stringify({ error: `Kunne ikke slette rapporten: ${deleteError.message}` });
    }

    return JSON.stringify({
      deleted: true,
      message: `Rapporten "${existing.name}" er slettet.`,
    });
  },
});
