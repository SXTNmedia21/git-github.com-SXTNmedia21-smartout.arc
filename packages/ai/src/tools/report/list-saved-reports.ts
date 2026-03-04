// ============================================
// list-saved-reports.ts
// Lists all saved reports for the current workspace.
// Used by the agent to show what reports already exist.
// Connected to: supabase/migrations/20260301150000_create_custom_report.sql
// ============================================

import { z } from "zod";
import { defineTool } from "../../types";
import type { ReportToolContext } from "./types";

/**
 * list_saved_reports — Returns all saved reports in the workspace.
 * Ordered by pinned first, then most recently updated.
 */
export const listSavedReports = defineTool({
  name: "list_saved_reports",
  description:
    "List all saved reports in the current workspace. Returns report names, descriptions, visualization types, and whether they are pinned. Use this when the user asks to see their reports.",
  schema: z.object({}),
  execute: async (_params: Record<string, never>, ctx: ReportToolContext) => {
    const { data, error } = await ctx.supabase
      .from("custom_report")
      .select("report_id, name, description, config, is_pinned, created_at, updated_at")
      .eq("workspace_id", ctx.workspaceId)
      .order("is_pinned", { ascending: false })
      .order("updated_at", { ascending: false })
      .limit(50);

    if (error) {
      return JSON.stringify({ error: `Kunne ikke hente rapporter: ${error.message}` });
    }

    if (!data || data.length === 0) {
      return JSON.stringify({
        reports: [],
        message: "Ingen lagrede rapporter ennå. Skal jeg hjelpe deg å lage en?",
      });
    }

    // Extract visualization type from config for display
    const reports = data.map((r) => ({
      report_id: r.report_id,
      name: r.name,
      description: r.description,
      visualization: (r.config as Record<string, unknown>)?.visualization ?? "table",
      is_pinned: r.is_pinned,
      created_at: r.created_at,
      updated_at: r.updated_at,
    }));

    return JSON.stringify({ reports, count: reports.length });
  },
});
