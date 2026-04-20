import { z } from "zod";
import { readFile } from "node:fs/promises";
import type { ToolContext } from "./list_workspaces.js";

export interface PreviewSqlResult {
  filePath: string;
  totalInserts: number;
  insertsByTable: Record<string, number>;
  hasBegin: boolean;
  hasCommit: boolean;
  warnings: string[];
}

export const previewSqlTool = {
  name: "preview_sql",
  description:
    "Parse a generated SQL file and return a summary of its INSERTs and any safety warnings. Does not execute SQL.",
  inputSchema: z.object({
    filePath: z.string().min(1),
  }),
  execute: async (
    input: { filePath: string },
    _ctx: ToolContext,
  ): Promise<PreviewSqlResult> => {
    const content = await readFile(input.filePath, "utf-8");
    const insertsByTable: Record<string, number> = {};
    const insertRegex = /INSERT\s+INTO\s+([\w.]+)/gi;
    let match;
    while ((match = insertRegex.exec(content)) !== null) {
      const table = match[1];
      insertsByTable[table] = (insertsByTable[table] ?? 0) + 1;
    }
    const totalInserts = Object.values(insertsByTable).reduce(
      (a, b) => a + b,
      0,
    );

    const hasBegin = /^\s*BEGIN\s*;/m.test(content);
    const hasCommit = /COMMIT\s*;/.test(content);

    const warnings: string[] = [];
    if (!hasBegin)
      warnings.push("missing BEGIN — migration is not transactional");
    if (!hasCommit) warnings.push("missing COMMIT — migration is incomplete");
    if (/\bDELETE\b/i.test(content))
      warnings.push(
        "contains DELETE statements — strike-mcp should never emit DELETE",
      );
    if (/\bUPDATE\b/i.test(content))
      warnings.push(
        "contains UPDATE statements — strike-mcp should never emit UPDATE",
      );

    return {
      filePath: input.filePath,
      totalInserts,
      insertsByTable,
      hasBegin,
      hasCommit,
      warnings,
    };
  },
};
