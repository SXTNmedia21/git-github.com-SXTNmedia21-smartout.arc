import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { PlaceholderFieldView } from "./placeholder-field-view";

export type PlaceholderType = "auto" | "manual" | "generated" | "signature";

export type PlaceholderFieldAttributes = {
  key: string;
  label: string;
  placeholderType: PlaceholderType;
  value: string | null;
};

/**
 * PlaceholderField — Inline node for {{placeholder}} fields rendered as colored chips.
 *
 * Architecture spec Section 5.3: "Inline {{placeholder}} rendered as colored chip"
 * Architecture spec Section 5.8: Chip colors by type (auto=green, manual=orange, generated=blue, signature=purple)
 */
export const PlaceholderField = Node.create({
  name: "placeholderField",

  group: "inline",

  inline: true,

  atom: true,

  addAttributes() {
    return {
      key: {
        default: "placeholder",
        parseHTML: (element) => element.getAttribute("data-key"),
        renderHTML: (attributes) => ({
          "data-key": attributes.key as string,
        }),
      },
      label: {
        default: "Placeholder",
        parseHTML: (element) => element.getAttribute("data-label"),
        renderHTML: (attributes) => ({
          "data-label": attributes.label as string,
        }),
      },
      placeholderType: {
        default: "manual" as PlaceholderType,
        parseHTML: (element) => element.getAttribute("data-placeholder-type"),
        renderHTML: (attributes) => ({
          "data-placeholder-type": attributes.placeholderType as string,
        }),
      },
      value: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-value"),
        renderHTML: (attributes) => ({
          "data-value": (attributes.value as string) || "",
        }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-type="placeholder-field"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, { "data-type": "placeholder-field" }),
      `{{${HTMLAttributes["data-key"] as string}}}`,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(PlaceholderFieldView);
  },
});
