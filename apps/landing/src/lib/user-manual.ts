import fs from "node:fs";
import path from "node:path";

export type UserManualDoc = {
  slug: string;
  title: string;
  order: number;
  fileName: string;
  content: string;
  excerpt: string;
};

export type UserManualNavItem = {
  title: string;
  href: string;
  description: string;
  slug: string;
};

const MANUAL_DIR_NAME = "User Manual";

function resolveManualDirectory() {
  const candidates = [
    path.join(process.cwd(), "docs", MANUAL_DIR_NAME),
    path.join(process.cwd(), "..", "..", "docs", MANUAL_DIR_NAME),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error(`Could not locate docs/${MANUAL_DIR_NAME} from ${process.cwd()}`);
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

function extractTitle(markdown: string, fallback: string) {
  const firstHeading = markdown.match(/^#\s+(.+)$/m)?.[1]?.trim();
  return firstHeading || fallback;
}

function extractExcerpt(markdown: string) {
  const lines = markdown
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"));
  return lines[0] || "Se dokumentasjonssiden for detaljer.";
}

export function getUserManualDocs(): UserManualDoc[] {
  const manualDir = resolveManualDirectory();
  const files = fs
    .readdirSync(manualDir)
    .filter((file) => file.toLowerCase().endsWith(".md") && file.toLowerCase() !== "index.md");

  const docs = files
    .map((fileName, index) => {
      const numberedMatch = fileName.match(/^(\d+)\-(.+)\.md$/i);
      const baseName = stripNumericPrefix(fileName).replace(/\.md$/i, "");
      const order = numberedMatch?.[1] ? Number.parseInt(numberedMatch[1], 10) : 1000 + index;
      const slug = slugify(baseName);
      const fullPath = path.join(manualDir, fileName);
      const content = fs.readFileSync(fullPath, "utf8");
      const fallbackTitle = toTitleCase(slug || "Dokument");
      return {
        slug,
        title: extractTitle(content, fallbackTitle),
        order,
        fileName,
        content,
        excerpt: extractExcerpt(content),
      } satisfies UserManualDoc;
    })
    .sort((a, b) => a.order - b.order);

  return docs;
}

export function getUserManualDocBySlug(slug: string) {
  return getUserManualDocs().find((doc) => doc.slug === slug) ?? null;
}

export function getUserManualNavigation(): UserManualNavItem[] {
  return getUserManualDocs().map((doc) => ({
    title: doc.title,
    href: `/docs/${doc.slug}`,
    description: doc.excerpt,
    slug: doc.slug,
  }));
}

export function getUserManualIndexMarkdown() {
  const manualDir = resolveManualDirectory();
  const indexPath = path.join(manualDir, "INDEX.md");
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

export function searchUserManual(query: string, limit = 4) {
  return getUserManualDocs()
    .map((doc) => ({
      doc,
      score: scoreDocAgainstQuery(doc, query),
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => entry.doc);
}
