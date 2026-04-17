import { z } from "zod";
import { getEntityByName } from "../entities.js";
import type { ToolContext } from "./list_workspaces.js";

export interface MigrationStep {
  tool: string;
  entity: string;
  recordCount: number;
}

export interface PlanMigrationResult {
  workspaceId: string;
  steps: MigrationStep[];
}

const PHASE_3_ORDER: Array<{ entity: string; tool: string }> = [
  { entity: "workspace", tool: "migrate_workspace" },
  { entity: "locations", tool: "migrate_locations" },
];

export const planMigrationTool = {
  name: "plan_migration",
  description:
    "Read-only. Returns the recommended migration order for a workspace based on dependencies and which entities actually have records.",
  inputSchema: z.object({
    workspaceId: z.string().min(1),
  }),
  execute: async (
    input: { workspaceId: string },
    ctx: ToolContext,
  ): Promise<PlanMigrationResult> => {
    const steps: MigrationStep[] = [];

    for (const { entity, tool } of PHASE_3_ORDER) {
      const entry = getEntityByName(entity);
      if (!entry) continue;

      let count: number;
      if (entity === "workspace") {
        const all = await ctx.bubble.listAll("workspace", {});
        count = all.filter((r) => r._id === input.workspaceId).length;
      } else if (entry.workspaceFieldKey) {
        const all = await ctx.bubble.listAll(entry.bubbleType, {
          constraints: [
            {
              key: entry.workspaceFieldKey,
              constraint_type: "equals",
              value: input.workspaceId,
            },
          ],
        });
        count = all.filter(
          (r) => r[entry.workspaceFieldKey!] === input.workspaceId,
        ).length;
      } else {
        count = 0;
      }

      if (count > 0) {
        steps.push({ tool, entity, recordCount: count });
      }
    }

    return { workspaceId: input.workspaceId, steps };
  },
};
