import { z } from "zod";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { ToolContext } from "./list_workspaces.js";

export interface BundleMigrationResult {
  bundlePath: string;
  workspaceSlug: string;
  totalInserts: number;
  insertsByTable: Record<string, number>;
  warnings: string[];
}

export const bundleMigrationTool = {
  name: "bundle_migration",
  description:
    "Concatenate all staged SQL files for a workspace into one transactional migration. Calls verify_target_empty first if Supabase is configured. Refuses if target is non-empty without explicit acknowledgement.",
  inputSchema: z.object({
    workspaceSlug: z.string().min(1),
    acknowledgeTargetHasData: z.boolean().optional(),
  }),
  execute: async (
    input: { workspaceSlug: string; acknowledgeTargetHasData?: boolean },
    ctx: ToolContext,
  ): Promise<BundleMigrationResult> => {
    const workspaceDir = join(ctx.stagingDir, input.workspaceSlug);

    // Verify target empty (if Supabase configured)
    if (ctx.supabase !== null) {
      const wsCount = await ctx.supabase.count("workspaces", { slug: input.workspaceSlug });
      if (wsCount > 0 && !input.acknowledgeTargetHasData) {
        throw new Error(
          `Target workspace "${input.workspaceSlug}" already exists in v3 (${wsCount} row(s)). Pass acknowledgeTargetHasData: true to override.`,
        );
      }
    }

    // Collect SQL files in deterministic order
    const entries = await readdir(workspaceDir);
    const sqlFiles = entries.filter((f) => f.endsWith(".sql") && f !== "bundled.sql").sort();
    if (sqlFiles.length === 0) {
      throw new Error(`no .sql files found in ${workspaceDir}`);
    }

    const bodies: string[] = [];
    const insertsByTable: Record<string, number> = {};

    for (const file of sqlFiles) {
      const content = await readFile(join(workspaceDir, file), "utf-8");
      // Strip individual BEGIN; and COMMIT; lines
      const stripped = content
        .replace(/^\s*BEGIN\s*;\s*$/gm, "")
        .replace(/^\s*COMMIT\s*;\s*$/gm, "");
      bodies.push(`-- from ${file}\n${stripped.trim()}\n`);

      // Count inserts
      const re = /INSERT\s+INTO\s+([\w.]+)/gi;
      let m;
      while ((m = re.exec(content)) !== null) {
        insertsByTable[m[1]] = (insertsByTable[m[1]] ?? 0) + 1;
      }
    }

    const totalInserts = Object.values(insertsByTable).reduce((a, b) => a + b, 0);

    const bundled = [
      "BEGIN;",
      "",
      `-- strike-mcp bundled migration for workspace: ${input.workspaceSlug}`,
      `-- generated: ${new Date().toISOString()}`,
      `-- total INSERTs: ${totalInserts}`,
      `-- REVIEW BEFORE APPLYING TO PRODUCTION`,
      "",
      ...bodies,
      "COMMIT;",
      "",
    ].join("\n");

    const bundlePath = join(workspaceDir, "bundled.sql");
    await writeFile(bundlePath, bundled, "utf-8");

    return {
      bundlePath,
      workspaceSlug: input.workspaceSlug,
      totalInserts,
      insertsByTable,
      warnings: [],
    };
  },
};
