import { z } from "zod";
import { defineTool } from "../../types";
import type { ContractToolContext, EditorAction } from "./types";

/**
 * insert_section — Inserts a new clause block at the end of the document.
 * Returns an EditorAction for client-side application with diff visualization.
 */
export const insertSection = defineTool({
  name: "insert_section",
  description:
    "Insert a new clause section into the contract. Provide a title, category, and the HTML content for the section body. The section will be added as a new ClauseBlock node.",
  schema: z.object({
    title: z.string().describe("Section title (e.g., '§ 3. Betaling')"),
    category: z
      .enum([
        "general",
        "parties",
        "service",
        "payment",
        "legal",
        "gdpr",
        "signature",
        "termination",
      ])
      .describe("Section category for the badge"),
    content: z.string().describe("HTML content for the section body"),
    position: z
      .enum(["start", "end", "before", "after"])
      .optional()
      .default("end")
      .describe("Where to insert: start, end, before/after a specific section"),
    relativeTo: z
      .string()
      .optional()
      .describe("clauseId to insert before/after (only when position is 'before' or 'after')"),
  }),
  execute: async (
    { title, category, content, position, relativeTo },
    _ctx: ContractToolContext,
  ) => {
    const clauseId = `clause-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    const action: EditorAction = {
      type: "insert_section",
      content,
      data: {
        clauseId,
        title,
        category,
        position,
        relativeTo,
      },
    };

    return JSON.stringify({
      success: true,
      action,
      message: `New section "${title}" (${category}) will be inserted.`,
    });
  },
});
