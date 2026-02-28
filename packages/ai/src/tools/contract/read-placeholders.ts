import { z } from "zod";
import { defineTool } from "../../types";
import type { ContractToolContext } from "./types";

/**
 * read_placeholders — Lists all placeholder fields found in the current document.
 * Parses the HTML to extract {{placeholder}} patterns and data-type="placeholder-field" nodes.
 */
export const readPlaceholders = defineTool({
  name: "read_placeholders",
  description:
    "List all placeholder fields in the current contract document. Returns an array of placeholders with their keys, labels, types, and values.",
  schema: z.object({}),
  execute: async (_params, ctx: ContractToolContext) => {
    if (!ctx.editorState) {
      return JSON.stringify({ error: "No editor state available", placeholders: [] });
    }

    const html = ctx.editorState.html;
    const placeholders: Array<{
      key: string;
      label: string;
      type: string;
      value: string | null;
    }> = [];

    // Extract from data-type="placeholder-field" spans
    const fieldRegex =
      /data-key="([^"]*)"[^>]*data-label="([^"]*)"[^>]*data-placeholder-type="([^"]*)"[^>]*data-value="([^"]*)"/g;
    let match;
    while ((match = fieldRegex.exec(html)) !== null) {
      placeholders.push({
        key: match[1] ?? "",
        label: match[2] ?? "",
        type: match[3] ?? "manual",
        value: match[4] || null,
      });
    }

    // Also extract raw {{placeholder}} patterns from text
    const textPatterns = ctx.editorState.text.matchAll(/\{\{(\w+)\}\}/g);
    for (const textMatch of textPatterns) {
      const key = textMatch[1] ?? "";
      if (!placeholders.some((p) => p.key === key)) {
        placeholders.push({
          key,
          label: key,
          type: "manual",
          value: null,
        });
      }
    }

    return JSON.stringify({ placeholders, count: placeholders.length });
  },
});
