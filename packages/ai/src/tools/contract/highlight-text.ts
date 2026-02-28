import { z } from "zod";
import { defineTool } from "../../types";
import type { ContractToolContext, EditorAction } from "./types";

/**
 * highlight_text — Highlights a text range with a specific color.
 * Returns an EditorAction for client-side highlighting.
 */
export const highlightText = defineTool({
  name: "highlight_text",
  description:
    "Highlight specific text in the contract with a colored marker. Useful for drawing attention to key terms, important clauses, or areas that need review.",
  schema: z.object({
    text: z.string().describe("The text to highlight"),
    color: z
      .enum(["yellow", "green", "blue", "red", "purple", "orange"])
      .describe("Highlight color"),
    note: z.string().optional().describe("Optional note explaining why this text is highlighted"),
  }),
  execute: async ({ text, color, note }, _ctx: ContractToolContext) => {
    const action: EditorAction = {
      type: "highlight_text",
      content: text,
      data: { color, note },
    };

    return JSON.stringify({
      success: true,
      action,
      message: `Text "${text.substring(0, 50)}..." will be highlighted in ${color}.`,
    });
  },
});
