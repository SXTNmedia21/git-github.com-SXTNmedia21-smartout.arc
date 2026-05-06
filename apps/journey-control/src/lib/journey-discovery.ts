/**
 * Filesystem scan for journeys.
 *
 * Compiled = .ts files in apps/e2e/protocols/ that export a const
 * matching JourneyIR shape. We don't import them (would require
 * compiling TS); we read the file + parse the title heuristically.
 *
 * Drafts = .md files in docs/journeys/ named JOURNEY-*.md.
 */

import * as fs from "fs/promises";
import * as path from "path";

export type CompiledJourney = {
  slug: string;
  title: string;
  filePath: string;
  module?: string;
};

export type DraftJourney = {
  slug: string;
  title: string;
  filePath: string;
};

const PROTOCOLS_DIR = "apps/e2e/protocols";
const JOURNEYS_DIR = "docs/journeys";

const RESERVED_FILES = new Set(["index.ts", "schema.ts", "types.ts"]);

export async function listCompiledJourneys(repoRoot: string): Promise<CompiledJourney[]> {
  const dir = path.join(repoRoot, PROTOCOLS_DIR);
  const entries = await fs.readdir(dir).catch(() => [] as string[]);
  const result: CompiledJourney[] = [];

  for (const entry of entries) {
    if (!entry.endsWith(".ts")) continue;
    if (RESERVED_FILES.has(entry)) continue;

    const filePath = path.join(dir, entry);
    const content = await fs.readFile(filePath, "utf8");

    const slugMatch = content.match(/slug:\s*["']([^"']+)["']/);
    const titleMatch = content.match(/title:\s*["']([^"']+)["']/);
    const moduleMatch = content.match(/module:\s*["']([^"']+)["']/);

    if (!slugMatch?.[1] || !titleMatch?.[1]) continue;

    result.push({
      slug: slugMatch[1],
      title: titleMatch[1],
      filePath,
      module: moduleMatch?.[1],
    });
  }

  return result.sort((a, b) => a.slug.localeCompare(b.slug));
}

export async function listDraftJourneys(repoRoot: string): Promise<DraftJourney[]> {
  const dir = path.join(repoRoot, JOURNEYS_DIR);
  const entries = await fs.readdir(dir).catch(() => [] as string[]);
  const result: DraftJourney[] = [];

  for (const entry of entries) {
    if (!entry.startsWith("JOURNEY-") || !entry.endsWith(".md")) continue;

    const filePath = path.join(dir, entry);
    const slug = entry.replace(/^JOURNEY-/, "").replace(/\.md$/, "");

    // Read frontmatter title or first heading
    const content = await fs.readFile(filePath, "utf8");
    const titleMatch =
      content.match(/^title:\s*["']?([^"'\n]+)["']?$/m) ?? content.match(/^#\s+(.+)$/m);
    const title = titleMatch?.[1]?.trim() ?? slug;

    result.push({ slug, title, filePath });
  }

  return result.sort((a, b) => a.slug.localeCompare(b.slug));
}
