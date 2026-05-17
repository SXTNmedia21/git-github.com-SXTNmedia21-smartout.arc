#!/usr/bin/env tsx
/**
 * check-tool-name-collisions.ts — ADR-0360 enforcement CI detector.
 *
 * Scans all Botsson tool-hook files under
 * `apps/web/src/app/dashboard/**\/_tools/use-*-tools.ts` and fails if
 * any NEW `modelToolName` string is registered in more than one file.
 *
 * RATCHET PATTERN
 * ───────────────
 * Pre-existing collisions are tracked in
 * `scripts/known-tool-name-collisions.json` (the allowlist). The detector
 * PASSES on allowlisted collisions (logged as WARN), FAILS only on NEW
 * collisions. Allowlist shrinks via follow-up sorties that resolve the
 * underlying ownership conflict.
 *
 * Why a ratchet:
 *   M5 Sortie 2 (2026-05-17) closed 3 HMS-cluster collisions but the
 *   full repo has 8 additional cross-domain collisions out of scope.
 *   Without a ratchet, wiring the detector into pre-push blocks ALL
 *   pushes on ALL branches until follow-up sorties land — L-0260
 *   amplifier shape. Same pattern used for TypeScript baseline gates,
 *   ESLint baseline gates, SonarCloud quality gates.
 *
 * Why this exists:
 *   L-0258 (2026-05-14) documented 9 confirmed tool-name collisions
 *   across useRegisterTools bridges; ADR-0325 Phase 1 used Object.assign
 *   last-wins routing which silently overwrites tool implementations on
 *   mount. ADR-0360 mandates a CI detector to block NEW collisions at
 *   PR time while permitting tracked pre-existing debt.
 *
 * What it checks:
 *   Every `modelToolName: "X"` literal across all matching files. Lines
 *   starting with `//` are ignored. Multi-line definitions are handled
 *   by scanning the raw file content with a global regex (not
 *   line-by-line).
 *
 * Exit codes:
 *   0 — no NEW collisions. Allowlisted collisions logged as WARN.
 *       Decay warnings emitted if any allowlisted entry no longer
 *       appears as a collision (suggest pruning).
 *   1 — one or more NEW collisions found. Prints report + exit 1.
 *   2 — script-internal error (missing directory, fs failure, malformed
 *       allowlist JSON).
 *
 * Run:
 *   pnpm tsx scripts/check-tool-name-collisions.ts
 *   pnpm lint:tool-collisions
 *
 * ADR: docs/decisions/0348-l-0258-collision-detector-mandatory-ci.md
 * Allowlist: scripts/known-tool-name-collisions.json
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";

const ROOT = resolve(__dirname, "..");
const TOOLS_BASE = join(ROOT, "apps", "web", "src", "app", "dashboard");
const ALLOWLIST_PATH = join(ROOT, "scripts", "known-tool-name-collisions.json");

// ─────────────────────────────────────────────────────────────────────────────
// Allowlist
// ─────────────────────────────────────────────────────────────────────────────

type Allowlist = {
  knownCollisions: string[];
  note?: string;
  lastUpdated?: string;
  trackingRef?: string;
};

function loadAllowlist(): Allowlist {
  let raw: string;
  try {
    raw = readFileSync(ALLOWLIST_PATH, "utf-8");
  } catch (err) {
    console.error(`[check-tool-collisions] Cannot read allowlist at ${ALLOWLIST_PATH}: ${err}`);
    process.exit(2);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    console.error(`[check-tool-collisions] Malformed allowlist JSON at ${ALLOWLIST_PATH}: ${err}`);
    process.exit(2);
  }
  if (
    !parsed ||
    typeof parsed !== "object" ||
    !Array.isArray((parsed as Allowlist).knownCollisions) ||
    !(parsed as Allowlist).knownCollisions.every((s) => typeof s === "string")
  ) {
    console.error(
      `[check-tool-collisions] Allowlist JSON must contain { "knownCollisions": string[] }.`,
    );
    process.exit(2);
  }
  return parsed as Allowlist;
}

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
  const allowlist = loadAllowlist();
  const allowedSet = new Set(allowlist.knownCollisions);

  // 1. Collect all matching files
  const allFiles = findFiles(TOOLS_BASE, isToolsFile).filter((f) =>
    f.includes(`${sep}_tools${sep}`),
  );

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

  // 3. Filter to collisions (more than one file) + partition allowed vs new
  const collisions = [...nameToFiles.entries()].filter(([, files]) => files.length > 1);

  const allowed: Array<[string, string[]]> = [];
  const newCollisions: Array<[string, string[]]> = [];

  for (const entry of collisions) {
    if (allowedSet.has(entry[0])) {
      allowed.push(entry);
    } else {
      newCollisions.push(entry);
    }
  }

  // 4. Detect decay — allowlisted entries that no longer collide
  const detectedNames = new Set(collisions.map(([name]) => name));
  const decayed: string[] = [...allowedSet].filter((name) => !detectedNames.has(name));

  // 5. Report
  // 5a. Log allowlisted collisions as WARN (informational).
  if (allowed.length > 0) {
    console.warn(
      `\n⚠  ${allowed.length} allowlisted collision(s) (not blocking — pending follow-up sortie):`,
    );
    for (const [name, files] of allowed) {
      console.warn(`   - '${name}' in ${files.length} files:`);
      for (const f of files) {
        console.warn(`       ${relative(ROOT, f)}`);
      }
    }
    console.warn(
      `   See scripts/known-tool-name-collisions.json (ref: ${allowlist.trackingRef ?? "n/a"}).`,
    );
  }

  // 5b. Decay warning — allowlist entry no longer detected as collision.
  if (decayed.length > 0) {
    console.warn(
      `\n⚠  ${decayed.length} allowlisted entry/entries no longer detected as collisions — consider pruning scripts/known-tool-name-collisions.json:`,
    );
    for (const name of decayed) {
      console.warn(`   - '${name}'`);
    }
  }

  // 5c. NEW collisions — hard fail.
  if (newCollisions.length > 0) {
    console.error(
      `\nDetected ${newCollisions.length} NEW tool-name collision(s) not in allowlist:\n`,
    );
    for (const [name, files] of newCollisions) {
      console.error(`  Tool '${name}' registered in ${files.length} files:`);
      for (const f of files) {
        console.error(`    - ${relative(ROOT, f)}`);
      }
    }
    console.error(
      `\nTo resolve: either fix the collision (ADR-0360 pattern — assign single ownership) or, if intentionally pending, add to scripts/known-tool-name-collisions.json with sortie/PR reference.\n`,
    );
    process.exit(1);
  }

  // 5d. Green path.
  console.log(
    `\n✓ No NEW collisions. Allowlist still applies to ${allowed.length} known collision(s) — see scripts/known-tool-name-collisions.json`,
  );
  console.log(`  Scanned ${allFiles.length} tool files, ${nameToFiles.size} unique tool names.`);
  process.exit(0);
}

main();
