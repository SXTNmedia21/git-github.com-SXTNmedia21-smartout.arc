/**
 * discovery.ts — Testable core logic for Phase 3.5a Bubble discovery.
 *
 * This module contains all the business logic for running discovery against
 * Bubble entities. The CLI shell (run_discovery.ts) keeps itself thin by
 * delegating all work here.
 */

import { existsSync } from "node:fs";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { BubbleClient } from "../../src/bubble/client.js";
import type { BubbleRecord } from "../../src/bubble/types.js";
import type { EntityEntry } from "../../src/entities.js";
import {
  loadMapping,
  saveMapping,
  type Mapping,
} from "../../src/research/mapping.js";
import { observe, observeWithSidecar } from "../../src/research/observation.js";
import { diff } from "../../src/research/diff.js";
import { propose } from "../../src/research/propose.js";
import { saveSidecar } from "../../src/research/sidecar.js";

// ─── Public interfaces ────────────────────────────────────────────────────

export interface DiscoveryResult {
  entity: string;
  status: "success" | "skipped" | "error";
  recordCount?: number;
  newFieldCount?: number;
  errorMessage?: string;
}

export interface DiscoveryContext {
  bubble: BubbleClient;
  mappingsDir: string;
  workspaceId: string;
  force: boolean;
  enableSidecar: boolean;
  /** Optional callback called after each entity completes. */
  onProgress?: (result: DiscoveryResult, index: number, total: number) => void;
}

// ─── Internal helpers ──────────────────────────────────────────────────────

const SAMPLE_SIZE = 50;

function mappingFilePath(mappingsDir: string, entity: string): string {
  return join(mappingsDir, `${entity}.json`);
}

function errorSentinelPath(mappingsDir: string, entity: string): string {
  return join(mappingsDir, ".local", `${entity}.error.json`);
}

function createEmptyMapping(entity: string, bubbleType: string): Mapping {
  return {
    entity,
    bubble_type: bubbleType,
    target_table: null,
    field_map: {},
    required_source_fields: [],
    skip_if_missing: [],
    known_quirks: [],
    last_verified: "",
    sample_record_count: 0,
    total_record_count: null,
    v3_schema_hash: null,
  };
}

function dedupeById(records: BubbleRecord[]): BubbleRecord[] {
  const seen = new Set<string>();
  const out: BubbleRecord[] = [];
  for (const record of records) {
    if (seen.has(record._id)) continue;
    seen.add(record._id);
    out.push(record);
  }
  return out;
}

// ─── Core functions ────────────────────────────────────────────────────────

/**
 * Run discovery for a single entity. Fetches sample records from Bubble,
 * observes field shapes, diffs against existing mapping, proposes updates,
 * saves mapping, and optionally writes a sidecar.
 */
export async function runDiscoveryForEntity(
  entity: EntityEntry,
  ctx: DiscoveryContext,
): Promise<DiscoveryResult> {
  const mappingPath = mappingFilePath(ctx.mappingsDir, entity.name);

  // Skip if mapping exists and force is not set
  if (!ctx.force && existsSync(mappingPath)) {
    return { entity: entity.name, status: "skipped" };
  }

  // Per-workspace sampling: if the entity has a workspace-link field, filter the
  // sample to the target workspace so field observations reflect that tenant's
  // real data — not a global mix across all 40 workspaces.
  const constraints =
    entity.workspaceFieldKey && ctx.workspaceId
      ? [{
          key: entity.workspaceFieldKey,
          constraint_type: "equals" as const,
          value: ctx.workspaceId,
        }]
      : undefined;

  const sample = await ctx.bubble.sampleBidirectional(
    entity.bubbleType,
    SAMPLE_SIZE,
    { constraints },
  );
  const records = dedupeById([...sample.firstN, ...sample.lastN]);

  const existing =
    (await loadMapping(ctx.mappingsDir, entity.name)) ??
    createEmptyMapping(entity.name, entity.bubbleType);

  let proposed: Mapping;
  if (ctx.enableSidecar) {
    const { observation, sidecar } = observeWithSidecar(records);
    const diffResult = diff(existing, observation);
    proposed = propose(existing, observation, records.length);
    proposed.total_record_count = sample.totalCount;
    await saveMapping(ctx.mappingsDir, proposed);
    await saveSidecar(ctx.mappingsDir, entity.name, sidecar);
    const newFieldCount = diffResult.newFields.length;
    return {
      entity: entity.name,
      status: "success",
      recordCount: records.length,
      newFieldCount,
    };
  } else {
    const observation = observe(records);
    const diffResult = diff(existing, observation);
    proposed = propose(existing, observation, records.length);
    proposed.total_record_count = sample.totalCount;
    await saveMapping(ctx.mappingsDir, proposed);
    return {
      entity: entity.name,
      status: "success",
      recordCount: records.length,
      newFieldCount: diffResult.newFields.length,
    };
  }
}

/**
 * Run discovery for a list of entities, collecting results.
 * Errors in individual entities are captured without aborting the run.
 * Calls onProgress after each entity.
 */
export async function runDiscovery(
  entities: EntityEntry[],
  ctx: DiscoveryContext,
): Promise<DiscoveryResult[]> {
  const results: DiscoveryResult[] = [];
  const total = entities.length;

  for (let i = 0; i < entities.length; i++) {
    const entity = entities[i];
    let result: DiscoveryResult;
    try {
      result = await runDiscoveryForEntity(entity, ctx);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : String(err);

      // Save error sentinel
      try {
        await mkdir(join(ctx.mappingsDir, ".local"), { recursive: true });
        await writeFile(
          errorSentinelPath(ctx.mappingsDir, entity.name),
          JSON.stringify({ entity: entity.name, error: errorMessage, at: new Date().toISOString() }, null, 2) + "\n",
          "utf-8",
        );
      } catch {
        // Ignore errors when writing the sentinel
      }

      result = {
        entity: entity.name,
        status: "error",
        errorMessage,
      };
    }
    results.push(result);
    ctx.onProgress?.(result, i, total);
  }

  return results;
}

/**
 * Format a progress line for a completed discovery result.
 * Example: "[3/14] ✓ workspace — 50 records, 12 new fields"
 */
export function formatProgress(
  result: DiscoveryResult,
  index: number,
  total: number,
): string {
  const position = `[${index + 1}/${total}]`;
  if (result.status === "skipped") {
    return `${position} ⏭  ${result.entity} — skipped (mapping exists)`;
  }
  if (result.status === "error") {
    return `${position} ✗ ${result.entity} — ${result.errorMessage ?? "unknown error"}`;
  }
  const records = result.recordCount ?? 0;
  const newFields = result.newFieldCount ?? 0;
  return `${position} ✓ ${result.entity} — ${records} records, ${newFields} new fields`;
}

/**
 * Build a summary table string from a list of discovery results.
 */
export function formatSummary(results: DiscoveryResult[]): string {
  const success = results.filter((r) => r.status === "success").length;
  const skipped = results.filter((r) => r.status === "skipped").length;
  const failed = results.filter((r) => r.status === "error").length;

  const lines = [
    "",
    "─────────────────────────────────────────",
    "  Discovery Summary",
    "─────────────────────────────────────────",
    `  Processed:  ${success}`,
    `  Skipped:    ${skipped}`,
    `  Failed:     ${failed}`,
    "─────────────────────────────────────────",
    "",
  ];

  if (failed > 0) {
    lines.push("  Failed entities:");
    for (const r of results.filter((x) => x.status === "error")) {
      lines.push(`    ✗ ${r.entity}: ${r.errorMessage}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

// Re-export loadMapping for use by the CLI
export { loadMapping };
