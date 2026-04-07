#!/usr/bin/env node
/**
 * scripts/patch-vercel-plugin-ai-sdk.mjs
 *
 * Idempotently patches the broken `generateObject was removed in AI SDK v6`
 * rule in the vercel-plugin/ai-sdk PostToolUse validator.
 *
 * Why this exists
 * ===============
 * The validator falsely claims `generateObject` was REMOVED in AI SDK v6.
 * Empirical verification (2026-04-07, ai@6.0.103):
 *   - Function declared at dist/index.d.ts:5158
 *   - Named export at dist/index.d.ts:6383
 *   - `NoObjectGeneratedError` class also exported
 * Vercel's own upstream `common-errors.md:73` says "is deprecated", not removed.
 *
 * The rule lives in 10 files across 4 plugin installations:
 *   - 4 × overlay.yaml
 *   - 4 × SKILL.md (frontmatter)
 *   - 4 × generated/skill-manifest.json (the file the validator actually loads)
 *
 * This script changes:
 *   message: "generateObject was removed in AI SDK v6 — use generateText..."
 * to:
 *   message: "generateObject is deprecated in AI SDK v6 (still exported and
 *            functional in ai@6.0.103, verified 2026-04-07). Prefer
 *            generateText with output: Output.object({ schema })..."
 *
 * And changes severity from `error` to `recommended` so the validator informs
 * but does not block.
 *
 * Idempotent: safe to re-run any number of times. Logs which files were
 * already patched vs newly patched.
 *
 * When to run
 * ===========
 *  - After `pnpm install` if Claude Code plugin auto-updates revert the patch
 *  - Manually when the validator starts producing the false-positive error
 *
 * Long-term fix
 * =============
 * File an upstream PR against vercel/vercel-plugin to land the fix once and
 * for all. Until then, this script is the local workaround.
 *
 * See ADR-0073 (agent-harness eval harness, hook addendum) for full context.
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

/**
 * Manual recursive walk to find files by basename match.
 * Used instead of globSync because that requires Node 22+ and we target 20.
 */
function findByBasename(root, basenames) {
  const found = [];
  function walk(dir) {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (basenames.includes(entry.name)) {
        found.push(full);
      }
    }
  }
  walk(root);
  return found;
}

const OLD_MSG =
  "generateObject was removed in AI SDK v6 — use generateText with output: Output.object({ schema }) instead. Run Skill(ai-sdk) for v6 structured output guidance.";
const NEW_MSG =
  "generateObject is deprecated in AI SDK v6 (still exported and functional in ai@6.0.103, verified 2026-04-07). Prefer generateText with output: Output.object({ schema }) for new code. Run Skill(ai-sdk) for migration guidance.";

const cacheRoot = join(homedir(), ".claude/plugins/cache");

// Only scan files where the rule is known to live. The validator loads from
// skill-manifest.json at runtime; the .yaml and .md copies are sources for
// the manifest build but worth patching for consistency.
const targetBasenames = ["overlay.yaml", "SKILL.md", "skill-manifest.json"];

let patched = 0;
let alreadyPatched = 0;
let scanned = 0;

const files = findByBasename(cacheRoot, targetBasenames);

{
  for (const filePath of files) {
    scanned++;
    let text;
    try {
      text = readFileSync(filePath, "utf8");
    } catch {
      continue;
    }

    if (!text.includes(OLD_MSG) && !text.includes(NEW_MSG)) continue;

    if (text.includes(NEW_MSG) && !text.includes(OLD_MSG)) {
      // Check severity is also recommended; if so, skip silently.
      const idx = text.indexOf(NEW_MSG);
      const window = text.slice(idx, Math.min(idx + 400, text.length));
      if (/severity["']?\s*[:\s]\s*["']?recommended/.test(window)) {
        alreadyPatched++;
        continue;
      }
    }

    let next = text.replace(OLD_MSG, NEW_MSG);

    // Replace severity:error → severity:recommended within the rule block
    // (search a 400-char window after the new message).
    let idx = 0;
    while (true) {
      const i = next.indexOf(NEW_MSG, idx);
      if (i === -1) break;
      const windowEnd = Math.min(i + 400, next.length);
      const before = next.slice(0, i);
      const window = next.slice(i, windowEnd);
      const after = next.slice(windowEnd);
      const newWindow = window.replace(
        /(severity["']?\s*[:\s]\s*["']?)error/,
        "$1recommended",
      );
      next = before + newWindow + after;
      idx = i + NEW_MSG.length;
    }

    if (next !== text) {
      writeFileSync(filePath, next, "utf8");
      patched++;
      console.log(`patched: ${filePath.replace(cacheRoot, "<cache>")}`);
    }
  }
}

console.log(`\nScanned ${scanned} files.`);
console.log(`Patched: ${patched} (newly).`);
console.log(`Already patched: ${alreadyPatched}.`);

if (patched === 0 && alreadyPatched === 0 && scanned > 0) {
  console.log(
    `No matching rule found in any cache file. Either the plugin updated and ` +
      `removed the rule entirely (good!), or the rule text changed. Inspect ` +
      `~/.claude/plugins/cache/ manually if Claude Code is still showing ` +
      `validator errors about generateObject.`,
  );
}
