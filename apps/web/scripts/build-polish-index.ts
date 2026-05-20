#!/usr/bin/env tsx
/**
 * build-polish-index.ts — master polish ledger generator.
 *
 * Aggregates three truth sources into a single drift-free index:
 *   1. `.claude/page-polish/*.run.yml`      — per-route polish worksheets
 *      (status, verified, speed_test/retest metrics, design debt, harness tools).
 *   2. `apps/web/.botsson/site-map.json`     — route → tier, module, access, tools.
 *   3. live source grep of Tier 0 elements   — shared primitives have no run.yml;
 *      their polish status is computed from inline motion / palette debt.
 *
 * Emits:
 *   - docs/polish/POLISH-INDEX.md            — human ledger (routes + elements + rollup).
 *   - apps/web/.botsson/polish-index.json    — machine mirror.
 *
 * The rollup block is linked from docs/DASHBOARD.md ("Polish Coverage").
 *
 * Run: pnpm --filter web polish:index
 *      (or tsx scripts/build-polish-index.ts from apps/web)
 *
 * Regenerate after editing any run.yml, site-map.json, or Tier 0 primitive.
 * NEVER hand-edit the emitted files — they are overwritten on every run.
 */

import { readFileSync, readdirSync, statSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, relative } from "node:path";
import { parseDocument } from "yaml";

// Recovering deeply-malformed worksheets makes yaml's toJS emit a noisy
// "Keys with collection values will be stringified" warning when a broken list
// got parsed as a map key. The recovered top-level fields are still correct;
// silence just this one warning so CI logs stay clean.
const origEmitWarning = process.emitWarning.bind(process);
process.emitWarning = ((warning: string | Error, ...rest: unknown[]) => {
  const msg = typeof warning === "string" ? warning : warning.message;
  if (msg.includes("Keys with collection values")) return;
  return (origEmitWarning as (...a: unknown[]) => void)(warning, ...rest);
}) as typeof process.emitWarning;

const WEB_ROOT = join(__dirname, "..");
const REPO_ROOT = join(WEB_ROOT, "..", "..");
const POLISH_DIR = join(REPO_ROOT, ".claude", "page-polish");
const SITE_MAP_PATH = join(WEB_ROOT, ".botsson", "site-map.json");
const OUT_MD = join(REPO_ROOT, "docs", "polish", "POLISH-INDEX.md");
const OUT_JSON = join(WEB_ROOT, ".botsson", "polish-index.json");

const nowIso = new Date().toISOString();
const today = nowIso.slice(0, 10);

/* ── Types ─────────────────────────────────────────────────────────────── */

type Metrics = { lcp_ms: number | null; cls: number | null; tti_ms: number | null };
type RouteRow = {
  route: string;
  tier: number | null;
  module: string | null;
  status: string | null;
  verified: boolean;
  verified_at: string | null;
  url: string | null;
  warm: Metrics;
  zinc_hits: number | null;
  motion_hits: number | null;
  tool_count: number;
  tool_names: string[];
  source: "run.yml" | "site-map" | "both";
};
type ElementRow = {
  name: string;
  path: string;
  motion_debt: number;
  palette_debt: number;
  status: "clean" | "debt";
};

/* ── Helpers ───────────────────────────────────────────────────────────── */

// Worksheets are hand-authored and frequently carry YAML-invalid inline
// annotations (trailing prose after quoted values, bare `|` unions, inline
// flow-maps). Strict parse throws → the whole worksheet's data is lost, which
// undercounts verified routes (13 verified worksheets were dropped this way:
// 66% reported vs ~100% real). parseDocument recovers a partial JS object even
// when deep subtrees error — top-level fields (route, verified, verified_at)
// + locate + speed_test still extract, which is all the index needs. Malformed
// subtrees come back null and the null-tolerant readers downstream handle that.
function readYaml(file: string): Record<string, unknown> | null {
  try {
    const doc = parseDocument(readFileSync(file, "utf8"));
    return (doc.toJS({ maxAliasCount: -1 }) ?? null) as Record<string, unknown> | null;
  } catch {
    return null;
  }
}

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/** Recursively collect .tsx/.ts/.css files under a path (or [path] if a file). */
function collectFiles(p: string): string[] {
  if (!existsSync(p)) return [];
  const s = statSync(p);
  if (s.isFile()) return [p];
  const out: string[] = [];
  for (const e of readdirSync(p)) {
    if (e.startsWith(".") || e === "node_modules") continue;
    const full = join(p, e);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...collectFiles(full));
    else if (/\.(tsx|ts|css)$/.test(full)) out.push(full);
  }
  return out;
}

