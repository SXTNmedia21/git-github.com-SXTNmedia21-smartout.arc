import { z } from "zod";
import { defineTool } from "../../types";
import type { ContractToolContext, EditorAction } from "./types";

/**
 * replace_section — Replaces the content of a specific clause block.
 * Returns an EditorAction that the client applies with diff visualization.
 */
export const replaceSection = defineTool({
  name: "replace_section",
  description:
    "Replace the content of a specific clause section in the contract. Provide the clauseId of the section to replace and the new HTML content. The change will be shown as a diff for user approval.",
  schema: z.object({
    clauseId: z.string().describe("The clauseId of the section to replace"),
    newContent: z.string().describe("New HTML content for the section body"),
    reason: z.string().optional().describe("Brief explanation of why this change is being made"),
  }),
  execute: async ({ clauseId, newContent, reason }, _ctx: ContractToolContext) => {
    const action: EditorAction = {
      type: "replace_section",
      target: clauseId,
      content: newContent,
      data: { reason },
    };

    return JSON.stringify({
      success: true,
      action,
      message: `Section "${clauseId}" will be updated. ${reason || ""}`,
    });
  },
});
