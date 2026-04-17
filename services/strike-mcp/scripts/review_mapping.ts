#!/usr/bin/env tsx
/**
 * review_mapping.ts — Phase 3.5b: Interactive mapping review CLI
 *
 * Walks through a mapping file field-by-field, validating against v3_schema.json
 * constraints, and lets the reviewer Accept, Skip, Rename, or Drop each field.
 *
 * USAGE:
 *   pnpm tsx scripts/review_mapping.ts --entity=<name> [--v3-schema=<path>]
 *
 * OPTIONS:
 *   --entity=<name>        Required. Entity name matching a file in mappings/<entity>.json
 *   --v3-schema=<path>     Path to v3_schema.json (default: ./v3_schema.json)
 *
 * EXAMPLES:
 *   tsx scripts/review_mapping.ts --entity=workspace
 *   tsx scripts/review_mapping.ts --entity=shifts --v3-schema=/tmp/v3_schema.json
 */

import * as readline from "node:readline";
import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { Mapping } from "../src/research/mapping.js";
import { loadMapping, saveMapping, hasMappingLevelReview } from "../src/research/mapping.js";
import { loadSidecar } from "../src/research/sidecar.js";
import type { V3Schema } from "../src/research/v3_schema.js";
import {
  appendDecision,
  type DecisionEntry,
} from "../src/history/decision_log.js";
import {
  validateDecision,
  applyDecision,
  describeField,
  countUnreviewedFields,
  unreviewedFieldKeys,
  type FieldDecision,
  type ReviewContext,
} from "./lib/review.js";

const MAPPINGS_DIR = join(import.meta.dirname, "..", "mappings");

/**
 * Wrapper around appendDecision that never stops the review loop.
 * An audit-trail write failure is logged to stderr but does not abort the user's work.
 *
 * Takes historyDir explicitly to avoid closure-capture issues — makes the helper
 * unit-testable in isolation if we ever need it.
 */
