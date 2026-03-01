// ============================================
// metadata-extractor.ts
// Extracts document type and metadata from markdown files.
// Handles both YAML frontmatter (standard) and inline patterns
// (for older docs that use **Status:** format).
// Connected to: src/chunking/chunker.ts (provides metadata for chunk headers)
// ============================================

import matter from "gray-matter";

/**
 * Document types matching the doc_type enum in the database.
 * Must stay in sync with the migration enum.
 */
export type DocType =
  | "adr"
  | "module"
  | "architecture"
  | "cross_cutting"
  | "plan"
  | "research"
  | "roadmap"
  | "other";

/**
 * Extracted metadata from a documentation file.
 */
export type DocMetadata = {
  title: string | null;
  docType: DocType;
  status: string | null;
  created: string | null;
  updated: string | null;
  frontmatter: Record<string, unknown>;
  bodyContent: string;
};

/**
 * Detects the document type based on the file's relative path.
 *
 * Why: Different doc types have different chunking strategies
 * (ADRs are kept whole, modules are split on headings).
 * The path reliably indicates the type.
 *
 * @param relativePath - Path relative to the docs/ directory (e.g., "decisions/0031-foo.md")
 * @returns The detected DocType
 */
export function detectDocType(relativePath: string): DocType {
  const normalized = relativePath.replace(/\\/g, "/").toLowerCase();

  // Match against known directory patterns
  if (normalized.includes("decisions/") || normalized.includes("adr")) {
    return "adr";
  }
  if (normalized.includes("modules/")) {
    return "module";
  }
  if (normalized.includes("architecture/")) {
    return "architecture";
  }
  if (normalized.includes("cross-cutting/") || normalized.includes("cross_cutting/")) {
    return "cross_cutting";
  }
  if (normalized.includes("plans/")) {
    return "plan";
  }
  if (normalized.includes("research/")) {
    return "research";
  }
  if (normalized.includes("roadmap")) {
    return "roadmap";
  }

  return "other";
}

/**
 * Extracts metadata from a markdown file's content.
 *
 * Why: We need metadata (title, type, status) to build context
 * headers for each chunk and to store in the metadata JSONB column.
 * Handles both YAML frontmatter and legacy inline patterns.
 *
 * @param content - Raw markdown content including frontmatter
 * @param relativePath - Path relative to docs/ for type detection
 * @returns Extracted metadata and the body content (frontmatter stripped)
 */
export function extractMetadata(content: string, relativePath: string): DocMetadata {
  const docType = detectDocType(relativePath);

  // Parse YAML frontmatter if present
  const parsed = matter(content);
  const fm = parsed.data as Record<string, unknown>;
  const bodyContent = parsed.content;

  // Extract title: frontmatter > first H1 > null
  let title = (fm["title"] as string) ?? null;
  if (!title) {
    const h1Match = bodyContent.match(/^#\s+(.+)$/m);
    if (h1Match?.[1]) {
      title = h1Match[1].trim();
    }
  }

  // Extract status from frontmatter or inline pattern
  let status = (fm["status"] as string) ?? null;
  if (!status) {
    const statusMatch = bodyContent.match(/\*\*Status:\*\*\s*(.+)/i);
    if (statusMatch?.[1]) {
      status = statusMatch[1].trim();
    }
  }

  // Extract dates
  const created = fm["created"] ? String(fm["created"]) : null;
  const updated = fm["updated"] ? String(fm["updated"]) : null;

  return {
    title,
    docType,
    status,
    created,
    updated,
    frontmatter: fm,
    bodyContent,
  };
}
