#!/usr/bin/env tsx
/**
 * check-tool-name-collisions.ts — ADR-0348 enforcement CI detector.
 *
 * Scans all Botsson tool-hook files under
 * `apps/web/src/app/dashboard/**\/_tools/use-*-tools.ts` and fails if
 * any `modelToolName` string is registered in more than one file.
 *
 * Why this exists:
 *   L-0258 (2026-05-14) documented 9 confirmed tool-name collisions across
 *   useRegisterTools bridges; ADR-0325 Phase 1 used Object.assign last-wins
 *   routing which silently overwrites tool implementations on mount.
 *   ADR-0348 mandates a CI detector to block new collisions at PR time.
 *   M5 Sortie 2 (2026-05-17) closed the 3 HMS-cluster collisions and ships
 *   this detector to prevent recurrence.
 *
 * What it checks:
 *   Every `modelToolName: "X"` literal across all matching files. Lines
 *   starting with `//` are ignored. Multi-line definitions are handled by
 *   scanning the raw file content with a global regex (not line-by-line).
 *
 * Exit codes:
 *   0 — no collisions. Prints a green summary line.
 *   1 — one or more collisions found. Prints a collision report + exit 1.
 *   2 — script-internal error (missing directory, fs failure).
 *
 * Run:
 *   pnpm tsx scripts/check-tool-name-collisions.ts
 *   pnpm lint:tool-collisions
 *
 * ADR: docs/decisions/0348-l-0258-collision-detector-mandatory-ci.md
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";

const ROOT = resolve(__dirname, "..");
const TOOLS_BASE = join(ROOT, "apps", "web", "src", "app", "dashboard");

// ─────────────────────────────────────────────────────────────────────────────
// Glob — manual recursive glob (no external deps)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Recursively find all files matching the predicate under `dir`.
 */
function findFiles(dir: string, predicate: (filename: string) => boolean): string[] {
  const results: string[] = [];
  let entries: ReturnType<typeof readdirSync>;
  try {
    entries = readdirSync(dir);
  } catch {
    return results;
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    let stat: ReturnType<typeof statSync>;
    try {
      stat = statSync(full);
    } catch {
      continue;
    }
    if (stat.isDirectory()) {
      results.push(...findFiles(full, predicate));
    } else if (predicate(entry)) {
      results.push(full);
    }
  }
  return results;
}

/**
 * Matches files like `use-*-tools.ts` inside a `_tools/` directory.
 */
function isToolsFile(filename: string): boolean {
  return filename.startsWith("use-") && filename.endsWith("-tools.ts");
}

// ─────────────────────────────────────────────────────────────────────────────
// Extract modelToolName literals
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Return all `modelToolName: "X"` values from a file, ignoring comment lines.
 *
 * Strategy:
 *  1. Strip single-line comments (`// ...`) to avoid false positives.
 *  2. Apply global regex for modelToolName literals.
 *
 * Note: does NOT strip block comments (`/* ... *\/`) — tool definitions
 * live in object literals, never inside block comments in this codebase.
 */
function extractToolNames(filePath: string): string[] {
  let src: string;
  try {
    src = readFileSync(filePath, "utf-8");
  } catch (err) {
    console.error(`[check-tool-collisions] Cannot read ${filePath}: ${err}`);
    process.exit(2);
  }

  // Strip single-line comments to avoid matching commented-out tool names.
  const stripped = src
    .split("\n")
    .map((line) => {
      const commentIdx = line.indexOf("//");
      if (commentIdx === -1) return line;
      // Make sure it's not inside a string — simple heuristic: skip if odd number of `"` before `//`
      const beforeComment = line.slice(0, commentIdx);
      const quoteCount = (beforeComment.match(/"/g) ?? []).length;
      if (quoteCount % 2 !== 0) return line; // inside a string — keep
      return beforeComment;
    })
    .join("\n");

  // Match: modelToolName: "ToolName"  (with any whitespace around colon/value)
  const TOOL_NAME_RE = /modelToolName\s*:\s*"([^"]+)"/g;
  const names: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = TOOL_NAME_RE.exec(stripped)) !== null) {
    names.push(match[1]);
  }
  return names;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

function main(): void {
  // 1. Collect all matching files
  const allFiles = findFiles(TOOLS_BASE, isToolsFile).filter((f) => {
    // Only files under a `_tools/` directory segment
    return f.includes(`${sep}_tools${sep}`);
  });

  if (allFiles.length === 0) {
    console.error(
      `[check-tool-collisions] No tool files found under ${TOOLS_BASE}. Check the path.`,
    );
    process.exit(2);
  }

  // 2. Build map: toolName → [filePath, ...]
  const nameToFiles = new Map<string, string[]>();

  for (const filePath of allFiles) {
    const names = extractToolNames(filePath);
    for (const name of names) {
      const existing = nameToFiles.get(name) ?? [];
      existing.push(filePath);
      nameToFiles.set(name, existing);
    }
  }

  // 3. Filter to collisions (more than one file)
  const collisions = [...nameToFiles.entries()].filter(([, files]) => files.length > 1);

  // 4. Report
  if (collisions.length === 0) {
    console.log(
      `✓ No tool-name collisions across ${allFiles.length} files (${nameToFiles.size} unique tool names).`,
    );
    process.exit(0);
  }

  console.error(
    `\nError: ${collisions.length} tool-name collision(s) detected across ${allFiles.length} files.\n`,
  );
  for (const [name, files] of collisions) {
    console.error(`  Tool '${name}' registered in ${files.length} files:`);
    for (const f of files) {
      console.error(`    - ${relative(ROOT, f)}`);
    }
  }
  console.error(
    `\nFix: assign single ownership per tool name. See ADR-0348 + L-0258 for resolution pattern.\n`,
  );
  process.exit(1);
}

main();
