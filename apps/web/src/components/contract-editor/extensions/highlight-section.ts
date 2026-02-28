import { Mark, mergeAttributes } from "@tiptap/core";

export type HighlightColor = "yellow" | "green" | "blue" | "red" | "purple" | "orange";

const COLOR_STYLES: Record<HighlightColor, string> = {
  yellow:
    "background-color: rgba(250, 204, 21, 0.2); border-bottom: 2px solid rgba(250, 204, 21, 0.5);",
  green:
    "background-color: rgba(34, 197, 94, 0.2); border-bottom: 2px solid rgba(34, 197, 94, 0.5);",
  blue: "background-color: rgba(59, 130, 246, 0.2); border-bottom: 2px solid rgba(59, 130, 246, 0.5);",
  red: "background-color: rgba(239, 68, 68, 0.2); border-bottom: 2px solid rgba(239, 68, 68, 0.5);",
  purple:
    "background-color: rgba(168, 85, 247, 0.2); border-bottom: 2px solid rgba(168, 85, 247, 0.5);",
  orange:
    "background-color: rgba(249, 115, 22, 0.2); border-bottom: 2px solid rgba(249, 115, 22, 0.5);",
};

/**
 * HighlightSection — Mark extension for highlighting text with accent colors.
 *
 * Architecture spec Section 5.3: "AI-applied colored highlights"
 * Supports multiple colors for different highlighting purposes.
 */
export const HighlightSection = Mark.create({
  name: "highlightSection",

  addAttributes() {
    return {
      color: {
        default: "yellow" as HighlightColor,
        parseHTML: (element) => element.getAttribute("data-highlight-color") || "yellow",
        renderHTML: (attributes) => ({
          "data-highlight-color": attributes.color as string,
        }),
      },
      note: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-note"),
        renderHTML: (attributes) => {
          if (!attributes.note) return {};
          return { "data-note": attributes.note as string };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-type="highlight-section"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const color = (HTMLAttributes["data-highlight-color"] as HighlightColor) || "yellow";
    const style = COLOR_STYLES[color] || COLOR_STYLES.yellow;

    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        "data-type": "highlight-section",
        style: `${style} padding: 1px 2px; border-radius: 2px;`,
      }),
      0,
    ];
  },

  // Use editor.chain().focus().setMark('highlightSection', { color, note }).run()
  // or editor.chain().focus().unsetMark('highlightSection').run()
  // No custom commands needed — built-in setMark/unsetMark work for any mark.
});
