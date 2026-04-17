/**
 * Append-only decision log for strike-mcp review and migration workflows.
 *
 * Why append-only: the log is the audit trail for every mapping decision.
 * Modifying past entries would destroy the guarantee that "what was decided on
 * date X, by whom, for which workspace" is recoverable six months from now.
 *
 * The log is grep-friendly JSONL so downstream analysis (pattern extraction,
 * per-workspace review reports) can use simple jq/grep pipelines.
 */

import { appendFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

export interface DecisionEntry {
  ts?: string;
  scope: "schema" | "workspace_migration";
  workspace: string;
  entity: string;
  action:
    | "field_target_set"
    | "field_approved"
    | "field_dropped"
    | "field_renamed"
    | "field_review_deferred"
    | "target_table_set"
    | "mapping_attested_empty"
    | "pattern_auto_applied" // Reserved for future cross-entity pattern layer; not emitted in Phase 3.5b
    | "mapping_committed"
    | "field_map_rewritten" // Full field_map rewrite after discovery-sidecar divergence (Task #21)
    | "required_source_fields_fix"; // Revise required_source_fields to match live API sparsity
  field?: string;
  target?: string | null;
  transform?: string | null;
  reasoning?: string;
  by: "pontus" | "auto_align" | "review_mapping" | string;
  approval_hash?: string;
  confidence?: number;
  metadata?: Record<string, unknown>;
}

export async function appendDecision(
  historyDir: string,
  entry: DecisionEntry,
): Promise<void> {
  const filled: DecisionEntry = {
    ...entry,
    ts: entry.ts && entry.ts !== "" ? entry.ts : new Date().toISOString(),
  };
  await mkdir(historyDir, { recursive: true });
  await appendFile(
    join(historyDir, "decisions.jsonl"),
    JSON.stringify(filled) + "\n",
    "utf-8",
  );
}
