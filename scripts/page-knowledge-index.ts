#!/usr/bin/env tsx
/**
 * page-knowledge-index — generate `.claude/page-polish/index.md`
 *
 * Reads the `page_knowledge` table from Supabase Local and writes a markdown
 * table summarising every polished route. Workspace_id NULL = platform
 * default; the index intentionally lists only platform-default rows so the
 * report is repo-wide, not tenant-specific.
 *
 * Run: pnpm page-knowledge:index
 *
 * Requires SUPABASE_LOCAL_URL + SUPABASE_LOCAL_SERVICE_ROLE_KEY (or anon key
 * for read-only) in env. Falls back to the standard Supabase Local defaults.
 */

import { createClient } from "@supabase/supabase-js";
import { promises as fs } from "node:fs";
import path from "node:path";

const OUTPUT_PATH = path.join(process.cwd(), ".claude/page-polish/index.md");

const SUPABASE_URL =
  process.env.SUPABASE_LOCAL_URL ?? process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
const SUPABASE_KEY =
  process.env.SUPABASE_LOCAL_SERVICE_ROLE_KEY ??
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  process.env.SUPABASE_ANON_KEY ??
  "";

if (!SUPABASE_KEY) {
  console.error(
    "ERROR: no Supabase key found. Set SUPABASE_LOCAL_SERVICE_ROLE_KEY (recommended) or SUPABASE_ANON_KEY.",
  );
  process.exit(1);
}

type PageKnowledgeRow = {
  route: string;
  header: string | null;
  description: string | null;
  components: number | null;
  metrics: { lcp_ms?: number; cls?: number; tti_ms?: number; captured_at?: string } | null;
  updated_at: string;
};

async function main(): Promise<void> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false },
  });

  const { data, error } = await supabase
    .from("page_knowledge")
    .select("route, header, description, components, metrics, updated_at")
    .is("workspace_id", null)
    .order("route", { ascending: true });

  if (error) {
    console.error("Query failed:", error.message);
    process.exit(1);
  }

  const rows = (data ?? []) as PageKnowledgeRow[];

  const header = `# Page Knowledge Index

Generated: ${new Date().toISOString()}
Source: \`page_knowledge\` table (workspace_id IS NULL — platform defaults only)
Run: \`pnpm page-knowledge:index\`

| Route | Header | Description | Components | LCP (ms) | Last polish | Run YAML |
|-------|--------|-------------|------------|----------|-------------|----------|
`;

  const lines = rows.map((row) => {
    const lcp = row.metrics?.lcp_ms ?? null;
    const lastPolish = row.updated_at ? row.updated_at.slice(0, 10) : "—";
    const slug = row.route.replace(/^\//, "").replace(/\//g, "-") || "root";
    const yamlRef = `[run.yml](./${slug}.run.yml)`;
    return [
      `\`${row.route}\``,
      row.header ?? "—",
      row.description ?? "—",
      row.components ?? "—",
      lcp ?? "—",
      lastPolish,
      yamlRef,
    ]
      .map((cell) => String(cell).replace(/\|/g, "\\|"))
      .join(" | ");
  });

  const empty =
    rows.length === 0
      ? "\n_No platform-default rows yet. First polish run will populate this table._\n"
      : "";

  const body = lines.length > 0 ? lines.map((l) => `| ${l} |`).join("\n") : empty;

  await fs.mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await fs.writeFile(OUTPUT_PATH, header + body + "\n", "utf8");

  console.log(`Wrote ${OUTPUT_PATH} — ${rows.length} route(s).`);
}

void main();