async function logDecision(
  historyDir: string,
  entry: DecisionEntry,
): Promise<void> {
  try {
    await appendDecision(historyDir, entry);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[decision-log] FAILED to write: ${msg}`);
  }
}

// ─── Argument parsing ─────────────────────────────────────────────────────

function parseArgs(argv: string[]): {
  entityName: string | null;
  v3SchemaPath: string;
  workspaceSlug: string | null;
} {
  let entityName: string | null = null;
  let v3SchemaPath = "./v3_schema.json";
  let workspaceSlug: string | null = null;

  for (const arg of argv) {
    if (arg.startsWith("--entity=")) {
      entityName = arg.slice("--entity=".length).trim();
    } else if (arg.startsWith("--v3-schema=")) {
      v3SchemaPath = arg.slice("--v3-schema=".length).trim();
    } else if (arg.startsWith("--workspace=")) {
      workspaceSlug = arg.slice("--workspace=".length).trim();
    }
  }

  return { entityName, v3SchemaPath, workspaceSlug };
}

// ─── I/O helpers ──────────────────────────────────────────────────────────

function prompt(rl: readline.Interface, question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => resolve(answer.trim()));
  });
}

function printSeparator(): void {
  console.log("─".repeat(60));
}

// ─── Table selection ──────────────────────────────────────────────────────

async function selectTargetTable(
  rl: readline.Interface,
  v3Schema: V3Schema,
  filterPrefix?: string,
): Promise<string | null> {
  const tables = Object.keys(v3Schema.tables).sort();
  const filtered = filterPrefix
    ? tables.filter((t) => t.includes(filterPrefix))
    : tables;

  if (filtered.length === 0) {
    console.log("No matching tables found.");
    return null;
  }

  filtered.forEach((t, i) => console.log(`  [${i + 1}] ${t}`));

  const answer = await prompt(rl, `\nSelect table [1-${filtered.length}] or 0 to cancel: `);
  const idx = parseInt(answer, 10) - 1;
  if (isNaN(idx) || idx < 0 || idx >= filtered.length) return null;
  return filtered[idx];
}

// ─── Mapping-level attestation ─────────────────────────────────────────────

async function handleMappingLevelReview(
  rl: readline.Interface,
  mapping: Mapping,
): Promise<Mapping> {
  console.log("\n⚠ MAPPING-LEVEL REVIEW REQUIRED");
  console.log(
    "  This entity had 0 records in Bubble (sample_record_count=0).",
  );
  console.log("  Attest that the source is intentionally empty?\n");

  const answer = await prompt(rl, "Attest empty source? [Y/N]: ");
  if (answer.toUpperCase() !== "Y") {
    console.log("Skipping attestation. No changes saved.");
    return mapping;
  }

  const defaultUser = process.env.USER ?? "unknown";
  const attestedBy = await prompt(rl, `Attested by [${defaultUser}]: `);
  const today = new Date().toISOString().slice(0, 10);

  return {
    ...mapping,
    known_empty_source: true,
    attested_by: attestedBy || defaultUser,
    attested_on: today,
  };
}

// ─── Per-field review loop ────────────────────────────────────────────────

async function reviewField(
  rl: readline.Interface,
  fieldKey: string,
  ctx: ReviewContext,
): Promise<FieldDecision | null> {
  printSeparator();
  console.log(describeField(fieldKey, ctx));
  console.log("");
  console.log("[A]ccept / [S]kip (target=null) / [R]ename / [D]rop from migration:");

  while (true) {
    const input = (await prompt(rl, "> ")).toUpperCase();

    if (input === "A") {
      const decision = { fieldKey, action: "accept" as const };
      const result = validateDecision(decision, ctx);
      if (!result.valid) {
        console.log(`\n✗ Cannot accept: ${result.reason}`);
        console.log("Choose: [S]kip / [R]ename / [D]rop\n");
        continue;
      }
      if (result.warning) {
        console.log(`\n⚠ Warning: ${result.warning}`);
        const confirm = await prompt(rl, "Type CONFIRM to accept anyway, or press Enter to choose another action: ");
        if (confirm !== "CONFIRM") continue;
      }
      return decision;
    }

    if (input === "S") {
      return { fieldKey, action: "skip" };
    }

    if (input === "D") {
      const reason = await prompt(rl, "Reason (optional, press Enter to skip): ");
      return reason
        ? { fieldKey, action: "drop", reasoning: reason }
        : { fieldKey, action: "drop" };
    }

    if (input === "R") {
      const newTarget = await prompt(rl, "New target column name: ");
      if (!newTarget) {
        console.log("No name provided. Try again.");
        continue;
      }
      const decision = { fieldKey, action: "rename" as const, newTarget };
      const result = validateDecision(decision, ctx);
      if (!result.valid) {
        console.log(`\n✗ Cannot rename: ${result.reason}`);
        continue;
      }
      if (result.warning) {
        console.log(`\n⚠ Warning: ${result.warning}`);
      }
      return decision;
    }

    console.log("Invalid input. Type A, S, R, or D.");
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const { entityName, v3SchemaPath, workspaceSlug: slugArg } = parseArgs(
    process.argv.slice(2),
  );

  // Audit trail setup — anchors every decision to a source workspace for later analysis.
  // This must resolve before any mapping work begins; decisions made before this would be lost.
  const workspaceSlug = slugArg ?? process.env.STRIKE_WORKSPACE_SLUG ?? "";
  if (!workspaceSlug) {
    console.error(
      "Error: STRIKE_WORKSPACE_SLUG env or --workspace=<slug> is required.\n" +
        "  This anchors every decision to a source workspace for later analysis.\n" +
        "  Example: STRIKE_WORKSPACE_SLUG=strom-mat-og-bar pnpm tsx scripts/review_mapping.ts --entity=locations",
    );
    process.exit(1);
  }

  const historyDir =
    process.env.STRIKE_HISTORY_DIR ??
    join(import.meta.dirname, "..", "history");

  // Session counters for the mapping_committed entry at end-of-review.
  const sessionStart = Date.now();
  let fieldsApproved = 0;
  let fieldsDropped = 0;
  let fieldsRenamed = 0;
  let fieldsDeferred = 0;

  if (!entityName) {
    console.error("Error: --entity=<name> is required.");
    console.error("Usage: tsx scripts/review_mapping.ts --entity=workspace");
    process.exit(1);
  }

  // Load mapping
  const mapping = await loadMapping(MAPPINGS_DIR, entityName);
  if (!mapping) {
    console.error(`No mapping found for "${entityName}" in ${MAPPINGS_DIR}.`);
    console.error("Run discovery first: pnpm discovery --entity=" + entityName);
    process.exit(1);
  }

  // Load v3 schema
  if (!existsSync(v3SchemaPath)) {
    console.error(`v3_schema.json not found at: ${v3SchemaPath}`);
    console.error("Generate it with: pnpm tsx scripts/run_discovery.ts (or run src/research/v3_schema.ts directly)");
    process.exit(1);
  }
  const v3SchemaRaw = await readFile(v3SchemaPath, "utf-8");
  const v3Schema = JSON.parse(v3SchemaRaw) as V3Schema;

  // Load sidecar (optional)
  const sidecar = await loadSidecar(MAPPINGS_DIR, entityName);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
  });

  let currentMapping = mapping;
  const ctx: ReviewContext = { mapping: currentMapping, v3Schema, sidecar };

  console.log(`\n═══════════════════════════════════════════════════`);
  console.log(`  Reviewing: ${entityName}`);
  console.log(`  Target table: ${mapping.target_table ?? "(not set)"}`);
  console.log(`  Sample records: ${mapping.sample_record_count}`);
  console.log(`  Unreviewed fields: ${countUnreviewedFields(mapping)}`);
  console.log(`═══════════════════════════════════════════════════\n`);

  // Mapping-level attestation gate (zero records)
  if (hasMappingLevelReview(currentMapping)) {
    currentMapping = await handleMappingLevelReview(rl, currentMapping);
    ctx.mapping = currentMapping;
    await saveMapping(MAPPINGS_DIR, currentMapping);
    if (currentMapping.known_empty_source === true) {
      await logDecision(historyDir, {
        scope: "schema",
        workspace: workspaceSlug,
        entity: entityName,
        action: "mapping_attested_empty",
        by: "pontus",
        metadata: {
          attested_by: currentMapping.attested_by,
          attested_on: currentMapping.attested_on,
          total_records: currentMapping.sample_record_count,
        },
      });
    }
  }

  // Target table selection if not set
  if (!currentMapping.target_table) {
    console.log("\nNo target table set. Please select a v3 table:\n");
    const prefix = await prompt(rl, "Filter tables by prefix (or Enter to list all): ");
    const selected = await selectTargetTable(rl, v3Schema, prefix || undefined);
    if (selected) {
      currentMapping = { ...currentMapping, target_table: selected };
      ctx.mapping = currentMapping;
      await saveMapping(MAPPINGS_DIR, currentMapping);
      await logDecision(historyDir, {
        scope: "schema",
        workspace: workspaceSlug,
        entity: entityName,
        action: "target_table_set",
        target: selected,
        by: "pontus",
      });
      console.log(`\nTarget table set to: ${selected}\n`);
    } else {
      console.log("No table selected. Continuing without target table.\n");
    }
  }

  // Field review loop. An empty queue is allowed — it means the mapping is
  // already fully reviewed (e.g. after a fresh empty-source attestation), and
  // the mapping_committed gate at the end will still fire correctly.
  const fieldsToReview = unreviewedFieldKeys(currentMapping);
  if (fieldsToReview.length === 0) {
    console.log("All fields are already reviewed. Nothing to do.");
  } else {
    console.log(`\nReviewing ${fieldsToReview.length} fields...\n`);
  }

  for (const fieldKey of fieldsToReview) {
    // Refresh ctx with latest mapping state
    ctx.mapping = currentMapping;

    const decision = await reviewField(rl, fieldKey, ctx);
    if (!decision) continue;

    currentMapping = applyDecision(currentMapping, decision);
    ctx.mapping = currentMapping;

    // Save immediately after each field decision
    await saveMapping(MAPPINGS_DIR, currentMapping);
    console.log(`  → Saved decision: ${decision.action}${decision.newTarget ? ` → ${decision.newTarget}` : ""}\n`);

    // Audit trail: emit per-field decision and bump session counters
    const postEntry = currentMapping.field_map[fieldKey];
    switch (decision.action) {
      case "accept":
        fieldsApproved++;
        await logDecision(historyDir, {
          scope: "schema",
          workspace: workspaceSlug,
          entity: entityName,
          action: "field_approved",
          field: fieldKey,
          target: postEntry?.target ?? null,
          transform: postEntry?.transform ?? null,
          by: "pontus",
        });
        break;
      case "drop":
        fieldsDropped++;
        await logDecision(historyDir, {
          scope: "schema",
          workspace: workspaceSlug,
          entity: entityName,
          action: "field_dropped",
          field: fieldKey,
          reasoning: decision.reasoning,
          by: "pontus",
        });
        break;
      case "rename":
        fieldsRenamed++;
        await logDecision(historyDir, {
          scope: "schema",
          workspace: workspaceSlug,
          entity: entityName,
          action: "field_renamed",
          field: fieldKey,
          target: decision.newTarget ?? null,
          transform: postEntry?.transform ?? null,
          by: "pontus",
        });
        break;
      case "skip":
        fieldsDeferred++;
        await logDecision(historyDir, {
          scope: "schema",
          workspace: workspaceSlug,
          entity: entityName,
          action: "field_review_deferred",
          field: fieldKey,
          target: null,
          by: "pontus",
        });
        break;
    }
  }

  rl.close();

  printSeparator();
  const remaining = countUnreviewedFields(currentMapping);
  console.log(`\nReview complete for "${entityName}".`);
  console.log(`Remaining needs_review fields: ${remaining}`);

  if (remaining === 0) {
    const committedEntry: DecisionEntry = {
      scope: "schema",
      workspace: workspaceSlug,
      entity: entityName,
      action: "mapping_committed",
      by: "pontus",
      metadata: {
        fields_approved: fieldsApproved,
        fields_dropped: fieldsDropped,
        fields_renamed: fieldsRenamed,
        fields_deferred: fieldsDeferred,
        session_duration_ms: Date.now() - sessionStart,
      },
    };
    if (currentMapping.approval_hash) {
      committedEntry.approval_hash = currentMapping.approval_hash;
    }
    await logDecision(historyDir, committedEntry);

    console.log("✓ All fields reviewed. Mapping is ready for Phase 3.5c validation.\n");
  } else {
    console.log(`⚠ ${remaining} field(s) still need review.\n`);
  }
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`\nFatal error: ${msg}`);
  process.exit(1);
});
