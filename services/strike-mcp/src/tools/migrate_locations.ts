import { z } from "zod";
import { loadMapping } from "../research/mapping.js";
import { runEngine } from "../migration/engine.js";
import { emitSql } from "../migration/sql_emitter.js";
import { writeStagedFiles, slugify } from "../migration/staging.js";
import { getEntityByName } from "../entities.js";
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
    lines.push("## Skipped records", "");
    for (const s of result.skipped) lines.push(`- \`${s.recordId}\`: ${s.reason}`);
    lines.push("");
  }
  if (result.warnings.length > 0) {
    lines.push("## Warnings", "");
    for (const w of result.warnings) lines.push(`- ${w}`);
    lines.push("");
  }
  return lines.join("\n");
}

export const migrateLocationsTool = {
  name: "migrate_locations",
  description:
    "Migrate all locations belonging to a workspace from Bubble to a staged Supabase migration file. Read-only — never writes to Supabase.",
  inputSchema: z.object({
    workspaceId: z.string().min(1),
  }),
  execute: async (
    input: { workspaceId: string },
    ctx: ToolContext,
  ): Promise<MigrationReport> => {
    const mapping = await loadMapping(ctx.mappingsDir, "locations");
    if (!mapping) {
      throw new Error(
        `mapping for "locations" not found at ${ctx.mappingsDir}/locations.json. Run research_entity first.`,
      );
    }

    const entry = getEntityByName("locations");
    if (!entry || !entry.workspaceFieldKey) {
      throw new Error(`locations entity not in registry or has no workspace key`);
    }

    // Resolve workspace name → slug (we need this even though we're not migrating the workspace itself)
    const workspaces = await ctx.bubble.listAll("workspace", {});
    const ws = workspaces.find((w) => w._id === input.workspaceId);
    if (!ws) throw new Error(`workspace not found: ${input.workspaceId}`);
    const workspaceSlug = slugify(pickName(ws));

    // Fetch all locations and filter client-side (defensive — server-side constraints unreliable)
    const all = await ctx.bubble.listAll(entry.bubbleType, {
      constraints: [
        { key: entry.workspaceFieldKey, constraint_type: "equals", value: input.workspaceId },
      ],
    });
    const filtered = all.filter((r) => r[entry.workspaceFieldKey!] === input.workspaceId);

    const generatedAt = new Date().toISOString();
    const result = runEngine(mapping, filtered, {
      workspaceId: input.workspaceId,
      workspaceSlug,
      mapping,
      companyId: null,
    });

    const sql = emitSql(result.rows, {
      entity: "locations",
      workspaceId: input.workspaceId,
      workspaceSlug,
      generatedAt,
    });
    const report = buildReport("locations", input.workspaceId, workspaceSlug, result, generatedAt);

    const staged = await writeStagedFiles({
      stagingDir: ctx.stagingDir,
      workspaceSlug,
      orderIndex: 2,
      entity: "locations",
      sql,
      report,
    });

    return {
      entity: "locations",
      workspaceId: input.workspaceId,
      workspaceSlug,
      recordsProcessed: filtered.length,
      recordsEmitted: result.rows.length,
      recordsSkipped: result.skipped.length,
      warnings: result.warnings,
      generatedAt,
      sqlFilePath: staged.sqlPath,
      reportFilePath: staged.reportPath,
    };
  },
};
