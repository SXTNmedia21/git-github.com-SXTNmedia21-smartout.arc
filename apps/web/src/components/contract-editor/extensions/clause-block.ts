import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { ClauseBlockView } from "./clause-block-view";

export type ClauseBlockAttributes = {
  clauseId: string;
  title: string;
  category: string;
  collapsed: boolean;
};

/**
 * ClauseBlock — Draggable section node with title, category badge, drag handle.
 * Renders as a bordered card with header. Content is editable inside.
 *
 * Architecture spec Section 5.3: "Draggable section with title, summary, collapsible body, drag handle"
 */
export const ClauseBlock = Node.create({
  name: "clauseBlock",

  group: "block",

  content: "block+",

  draggable: true,

  defining: true,

  addAttributes() {
    return {
      clauseId: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-clause-id"),
        renderHTML: (attributes) => ({
          "data-clause-id": attributes.clauseId as string,
        }),
      },
      title: {
        default: "Untitled Section",
        parseHTML: (element) => element.getAttribute("data-title"),
        renderHTML: (attributes) => ({
          "data-title": attributes.title as string,
        }),
      },
      category: {
        default: "general",
        parseHTML: (element) => element.getAttribute("data-category"),
        renderHTML: (attributes) => ({
          "data-category": attributes.category as string,
        }),
      },
      collapsed: {
        default: false,
        parseHTML: (element) => element.getAttribute("data-collapsed") === "true",
        renderHTML: (attributes) => ({
          "data-collapsed": String(attributes.collapsed),
        }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="clause-block"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-type": "clause-block" }), 0];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ClauseBlockView);
  },
});
