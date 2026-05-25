/**
 * check-cors-pattern.mjs
 *
 * CI gate that ensures Edge Functions cannot reintroduce the recurring
 * CORS-blocks-workspace-subdomain bug (ADR-0408, 2026-05-23).
 *
 * Fails (exit 1) if any EF file:
 *   1. Imports a symbol named `corsHeaders` from `_shared/cors.ts`
 *      (the deprecated static constant that hardcoded https://smartout.ai)
 *   2. Contains a hardcoded Access-Control-Allow-Origin value with an
 *      explicit https?:// URL (not a wildcard, not an echo)
 *
 * Skips _shared/cors.ts itself (the source module) and test files.
 *
 * Run: node scripts/check-cors-pattern.mjs
 * Wire: package.json "check:cors" + husky pre-push + .github/workflows/ci.yml
 */

import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";

const EF_ROOT = new URL("../supabase/functions", import.meta.url).pathname;
const SHARED_CORS = join(EF_ROOT, "_shared", "cors.ts");

// Pattern 1: import { corsHeaders } from ".../_shared/cors.ts"
// Match the old deprecated import — not getCorsHeaders
const IMPORT_PATTERN = /import\s+\{[^}]*\bcorsHeaders\b[^}]*\}\s+from\s+['"][^'"]*_shared\/cors\.ts['"]/;

// Pattern 2: hardcoded ACAO with explicit URL (not *, not an echo)
// Catches: "Access-Control-Allow-Origin": "https://..."
//          "Access-Control-Allow-Origin": 'http://...'
const ACAO_HARDCODED = /Access-Control-Allow-Origin["']?\s*:\s*["']https?:\/\//;

/**
 * Recursively collect .ts files under a directory.
 * Skips directories named _shared to avoid false positives on cors.ts itself,
 * and skips files ending in .test.ts or .spec.ts.
 */
async function collectFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const results = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...(await collectFiles(full)));
    } else if (entry.isFile() && entry.name.endsWith(".ts")) {
      // Skip _shared/cors.ts (the source module itself — it defines the ACAO header)
      if (full === SHARED_CORS) continue;
      // Skip test files
      if (entry.name.endsWith(".test.ts") || entry.name.endsWith(".spec.ts")) continue;
      results.push(full);
    }
  }
  return results;
}

const files = await collectFiles(EF_ROOT);

const violations = [];

for (const file of files) {
  const rel = relative(process.cwd(), file);
  const content = await readFile(file, "utf8");
  const lines = content.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    if (IMPORT_PATTERN.test(line)) {
      violations.push(
        `${rel}:${lineNum}: deprecated 'corsHeaders' import from _shared/cors.ts — use getCorsHeaders(req) instead`,
      );
    }

    if (ACAO_HARDCODED.test(line)) {
      violations.push(
        `${rel}:${lineNum}: hardcoded Access-Control-Allow-Origin URL detected — must use getCorsHeaders(req) to echo origin dynamically`,
      );
    }
  }
}

if (violations.length > 0) {
  console.error("\n[check-cors-pattern] FAILED — CORS pattern violations found:\n");
  for (const v of violations) {
    console.error(`  ✗ ${v}`);
  }
  console.error(
    `\n  ${violations.length} violation(s). Fix by importing getCorsHeaders from _shared/cors.ts\n` +
      `  and calling const cors = getCorsHeaders(req); at the top of the handler.\n` +
      `  See ADR-0408 and docs/decisions/0408-cors-subdomain-migration-and-deprecated-removal.md\n`,
  );
  process.exit(1);
} else {
  // Silent pass — no output on success to keep CI logs clean
  process.exit(0);
}
