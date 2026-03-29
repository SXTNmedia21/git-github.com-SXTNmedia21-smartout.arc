import fs from "node:fs";
import path from "node:path";
import { cache } from "react";

export type UserManualDoc = {
  slug: string;
  title: string;
  order: number;
  fileName: string;
  content: string;
  excerpt: string;
  slugEn?: string;
};

export type UserManualNavItem = {
  title: string;
  href: string;
  description: string;
  slug: string;
};

export type DocsLocale = "nb" | "en";

const MANUAL_DIR_NAME = "User Manual";

function resolveManualDirectory(locale: DocsLocale) {
  const candidates = [
    path.join(process.cwd(), "docs", MANUAL_DIR_NAME, locale),
    path.join(process.cwd(), "..", "..", "docs", MANUAL_DIR_NAME, locale),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

function toTitleCase(input: string) {
  return input
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function stripNumericPrefix(fileName: string) {
  return fileName.replace(/^\d+\-/, "");
}

function slugify(input: string) {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function stripFrontmatter(markdown: string) {
  if (!markdown.startsWith("---")) return markdown;
  const closing = markdown.indexOf("---", 3);
  if (closing === -1) return markdown;
  return markdown.slice(closing + 3);
}

function extractFrontmatterField(markdown: string, field: string): string | undefined {
  if (!markdown.startsWith("---")) return undefined;
  const closing = markdown.indexOf("---", 3);
  if (closing === -1) return undefined;
  const frontmatter = markdown.slice(3, closing);
  const match = frontmatter.match(new RegExp(`^${field}:\\s*(.+)$`, "m"));
  return match?.[1]?.trim().replace(/^["']|["']$/g, "");
}

function extractTitle(markdown: string, fallback: string) {
  const body = stripFrontmatter(markdown);
  const firstHeading = body.match(/^#\s+(.+)$/m)?.[1]?.trim();
  return firstHeading || fallback;
}

function extractExcerpt(markdown: string) {
  const body = stripFrontmatter(markdown);
  const lines = body
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#") && line !== "---");
  const first = lines[0] || "Se dokumentasjonssiden for detaljer.";
  return first.startsWith("> ") ? first.slice(2) : first;
}

export const getUserManualDocs = cache((locale: DocsLocale = "nb"): UserManualDoc[] => {
  const manualDir = resolveManualDirectory(locale);
  if (!manualDir) return [];
  const files = fs
    .readdirSync(manualDir)
    .filter((file) => file.toLowerCase().endsWith(".md") && file.toLowerCase() !== "index.md");

  const docs = files
    .map((fileName, index) => {
      const numberedMatch = fileName.match(/^(\d+)\-(.+)\.md$/i);
      const baseName = stripNumericPrefix(fileName).replace(/\.md$/i, "");
      const order = numberedMatch?.[1] ? Number.parseInt(numberedMatch[1], 10) : 1000 + index;
      const fullPath = path.join(manualDir, fileName);
      const content = fs.readFileSync(fullPath, "utf8");
      const fallbackTitle = toTitleCase(baseName || "Dokument");

      // For en docs: prefer slug_en from frontmatter for URL-friendly English slugs
      // For nb docs: derive slug from filename (Norwegian names)
      const fmSlug = extractFrontmatterField(content, "slug");
      const fmSlugEn = extractFrontmatterField(content, "slug_en");
      const slug = locale === "en" && fmSlugEn ? fmSlugEn : (fmSlug ?? slugify(baseName));

      return {
        slug,
        title: extractTitle(content, fallbackTitle),
        order,
        fileName,
        content,
        excerpt: extractExcerpt(content),
        slugEn: fmSlugEn,
      } satisfies UserManualDoc;
    })
    .sort((a, b) => a.order - b.order);

  const seen = new Set<string>();
  return docs.filter((doc) => {
    if (seen.has(doc.slug)) return false;
    seen.add(doc.slug);
    return true;
  });
});

export function getUserManualDocBySlug(slug: string, locale: DocsLocale = "nb") {
  return getUserManualDocs(locale).find((doc) => doc.slug === slug) ?? null;
}

export function getUserManualNavigation(locale: DocsLocale = "nb"): UserManualNavItem[] {
  return getUserManualDocs(locale).map((doc) => ({
    title: doc.title,
    href: locale === "en" ? `/en/docs/${doc.slug}` : `/docs/${doc.slug}`,
    description: doc.excerpt,
    slug: doc.slug,
  }));
}

export function getUserManualIndexMarkdown() {
  const manualDir = resolveManualDirectory("nb");
  if (!manualDir) return "# User Manual\n\nDokumentation er ikke tilgjengelig i dette miljøet.";
  const parentDir = path.dirname(manualDir);
  const indexPath = path.join(parentDir, "INDEX.md");
  if (!fs.existsSync(indexPath)) {
    return "# User Manual\n\nIndex page is missing.";
  }
  return fs.readFileSync(indexPath, "utf8");
}

function scoreDocAgainstQuery(doc: UserManualDoc, query: string) {
  const normalized = query.toLowerCase().trim();
  if (!normalized) return 0;
  const terms = normalized.split(/\s+/).filter(Boolean);
  const haystackTitle = doc.title.toLowerCase();
  const haystackContent = doc.content.toLowerCase();

  let score = 0;
  for (const term of terms) {
    if (haystackTitle.includes(term)) score += 6;
    const contentMatches = haystackContent.split(term).length - 1;
    if (contentMatches > 0) score += Math.min(contentMatches, 8);
  }
  return score;
}

export function searchUserManual(query: string, limit = 4, locale: DocsLocale = "nb") {
  return getUserManualDocs(locale)
    .map((doc) => ({
      doc,
      score: scoreDocAgainstQuery(doc, query),
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => entry.doc);
}
