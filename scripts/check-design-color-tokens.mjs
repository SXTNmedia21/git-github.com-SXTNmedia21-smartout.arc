#!/usr/bin/env node
/**
 * check-design-color-tokens.mjs — the colour gate (closes the hook #10 hole).
 *
 * hook #10 gates only zinc/gray/slate. This gate fails on ANY raw Tailwind palette
 * class, hex literal, or raw oklch() in app .tsx/.css — the full set that made the
 * shell re-skin ship the WRONG orange (orange-500 != brand-orange). Nordic tokens only
 * (ADR-0366 / ADR-0361). globals.css is the only exempt file.
 *
 * Usage:
 *   node scripts/check-design-color-tokens.mjs <file...>      # check given files
 *   node scripts/check-design-color-tokens.mjs --staged       # check staged dashboard files
 *   node scripts/check-design-color-tokens.mjs --page <dir>   # check a page dir (advance-gate)
 * Exit 1 on any violation (prints file:line + the fix). Exit 0 = token-clean.
 */
import { readFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";

// The full Tailwind palette (everything that is NOT a Nordic semantic token).
const PALETTE = [
  "slate","gray","zinc","neutral","stone","red","orange","amber","yellow","lime",
  "green","emerald","teal","cyan","sky","blue","indigo","violet","purple","fuchsia","pink","rose",
].join("|");
const RE_PALETTE = new RegExp(`\\b(?:bg|text|border|ring|from|to|via|fill|stroke|divide|outline|shadow|accent|caret|decoration|placeholder)-(?:${PALETTE})-[0-9]{2,3}\\b`, "g");
const RE_HEX = /#[0-9a-fA-F]{3,8}\b/g;
const RE_OKLCH = /\boklch\(/g;

function fileArgs() {
  const a = process.argv.slice(2);
  if (a[0] === "--staged") {
    const out = execSync("git diff --cached --name-only --diff-filter=ACM", { encoding: "utf8" });
    return out.split("\n").filter((f) => /apps\/web\/src\/.*\.(tsx|css)$/.test(f) && existsSync(f));
  }
  if (a[0] === "--page") {
    const dir = a[1];
    const out = execSync(`git ls-files '${dir}' 2>/dev/null; find '${dir}' -name '*.tsx' -o -name '*.css' 2>/dev/null`, { encoding: "utf8" });
    return [...new Set(out.split("\n").filter((f) => /\.(tsx|css)$/.test(f) && existsSync(f)))];
  }
  return a.filter((f) => existsSync(f));
}

let violations = 0;
for (const file of fileArgs()) {
  // SCOPE GUARD (training-mode safety): NEVER run outside apps/web/src — no node_modules, no archive,
  // no prod, no unrelated paths. Read-only measurement only.
  if (!/(^|\/)apps\/web\/src\//.test(file)) continue;
  if (file.endsWith("globals.css")) continue; // the only exempt file (token definitions live here)
  const lines = readFileSync(file, "utf8").split("\n");
  lines.forEach((line, i) => {
    // skip comment-only lines + the reduced-motion a11y reset (WCAG)
    const t = line.trim();
    if (t.startsWith("//") || t.startsWith("*") || t.startsWith("/*")) return;
    for (const [re, label, fix] of [
      [RE_PALETTE, "raw Tailwind palette class", "use a Nordic token: brand-orange / success / warning / muted / accent / var(--token)"],
      [RE_HEX, "hex colour literal", "use a Nordic token (no hex in app code; globals.css only)"],
      [RE_OKLCH, "raw oklch() literal", "use a Nordic token (no oklch literal in app code; globals.css only)"],
    ]) {
      const m = line.match(re);
      if (m) {
        violations += m.length;
        console.error(`  ${file}:${i + 1}  ${label}: ${[...new Set(m)].join(", ")}\n      → ${fix}`);
      }
    }
  });
}

if (violations > 0) {
  console.error(`\n✖ colour gate: ${violations} raw-colour violation(s). A page is NOT 100% until this is 0.`);
  console.error("  Nordic Split: colours via tokens only (ADR-0366 / ADR-0361). globals.css is the only exempt file.\n");
  process.exit(1);
}
// Ready != authorized (C4). The gate measures; the human approves before advancing.
console.log("✓ colour gate: token-clean (0 raw palette / hex / oklch).");
console.log("  AWAITING-HUMAN-APPROVAL — token-clean is NOT permission to advance. A human reviews the");
console.log("  browser + approves. (Colour is 1 of 8 fidelity dimensions; font/padding/position need the");
console.log("  Playwright visual gate. See docs/campaign/DESIGN-FIDELITY-GATE.md.)");
