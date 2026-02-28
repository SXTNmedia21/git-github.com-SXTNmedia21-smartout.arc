import { z } from "zod";
import { defineTool } from "../../types";
import type { ContractToolContext, EditorAction } from "./types";

/**
 * add_signature_field — Inserts a DocuSeal signature field block.
 * Returns an EditorAction for client-side insertion.
 */
export const addSignatureField = defineTool({
  name: "add_signature_field",
  description:
    "Add a signature field block to the contract. This maps to a DocuSeal signature field and appears as a visual signature placeholder. Typically placed at the end of the contract. Each contract should have signature fields for both sender (Smartout/leverandør) and recipient (kunde).",
  schema: z.object({
    role: z
      .enum(["sender", "recipient"])
      .describe("Who signs: sender (Smartout) or recipient (kunde)"),
    label: z
      .string()
      .describe("Label for the signature field (e.g., 'Signatur Leverandør', 'Signatur Kunde')"),
    required: z.boolean().optional().default(true).describe("Whether the signature is required"),
  }),
  execute: async ({ role, label, required }, _ctx: ContractToolContext) => {
    const action: EditorAction = {
      type: "add_signature_field",
      data: { role, label, required },
    };

    return JSON.stringify({
      success: true,
      action,
      message: `Signature field "${label}" (${role}) will be added.`,
    });
  },
});
