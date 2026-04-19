import { z } from "zod";
import { loadMapping } from "../research/mapping.js";
import { runEngine } from "../migration/engine.js";
import { emitSql } from "../migration/sql_emitter.js";
import { writeStagedFiles, slugify } from "../migration/staging.js";
import type { ToolContext } from "./list_workspaces.js";
import type { MigrationReport, MigrationResult } from "../migration/types.js";

const NAME_KEYS = ["name_text", "Name", "Titel", "title", "name"];

function pickName(record: Record<string, unknown>): string {
  for (const k of NAME_KEYS) {
    const v = record[k];
    if (typeof v === "string" && v.trim().length > 0) return v;
  }
  return "(unnamed)";
}

function buildReport(
  entity: string,
  workspaceId: string,
  workspaceSlug: string,
  result: MigrationResult,
  generatedAt: string,
): string {
  const lines = [
    `# Migration report — ${entity}`,
    "",
    `- **Workspace ID:** \`${workspaceId}\``,
    `- **Workspace slug:** \`${workspaceSlug}\``,
    `- **Generated:** ${generatedAt}`,
    `- **Rows emitted:** ${result.rows.length}`,
    `- **Records skipped:** ${result.skipped.length}`,
    "",
  ];
  if (result.skipped.length > 0) {
    lines.push("## Skipped records");
    lines.push("");
    for (const s of result.skipped) {
      lines.push(`- \`${s.recordId}\`: ${s.reason}`);
    }
    lines.push("");
  }
  if (result.warnings.length > 0) {
    lines.push("## Warnings");
    lines.push("");
    for (const w of result.warnings) lines.push(`- ${w}`);
    lines.push("");
  }
  return lines.join("\n");
}

export const migrateWorkspaceTool = {
  name: "migrate_workspace",
  description:
    "Migrate a single workspace record from Bubble to a staged Supabase migration file. Read-only — never writes to Supabase. Output goes to the staging directory for human review.",
  inputSchema: z.object({
    workspaceId: z.string().min(1),
  }),
  execute: async (
    input: { workspaceId: string },
    ctx: ToolContext,
  ): Promise<MigrationReport> => {
    const mapping = await loadMapping(ctx.mappingsDir, "workspace");
    if (!mapping) {
      throw new Error(
        `mapping for "workspace" not found at ${ctx.mappingsDir}/workspace.json. Run research_entity first.`,
      );
    }

    const all = await ctx.bubble.listAll("workspace", {});
    const record = all.find((r) => r._id === input.workspaceId);
    if (!record) {
      throw new Error(`workspace not found: ${input.workspaceId}`);
    }

    const workspaceSlug = slugify(pickName(record));
    const generatedAt = new Date().toISOString();

    const result = runEngine(mapping, [record], {
      workspaceId: input.workspaceId,
      workspaceSlug,
      mapping,
      companyId: null,
    });

    const sql = emitSql(result.rows, {
      entity: "workspace",
      workspaceId: input.workspaceId,
      workspaceSlug,
      generatedAt,
    });

    const report = buildReport("workspace", input.workspaceId, workspaceSlug, result, generatedAt);

    const staged = await writeStagedFiles({
      stagingDir: ctx.stagingDir,
      workspaceSlug,
      orderIndex: 1,
      entity: "workspace",
      sql,
      report,
    });

    return {
      entity: "workspace",
      workspaceId: input.workspaceId,
      workspaceSlug,
      recordsProcessed: 1,
      recordsEmitted: result.rows.length,
      recordsSkipped: result.skipped.length,
      warnings: result.warnings,
      generatedAt,
      sqlFilePath: staged.sqlPath,
      reportFilePath: staged.reportPath,
    };
  },
};
