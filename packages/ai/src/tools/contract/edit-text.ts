import { z } from "zod";
import { defineTool } from "../../types";
import type { ContractToolContext, EditorAction } from "./types";

/**
 * edit_text — Find-and-replace text within a specific section.
 * Returns an EditorAction for client-side application with diff visualization.
 */
export const editText = defineTool({
  name: "edit_text",
  description:
    "Find and replace specific text within a clause section. Useful for targeted edits like fixing terminology, updating names, or changing specific phrases without replacing the entire section.",
  schema: z.object({
    clauseId: z.string().describe("The clauseId of the section containing the text"),
    findText: z.string().describe("The exact text to find"),
    replaceWith: z.string().describe("The replacement text"),
    reason: z.string().optional().describe("Brief explanation of why this change is being made"),
  }),
  execute: async ({ clauseId, findText, replaceWith, reason }, _ctx: ContractToolContext) => {
    const action: EditorAction = {
      type: "edit_text",
      target: clauseId,
      data: {
        findText,
        replaceWith,
        reason,
      },
    };

    return JSON.stringify({
      success: true,
      action,
      message: `Text "${findText}" will be replaced with "${replaceWith}" in section "${clauseId}". ${reason || ""}`,
    });
  },
});
