import { z } from "zod";
import { defineTool } from "../../types";
import type { ContractToolContext, EditorAction } from "./types";

/**
 * add_placeholder — Inserts a placeholder field into the document.
 * Returns an EditorAction for client-side insertion of a colored chip.
 */
export const addPlaceholder = defineTool({
  name: "add_placeholder",
  description:
    "Insert a new placeholder merge field into the contract. Placeholders appear as colored chips that get replaced with real values when the contract is generated. Types: auto (green, from workspace data), manual (orange, user input), generated (blue, auto-generated), signature (purple, signature fields).",
  schema: z.object({
    key: z
      .string()
      .describe("Placeholder key in snake_case (e.g., 'firmanavn', 'org_nummer', 'avtaleperiode')"),
    label: z.string().describe("Human-readable label for the chip (e.g., 'Firmanavn', 'Org.nr')"),
    placeholderType: z
      .enum(["auto", "manual", "generated", "signature"])
      .describe(
        "Type of placeholder: auto (workspace data), manual (user input), generated (auto), signature",
      ),
  }),
  execute: async ({ key, label, placeholderType }, _ctx: ContractToolContext) => {
    const action: EditorAction = {
      type: "add_placeholder",
      data: { key, label, placeholderType },
    };

    return JSON.stringify({
      success: true,
      action,
      message: `Placeholder "${label}" (${placeholderType}) will be inserted.`,
    });
  },
});
