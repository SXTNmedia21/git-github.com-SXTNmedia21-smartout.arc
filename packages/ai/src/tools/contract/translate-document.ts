import { z } from "zod";
import { defineTool } from "../../types";
import type { ContractToolContext } from "./types";

/**
 * translate_document — Translates the entire document to a target language.
 * Returns a message indicating the translation was prepared. The AI should
 * then call replace_section for each section with translated content.
 */
export const translateDocument = defineTool({
  name: "translate_document",
  description:
    "Translate the entire contract document to a target language. This prepares a full translation plan. After calling this, use replace_section for each section with the translated content. Always add a governing language clause specifying which language version prevails.",
  schema: z.object({
    targetLanguage: z
      .enum(["no", "en", "sv", "da"])
      .describe("Target language: no (Norwegian), en (English), sv (Swedish), da (Danish)"),
    addGoverningLanguageClause: z
      .boolean()
      .optional()
      .default(true)
      .describe("Whether to add a clause specifying which language version prevails"),
  }),
  execute: async ({ targetLanguage, addGoverningLanguageClause }, ctx: ContractToolContext) => {
    if (!ctx.editorState) {
      return JSON.stringify({ error: "No editor state available" });
    }

    const languageNames: Record<string, string> = {
      no: "Norwegian",
      en: "English",
      sv: "Swedish",
      da: "Danish",
    };

    return JSON.stringify({
      success: true,
      message: `Full document translation to ${languageNames[targetLanguage]} is ready. Now translate each section using replace_section with the translated content. ${addGoverningLanguageClause ? "Remember to add a governing language clause." : ""}`,
      targetLanguage,
      currentText: ctx.editorState.text.substring(0, 2000),
      addGoverningLanguageClause,
    });
  },
});
