#!/usr/bin/env tsx
/**
 * auto_align.ts — Phase 3.5b Auto-Alignment CLI
 *
 * Reads all 20 mappings from mappings/*.json, reads v3_schema.json,
 * aligns each entity, writes shadow output to mappings/.aligned/<entity>.json
 * and per-entity markdown reports to scripts/auto_align_report/<entity>.md.
 *
 * Usage:
 *   pnpm tsx scripts/auto_align.ts                # Normal run — writes to .aligned/
 *   pnpm tsx scripts/auto_align.ts --force         # Skip preflight invariants
 *   pnpm tsx scripts/auto_align.ts --commit        # Promote .aligned/*.json → mappings/*.json
 *   pnpm tsx scripts/auto_align.ts --entity=shifts # Single entity (for debugging)
 *
 * Council spec: docs/superpowers/decisions/0001-phase-3.5b-auto-align.md
 */

import { readFile, writeFile, mkdir, readdir, rename, access, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { execSync } from "node:child_process";
import {
  alignEntity,
  generateEntityReport,
  generateSummaryReport,
  computeApprovalHash,
  assertNoSidecarAccess,
  type V3Schema,
  type AlignmentResult,
} from "./lib/align.js";
import type { Mapping } from "../src/research/mapping.js";
import {
  appendDecision,
  type DecisionEntry,
} from "../src/history/decision_log.js";

/**
 * Wrapper around appendDecision that never aborts the alignment run.
 * Audit-trail write failures land on stderr; the run continues.
 */
async function logDecision(
  historyDir: string,
  entry: DecisionEntry,
): Promise<void> {
  try {
    await appendDecision(historyDir, entry);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    process.stderr.write(`[decision-log] FAILED to write: ${msg}\n`);
  }
}

// ─── Path constants ───────────────────────────────────────────────────────────

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
const MAPPINGS_DIR = join(REPO_ROOT, "mappings");
const ALIGNED_DIR = join(MAPPINGS_DIR, ".aligned");
const SCHEMA_PATH = join(REPO_ROOT, "v3_schema.json");
const REPORT_DIR = join(__dirname, "auto_align_report");

// ─── CLI argument parsing ─────────────────────────────────────────────────────

const args = process.argv.slice(2);
const FLAG_FORCE = args.includes("--force");
const FLAG_COMMIT = args.includes("--commit");
const entityArg = args.find((a) => a.startsWith("--entity="));
const SINGLE_ENTITY = entityArg ? entityArg.replace("--entity=", "") : null;
const workspaceArg = args.find((a) => a.startsWith("--workspace="));
const WORKSPACE_SLUG =
  (workspaceArg ? workspaceArg.replace("--workspace=", "") : "") ||
  process.env.STRIKE_WORKSPACE_SLUG ||
  "";
const attestedByArg = args.find((a) => a.startsWith("--attested-by="));
const ATTESTED_BY = attestedByArg ? attestedByArg.replace("--attested-by=", "") : "";
const HISTORY_DIR =
  process.env.STRIKE_HISTORY_DIR ??
  join(import.meta.dirname, "..", "history");

// Fields where auto-confirm is unsafe even with perfect type compatibility.
// These drive legal, permission, or contract behavior — wrong mapping degrades
// agent answers silently. Force interactive review on these regardless of
// auto_align confidence score. Per 2026-04-15 council verdict P0-#8.
const FORCE_INTERACTIVE_FIELDS = new Set([
  "role",
  "employment_type",
  "team_id",
  "department_id",
  "position_id",
  "employment_contract_id",
  "employment_profile_id",
  "framework_id",
  "tariff_id",
  "status",
  "profile_status",
]);

function isForceInteractive(targetColumn: string | null): boolean {
  if (!targetColumn) return false;
  if (FORCE_INTERACTIVE_FIELDS.has(targetColumn)) return true;
  if (targetColumn.startsWith("framework_") || targetColumn.startsWith("tariff_")) return true;
  return false;
}

// ─── Logging helpers ──────────────────────────────────────────────────────────

function log(msg: string): void {
  process.stdout.write(msg + "\n");
}

function err(msg: string): void {
  process.stderr.write("[ERROR] " + msg + "\n");
}

function abort(msg: string): never {
  err(msg);
  process.exit(1);
}

// ─── Preflight invariants ─────────────────────────────────────────────────────

async function runPreflightChecks(): Promise<void> {
  if (FLAG_FORCE) {
    log("⚠️  --force: skipping preflight invariants");
    return;
  }

  // 1. Git dirty check
  try {
    const gitStatus = execSync("git status --porcelain mappings/", {
      cwd: REPO_ROOT,
      encoding: "utf-8",
    }).trim();
    if (gitStatus.length > 0) {
      abort(
        `Preflight failed: mappings/ has uncommitted changes.\n` +
        `Commit or stash them before running auto_align.\n` +
        `Dirty files:\n${gitStatus}\n` +
        `Use --force to skip this check.`,
      );
    }
  } catch (e) {
    // Not a git repo or git not available — warn but continue
    log("⚠️  Warning: could not run git status — not a git repo or git unavailable");
  }

  // 2. Check for prior auto_aligned_at marker
  const mappingFiles = await readdir(MAPPINGS_DIR);
  for (const file of mappingFiles.filter((f) => f.endsWith(".json") && !f.startsWith("."))) {
    const path = join(MAPPINGS_DIR, file);
    assertNoSidecarAccess(path);
    const content = await readFile(path, "utf-8");
    const parsed = JSON.parse(content) as Record<string, unknown>;
    if ("auto_aligned_at" in parsed) {
      abort(
        `Preflight failed: ${file} already has auto_aligned_at field.\n` +
        `This means a prior run was committed. Clean up or use --force.`,
      );
    }
  }

  // 3. Check .aligned/ doesn't exist already
  if (existsSync(ALIGNED_DIR)) {
    abort(
      `Preflight failed: mappings/.aligned/ already exists.\n` +
      `Remove it before running: rm -rf mappings/.aligned/\n` +
      `Use --force to skip this check.`,
    );
  }

  // 4. Schema file exists and is readable
  try {
    await access(SCHEMA_PATH);
  } catch {
    abort(`Preflight failed: v3_schema.json is missing or unreadable at ${SCHEMA_PATH}`);
  }

  log("✅ Preflight checks passed");
}

// ─── Load helpers ─────────────────────────────────────────────────────────────

async function loadSchema(): Promise<{ schema: V3Schema; hash: string }> {
  const content = await readFile(SCHEMA_PATH, "utf-8");
  const schema = JSON.parse(content) as V3Schema;
  const hash = createHash("sha256").update(content, "utf-8").digest("hex");
  return { schema, hash };
}

async function loadMappings(onlyEntity?: string): Promise<Mapping[]> {
  const files = await readdir(MAPPINGS_DIR);
  const mappingFiles = files
    .filter((f) => f.endsWith(".json") && !f.startsWith("."))
    .filter((f) => !onlyEntity || f === `${onlyEntity}.json`);

  const mappings: Mapping[] = [];
  for (const file of mappingFiles) {
    const path = join(MAPPINGS_DIR, file);
    assertNoSidecarAccess(path);
    const content = await readFile(path, "utf-8");
    mappings.push(JSON.parse(content) as Mapping);
  }
  return mappings;
}

// ─── Shadow write ─────────────────────────────────────────────────────────────

async function writeAlignedMapping(
  originalMapping: Mapping,
  result: AlignmentResult,
): Promise<void> {
  const aligned: Record<string, unknown> = {
    ...originalMapping,
    target_table: result.targetTable,
    known_empty_source: result.knownEmptySource || undefined,
    v3_schema_hash: null, // will be set by caller
    approval_hash: result.approvalHash,
    // Update field_map with alignment results
    field_map: buildAlignedFieldMap(originalMapping, result),
  };

  // Remove undefined keys
  for (const k of Object.keys(aligned)) {
    if (aligned[k] === undefined) delete aligned[k];
  }

  const path = join(ALIGNED_DIR, `${result.entity}.json`);
  await writeFile(path, JSON.stringify(aligned, null, 2) + "\n", "utf-8");
}

function buildAlignedFieldMap(
  mapping: Mapping,
  result: AlignmentResult,
): Record<string, unknown> {
  const fm: Record<string, unknown> = {};
  for (const f of result.fields) {
    const original = mapping.field_map[f.bubbleField];
    if (!original) continue;
    // Force interactive review on legal/permission/contract-adjacent fields
    // even when auto_align would otherwise auto-confirm. Per council P0-#8.
    const forceReview = isForceInteractive(f.targetColumn);
    // Preserve prior human attestation when target+transform haven't changed
    // (mirrors fix in scripts/lib/align.ts:813 — see commit 11079c2 for the
    // root-cause analysis). forceReview still overrides because legal-adjacent
    // fields require fresh human eyes per P0-#8.
    // forceReview only applies to NEW mappings — once a human has attested
    // (needs_review=false on disk + same target+transform recommended), the
    // legal-adjacency review was already done. Re-running auto_align should
    // not re-flag every PK ⟶ ${entity}_id assignment for re-review.
    const humanApproved =
      original.needs_review === false &&
      original.target === f.targetColumn &&
      original.transform === f.transform;
    fm[f.bubbleField] = {
      ...original,
      target: f.targetColumn,
      transform: f.transform,
      needs_review: humanApproved ? false : (f.verdict !== "auto-confirm" || forceReview),
    };
  }
  return fm;
}

// ─── --commit: promote .aligned/ → mappings/ ─────────────────────────────────

async function runCommit(): Promise<void> {
  if (!existsSync(ALIGNED_DIR)) {
    abort(`--commit failed: mappings/.aligned/ does not exist. Run auto_align first.`);
  }

  const files = await readdir(ALIGNED_DIR);
  const jsonFiles = files.filter((f) => f.endsWith(".json"));

  if (jsonFiles.length === 0) {
    abort("--commit failed: no files in mappings/.aligned/");
  }

  let promoted = 0;
  for (const file of jsonFiles) {
    const src = join(ALIGNED_DIR, file);
    const dest = join(MAPPINGS_DIR, file);
    // Write to tmp then rename for atomicity
    const tmp = dest + ".tmp";
    const content = await readFile(src, "utf-8");
    await writeFile(tmp, content, "utf-8");
    await rename(tmp, dest);
    promoted++;

    // Audit trail: this mapping is now ready for migration.
    // by=<human email> because --commit requires human attestation per ADR-0003.
    const parsed = JSON.parse(content) as Mapping;
    const committedEntry: DecisionEntry = {
      scope: "schema",
      workspace: WORKSPACE_SLUG,
      entity: parsed.entity,
      action: "mapping_committed",
      by: ATTESTED_BY,
      metadata: {
        mode: "auto_align_commit",
        attested_by: ATTESTED_BY,
      },
    };
    if (parsed.approval_hash) {
      committedEntry.approval_hash = parsed.approval_hash;
    }
    await logDecision(HISTORY_DIR, committedEntry);
  }

  log(`✅ Promoted ${promoted} files to mappings/`);
  log(`   Commit with git: git add mappings/ && git commit -m "feat(align): apply auto-align phase 3.5b"`);

  // Clean up .aligned/
  await rm(ALIGNED_DIR, { recursive: true });
  log(`   Removed mappings/.aligned/`);
}

// ─── Main run ─────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  log("");
  log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  log("  Phase 3.5b Auto-Align");
  log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  // Audit trail anchor — required for every run, including --commit.
  if (!WORKSPACE_SLUG) {
    abort(
      "STRIKE_WORKSPACE_SLUG env or --workspace=<slug> is required.\n" +
        "  This anchors every alignment decision to a source workspace for later analysis.\n" +
        "  Example: STRIKE_WORKSPACE_SLUG=strom-mat-og-bar pnpm tsx scripts/auto_align.ts",
    );
  }

  if (FLAG_COMMIT) {
    // Human attestation gate — auto_align can pre-fill, but a human must sign
    // the commit. Prevents the "rubber-stamp 180 auto-confirms" failure mode
    // that the 2026-04-15 council flagged as P0.
    if (!ATTESTED_BY) {
      abort(
        "--attested-by=<email> is required for --commit.\n" +
          "  auto_align pre-fills mappings; a human must sign off before promotion.\n" +
          "  Example: pnpm tsx scripts/auto_align.ts --commit --attested-by=pontus@smartout.no",
      );
    }
    if (!ATTESTED_BY.includes("@")) {
      abort(`--attested-by must be an email address (got: ${ATTESTED_BY})`);
    }
    await runCommit();
    return;
  }

  // Preflight
  await runPreflightChecks();

  // Load schema
  log("\n📐 Loading v3_schema.json...");
  const { schema, hash: schemaHash } = await loadSchema();
  const tableCount = Object.keys(schema.tables).length;
  log(`   ${tableCount} tables loaded (schema hash: ${schemaHash.slice(0, 12)}...)`);

  // Load mappings
  log(`\n📂 Loading mappings...`);
  const mappings = await loadMappings(SINGLE_ENTITY ?? undefined);
  log(`   ${mappings.length} mapping(s) loaded`);

  if (mappings.length === 0) {
    abort(`No mappings found${SINGLE_ENTITY ? ` for entity "${SINGLE_ENTITY}"` : ""}`);
  }

  // Create output directories
  await mkdir(ALIGNED_DIR, { recursive: true });
  await mkdir(REPORT_DIR, { recursive: true });

  // Process each entity
  log(`\n🔄 Aligning entities...`);
  const results: AlignmentResult[] = [];
  const timestamp = new Date().toISOString();

  for (const mapping of mappings) {
    const result = alignEntity(mapping, schema);
    results.push(result);

    const statusIcon =
      result.alignmentStatus === "blocked"
        ? "🔴"
        : result.alignmentStatus === "unmatched"
        ? "🔴"
        : result.alignmentStatus === "empty_attested"
        ? "🟡"
        : "🟢";

    log(
      `   ${statusIcon} ${result.entity.padEnd(22)} → ${(result.targetTable ?? "UNMATCHED").padEnd(30)} ` +
      `confirmed:${result.autoConfirmedCount} dropped:${result.droppedCount} review:${result.reviewQueueCount} blockers:${result.blockerCount}`,
    );

    // Write aligned shadow mapping
    await writeAlignedMapping(mapping, result);

    // Audit trail: emit one decision per field that auto_align resolved.
    // Force-interactive fields are NOT logged as field_target_set — they stay
    // needs_review and must be approved by a human via review_mapping.ts.
    for (const f of result.fields) {
      if (f.verdict === "auto-confirm" && f.targetColumn && !isForceInteractive(f.targetColumn)) {
        await logDecision(HISTORY_DIR, {
          scope: "schema",
          workspace: WORKSPACE_SLUG,
          entity: result.entity,
          action: "field_target_set",
          field: f.bubbleField,
          target: f.targetColumn,
          transform: f.transform,
          by: "auto_align",
          metadata: {
            verdict: f.verdict,
            v3_type: f.v3Type,
            v3_family: f.v3Family,
            fill_rate: f.fillRate,
            ambiguous: f.ambiguous,
          },
        });
      } else if (f.verdict === "drop") {
        await logDecision(HISTORY_DIR, {
          scope: "schema",
          workspace: WORKSPACE_SLUG,
          entity: result.entity,
          action: "field_dropped",
          field: f.bubbleField,
          by: "auto_align",
          metadata: {
            verdict: f.verdict,
            fill_rate: f.fillRate,
            note: f.note,
          },
        });
      }
    }

    // Write per-entity report
    const report = generateEntityReport(result);
    await writeFile(join(REPORT_DIR, `${result.entity}.md`), report, "utf-8");
  }

  // Write summary report
  const summary = generateSummaryReport(results, schemaHash, timestamp);
  const summaryPath = join(REPORT_DIR, "auto_align_SUMMARY.md");
  await writeFile(summaryPath, summary, "utf-8");

  // Print summary stats
  const totalConfirmed = results.reduce((s, r) => s + r.autoConfirmedCount, 0);
  const totalDropped = results.reduce((s, r) => s + r.droppedCount, 0);
  const totalReview = results.reduce((s, r) => s + r.reviewQueueCount, 0);
  const totalBlockers = results.reduce((s, r) => s + r.blockerCount, 0);
  const blockedEntities = results.filter((r) => r.alignmentStatus === "blocked");
  const unmatchedEntities = results.filter((r) => r.alignmentStatus === "unmatched");
  const emptyEntities = results.filter((r) => r.alignmentStatus === "empty_attested");

  log("");
  log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  log("  Alignment Summary");
  log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  log(`  Entities:         ${results.length}`);
  log(`  Auto-confirmed:   ${totalConfirmed} fields`);
  log(`  Dropped:          ${totalDropped} fields`);
  log(`  Review queue:     ${totalReview} fields`);
  log(`  Blockers:         ${totalBlockers} columns`);
  log(`  Blocked entities: ${blockedEntities.length}`);
  log(`  Unmatched:        ${unmatchedEntities.length}`);
  log(`  Empty-attested:   ${emptyEntities.length}`);

  if (blockedEntities.length > 0) {
    log("");
    log("  🔴 BLOCKED entities (must resolve before migration):");
    for (const r of blockedEntities) {
      log(`     - ${r.entity}: ${r.entityBlockers.join(", ")}`);
    }
  }

  if (unmatchedEntities.length > 0) {
    log("");
    log("  🔴 UNMATCHED entities (no v3 table found):");
    for (const r of unmatchedEntities) {
      log(`     - ${r.entity} (bubble_type: ${r.bubbleType})`);
    }
  }

  log("");
  log(`  📄 Summary report: ${summaryPath}`);
  log(`  📁 Shadow output:  ${ALIGNED_DIR}`);
  log(`  📁 Reports:        ${REPORT_DIR}`);
  log("");
  log("  Next steps:");
  log("  1. Review scripts/auto_align_report/auto_align_SUMMARY.md");
  log("  2. Check per-entity reports for review queue decisions");
  log("  3. When ready: pnpm tsx scripts/auto_align.ts --commit");
  log("");
}

main().catch((e: unknown) => {
  const msg = e instanceof Error ? e.message : String(e);
  abort(`Unexpected error: ${msg}`);
});
