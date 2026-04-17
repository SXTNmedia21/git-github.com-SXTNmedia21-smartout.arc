import { z } from "zod";
import type { BubbleClient } from "../bubble/client.js";
import { BubbleNotFoundError } from "../bubble/errors.js";
import { ENTITY_REGISTRY } from "../entities.js";
import type { ToolContext } from "./list_workspaces.js";

const MAX_RECORDS_PER_ENTITY = 5000;

export interface InspectError {
  entity: string;
  message: string;
}

export interface InspectResult {
  workspaceId: string;
  counts: Record<string, number>;
  errors: InspectError[];
  warnings: string[];
}

export const inspectWorkspaceTool = {
  name: "inspect_workspace",
  description:
    "Count the records per entity type belonging to a given workspace. Returns a scope overview used for migration planning.",
  inputSchema: z.object({
    workspaceId: z.string().min(1),
  }),
  execute: async (
    input: { workspaceId: string },
    ctx: ToolContext,
  ): Promise<InspectResult> => {
    const counts: Record<string, number> = {};
    const errors: InspectError[] = [];
    const warnings: string[] = [];

    for (const entity of ENTITY_REGISTRY) {
      if (entity.workspaceFieldKey === null) continue;

      try {
        const records = await ctx.bubble.listAll(entity.bubbleType, {
          maxRecords: MAX_RECORDS_PER_ENTITY,
          constraints: [
            {
              key: entity.workspaceFieldKey,
              constraint_type: "equals",
              value: input.workspaceId,
            },
          ],
        });
        counts[entity.name] = records.length;
        if (records.length >= MAX_RECORDS_PER_ENTITY) {
          warnings.push(
            `${entity.name}: capped at ${MAX_RECORDS_PER_ENTITY}; actual count may be higher`,
          );
        }
      } catch (err) {
        if (err instanceof BubbleNotFoundError) {
          counts[entity.name] = 0;
          errors.push({
            entity: entity.name,
            message: `Bubble type "${entity.bubbleType}" not found`,
          });
        } else {
          throw err;
        }
      }
    }

    return { workspaceId: input.workspaceId, counts, errors, warnings };
  },
};
