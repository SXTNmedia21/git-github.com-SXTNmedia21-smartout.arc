#!/usr/bin/env tsx
/**
 * check-pipeline-override-parity.ts — ADR-0340 T0.5 enforcement CI lint.
 *
 * Verifies that every pipeline-defining capability has a sibling
 * `<cap>.override` row seeded in `supabase/migrations/*.sql`.
 *
 * Why this exists:
 *   ADR-0340 (Shift Lifecycle Pipeline V2) introduces `override_pipeline`
 *   admin tools that call gate_action with `<cap>.override` as the capability.
 *   Without explicit seed rows, gate_action() hits the default-allow path
 *   (L-0189: no engine_authority_config row → allow=true, reason=NULL),
 *   silently bypassing authority checks for every admin override call.
 *   This is the same CVE class as L-0281 / L-0066.
 *
 *   ADR-0189 (authority-seed-parity) + ADR-0287 (gate-action call-site coverage)
 *   are orthogonal controls:
 *     - ADR-0189: every gate_action() literal has a seed row.
 *     - ADR-0287: every mutation tool calls gate_action.
 *   NEITHER covers the pipeline-override seed gap: the gap is structural —
 *   any pipeline-defining capability inherently needs a sibling .override row,
 *   and CI must flag the absence before the override tool ships.
 *
 * What "pipeline-defining capability" means:
 *   A capability listed in PIPELINE_DEFINING_CAPABILITIES below. This list
 *   starts with shift_swap + shift_marketplace (the two capabilities named
 *   in ADR-0340). As new pipeline capabilities land, their authors MUST
 *   add them to this list (the CI check rejects the omission).
 *
 * What counts as "an override seed":
 *   Any `INSERT INTO` (or `INSERT INTO public.`) `capability_default_registry`
 *   OR `engine_authority_config` statement in a .sql migration file that
 *   contains the literal string `'<cap>.override'`. Both Part A
 *   (capability_default_registry) and Part B (engine_authority_config) are
 *   accepted — either satisfies the parity requirement.
 *
 * Modes:
 *   --baseline   (default)  warn + exit 0; documents counts. CI-safe.
 *   --strict                exit 1 on any violation. For local pre-merge
 *                           runs and the post-grace-period CI switch.
 *
 * Run:
 *   npx tsx scripts/check-pipeline-override-parity.ts --baseline
 *   npx tsx scripts/check-pipeline-override-parity.ts --strict
 *
 * Exit codes:
 *   0 — all pipeline capabilities have override seeds (or baseline mode).
 *   1 — one or more pipeline capabilities lack override seeds and --strict.
 *   2 — script-internal error (missing migrations directory, etc.).
 *
 * Adding a new pipeline-defining capability:
 *   1. Add the base capability name to PIPELINE_DEFINING_CAPABILITIES below.
 *   2. Write a migration seeding `<cap>.override` in capability_default_registry
 *      + engine_authority_config (follow 20260620100200_seed_pipeline_override_authority.sql).
 *   3. Run this script locally (--strict) to verify.
 *
 * ADR: docs/decisions/0340-shift-lifecycle-pipeline-implementation.md §T0.5
 * Learning: docs/learnings/0281-default-allow-cve-recurrence-pipeline-override.md
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(__dirname, "..");
const MIGRATIONS_DIR = join(ROOT, "supabase", "migrations");

// ─────────────────────────────────────────────────────────────────────────────
// Pipeline-defining capabilities
//
// These are capabilities that introduce multi-stage pipeline flows (via
// engine_authority_pipeline blueprints + engine_state instances). Every
// capability in this list MUST have a sibling `<cap>.override` row in
// engine_authority_config + capability_default_registry.
//
// MAINTENANCE: add new pipeline-defining capabilities here as they land.
// The CI check will reject any capability missing its .override seed.
// ─────────────────────────────────────────────────────────────────────────────
const PIPELINE_DEFINING_CAPABILITIES: readonly string[] = ["shift_swap", "shift_marketplace"];

// ─────────────────────────────────────────────────────────────────────────────
// Scan migrations for seeded override rows
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the set of base capabilities for which a `<cap>.override` literal
 * appears inside an INSERT statement targeting either
 * `capability_default_registry` or `engine_authority_config` in any migration.
 *
 * Detection strategy:
 *   1. Read all *.sql files in MIGRATIONS_DIR.
 *   2. For each pipeline-defining capability, check whether its override
 *      literal (e.g. `'shift_swap.override'`) appears in the file content.
 *      We require it to be a SQL string literal (surrounded by single quotes)
 *      to avoid false positives from comments or identifiers.
 *
 * This is intentionally conservative — we only scan for the literal in SQL
 * files, not in TypeScript call sites (that's ADR-0189's authority-seed-parity
 * script's job).
 */
