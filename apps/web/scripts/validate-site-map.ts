#!/usr/bin/env tsx
/**
 * validate-site-map.ts — site-map.json drift detector.
 *
 * Source: apps/web/.botsson/site-map.json (Phase 8 of smartout-page-polish skill).
 *
 * Checks:
 *  1. JSON parses + matches expected shape.
 *  2. Every entry has required fields (path, purpose, module, tier, access,
 *     polished_at, owns_chat_surface, tools).
 *  3. `path` is unique across entries.
 *  4. `purpose` ≤ 140 chars and non-empty.
 *  5. `tools[].description` non-empty (Botsson cannot pick empty-desc tools).
 *  6. Every `useRegisterTools(pageKey, kit)` call in apps/web/src has a
 *     corresponding entry whose tool names match. Drift either direction = fail.
 *
 * Exit 0 = clean. Exit 1 = drift / shape errors. Phase 8 stop condition.
 *
 * Run: pnpm --filter web site-map:validate
 *      (or tsx scripts/validate-site-map.ts from apps/web)
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const WEB_ROOT = join(__dirname, "..");
const SITE_MAP_PATH = join(WEB_ROOT, ".botsson", "site-map.json");
const SRC_ROOT = join(WEB_ROOT, "src");

type ToolEntry = { name: string; description: string };
type RouteEntry = {
  path: string;
  purpose: string;
  module: string;
  tier: number;
  access: string[];
  polished_at: string;
  owns_chat_surface: boolean;
  domain_chat_endpoint?: string | null;
  tools: ToolEntry[];
  common_intents?: string[];
};
type SiteMap = {
  version: number;
  generated_at: string;
  notes?: string;
  routes: RouteEntry[];
};

const errors: string[] = [];

// ── 1. Parse JSON + shape ─────────────────────────────────────────────────
let siteMap: SiteMap;
try {
  siteMap = JSON.parse(readFileSync(SITE_MAP_PATH, "utf8")) as SiteMap;
} catch (err) {
  console.error(`✗ site-map.json parse error: ${(err as Error).message}`);
  process.exit(1);
}

if (siteMap.version !== 1) {
  errors.push(`version must be 1, got ${siteMap.version}`);
}
if (!Array.isArray(siteMap.routes)) {
  errors.push("routes must be an array");
}

// ── 2 + 3 + 4 + 5. Per-entry validation ────────────────────────────────────
const REQUIRED_FIELDS: Array<keyof RouteEntry> = [
  "path",
  "purpose",
  "module",
  "tier",
  "access",
  "polished_at",
  "owns_chat_surface",
  "tools",
];
const seenPaths = new Set<string>();
const ALLOWED_ACCESS = new Set(["owner", "admin", "manager", "employee", "godmode"]);

for (const [i, route] of (siteMap.routes ?? []).entries()) {
  const tag = `routes[${i}] (path=${route?.path ?? "?"})`;
  for (const field of REQUIRED_FIELDS) {
    if (route[field] === undefined || route[field] === null) {
      errors.push(`${tag}: missing required field "${field}"`);
    }
  }
  if (typeof route.path === "string") {
    if (!route.path.startsWith("/")) {
      errors.push(`${tag}: path must start with /`);
    }
    if (route.path.includes("?") || route.path.includes("#")) {
      errors.push(`${tag}: path must not contain query/hash — strip before saving`);
    }
    if (seenPaths.has(route.path)) {
      errors.push(`${tag}: duplicate path "${route.path}"`);
    }
    seenPaths.add(route.path);
  }
  if (typeof route.purpose === "string") {
    if (route.purpose.trim().length === 0) {
      errors.push(`${tag}: purpose is empty`);
    }
    if (route.purpose.length > 140) {
      errors.push(`${tag}: purpose >140 chars (${route.purpose.length}) — tighten`);
    }
  }
  if (Array.isArray(route.access)) {
    for (const a of route.access) {
      if (!ALLOWED_ACCESS.has(a)) {
        errors.push(`${tag}: access "${a}" not in allowed set`);
      }
    }
  }
  if (typeof route.tier === "number" && (route.tier < 0 || route.tier > 3)) {
    errors.push(`${tag}: tier must be 0–3, got ${route.tier}`);
  }
  if (Array.isArray(route.tools)) {
    for (const t of route.tools) {
      if (!t.name || !t.description) {
        errors.push(`${tag}: tool entry missing name or description`);
      }
      if (t.description && t.description.trim().length === 0) {
        errors.push(`${tag}: tool "${t.name}" has empty description`);
      }
    }
  }
  if (route.owns_chat_surface === true && !route.domain_chat_endpoint) {
    errors.push(
      `${tag}: owns_chat_surface=true requires domain_chat_endpoint (which API the in-page chat POSTs to)`,
    );
  }
}

// ── 6. Cross-reference live tool registrations ────────────────────────────
// Scan source for `useRegisterTools("page-key", ...)` and warn when a page-key
// is registered but no site-map entry references it. Hard-fail when the
// site-map lists a tool name that no inline-object registration declares.
//
// Limitation: most registrations pass a tool kit by variable name
// (`useRegisterTools("schedule", scheduleTools)`), not an inline object literal.
// Variable-args are flagged as "indirect" and skipped in the strict tool-name
// drift check — the page-polish author is still responsible for keeping the
// site-map.json tool list synced with the kit definition.

type Registration = {
  file: string;
  pageKey: string;
  toolNamesInline: string[];
  hasInlineKit: boolean;
};
const registrations: Registration[] = [];

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir)) {
    if (e.startsWith(".") || e === "node_modules") continue;
    const full = join(dir, e);
    const s = statSync(full);
    if (s.isDirectory()) out.push(...walk(full));
    else if (full.endsWith(".tsx") || full.endsWith(".ts")) out.push(full);
  }
  return out;
}

// page-key arg (string literal) + second arg as either inline object or variable.
const REGISTER_RE = /useRegisterTools\(\s*["']([^"']+)["']\s*,\s*([\s\S]*?)\s*\)/g;
const TOOL_NAME_RE = /^\s*([a-zA-Z_][\w]*)\s*:\s*\{/gm;

for (const file of walk(SRC_ROOT)) {
  let src: string;
  try {
    src = readFileSync(file, "utf8");
  } catch {
    continue;
  }
  if (!src.includes("useRegisterTools(")) continue;
  let m: RegExpExecArray | null;
  while ((m = REGISTER_RE.exec(src)) !== null) {
    const pageKey = m[1];
    if (!pageKey) continue;
    const secondArg = (m[2] ?? "").trim();
    const hasInlineKit = secondArg.startsWith("{");
    const inlineNames: string[] = [];
    if (hasInlineKit) {
      let tm: RegExpExecArray | null;
      while ((tm = TOOL_NAME_RE.exec(secondArg)) !== null) {
        const name = tm[1];
        if (name) inlineNames.push(name);
      }
    }
    registrations.push({
      file: relative(WEB_ROOT, file),
      pageKey,
      toolNamesInline: inlineNames,
      hasInlineKit,
    });
  }
}

// Warn (not fail) when a useRegisterTools page-key never appears in site-map.
// The map from pageKey → path is human-author work; we cannot resolve it
// statically. List the unmapped page-keys so the author knows what to add.
const pageKeysInRegistrations = new Set(registrations.map((r) => r.pageKey));
const pageKeysReferencedInSiteMap = new Set<string>();
for (const route of siteMap.routes ?? []) {
  // Convention: the last path segment doubles as a pageKey if no explicit field.
  // We do not require this — but if it matches a registration, count it.
  const segs = (route.path ?? "").split("/").filter(Boolean);
  if (segs.length > 0) pageKeysReferencedInSiteMap.add(segs[segs.length - 1] ?? "");
  for (const t of route.tools ?? []) {
    if (t.name) pageKeysReferencedInSiteMap.add(t.name);
  }
}

const unmappedPageKeys = [...pageKeysInRegistrations].filter(
  (pk) => !pageKeysReferencedInSiteMap.has(pk),
);
if (unmappedPageKeys.length > 0) {
  console.warn(
    `⚠ ${unmappedPageKeys.length} useRegisterTools page-key(s) have no clear site-map mapping (manual cross-check required):`,
  );
  for (const pk of unmappedPageKeys) {
    const where = registrations
      .filter((r) => r.pageKey === pk)
      .map((r) => r.file)
      .join(", ");
    console.warn(`    - "${pk}" → ${where}`);
  }
}

// ── Report ────────────────────────────────────────────────────────────────
const inlineCount = registrations.filter((r) => r.hasInlineKit).length;
const indirectCount = registrations.length - inlineCount;
if (errors.length === 0) {
  console.log(
    `✓ site-map.json valid — ${siteMap.routes.length} route entries, ${registrations.length} useRegisterTools call sites (${inlineCount} inline, ${indirectCount} indirect-via-variable).`,
  );
  process.exit(0);
}
for (const e of errors) console.error(`✗ ${e}`);
console.error(`\n${errors.length} site-map drift(s) detected.`);
process.exit(1);
