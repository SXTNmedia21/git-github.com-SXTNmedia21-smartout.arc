// ============================================
// save-report.ts
// Persists a report configuration to the custom_report table.
// Called after the user approves a preview from preview_report.
// Connected to: supabase/migrations/20260301150000_create_custom_report.sql
// ============================================

import { z } from "zod";
import { defineTool } from "../../types";
import type { ReportToolContext } from "./types";

/**
 * save_report — Saves a named report to the database.
 * Requires a name, description, and the full config object.
 * Returns the saved report record with its ID.
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
    const { data, error } = await ctx.supabase
      .from("custom_report")
      .insert({
        workspace_id: ctx.workspaceId,
        name,
        description: description ?? null,
        config,
        created_by: ctx.profileId,
        updated_by: ctx.profileId,
      })
      .select("report_id, name, description, is_pinned, created_at")
      .single();

    if (error) {
      return JSON.stringify({ error: `Kunne ikke lagre rapporten: ${error.message}` });
    }

    return JSON.stringify({
      saved: true,
      report: data,
      message: `Rapporten "${name}" er lagret!`,
    });
  },
});
