import { Node, mergeAttributes } from "@tiptap/core";

export type DateFieldAttributes = {
  key: string;
  label: string;
  format: string;
  value: string | null;
};

/**
 * DateField — Inline atom node for date fields in contracts.
 *
 * Architecture spec Section 5.3: "Maps to DocuSeal <date-field>"
 * Rendered as a styled inline chip similar to placeholder fields.
 */
export const DateField = Node.create({
  name: "dateField",

  group: "inline",

  inline: true,

  atom: true,

  addAttributes() {
    return {
      key: {
        default: "date",
        parseHTML: (element) => element.getAttribute("data-key"),
        renderHTML: (attributes) => ({
          "data-key": attributes.key as string,
        }),
      },
      label: {
        default: "Dato",
        parseHTML: (element) => element.getAttribute("data-label"),
        renderHTML: (attributes) => ({
          "data-label": attributes.label as string,
        }),
      },
      format: {
        default: "dd.MM.yyyy",
        parseHTML: (element) => element.getAttribute("data-format"),
        renderHTML: (attributes) => ({
          "data-format": attributes.format as string,
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
        tag: 'span[data-type="date-field"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes, node }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        "data-type": "date-field",
        style:
          "display: inline-flex; align-items: center; gap: 4px; padding: 1px 8px; border-radius: 9999px; border: 1px solid rgba(59, 130, 246, 0.3); background: rgba(59, 130, 246, 0.1); color: rgb(96, 165, 250); font-size: 0.75rem; font-weight: 500;",
      }),
      (node.attrs.label as string) || (node.attrs.key as string),
    ];
  },

  addNodeView() {
    return ({ node }) => {
      const dom = document.createElement("span");
      dom.setAttribute("data-type", "date-field");
      dom.contentEditable = "false";
      dom.className =
        "inline-flex items-center gap-1 rounded-full border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 text-xs font-medium text-blue-400";

      const dot = document.createElement("span");
      dot.className = "h-1.5 w-1.5 rounded-full bg-blue-400";
      dom.appendChild(dot);

      const text = document.createElement("span");
      text.textContent = (node.attrs.label as string) || (node.attrs.key as string);
      dom.appendChild(text);

      return {
        dom,
        update: (updatedNode) => {
          if (updatedNode.type.name !== "dateField") return false;
          text.textContent =
            (updatedNode.attrs.label as string) || (updatedNode.attrs.key as string);
          return true;
        },
      };
    };
  },
});