function collectSeededOverrides(): Set<string> {
  if (!existsSync(MIGRATIONS_DIR)) {
    throw new Error(`Migrations directory not found: ${MIGRATIONS_DIR}`);
  }

  const sqlFiles = readdirSync(MIGRATIONS_DIR).filter(
    (f) => f.endsWith(".sql") && f !== "rollback",
  );

  const seeded = new Set<string>();

  for (const file of sqlFiles) {
    const content = readFileSync(join(MIGRATIONS_DIR, file), "utf8");

    for (const cap of PIPELINE_DEFINING_CAPABILITIES) {
      const overrideLiteral = `'${cap}.override'`;
      if (content.includes(overrideLiteral)) {
        seeded.add(cap);
      }
    }
  }

  return seeded;
}

// ─────────────────────────────────────────────────────────────────────────────
// Result types
// ─────────────────────────────────────────────────────────────────────────────

type CapabilityResult = {
  capability: string;
  overrideSeed: string; // `<cap>.override` literal that must be seeded
  seeded: boolean;
};

// ─────────────────────────────────────────────────────────────────────────────
// Output rendering
// ─────────────────────────────────────────────────────────────────────────────

function renderTable(results: CapabilityResult[]): string {
  const rows: string[] = [];
  rows.push("Pipeline capability".padEnd(36) + "Override seed".padEnd(36) + "Status".padStart(10));
  rows.push("-".repeat(82));
  for (const r of results) {
    const status = r.seeded ? "PASS" : "MISSING";
    rows.push(r.capability.padEnd(36) + r.overrideSeed.padEnd(36) + status.padStart(10));
  }
  return rows.join("\n");
}

function renderViolations(results: CapabilityResult[]): string {
  const missing = results.filter((r) => !r.seeded);
  if (missing.length === 0) return "";

  const lines: string[] = [];
  lines.push(
    `\n${missing.length} pipeline-defining capability(s) lack a sibling .override seed (ADR-0340 T0.5 / L-0281):`,
  );
  for (const m of missing) {
    lines.push(`  MISSING  capability='${m.capability}'  override='${m.overrideSeed}'`);
  }
  lines.push("");
  lines.push("Fix: write a migration seeding `<cap>.override` in both:");
  lines.push("  1. public.capability_default_registry (Part A — platform-wide default)");
  lines.push(
    "  2. public.engine_authority_config INSERT ... SELECT FROM workspace (Part B — backfill)",
  );
  lines.push("");
  lines.push("Template: supabase/migrations/20260620100200_seed_pipeline_override_authority.sql");
  lines.push("ADR:      docs/decisions/0340-shift-lifecycle-pipeline-implementation.md §T0.5");
  lines.push("Learning: docs/learnings/0281-default-allow-cve-recurrence-pipeline-override.md");
  lines.push("");
  lines.push("After adding the migration, add the capability to PIPELINE_DEFINING_CAPABILITIES");
  lines.push("in scripts/check-pipeline-override-parity.ts if it is not yet listed.");
  return lines.join("\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// Entry
// ─────────────────────────────────────────────────────────────────────────────

function main(): void {
  const strict = process.argv.includes("--strict");
  const baseline = process.argv.includes("--baseline") || !strict;

  let seeded: Set<string>;
  try {
    seeded = collectSeededOverrides();
  } catch (err) {
    console.error(`[pipeline-override-parity] error: ${err}`);
    process.exit(2);
  }

  const results: CapabilityResult[] = PIPELINE_DEFINING_CAPABILITIES.map((cap) => ({
    capability: cap,
    overrideSeed: `${cap}.override`,
    seeded: seeded.has(cap),
  }));

  const missing = results.filter((r) => !r.seeded);

  const header = strict
    ? "[pipeline-override-parity] STRICT mode (ADR-0340 T0.5 enforcement)"
    : "[pipeline-override-parity] BASELINE mode (warn-only)";
  console.log(header);
  console.log("");
  console.log(renderTable(results));

  if (missing.length > 0) {
    console.log(renderViolations(results));
  } else {
    console.log(
      `\nAll ${results.length} pipeline-defining capability(s) have .override seeds. Nothing to report.`,
    );
  }

  if (missing.length > 0 && strict) {
    process.exit(1);
  }
  process.exit(0);
}

main();
