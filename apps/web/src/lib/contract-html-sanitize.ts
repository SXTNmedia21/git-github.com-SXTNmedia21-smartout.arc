/**
 * contract-html-sanitize — shared sanitize-html allowlist for contract HTML.
 *
 * Extracted from /api/contracts/route.ts so both the contract-draft endpoint
 * and the contract-send endpoint can import the same options without duplication.
 *
 * Allowlist is verified against all 6 Tiptap extensions used in ContractPreviewEditor:
 * ClauseBlock, PlaceholderField, SignatureField, SectionSummary, DateField, HighlightSection.
 *
 * The contract-service does NOT run its own sanitize — the BFF (Next.js Route Handlers)
 * is the sanitization gate. Service trusts BFF-gated input.
 */

import type sanitizeHtml from "sanitize-html";

/** Allowlist matching Tiptap output — strips scripts, event handlers, iframes */
export const HTML_SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    // sanitize-html defaults
    "address",
    "article",
    "aside",
    "footer",
    "header",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "hgroup",
    "main",
    "nav",
    "section",
    "blockquote",
    "dd",
    "div",
    "dl",
    "dt",
    "figcaption",
    "figure",
    "hr",
    "li",
    "main",
    "ol",
    "p",
    "pre",
    "ul",
    "a",
    "abbr",
    "b",
    "bdi",
    "bdo",
    "br",
    "cite",
    "code",
    "data",
    "dfn",
    "em",
    "i",
    "kbd",
    "mark",
    "q",
    "rb",
    "rp",
    "rt",
    "rtc",
    "ruby",
    "s",
    "samp",
    "small",
    "span",
    "strong",
    "sub",
    "sup",
    "time",
    "u",
    "var",
    "wbr",
    "caption",
    "col",
    "colgroup",
    "table",
    "tbody",
    "td",
    "tfoot",
    "th",
    "thead",
    "tr",
    // Additional Tiptap output tags
    "img",
  ],
  allowedAttributes: {
    a: ["href", "name", "target"],
    img: ["src", "srcset", "alt", "title", "width", "height", "loading"],
    span: [
      "class",
      "data-type",
      "data-key",
      "data-label",
      "data-placeholder-type",
      "data-role",
      "data-required",
      "data-clause-id",
      "data-title",
      "data-category",
      "data-color",
      "style",
    ],
    div: ["class", "data-type", "data-clause-id", "data-title", "data-category", "style"],
    section: ["class", "data-type", "style"],
  },
  allowedSchemes: ["https", "mailto"],
  disallowedTagsMode: "discard",
};
