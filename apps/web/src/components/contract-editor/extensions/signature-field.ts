import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { SignatureFieldView } from "./signature-field-view";

export type SignatureRole = "sender" | "recipient";

export type SignatureFieldAttributes = {
  role: SignatureRole;
  label: string;
  required: boolean;
};

/**
 * SignatureField — Block node for DocuSeal signature fields.
 *
 * Architecture spec Section 5.3: "Maps to DocuSeal <signature-field>"
 * Rendered as a visual signature placeholder with label and role indicator.
 */
export const SignatureField = Node.create({
  name: "signatureField",

  group: "block",

  atom: true,

  draggable: true,

  addAttributes() {
    return {
      role: {
        default: "recipient" as SignatureRole,
        parseHTML: (element) => element.getAttribute("data-role"),
        renderHTML: (attributes) => ({
          "data-role": attributes.role as string,
        }),
      },
      label: {
        default: "Signatur",
        parseHTML: (element) => element.getAttribute("data-label"),
        renderHTML: (attributes) => ({
          "data-label": attributes.label as string,
        }),
      },
      required: {
        default: true,
        parseHTML: (element) => element.getAttribute("data-required") === "true",
        renderHTML: (attributes) => ({
          "data-required": String(attributes.required),
        }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="signature-field"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-type": "signature-field" })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(SignatureFieldView);
  },
});
