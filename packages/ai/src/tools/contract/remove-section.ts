import { z } from "zod";
import { defineTool } from "../../types";
import type { ContractToolContext, EditorAction } from "./types";

/**
 * remove_section — Removes a clause block from the document.
 * Returns an EditorAction for client-side removal with confirmation.
 */
export const removeSection = defineTool({
  name: "remove_section",
  description:
    "Remove a clause section from the contract. The removal will be shown as a diff (red strikethrough) for user confirmation before applying.",
  schema: z.object({
    clauseId: z.string().describe("The clauseId of the section to remove"),
    reason: z
      .string()
      .optional()
      .describe("Brief explanation of why this section should be removed"),
  }),
  execute: async ({ clauseId, reason }, _ctx: ContractToolContext) => {
    const action: EditorAction = {
      type: "remove_section",
      target: clauseId,
      data: { reason },
    };

    return JSON.stringify({
      success: true,
      action,
      message: `Section "${clauseId}" will be removed. ${reason || ""}`,
    });
  },
});
