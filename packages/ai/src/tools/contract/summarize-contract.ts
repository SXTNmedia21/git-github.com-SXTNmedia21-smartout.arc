import { z } from "zod";
import { defineTool } from "../../types";
import type { ContractToolContext } from "./types";

/**
 * summarize_contract — Generates a human-readable summary of the contract.
 * Returns the document text for the AI to summarize.
 */
export const summarizeContract = defineTool({
  name: "summarize_contract",
  description:
    "Generate a human-readable summary of the current contract. Provides the full document text for summarization. The summary should cover key parties, obligations, payment terms, and important clauses.",
  schema: z.object({
    language: z
      .enum(["no", "en"])
      .optional()
      .default("no")
      .describe("Language for the summary: no (Norwegian) or en (English)"),
  }),
  execute: async ({ language }, ctx: ContractToolContext) => {
    if (!ctx.editorState) {
      return JSON.stringify({ error: "No editor state available" });
    }

    return JSON.stringify({
      success: true,
      documentText: ctx.editorState.text,
      language,
      instruction:
        language === "no"
          ? "Lag en kortfattet oppsummering av kontrakten på norsk. Dekk partene, hovedforpliktelser, betalingsvilkår, varighet, og viktige klausuler."
          : "Create a concise summary of the contract in English. Cover the parties, main obligations, payment terms, duration, and key clauses.",
    });
  },
});
