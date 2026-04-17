import { z } from "zod";
import type { ToolContext } from "./list_workspaces.js";

export interface VerifyTargetEmptyResult {
  workspaceSlug: string;
  empty: boolean;
  counts: Record<string, number>;
  message: string;
}

export const verifyTargetEmptyTool = {
  name: "verify_target_empty",
  description:
    "Read-only Supabase check: confirms the target workspace slug has no existing data. The only tool that talks to Supabase, and only for SELECT.",
  inputSchema: z.object({
    workspaceSlug: z.string().min(1),
  }),
  execute: async (
    input: { workspaceSlug: string },
    ctx: ToolContext,
  ): Promise<VerifyTargetEmptyResult> => {
    if (ctx.supabase === null) {
      throw new Error(
        "Supabase read client not configured. Set SUPABASE_URL and SUPABASE_ANON_KEY environment variables.",
      );
    }

    const wsCount = await ctx.supabase.count("workspaces", { slug: input.workspaceSlug });
    const counts = { workspaces: wsCount };
    const empty = wsCount === 0;
    const message = empty
      ? `Target workspace "${input.workspaceSlug}" is empty. Safe to proceed with bundle_migration.`
      : `Target workspace "${input.workspaceSlug}" already exists in v3 (${wsCount} row(s) in workspaces). bundle_migration will refuse without --acknowledge-target-has-data.`;

    return { workspaceSlug: input.workspaceSlug, empty, counts, message };
  },
};
