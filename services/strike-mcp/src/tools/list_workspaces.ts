import { z } from "zod";
import type { BubbleClient } from "../bubble/client.js";
import type { BubbleRecord } from "../bubble/types.js";
import { SupabaseReadClient } from "../supabase/client.js";

export interface ToolContext {
  bubble: BubbleClient;
  mappingsDir: string;
  vaultBubbleShapesDir: string;
  stagingDir: string;
  supabase: SupabaseReadClient | null;
}

export interface WorkspaceSummary {
  id: string;
  name: string;
  createdAt: string | null;
  modifiedAt: string | null;
}

export interface ListWorkspacesResult {
  workspaces: WorkspaceSummary[];
}

const NAME_KEY_CANDIDATES = ["name_text", "Name", "Titel", "title", "name"];

function pickName(record: BubbleRecord): string {
  for (const key of NAME_KEY_CANDIDATES) {
    const value = record[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value;
    }
  }
  return "(unnamed)";
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

export const listWorkspacesTool = {
  name: "list_workspaces",
  description:
    "List all workspaces in the configured Bubble.io instance. Returns ID, best-effort name, created/modified timestamps.",
  inputSchema: z.object({}),
  execute: async (
    _input: Record<string, never>,
    ctx: ToolContext,
  ): Promise<ListWorkspacesResult> => {
    const records = await ctx.bubble.listAll("workspace", {});
    const workspaces = records.map<WorkspaceSummary>((record) => ({
      id: record._id,
      name: pickName(record),
      createdAt: asString(record["Created Date"]),
      modifiedAt: asString(record["Modified Date"]),
    }));
    return { workspaces };
  },
};
