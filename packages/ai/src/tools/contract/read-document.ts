import { z } from "zod";
import { defineTool } from "../../types";
import type { ContractToolContext } from "./types";

/**
 * read_document — Reads the current editor content and structure.
 * Returns full document HTML and plain text for AI analysis.
 */
export const readDocument = defineTool({
  name: "read_document",
  description:
    "Read the current contract document content. Returns the full HTML and plain text. Use this to understand the current state of the document before making changes.",
  schema: z.object({
    includeHtml: z
      .boolean()
      .optional()
      .default(true)
      .describe("Include HTML content in the response"),
    includeText: z
      .boolean()
      .optional()
      .default(true)
      .describe("Include plain text content in the response"),
  }),
  execute: async ({ includeHtml, includeText }, ctx: ContractToolContext) => {
    if (!ctx.editorState) {
      return JSON.stringify({ error: "No editor state available" });
    }

    const result: Record<string, string> = {};
    if (includeHtml) result.html = ctx.editorState.html;
    if (includeText) result.text = ctx.editorState.text;

    return JSON.stringify(result);
  },
});
