import { Node, mergeAttributes } from "@tiptap/core";

/**
 * SectionSummary — Block node for one-line AI-generated section summaries.
 *
 * Architecture spec Section 5.3: "One-line plain-language summary per section"
 * Rendered in italic with muted color. Non-editable by users — AI-managed.
 */
export const SectionSummary = Node.create({
  name: "sectionSummary",

  group: "block",

  atom: true,

  addAttributes() {
    return {
      text: {
        default: "",
        parseHTML: (element) => element.textContent || "",
        renderHTML: () => ({}),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'p[data-type="section-summary"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes, node }) {
    return [
      "p",
      mergeAttributes(HTMLAttributes, {
        "data-type": "section-summary",
        style: "color: #6B7280; font-style: italic; font-size: 0.875rem; margin: 0.25rem 0;",
      }),
      node.attrs.text as string,
    ];
  },

  addNodeView() {
    // Simple DOM rendering — no React node view needed for a static text display
    return ({ node }) => {
      const dom = document.createElement("p");
      dom.setAttribute("data-type", "section-summary");
      dom.className = "text-muted-foreground my-1 text-sm italic";
      dom.contentEditable = "false";
      dom.textContent = (node.attrs.text as string) || "";

      return {
        dom,
        update: (updatedNode) => {
          if (updatedNode.type.name !== "sectionSummary") return false;
          dom.textContent = (updatedNode.attrs.text as string) || "";
          return true;
        },
      };
    };
  },
});
