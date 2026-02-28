import { z } from "zod";
import { defineTool } from "../../types";
import type { ContractToolContext, EditorAction } from "./types";

/**
 * translate_section — Translates a single section to a target language.
 * Returns an EditorAction with the translated content.
 */
export const translateSection = defineTool({
  name: "translate_section",
  description:
    "Translate a specific clause section to a target language. Preserves all placeholder fields ({{variabel}}) unchanged. Only translates the human-readable text.",
  schema: z.object({
    clauseId: z.string().describe("The clauseId of the section to translate"),
    targetLanguage: z
      .enum(["no", "en", "sv", "da"])
      .describe("Target language: no (Norwegian), en (English), sv (Swedish), da (Danish)"),
    translatedContent: z.string().describe("The translated HTML content for the section body"),
  }),
  execute: async ({ clauseId, targetLanguage, translatedContent }, _ctx: ContractToolContext) => {
    const action: EditorAction = {
      type: "replace_section",
      target: clauseId,
      content: translatedContent,
      data: {
        reason: `Translated to ${targetLanguage}`,
        translatedTo: targetLanguage,
      },
    };

    return JSON.stringify({
      success: true,
      action,
      message: `Section "${clauseId}" will be translated to ${targetLanguage}.`,
    });
  },
});
