#!/usr/bin/env node
// domain-lint — mechanical floor for the domain-steward skill (ADR-0392).
//
// Validates docs/domains/<name>/ folders against the fixed spine + truth-axis
// frontmatter, and flags staleness. This is the enforcement layer a discipline
// skill cannot provide on its own (cf. ADR-0366 OKLCH: drift only stopped when
// a linter shipped). Judgment stays in the skill; mechanics live here.
//
// Usage:
//   node scripts/domain-lint.mjs                 # lint all domains
//   node scripts/domain-lint.mjs --domain billing
//   node scripts/domain-lint.mjs --changed       # only domains touched vs origin/development (pre-push scope)
//   node scripts/domain-lint.mjs --max-stale-days 45
//   node scripts/domain-lint.mjs --stale-warn    # staleness = warning, not failure
//   node scripts/domain-lint.mjs --json
//
// Exit 0 = clean (or no domains yet). Exit 1 = violations.

import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { execSync } from "node:child_process";

const SPINE = [
  "README.md",
  "OVERVIEW.md",
  "ARCHITECTURE.md",
  "DATA-MODEL.md",
  "USER-FLOWS.md",
  "ROADMAP.md",
  "GAPS-AND-DEBT.md",
  "E2E-COVERAGE.md",
];
const MIRROR_VALUES = ["verified", "aspirational", "mixed"];
const STATUS_VALUES = ["draft", "in_progress", "review", "done", "archived"];
const REQUIRED_KEYS = ["title", "status", "updated", "created", "domain", "tags"];
// Spine files (except ROADMAP, which is aspirational by design) carry the truth axis.
const MIRROR_REQUIRED = SPINE.filter((f) => f !== "ROADMAP.md");

// ---- args ----
const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const opt = (n, d) => {
  const i = args.indexOf(n);
  return i >= 0 && args[i + 1] ? args[i + 1] : d;
};
const onlyDomain = opt("--domain", null);
const changedOnly = flag("--changed");
const maxStaleDays = parseInt(opt("--max-stale-days", "45"), 10);
const staleWarn = flag("--stale-warn");
const asJson = flag("--json");

const repo = execSync("git rev-parse --show-toplevel").toString().trim();
const domainsDir = join(repo, "docs", "domains");

const errors = [];
const warnings = [];
const err = (d, m) => errors.push(`${d}: ${m}`);
const warn = (d, m) => warnings.push(`${d}: ${m}`);

// Minimal frontmatter parser (no yaml dep). Returns flat key→string map of the
// top-level scalar keys in the leading --- block. Good enough for our checks.
function frontmatter(text) {
  if (!text.startsWith("---")) return null;
  const end = text.indexOf("\n---", 3);
  if (end < 0) return null;
  const block = text.slice(3, end);
  const fm = {};
  for (const line of block.split("\n")) {
    const m = line.match(/^([a-zA-Z_]+):\s*(.*)$/);
    if (m) fm[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
  return fm;
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;
function daysSince(d) {
  const t = Date.parse(d);
  if (Number.isNaN(t)) return null;
  return Math.floor((Date.now() - t) / 86400000);
}

function changedDomains() {
  try {
    execSync("git fetch origin development --quiet", { stdio: "ignore" });
  } catch {}
  let base = "origin/development";
  try {
    execSync(`git rev-parse --verify ${base}`, { stdio: "ignore" });
  } catch {
    base = "HEAD~1";
  }
  const out = execSync(`git diff --name-only ${base}... -- docs/domains`, { cwd: repo })
    .toString()
    .trim();
  const set = new Set();
  for (const p of out.split("\n").filter(Boolean)) {
    const m = p.match(/^docs\/domains\/([^/]+)\//);
    if (m && !m[1].startsWith("_")) set.add(m[1]);
  }
  return set;
}

// ---- run ----
if (!existsSync(domainsDir)) {
  if (asJson) console.log(JSON.stringify({ ok: true, domains: 0, note: "no docs/domains yet" }));
  else console.log("✅ domain-lint: docs/domains/ does not exist yet — nothing to lint.");
  process.exit(0);
}

let domainNames = readdirSync(domainsDir).filter(
  (n) => !n.startsWith("_") && statSync(join(domainsDir, n)).isDirectory(),
);
if (onlyDomain) domainNames = domainNames.filter((n) => n === onlyDomain);
if (changedOnly) {
  const ch = changedDomains();
  domainNames = domainNames.filter((n) => ch.has(n));
}

const dashboardPath = join(domainsDir, "_DASHBOARD.md");
const dashboard = existsSync(dashboardPath) ? readFileSync(dashboardPath, "utf8") : null;
if (!dashboard && domainNames.length) err("_DASHBOARD.md", "missing — every domain set needs the status dashboard");

for (const name of domainNames) {
  const dir = join(domainsDir, name);

  for (const file of SPINE) {
    const fp = join(dir, file);
    if (!existsSync(fp)) {
      err(name, `missing spine file ${file}`);
      continue;
    }
    const text = readFileSync(fp, "utf8");
    const fm = frontmatter(text);
    const tag = `${name}/${file}`;
    if (!fm) {
      err(tag, "missing or malformed YAML frontmatter");
      continue;
    }
    for (const k of REQUIRED_KEYS) if (!(k in fm)) err(tag, `frontmatter missing '${k}'`);
    if (fm.status && !STATUS_VALUES.includes(fm.status)) err(tag, `invalid status '${fm.status}'`);
    if (fm.created && !ISO.test(fm.created)) err(tag, `created not ISO date`);
    if (fm.updated && !ISO.test(fm.updated)) err(tag, `updated not ISO date`);

    if (MIRROR_REQUIRED.includes(file)) {
      if (!fm.mirror) err(tag, "frontmatter missing 'mirror' (verified|aspirational|mixed)");
      else if (!MIRROR_VALUES.includes(fm.mirror)) err(tag, `invalid mirror '${fm.mirror}'`);
      if (!fm.last_verified) err(tag, "frontmatter missing 'last_verified'");
      else if (!ISO.test(fm.last_verified)) err(tag, "last_verified not ISO date");

      // Staleness: a 'verified' claim that hasn't been re-checked vs code is rotting.
      if (fm.mirror === "verified" && ISO.test(fm.last_verified || "")) {
        const age = daysSince(fm.last_verified);
        if (age !== null && age > maxStaleDays) {
          const msg = `verified but last_verified ${age}d ago (> ${maxStaleDays}d) — re-run 'domain-steward update ${name}'`;
          staleWarn ? warn(tag, msg) : err(tag, msg);
        }
      }
    }
  }

  // Dashboard must list the domain.
  if (dashboard && !dashboard.includes(`(./${name}/)`) && !dashboard.includes(`./${name}/`)) {
    err(name, "not listed in _DASHBOARD.md");
  }
}

// ---- report ----
if (asJson) {
  console.log(JSON.stringify({ ok: errors.length === 0, domains: domainNames.length, errors, warnings }, null, 2));
} else {
  for (const w of warnings) console.log(`🟡 ${w}`);
  if (errors.length) {
    for (const e of errors) console.log(`❌ ${e}`);
    console.log(`\ndomain-lint: ${errors.length} violation(s) across ${domainNames.length} domain(s).`);
  } else {
    console.log(`✅ domain-lint: ${domainNames.length} domain(s) clean${warnings.length ? ` (${warnings.length} warning(s))` : ""}.`);
  }
}
process.exit(errors.length ? 1 : 0);
