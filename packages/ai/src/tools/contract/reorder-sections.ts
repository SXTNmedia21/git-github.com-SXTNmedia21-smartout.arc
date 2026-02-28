import { z } from "zod";
import { defineTool } from "../../types";
import type { ContractToolContext, EditorAction } from "./types";

/**
 * reorder_sections — Moves sections to new positions.
 * Returns an EditorAction for client-side reordering.
 */
export const reorderSections = defineTool({
  name: "reorder_sections",
  description:
    "Reorder clause sections in the contract. Provide the clauseId of the section to move and its new position (before or after another section).",
  schema: z.object({
    clauseId: z.string().describe("The clauseId of the section to move"),
    position: z
      .enum(["before", "after"])
      .describe("Whether to place it before or after the target"),
    targetClauseId: z.string().describe("The clauseId of the section to place it relative to"),
    reason: z.string().optional().describe("Brief explanation of why this reordering is needed"),
  }),
  execute: async ({ clauseId, position, targetClauseId, reason }, _ctx: ContractToolContext) => {
    const action: EditorAction = {
      type: "reorder_sections",
      target: clauseId,
      data: {
        position,
        targetClauseId,
        reason,
      },
    };

    return JSON.stringify({
      success: true,
      action,
      message: `Section "${clauseId}" will be moved ${position} "${targetClauseId}". ${reason || ""}`,
    });
  },
});