/** Count regex hits across files, excluding lines that already use motionTokens.* */
function countDebt(paths: string[], re: RegExp, excludeTokenLines: boolean): number {
  let total = 0;
  for (const root of paths) {
    for (const file of collectFiles(root)) {
      const lines = readFileSync(file, "utf8").split("\n");
      for (const line of lines) {
        if (excludeTokenLines && line.includes("motionTokens.")) continue;
        if (re.test(line)) total++;
        re.lastIndex = 0;
      }
    }
  }
  return total;
}

function median(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const sorted = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

const fmtMs = (v: number | null) => (v == null ? "—" : `${Math.round(v)}`);
const fmtCls = (v: number | null) => (v == null ? "—" : v.toFixed(3));

/* ── 1. site-map.json → route metadata map ─────────────────────────────── */

type SiteRoute = {
  path: string;
  tier: number;
  module: string;
  access: string[];
  tools: { name: string; description: string }[];
};
const siteByPath = new Map<string, SiteRoute>();
try {
  const sm = JSON.parse(readFileSync(SITE_MAP_PATH, "utf8")) as { routes: SiteRoute[] };
  for (const r of sm.routes ?? []) siteByPath.set(r.path, r);
} catch (err) {
  console.warn(`⚠ could not read site-map.json: ${(err as Error).message}`);
}

/* ── 2. run.yml files → route rows ─────────────────────────────────────── */

const routeRows: RouteRow[] = [];
const seenRoutes = new Set<string>();

for (const f of readdirSync(POLISH_DIR)) {
  if (!f.endsWith(".run.yml") || f.startsWith("_template")) continue;
  const data = readYaml(join(POLISH_DIR, f));
  if (!data) continue;
  const route = (data.route as string) ?? `/${f.replace(/\.run\.yml$/, "")}`;
  const locate = (data.locate as Record<string, unknown>) ?? {};
  const retest = (data.retest as Record<string, unknown>) ?? {};
  const speed = (data.speed_test as Record<string, unknown>) ?? {};
  const design = (data.design as Record<string, unknown>) ?? {};
  // Prefer retest.warm (post-fix) over speed_test.warm (baseline).
  const warmSrc =
    (retest.warm as Record<string, unknown>) ?? (speed.warm as Record<string, unknown>) ?? {};
  const harness = Array.isArray(data.harness_tools) ? (data.harness_tools as unknown[]) : [];
  const harnessCurrent = (data.harness_tools_current as Record<string, unknown>) ?? {};
  const toolNames = harness
    .map((t) => (t as Record<string, unknown>)?.key ?? (t as Record<string, unknown>)?.name)
    .filter((x): x is string => typeof x === "string");
  const site = siteByPath.get(route);

  seenRoutes.add(route);
  routeRows.push({
    route,
    tier: site?.tier ?? null,
    module: site?.module ?? null,
    status: (data.status as string) ?? null,
    verified: data.verified === true,
    verified_at: (data.verified_at as string) ?? null,
    url: (locate.url as string) ?? null,
    warm: {
      lcp_ms: num(warmSrc.lcp_ms),
      cls: num(warmSrc.cls),
      tti_ms: num(warmSrc.tti_ms),
    },
    zinc_hits: num(design.zinc_hits),
    motion_hits: num(design.motion_token_hits),
    tool_count: toolNames.length || (num(harnessCurrent.count) ?? 0),
    tool_names: toolNames.length ? toolNames : (site?.tools ?? []).map((t) => t.name),
    source: site ? "both" : "run.yml",
  });
}

// site-map routes with no run.yml — list them so coverage gaps are visible.
for (const [path, site] of siteByPath) {
  if (seenRoutes.has(path)) continue;
  routeRows.push({
    route: path,
    tier: site.tier,
    module: site.module,
    status: null,
    verified: false,
    verified_at: null,
    url: null,
    warm: { lcp_ms: null, cls: null, tti_ms: null },
    zinc_hits: null,
    motion_hits: null,
    tool_count: site.tools.length,
    tool_names: site.tools.map((t) => t.name),
    source: "site-map",
  });
}

routeRows.sort((a, b) => (a.tier ?? 9) - (b.tier ?? 9) || a.route.localeCompare(b.route));

/* ── 3. Tier 0 shared primitives → live element debt ───────────────────── */

const SPRING_RE = /stiffness:|damping:/;
const PALETTE_RE = /\b(?:zinc|gray|slate)-/;

const ELEMENT_DEFS: { name: string; rel: string; motion: boolean; palette: boolean }[] = [
  {
    name: "DashboardShell",
    rel: "apps/web/src/components/dashboard/DashboardShell.tsx",
    motion: true,
    palette: true,
  },
  {
    name: "entity-drawer",
    rel: "apps/web/src/components/dashboard/entity-drawer",
    motion: true,
    palette: true,
  },
  {
    name: "PaymentStatusBadge",
    rel: "apps/web/src/components/ui/PaymentStatusBadge.tsx",
    motion: true,
    palette: true,
  },
  {
    name: "DispatchStatusBadge",
    rel: "apps/web/src/components/ui/DispatchStatusBadge.tsx",
    motion: true,
    palette: true,
  },
  {
    name: "NotificationBell",
    rel: "apps/web/src/components/dashboard/NotificationBell.tsx",
    motion: true,
    palette: true,
  },
  {
    name: "GlobalCallAlert",
    rel: "apps/web/src/components/dashboard/GlobalCallAlert.tsx",
    motion: true,
    palette: true,
  },
  {
    name: "AnimatedWizardShell",
    rel: "apps/web/src/components/wizard/AnimatedWizardShell.tsx",
    motion: true,
    palette: true,
  },
  {
    name: "Sonner toast theme (globals.css)",
    rel: "apps/web/src/app/globals.css",
    motion: false,
    palette: true,
  },
];

const elementRows: ElementRow[] = ELEMENT_DEFS.map((def) => {
  const abs = join(REPO_ROOT, def.rel);
  const motionDebt = def.motion ? countDebt([abs], SPRING_RE, true) : 0;
  const paletteDebt = def.palette ? countDebt([abs], PALETTE_RE, false) : 0;
  return {
    name: def.name,
    path: def.rel,
    motion_debt: motionDebt,
    palette_debt: paletteDebt,
    status: motionDebt === 0 && paletteDebt === 0 ? "clean" : "debt",
  };
});

/* ── 4. Rollup ─────────────────────────────────────────────────────────── */

const verifiedCount = routeRows.filter((r) => r.verified).length;
const coveragePct = routeRows.length ? Math.round((verifiedCount / routeRows.length) * 100) : 0;
const medLcp = median(routeRows.map((r) => r.warm.lcp_ms).filter((x): x is number => x != null));
const medCls = median(routeRows.map((r) => r.warm.cls).filter((x): x is number => x != null));
const totalTools = routeRows.reduce((sum, r) => sum + r.tool_count, 0);
const elementsClean = elementRows.filter((e) => e.status === "clean").length;

const rollup = {
  routes_tracked: routeRows.length,
  routes_verified: verifiedCount,
  coverage_pct: coveragePct,
  median_warm_lcp_ms: medLcp,
  median_warm_cls: medCls,
  total_harness_tools: totalTools,
  tier0_elements_clean: elementsClean,
  tier0_elements_total: elementRows.length,
};

/* ── 5. Emit JSON ──────────────────────────────────────────────────────── */

writeFileSync(
  OUT_JSON,
  JSON.stringify(
    { version: 1, generated_at: nowIso, rollup, routes: routeRows, elements: elementRows },
    null,
    2,
  ) + "\n",
);

/* ── 6. Emit Markdown ──────────────────────────────────────────────────── */

const tick = (b: boolean) => (b ? "✓" : "·");

const routeTable = [
  "| Route | Tier | Status | ✓ | LCP ms | CLS | TTI ms | Tools | Source |",
  "|---|---|---|---|---|---|---|---|---|",
  ...routeRows.map(
    (r) =>
      `| \`${r.route}\` | ${r.tier ?? "—"} | ${r.status ?? "—"} | ${tick(r.verified)} | ${fmtMs(
        r.warm.lcp_ms,
      )} | ${fmtCls(r.warm.cls)} | ${fmtMs(r.warm.tti_ms)} | ${r.tool_count} | ${r.source} |`,
  ),
].join("\n");

const elementTable = [
  "| Element | Path | Motion debt | Palette debt | Status |",
  "|---|---|---|---|---|",
  ...elementRows.map(
    (e) =>
      `| ${e.name} | \`${e.path}\` | ${e.motion_debt} | ${e.palette_debt} | ${
        e.status === "clean" ? "✓ clean" : "· debt"
      } |`,
  ),
].join("\n");

const md = `---
title: Polish Index — coverage, performance, harness tools
status: live
updated: ${today}
module: meta
tags: [polish, coverage, performance, harness]
---

# Polish Index

> **Generated** by \`pnpm --filter web polish:index\` — DO NOT hand-edit.
> Truth sources: \`.claude/page-polish/*.run.yml\`, \`apps/web/.botsson/site-map.json\`,
> live source grep of Tier 0 primitives. Regenerate after touching any of them.
> Last generated: ${nowIso}

## Coverage Rollup

| Metric | Value |
|---|---|
| Routes tracked | ${rollup.routes_tracked} |
| Routes verified | ${rollup.routes_verified} (${rollup.coverage_pct}%) |
| Median warm LCP | ${fmtMs(rollup.median_warm_lcp_ms)} ms |
| Median warm CLS | ${fmtCls(rollup.median_warm_cls)} |
| Total harness tools | ${rollup.total_harness_tools} |
| Tier 0 elements clean | ${rollup.tier0_elements_clean}/${rollup.tier0_elements_total} |

## Routes

Tracked from \`*.run.yml\` (polish worksheets) + \`site-map.json\` (route catalog).
\`Source\` column: \`both\` = run.yml + site-map, \`run.yml\` = worksheet only (no site-map entry),
\`site-map\` = catalogued but never polished (coverage gap).

${routeTable}

## Tier 0 Elements (shared primitives)

Shared primitives have no route, so polish status is computed live from inline
spring physics (\`stiffness:\`/\`damping:\` outside \`motionTokens.*\`) and hardcoded
palette tokens (\`zinc-\`/\`gray-\`/\`slate-\`). \`clean\` = both 0.

${elementTable}
`;

if (!existsSync(join(REPO_ROOT, "docs", "polish"))) {
  mkdirSync(join(REPO_ROOT, "docs", "polish"), { recursive: true });
}
writeFileSync(OUT_MD, md);

/* ── 7. stdout summary ─────────────────────────────────────────────────── */

console.log(
  `✓ polish-index written — ${rollup.routes_tracked} routes (${rollup.coverage_pct}% verified), ` +
    `${rollup.tier0_elements_clean}/${rollup.tier0_elements_total} Tier 0 elements clean, ` +
    `${rollup.total_harness_tools} harness tools.`,
);
console.log(`  ${relative(REPO_ROOT, OUT_MD)}`);
console.log(`  ${relative(REPO_ROOT, OUT_JSON)}`);
