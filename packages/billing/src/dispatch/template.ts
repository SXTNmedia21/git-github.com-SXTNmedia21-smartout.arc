// Minimal Mustache-style template renderer for dispatch templates.
// Supports:
//   - {{path.to.value}} — dot-walks into the context object
//   - {{missing}}        — renders empty string (never throws)
//
// We deliberately DO NOT support {{#section}} / {{^section}} / partials —
// dispatch templates are single-line subjects and short email bodies, not
// full templating programs. Keeping the surface narrow makes renderer
// behaviour auditable and escape-safe.
//
// HTML-escaping is applied by default because the primary users are
// email_customer / email_internal adapters, and user-controlled strings
// (e.g. invoice.number) must not break HTML. Adapters whose channel is
// not HTML (http_api subject lines, plain-text) pass `escape: false`.

import type { TemplateContext } from "./types";

export type RenderOptions = {
  /** HTML-escape interpolated values. Default: true. */
  escape?: boolean;
};

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

function escapeHtml(input: string): string {
  return input.replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch] ?? ch);
}

function lookup(context: Record<string, unknown>, path: string): string {
  const parts = path.split(".");
  let cursor: unknown = context;
  for (const part of parts) {
    if (cursor === null || cursor === undefined || typeof cursor !== "object") {
      return "";
    }
    cursor = (cursor as Record<string, unknown>)[part];
  }
  if (cursor === null || cursor === undefined) return "";
  return String(cursor);
}

/**
 * Render a Mustache-style template against the provided context.
 *
 * Example:
 *   renderTemplate("Faktura {{invoice.number}}", { invoice: { number: "F-2026-001" } })
 *   // => "Faktura F-2026-001"
 */
export function renderTemplate(
  template: string,
  context: TemplateContext | Record<string, unknown>,
  options: RenderOptions = {},
): string {
  const escape = options.escape ?? true;
  return template.replace(/\{\{\s*([^}\s]+)\s*\}\}/g, (_, path: string) => {
    const raw = lookup(context as Record<string, unknown>, path);
    return escape ? escapeHtml(raw) : raw;
  });
}
