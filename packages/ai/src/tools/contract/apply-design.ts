import { z } from "zod";
import { defineTool } from "../../types";
import type { ContractToolContext, EditorAction } from "./types";

/**
 * apply_design — Applies visual design changes to the contract.
 * Returns an EditorAction for client-side design application.
 */
export const applyDesign = defineTool({
  name: "apply_design",
  description:
    "Apply visual design improvements to the contract. Can change accent color, font, or apply a full visual makeover with colorized headers, summaries, and improved spacing.",
  schema: z.object({
    designAction: z
      .enum([
        "change_accent_color",
        "add_summaries",
        "highlight_key_terms",
        "improve_spacing",
        "full_makeover",
      ])
      .describe("Type of design action to perform"),
    accentColor: z.string().optional().describe("New accent color hex code (e.g., '#FF6B35')"),
    font: z.string().optional().describe("Font family name"),
    description: z.string().optional().describe("Description of the design changes to apply"),
  }),
  execute: async ({ designAction, accentColor, font, description }, _ctx: ContractToolContext) => {
    const action: EditorAction = {
      type: "apply_design",
      data: {
        designAction,
        accentColor,
        font,
        description,
      },
    };

    return JSON.stringify({
      success: true,
      action,
      message: `Design action "${designAction}" will be applied. ${description || ""}`,
    });
  },
});
