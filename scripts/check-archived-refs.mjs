#!/usr/bin/env node
// check-archived-refs — mechanical guardrail for ADR-0392 migration debt.
//
// When a docs/modules/<X>/ folder is archived (frontmatter status: archived
// + superseded_by: docs/domains/<Y>/), references from LIVE docs to that
// archived path must move to the new domain. This script flags any live ref
// that didn't migrate. Dated sources (ADRs, specs, plans, handoffs) and the
// new domain's own back-pointers are allowed.
//
// Wire: pnpm check:archived-refs (husky pre-push).
// Exit 0 = clean. Exit 1 = stale refs found.

import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";

const repo = execSync("git rev-parse --show-toplevel").toString().trim();
const modulesDir = join(repo, "docs", "modules");

// ---- find archived module folders + their superseded_by target ----
const archived = []; // { name, paths: ["docs/modules/<X>/", "modules/<X>/"], supersededBy }
if (existsSync(modulesDir)) {
  for (const name of readdirSync(modulesDir)) {
    const dir = join(modulesDir, name);
    if (!statSync(dir).isDirectory()) continue;
    const readme = join(dir, "README.md");
    if (!existsSync(readme)) continue;
    const text = readFileSync(readme, "utf8");
    if (!/^status:\s*archived\b/m.test(text)) continue;
    const m = text.match(/^superseded_by:\s*(\S+)/m);
    const supersededBy = m ? m[1].replace(/\/$/, "") + "/" : null;
    archived.push({
      name,
      paths: [`docs/modules/${name}/`, `modules/${name}/`],
      supersededBy,
    });
  }
}

if (archived.length === 0) {
  console.log("✅ check-archived-refs: no archived module folders — nothing to check.");
  process.exit(0);
}

// ---- exclusion rules ----
// Skip the archived folder itself, dated raw sources, decision log, handoffs,
// and the target domain (its back-pointers to source are intentional). The
// _DASHBOARD legitimately tracks migration; allow it.
const EXCLUDE_PREFIXES = [
  "docs/decisions/",
  "docs/superpowers/specs/",
  "docs/superpowers/plans/",
  "docs/handoffs/",
];
const isExcluded = (rel, entry) => {
  if (rel.startsWith(`docs/modules/${entry.name}/`)) return true;
  if (rel === "docs/domains/_DASHBOARD.md") return true;
  if (entry.supersededBy && rel.startsWith(entry.supersededBy)) return true;
  return EXCLUDE_PREFIXES.some((p) => rel.startsWith(p));
};

// ---- scan ----
const violations = [];
// NB: `git ls-files 'docs/**/*.md'` misses top-level docs/INDEX.md (git's `**`
// doesn't match zero dirs). Scan all tracked under docs/ and filter by .md.
const allMd = execSync("git ls-files docs", { cwd: repo })
  .toString()
  .trim()
  .split("\n")
  .filter((p) => p.endsWith(".md"));

for (const rel of allMd) {
  let text;
  try {
    text = readFileSync(join(repo, rel), "utf8");
  } catch {
    continue;
  }
  for (const entry of archived) {
    if (isExcluded(rel, entry)) continue;
    for (const ref of entry.paths) {
      if (text.includes(ref)) {
        // Find line numbers
        const lines = text.split("\n");
        lines.forEach((line, i) => {
          if (line.includes(ref)) {
            violations.push({
              file: rel,
              line: i + 1,
              ref,
              archived: entry.name,
              target: entry.supersededBy || "(unspecified)",
            });
          }
        });
      }
    }
  }
}

if (violations.length === 0) {
  console.log(`✅ check-archived-refs: ${archived.length} archived folder(s), no stale refs.`);
  process.exit(0);
}

for (const v of violations) {
  console.log(`❌ ${v.file}:${v.line} → "${v.ref}" (archived: ${v.archived}) — move to ${v.target}`);
}
console.log(
  `\ncheck-archived-refs: ${violations.length} stale ref(s) across ${archived.length} archived module folder(s).`,
);
process.exit(1);
