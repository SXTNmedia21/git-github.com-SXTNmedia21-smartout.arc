/**
 * align.ts — Pure core library for Phase 3.5b auto-alignment.
 *
 * All functions are pure (no side effects, no FS access) and fully testable.
 * The CLI shell (scripts/auto_align.ts) handles all I/O.
 *
 * Council-approved spec: docs/superpowers/decisions/0001-phase-3.5b-auto-align.md
 */

import { createHash } from "node:crypto";
import type { FieldMapEntry, Mapping } from "../../src/research/mapping.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export type V3TypeFamily =
  | "uuid"
  | "uuid_array"
  | "text"
  | "timestamp"
  | "integer"
  | "numeric"
  | "boolean"
  | "jsonb"
  | "array"
  | "unknown";

export interface BubbleFieldClass {
  isString: boolean;
  isNumber: boolean;
  isBoolean: boolean;
  isArray: boolean;
  isObject: boolean;
  maxLength: number | null;
  isLikelyDate: boolean;
  isLikelyBubbleId: boolean;
  isLikelyUuid: boolean;
}

export type CompatibilityVerdictType = "auto-confirm" | "needs_review" | "drop";

export interface CompatibilityVerdict {
  verdict: CompatibilityVerdictType;
  transform?: string;
  note?: string;
  warning?: string;
}

export type EntityMatchStatus = "matched" | "unmatched" | "ambiguous";
export type MatchConfidence = "HIGH" | "LOW";

export interface EntityMatchResult {
  matchedTable: string | null;
  entityMatchStatus: EntityMatchStatus;
  confidence: MatchConfidence | null;
  candidates?: Array<{ table: string; score: number }>;
}

export interface FieldAlignmentResult {
  bubbleField: string;
  targetColumn: string | null;
  verdict: CompatibilityVerdictType;
  transform: string | null;
  note: string | null;
  warning: string | null;
  ambiguous: boolean;
  collisionWith: string | null;
  v3Type: string | null;
  v3Family: V3TypeFamily | null;
  fillRate: number;
}

export interface AlignmentResult {
  entity: string;
  bubbleType: string;
  targetTable: string | null;
  entityMatchStatus: EntityMatchStatus;
  matchConfidence: MatchConfidence | null;
  alignmentStatus: "ok" | "blocked" | "empty_attested" | "unmatched";
  entityBlockers: string[];
  knownEmptySource: boolean;
  fields: FieldAlignmentResult[];
  totalRecordCount: number;
  sampleRecordCount: number;
  approvalHash: string;
  // Counts
  autoConfirmedCount: number;
  droppedCount: number;
  reviewQueueCount: number;
  blockerCount: number;
}

export interface V3Column {
  name: string;
  type: string;
  nullable: boolean;
  is_primary_key: boolean;
  is_array: boolean;
  default_expr: string | null;
  foreign_key: { table: string; column: string } | null;
}

export interface V3Table {
  schema: string;
  name: string;
  qualified_name: string;
  columns: Record<string, V3Column>;
}

export interface V3Schema {
  tables: Record<string, V3Table>;
}

// ─── Context-injected columns ────────────────────────────────────────────────

/**
 * v3 columns that are populated by the migration engine at runtime,
 * not by field mapping from Bubble. These should NOT trigger the
 * NOT NULL blocker rule because they are handled elsewhere.
 *
 * - workspace_id, company_id: injected from MigrationContext
 * - created_at, updated_at, modified_at: Postgres DEFAULT now() (verify per table)
 * - created_by, updated_by, modified_by: synthesized at apply time or null
 * - *_id where the ID is UUIDv5 from parent entity: engine derives
 *
 * NOT in this set (deliberately — want the tool to complain):
 * - slug: now requires explicit declaration via mapping.derived_columns
 *   (e.g. slug: { from: "Titel", transform: "slugify" }). Forces the right
 *   pattern; no silent NOT NULL violations at apply time.
 * - source: ADR-0108 discriminator has DEFAULT 'operational' in M7 migration. If
 *   the engine forgets to override it to 'bubble_migration', rows silently land
 *   as 'operational' and M8 reconciliation triggers fire. Use mapping.constant_columns
 *   (e.g. source: 'bubble_migration') to inject explicitly.
 */
const CONTEXT_INJECTED_COLUMNS = new Set([
  "workspace_id",
  "company_id",
  "created_at",
  "updated_at",
  "modified_at",
  "created_by",
  "updated_by",
  "modified_by",
  "deleted_at",  // soft delete column
]);

export function isContextInjected(columnName: string): boolean {
  return CONTEXT_INJECTED_COLUMNS.has(columnName);
}

// ─── Governance: assertNoSidecarAccess ───────────────────────────────────────

/**
 * Hard-ban sidecar access. Throws immediately if any path targets .local/.
 * Call this before every FS read.
 */
export function assertNoSidecarAccess(path: string): void {
  if (path.includes("/.local/") || path.startsWith(".local/")) {
    throw new Error(
      `[HARD-BAN] Sidecar access forbidden. Path "${path}" targets .local/ directory. ` +
      `auto_align must never read sidecar or error sentinel files.`,
    );
  }
}

// ─── normalizeV3Type ──────────────────────────────────────────────────────────

/**
 * Normalize a raw v3 column type string into one of 9 canonical families.
 * Non-matching types → "unknown".
 */
export function normalizeV3Type(raw: string): V3TypeFamily {
  const t = raw.trim().toLowerCase();

  if (t === "uuid") return "uuid";
  if (t === "uuid[]") return "uuid_array";
  if (["text", "citext", "varchar", "character varying"].includes(t)) return "text";
  if (/^varchar\(\d+\)$/.test(t)) return "text";
  if (["timestamptz", "timestamp with time zone", "timestamp"].includes(t)) return "timestamp";
  if (["integer", "int", "int4", "bigint", "int8", "smallint"].includes(t)) return "integer";
  if (["numeric", "decimal", "float", "float8", "double precision"].includes(t)) return "numeric";
  if (["boolean", "bool"].includes(t)) return "boolean";
  if (["jsonb", "json"].includes(t)) return "jsonb";
  // Any non-uuid array type
  if (t.endsWith("[]") && t !== "uuid[]") return "array";

  return "unknown";
}

// ─── extractMaxLength ─────────────────────────────────────────────────────────

/**
 * Extract the maximum string length from sample values like ["string<24>", "string<32>"].
 * Returns null if no string<N> tokens found.
 */
export function extractMaxLength(sampleValues: unknown[]): number | null {
  let max: number | null = null;
  for (const v of sampleValues) {
    if (typeof v !== "string") continue;
    const match = v.match(/^string<(\d+)>$/);
    if (!match) continue;
    const len = parseInt(match[1], 10);
    if (max === null || len > max) max = len;
  }
  return max;
}

// ─── Date field name pattern ──────────────────────────────────────────────────

const DATE_NAME_PATTERN = /date|time|created|modified|updated|_at$|_on$|start|end|expire/i;

function isDateFieldName(name: string): boolean {
  return DATE_NAME_PATTERN.test(name);
}

// ─── classifyBubbleField ──────────────────────────────────────────────────────

/**
 * Classify a Bubble field into a typed class for compatibility checking.
 * Uses source_value_types and sample_values to determine characteristics.
 */
export function classifyBubbleField(field: FieldMapEntry): BubbleFieldClass {
  const types = field.source_value_types;
  const samples = field.sample_values as string[];
  const name = (field.target ?? "").toLowerCase();

  const isString = types.includes("string");
  const isNumber = types.includes("number");
  const isBoolean = types.includes("boolean");
  const isArray = types.includes("array");
  const isObject = types.includes("object");

  const maxLength = isString ? extractMaxLength(samples) : null;

  // Date: string<24> AND name matches date pattern
  const isLikelyDate = isString && maxLength === 24 && isDateFieldName(name);

  // Bubble ID: string<32> (and NOT a date pattern name)
  const isLikelyBubbleId = isString && maxLength === 32 && !isLikelyDate;

  // UUID v4: string<36>
  const isLikelyUuid = isString && maxLength === 36;

  return {
    isString,
    isNumber,
    isBoolean,
    isArray,
    isObject,
    maxLength,
    isLikelyDate,
    isLikelyBubbleId,
    isLikelyUuid,
  };
}

// ─── checkCompatibility ───────────────────────────────────────────────────────

const TIMESTAMP_SYSTEM_COLUMNS = /^(created_at|updated_at)$/i;

/**
 * Determine whether a Bubble field is compatible with a v3 column type.
 * Implements the 13-rule type-compatibility matrix from the spec.
 *
 * bubbleClass     — classified Bubble field
 * v3RawType       — raw v3 column type string (e.g. "timestamptz")
 * v3Nullable      — whether the v3 column is nullable
 * bubbleFieldName — destination column name (for timestamp system column check)
 */
export function checkCompatibility(
  bubbleClass: BubbleFieldClass,
  v3RawType: string,
  v3Nullable: boolean,
  bubbleFieldName: string,
): CompatibilityVerdict {
  const family = normalizeV3Type(v3RawType);
  const name = bubbleFieldName.toLowerCase();

  // Unknown v3 type family → always review
  if (family === "unknown") {
    return {
      verdict: "needs_review",
      note: `v3 column type "${v3RawType}" is not in a recognized type family — manual mapping required`,
    };
  }

  // ── String source ────────────────────────────────────────────────────────

  if (bubbleClass.isString) {
    const len = bubbleClass.maxLength;

    // Date gate: string<24> + date name → timestamp (but NOT if system column)
    if (bubbleClass.isLikelyDate && family === "timestamp") {
      // Special rule: created_at / updated_at → always review with mode note
      if (TIMESTAMP_SYSTEM_COLUMNS.test(name)) {
        return {
          verdict: "needs_review",
          note: "timestamp column on destination likely has DEFAULT now() — choose mode: preserve/regenerate/copy",
        };
      }
      return {
        verdict: "auto-confirm",
        transform: "bubble_date_to_tstz",
      };
    }

    // string<32> → uuid: Bubble ID ≠ UUID → review
    if (bubbleClass.isLikelyBubbleId && family === "uuid") {
      return {
        verdict: "needs_review",
        note: "Bubble ID (32 chars) is not a UUID — requires deterministic UUIDv5 generation",
      };
    }

    // string<32> → uuid_array → review
    if (bubbleClass.isLikelyBubbleId && family === "uuid_array") {
      return {
        verdict: "needs_review",
        note: "Bubble ID array → uuid[] requires UUIDv5 mapping of each element",
      };
    }

    // string<36> → uuid → auto-confirm
    if (bubbleClass.isLikelyUuid && family === "uuid") {
      return { verdict: "auto-confirm" };
    }

    // string ≤31 → text → auto-confirm
    if (len !== null && len <= 31 && family === "text") {
      return { verdict: "auto-confirm" };
    }

    // string =32 → text → auto-confirm
    if (len === 32 && family === "text") {
      return { verdict: "auto-confirm" };
    }

    // string ≤31 → uuid → REVIEW
    if (len !== null && len <= 31 && family === "uuid") {
      return {
        verdict: "needs_review",
        note: `Short string (${len} chars) → uuid is ambiguous — may be a slug or short code, not a UUID`,
      };
    }

    // string → text (any other length) → auto-confirm
    if (family === "text") {
      return { verdict: "auto-confirm" };
    }

    // Fallback for string → anything else
    return {
      verdict: "needs_review",
      note: `string source does not have a safe mapping to ${v3RawType} (family: ${family})`,
    };
  }

  // ── Number source ────────────────────────────────────────────────────────

  if (bubbleClass.isNumber) {
    if (family === "integer") return { verdict: "auto-confirm" };
    if (family === "numeric") return { verdict: "auto-confirm" };
    if (family === "text") {
      return {
        verdict: "needs_review",
        note: "number → text requires explicit cast — verify this is intentional",
      };
    }
    return {
      verdict: "needs_review",
      note: `number source has no safe mapping to ${v3RawType} (family: ${family})`,
    };
  }

  // ── Boolean source ───────────────────────────────────────────────────────

  if (bubbleClass.isBoolean) {
    if (family === "boolean") return { verdict: "auto-confirm" };
    return {
      verdict: "needs_review",
      note: `boolean source has no safe mapping to ${v3RawType}`,
    };
  }

  // ── Array source ─────────────────────────────────────────────────────────

  if (bubbleClass.isArray) {
    if (family === "uuid_array") {
      return {
        verdict: "needs_review",
        note: "array → uuid[] requires UUIDv5 mapping of each element",
      };
    }
    if (family === "array") {
      return {
        verdict: "auto-confirm",
        warning: "array → array: element types unverified — review array element compatibility",
      };
    }
    return {
      verdict: "needs_review",
      note: `array source has no safe mapping to ${v3RawType} (family: ${family})`,
    };
  }

  // ── Object source ────────────────────────────────────────────────────────

  if (bubbleClass.isObject) {
    if (family === "jsonb") return { verdict: "auto-confirm" };
    return {
      verdict: "needs_review",
      note: `object source has no safe mapping to ${v3RawType}`,
    };
  }

  // Unknown source type
  return {
    verdict: "needs_review",
    note: "source type could not be classified — manual review required",
  };
}

// ─── Entity-to-table matching ─────────────────────────────────────────────────

// Unicode ranges: U+1F300–U+1FAFF (emoji), U+2600–U+27BF (misc symbols)
const EMOJI_PATTERN = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu;

function stripEmojiAndNormalize(s: string): string {
  return s
    .replace(EMOJI_PATTERN, "")         // strip emoji
    .replace(/[()]/g, "")               // strip parens
    .replace(/^\s+|\s+$/g, "")          // trim
    .toLowerCase()
    .replace(/s$/, "");                  // strip trailing 's'
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }
  return dp[m][n];
}

function editDistanceSimilarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(a, b) / maxLen;
}

/**
 * Match a Bubble entity to the closest v3 table name.
 *
 * Pass 1: Strip emoji+parens, lowercase, remove trailing 's'. Exact match → HIGH confidence.
 * Pass 2: Fuzzy match via Levenshtein. Top 3 candidates returned. Confidence: LOW.
 * No match within 50% similarity → unmatched.
 * Tie on distance → both candidates marked ambiguous.
 */
export function matchEntityToTable(
  entityName: string,
  bubbleType: string,
  v3TableNames: string[],
): EntityMatchResult {
  // Use entity name as primary, bubble_type as secondary signal
  const normalizedEntity = stripEmojiAndNormalize(entityName);
  const normalizedBubble = stripEmojiAndNormalize(bubbleType);

  // Pass 1: exact match on normalized entity name
  for (const tableName of v3TableNames) {
    const normalizedTable = tableName.replace(/s$/, "").toLowerCase();
    if (normalizedEntity === normalizedTable || normalizedBubble === normalizedTable) {
      return {
        matchedTable: tableName,
        entityMatchStatus: "matched",
        confidence: "HIGH",
      };
    }
  }

  // Pass 2: fuzzy match
  const candidates = v3TableNames
    .map((tableName) => {
      const normalizedTable = tableName.replace(/s$/, "").toLowerCase();
      const scoreA = editDistanceSimilarity(normalizedEntity, normalizedTable);
      const scoreB = editDistanceSimilarity(normalizedBubble, normalizedTable);
      return { table: tableName, score: Math.max(scoreA, scoreB) };
    })
    .filter((c) => c.score > 0.5)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  if (candidates.length === 0) {
    return {
      matchedTable: null,
      entityMatchStatus: "unmatched",
      confidence: null,
      candidates: [],
    };
  }

  // Tie-breaker: if top 2 candidates have identical distance → ambiguous
  if (
    candidates.length >= 2 &&
    Math.abs(candidates[0].score - candidates[1].score) < 0.001
  ) {
    return {
      matchedTable: null,
      entityMatchStatus: "ambiguous",
      confidence: "LOW",
      candidates,
    };
  }

  return {
    matchedTable: candidates[0].table,
    entityMatchStatus: "matched",
    confidence: "LOW",
    candidates,
  };
}

// ─── Column name normalization ────────────────────────────────────────────────

/**
 * Normalize a Bubble field target name to a v3-compatible column name.
 * Used for collision detection and column matching.
 */
export function normalizeColumnName(target: string): string {
  return target
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/__+/g, "_")
    .replace(/^_+|_+$/g, "");
}

// ─── Single-entity alignment ──────────────────────────────────────────────────

/**
 * Align all fields in a single Mapping against the v3 schema.
 * Returns a full AlignmentResult — pure, no FS access.
 */
export function alignEntity(mapping: Mapping, v3Schema: V3Schema): AlignmentResult {
  const { entity, bubble_type, total_record_count, sample_record_count } = mapping;

  // Find matching v3 table.
  // Precedence: explicit mapping.target_table (set by reviewer/patch script) wins
  // over name-based fuzzy matching. This is required for entities where the
  // Bubble entity name diverges from the v3 table name (e.g. shifts →
  // public.schedule_shift, users → public.user_identity, salary_transactions →
  // public.payroll_ledger_archive). The matcher is only a hint for
  // never-attested entities; once a reviewer has set target_table, that decision
  // is canonical.
  const tableNames = Object.values(v3Schema.tables).map((t) => t.name);
  const matchResult: EntityMatchResult =
    mapping.target_table && v3Schema.tables[mapping.target_table]
      ? {
          matchedTable: v3Schema.tables[mapping.target_table].name,
          entityMatchStatus: "matched",
          confidence: "HIGH",
        }
      : matchEntityToTable(entity, bubble_type, tableNames);

  const targetTable = mapping.target_table
    ? mapping.target_table
    : matchResult.matchedTable
      ? `public.${matchResult.matchedTable}`
      : null;

  const v3Table = targetTable ? v3Schema.tables[targetTable] : null;

  // Zero-records handling
  const knownEmptySource =
    total_record_count === 0 || mapping.known_empty_source === true;

  // Initialize result structure
  const entityBlockers: string[] = [];
  const fields: FieldAlignmentResult[] = [];

  // Build collision map: normalized column name → [bubble field names]
  const columnCollisionMap = new Map<string, string[]>();
  for (const [bubbleField, fieldEntry] of Object.entries(mapping.field_map)) {
    const targetCol = fieldEntry.target ?? normalizeColumnName(bubbleField);
    const normalized = normalizeColumnName(targetCol);
    const existing = columnCollisionMap.get(normalized) ?? [];
    existing.push(bubbleField);
    columnCollisionMap.set(normalized, existing);
  }

  // For fill-rate: use sample_record_count as denominator since occurrence_count is
  // measured against the sample, not the full dataset.
  const fillRateBase = sample_record_count > 0 ? sample_record_count : (total_record_count ?? 0);

  for (const [bubbleField, fieldEntry] of Object.entries(mapping.field_map)) {
    const targetColRaw = fieldEntry.target ?? normalizeColumnName(bubbleField);
    const normalizedTarget = normalizeColumnName(targetColRaw);

    const fillRate = fillRateBase > 0 ? fieldEntry.occurrence_count / fillRateBase : 0;

    // Collision detection
    const collidingFields = columnCollisionMap.get(normalizedTarget) ?? [];
    const isAmbiguous = collidingFields.length > 1;
    const collisionWith =
      isAmbiguous
        ? collidingFields.filter((f) => f !== bubbleField).join(", ")
        : null;

    // If unknown/unmatched target table → all fields go to review
    if (!v3Table || matchResult.entityMatchStatus === "unmatched") {
      fields.push({
        bubbleField,
        targetColumn: null,
        verdict: "needs_review",
        transform: null,
        note: `No v3 table found for entity "${entity}"`,
        warning: null,
        ambiguous: isAmbiguous,
        collisionWith,
        v3Type: null,
        v3Family: null,
        fillRate,
      });
      continue;
    }

    // Zero-records: keep all at needs_review
    if (knownEmptySource) {
      fields.push({
        bubbleField,
        targetColumn: normalizedTarget,
        verdict: "needs_review",
        transform: null,
        note: "Entity has zero records — alignment preserved but not confirmed",
        warning: null,
        ambiguous: isAmbiguous,
        collisionWith,
        v3Type: null,
        v3Family: null,
        fillRate,
      });
      continue;
    }

    // Collision → needs_review
    if (isAmbiguous) {
      fields.push({
        bubbleField,
        targetColumn: normalizedTarget,
        verdict: "needs_review",
        transform: null,
        note: `collision with ${collisionWith}`,
        warning: null,
        ambiguous: true,
        collisionWith,
        v3Type: null,
        v3Family: null,
        fillRate,
      });
      continue;
    }

    // Find matching v3 column
    const v3Column = v3Table.columns[normalizedTarget] ?? null;

    if (!v3Column) {
      // No matching v3 column → drop
      fields.push({
        bubbleField,
        targetColumn: null,
        verdict: "drop",
        transform: null,
        note: `No v3 column "${normalizedTarget}" on table ${targetTable}`,
        warning: null,
        ambiguous: false,
        collisionWith: null,
        v3Type: null,
        v3Family: null,
        fillRate,
      });
      continue;
    }

    // Type compatibility check
    const bubbleClass = classifyBubbleField(fieldEntry);
    const family = normalizeV3Type(v3Column.type);
    const compat = checkCompatibility(
      bubbleClass,
      v3Column.type,
      v3Column.nullable,
      normalizedTarget,
    );

    fields.push({
      bubbleField,
      targetColumn: normalizedTarget,
      verdict: compat.verdict,
      transform: compat.transform ?? fieldEntry.transform,
      note: compat.note ?? null,
      warning: compat.warning ?? null,
      ambiguous: false,
      collisionWith: null,
      v3Type: v3Column.type,
      v3Family: family,
      fillRate,
    });
  }

  // Check NOT NULL blockers (v3 columns with nullable=false AND no default AND no Bubble field maps to them)
  const blockerList: string[] = [];
  if (v3Table && !knownEmptySource && matchResult.entityMatchStatus !== "unmatched") {
    const mappedV3Columns = new Set(
      fields
        .filter((f) => f.targetColumn !== null && f.verdict !== "drop")
        .map((f) => f.targetColumn!),
    );

    // Also count columns satisfied by derived_columns (e.g. slug from name) and
    // constant_columns (e.g. source='bubble_migration') — both are engine-emitted.
    for (const target of Object.keys(mapping.derived_columns ?? {})) {
      mappedV3Columns.add(target);
    }
    for (const target of Object.keys(mapping.constant_columns ?? {})) {
      mappedV3Columns.add(target);
    }
    // raw_json_target captures the entire source record into a v3 jsonb column
    // (ADR-0005). Engine assigns row[mapping.raw_json_target] = record post-mapping.
    if (mapping.raw_json_target) {
      mappedV3Columns.add(mapping.raw_json_target);
    }

    for (const [colName, col] of Object.entries(v3Table.columns)) {
      if (!col.nullable && col.default_expr === null && !col.is_primary_key) {
        // Skip columns that are populated by the migration engine at runtime
        // (MigrationContext.workspaceId, Postgres defaults, apply-time synthesis).
        if (isContextInjected(colName)) continue;
        if (!mappedV3Columns.has(colName)) {
          blockerList.push(colName);
        }
      }
    }
  }
  entityBlockers.push(...blockerList);

  // If blocked → downgrade all auto-confirmed to needs_review
  const isBlocked =
    entityBlockers.length > 0 &&
    !knownEmptySource &&
    matchResult.entityMatchStatus !== "unmatched";

  if (isBlocked) {
    for (const f of fields) {
      if (f.verdict === "auto-confirm") {
        f.verdict = "needs_review";
        f.note = (f.note ? f.note + "; " : "") + "entity blocked due to NOT NULL constraint(s) without mapping";
      }
    }
  }

  const autoConfirmedCount = fields.filter((f) => f.verdict === "auto-confirm").length;
  const droppedCount = fields.filter((f) => f.verdict === "drop").length;
  const reviewQueueCount = fields.filter((f) => f.verdict === "needs_review").length;

  // Determine overall alignment status
  let alignmentStatus: AlignmentResult["alignmentStatus"];
  if (matchResult.entityMatchStatus === "unmatched") {
    alignmentStatus = "unmatched";
  } else if (knownEmptySource) {
    alignmentStatus = "empty_attested";
  } else if (isBlocked) {
    alignmentStatus = "blocked";
  } else {
    alignmentStatus = "ok";
  }

  // Build aligned mapping and compute approval hash
  const alignedMapping: Mapping & { approval_hash?: string } = {
    ...mapping,
    target_table: targetTable,
    known_empty_source: knownEmptySource || undefined,
    field_map: buildAlignedFieldMap(mapping.field_map, fields),
  };

  const approvalHash = computeApprovalHash(alignedMapping as unknown as Record<string, unknown>);

  return {
    entity,
    bubbleType: bubble_type,
    targetTable,
    entityMatchStatus: matchResult.entityMatchStatus,
    matchConfidence: matchResult.confidence,
    alignmentStatus,
    entityBlockers,
    knownEmptySource,
    fields,
    totalRecordCount: total_record_count ?? 0,
    sampleRecordCount: sample_record_count,
    approvalHash,
    autoConfirmedCount,
    droppedCount,
    reviewQueueCount,
    blockerCount: entityBlockers.length,
  };
}

function buildAlignedFieldMap(
  originalFieldMap: Record<string, FieldMapEntry>,
  alignedFields: FieldAlignmentResult[],
): Record<string, FieldMapEntry> {
  const result: Record<string, FieldMapEntry> = {};
  for (const f of alignedFields) {
    const original = originalFieldMap[f.bubbleField];
    if (!original) continue;

    // Preserve prior human attestation: if the original was approved
    // (needs_review=false) AND the verdict's recommended target+transform
    // still match what the human approved, keep needs_review=false.
    // align.ts's verdict is a SUGGESTION — once a reviewer signs off
    // (via patch script + --commit + --attested-by), the field is locked
    // until the suggestion changes shape (e.g. v3 column renamed,
    // requiring fresh review). This prevents auto_align re-runs from
    // silently downgrading approved fields back to needs_review.
    const humanApproved =
      original.needs_review === false &&
      original.target === f.targetColumn &&
      original.transform === f.transform;

    result[f.bubbleField] = {
      ...original,
      target: f.targetColumn,
      transform: f.transform,
      needs_review: humanApproved ? false : f.verdict !== "auto-confirm",
    };
  }
  return result;
}

// ─── computeApprovalHash ──────────────────────────────────────────────────────

/**
 * Compute a canonical-JSON SHA-256 hash of a mapping.
 * Canonical = alphabetically sorted keys, no whitespace variation.
 * Used as approval gate for Phase 3.5c.
 */
export function computeApprovalHash(mapping: unknown): string {
  const canonical = canonicalJSON(mapping);
  return createHash("sha256").update(canonical, "utf-8").digest("hex");
}

function canonicalJSON(value: unknown): string {
  if (value === undefined) return "null";
  if (value === null) return "null";
  if (typeof value === "boolean" || typeof value === "number") return JSON.stringify(value);
  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return "[" + value.map(canonicalJSON).join(",") + "]";
  }
  if (typeof value === "object") {
    // Sort keys alphabetically, skip undefined values (matches JSON.stringify behavior)
    const keys = Object.keys(value as object)
      .filter((k) => (value as Record<string, unknown>)[k] !== undefined)
      .sort();
    const pairs = keys.map((k) => {
      return JSON.stringify(k) + ":" + canonicalJSON((value as Record<string, unknown>)[k]);
    });
    return "{" + pairs.join(",") + "}";
  }
  return JSON.stringify(value);
}

// ─── Report generation ────────────────────────────────────────────────────────

function fillRateBucket(fillRate: number): "always" | "mostly" | "sparse" | "empty" {
  if (fillRate >= 1.0) return "always";
  if (fillRate > 0.5) return "mostly";
  if (fillRate > 0) return "sparse";
  return "empty";
}

function pct(fillRate: number): string {
  return `${Math.round(fillRate * 100)}%`;
}

/**
 * Generate a per-entity markdown alignment report.
 */
export function generateEntityReport(result: AlignmentResult): string {
  const {
    entity,
    targetTable,
    entityMatchStatus,
    alignmentStatus,
    fields,
    entityBlockers,
    totalRecordCount,
    autoConfirmedCount,
    droppedCount,
    reviewQueueCount,
    blockerCount,
  } = result;

  const targetDisplay =
    entityMatchStatus === "unmatched"
      ? "**unmatched**"
      : entityMatchStatus === "ambiguous"
      ? "**ambiguous**"
      : alignmentStatus === "blocked"
      ? `\`${targetTable}\` — **BLOCKED**`
      : `\`${targetTable}\``;

  const statusDisplay =
    alignmentStatus === "blocked"
      ? "🔴 BLOCKED"
      : alignmentStatus === "empty_attested"
      ? "🟡 empty_attested"
      : alignmentStatus === "unmatched"
      ? "🔴 unmatched"
      : "🟢 ok";

  const lines: string[] = [
    `# ${entity} alignment report`,
    "",
    `**Target table:** ${targetDisplay}`,
    `**Status:** ${statusDisplay} | confirmed: ${autoConfirmedCount} / dropped: ${droppedCount} / review: ${reviewQueueCount} / blockers: ${blockerCount}`,
    `**Bubble type:** \`${result.bubbleType}\``,
    `**Total records:** ${totalRecordCount}`,
    "",
    "## Summary",
    "",
    `- ${autoConfirmedCount} fields auto-confirmed (safe matches)`,
    `- ${droppedCount} fields dropped (no v3 equivalent)`,
    `- ${reviewQueueCount} fields in review queue (type conflicts, ambiguous, collisions)`,
    `- ${blockerCount} blockers (NOT NULL v3 columns without mapping)`,
    "",
  ];

  // Blockers section
  if (blockerCount > 0) {
    lines.push("## Blockers", "");
    lines.push("These v3 columns are NOT NULL with no DEFAULT and have no Bubble source field:");
    lines.push("");
    for (const col of entityBlockers) {
      lines.push(`- \`${col}\``);
    }
    lines.push("");
  }

  // Review queue
  const reviewFields = fields.filter((f) => f.verdict === "needs_review");
  if (reviewFields.length > 0) {
    lines.push("## Review queue", "");
    lines.push("| Bubble field | Proposed target | v3 type | Issue | Recommended action |");
    lines.push("|---|---|---|---|---|");
    for (const f of reviewFields) {
      const target = f.targetColumn ?? "(none)";
      const v3type = f.v3Type ?? "—";
      const issue = f.note ?? (f.ambiguous ? `collision with ${f.collisionWith}` : "—");
      const action = f.transform ? `transform: \`${f.transform}\`` : "manual decision required";
      lines.push(`| \`${f.bubbleField}\` | \`${target}\` | \`${v3type}\` | ${issue} | ${action} |`);
    }
    lines.push("");
  }

  // Dropped fields with fill-rate buckets
  const droppedFields = fields.filter((f) => f.verdict === "drop");
  if (droppedFields.length > 0) {
    lines.push("## Dropped fields", "");

    const buckets = {
      always: droppedFields.filter((f) => fillRateBucket(f.fillRate) === "always"),
      mostly: droppedFields.filter((f) => fillRateBucket(f.fillRate) === "mostly"),
      sparse: droppedFields.filter((f) => fillRateBucket(f.fillRate) === "sparse"),
      empty: droppedFields.filter((f) => fillRateBucket(f.fillRate) === "empty"),
    };

    function renderBucket(label: string, bfields: FieldAlignmentResult[]) {
      if (bfields.length === 0) return;
      lines.push(`### ${label}`, "");
      lines.push("| Bubble field | Occurrence | Reason |");
      lines.push("|---|---|---|");
      for (const f of bfields) {
        const reason = f.note ?? "No matching v3 column";
        lines.push(`| \`${f.bubbleField}\` | ${f.fillRate === 0 ? 0 : `${pct(f.fillRate)}`} | ${reason} |`);
      }
      lines.push("");
    }

    renderBucket("Always populated (100%)", buckets.always);
    renderBucket("Mostly populated (>50%)", buckets.mostly);
    renderBucket("Sparse (<50%)", buckets.sparse);
    renderBucket("Empty (0%)", buckets.empty);
  }

  // Auto-confirmed fields (collapsible)
  const confirmedFields = fields.filter((f) => f.verdict === "auto-confirm");
  if (confirmedFields.length > 0) {
    lines.push("## Auto-confirmed fields", "");
    lines.push("<details>");
    lines.push(`<summary>Show ${confirmedFields.length} fields</summary>`, "");
    lines.push("| Bubble field | Target column | v3 type | Transform |");
    lines.push("|---|---|---|---|");
    for (const f of confirmedFields) {
      const transform = f.transform ?? "—";
      const warning = f.warning ? ` ⚠️ ${f.warning}` : "";
      lines.push(
        `| \`${f.bubbleField}\` | \`${f.targetColumn}\` | \`${f.v3Type}\` | ${transform}${warning} |`,
      );
    }
    lines.push("</details>", "");
  }

  return lines.join("\n");
}

/**
 * Generate the summary dashboard markdown.
 */
export function generateSummaryReport(
  results: AlignmentResult[],
  schemaHash: string,
  timestamp: string,
): string {
  const blocked = results.filter((r) => r.alignmentStatus === "blocked");
  const unmatched = results.filter((r) => r.alignmentStatus === "unmatched");
  const emptyAttested = results.filter((r) => r.alignmentStatus === "empty_attested");
  const ready = results.filter(
    (r) =>
      r.alignmentStatus === "ok" ||
      (r.alignmentStatus !== "blocked" &&
        r.alignmentStatus !== "unmatched" &&
        r.alignmentStatus !== "empty_attested"),
  );

  const lines: string[] = [
    `# Auto-align summary — ${timestamp}`,
    "",
    `**v3_schema_hash:** \`${schemaHash}\``,
    "**Shadow output:** `mappings/.aligned/`",
    "",
  ];

  if (blocked.length > 0) {
    lines.push("## BLOCKED entities", "");
    lines.push("These entities have NOT NULL v3 columns with no Bubble source field. Must resolve before migration.", "");
    for (const r of blocked) {
      lines.push(`- **${r.entity}** → \`${r.targetTable}\` — blockers: ${r.entityBlockers.join(", ")}`);
    }
    lines.push("");
  }

  if (unmatched.length > 0) {
    lines.push("## Unmatched entities", "");
    lines.push("No v3 table was found — human table selection required.", "");
    for (const r of unmatched) {
      lines.push(`- **${r.entity}** (bubble_type: \`${r.bubbleType}\`)`);
    }
    lines.push("");
  }

  if (emptyAttested.length > 0) {
    lines.push("## Empty-attested entities", "");
    lines.push("No data to migrate for this workspace. Mapping preserved for future runs.", "");
    for (const r of emptyAttested) {
      lines.push(`- **${r.entity}** → \`${r.targetTable}\``);
    }
    lines.push("");
  }

  // LOW confidence fuzzy matches need human validation
  const lowConfidenceMatches = results.filter(
    (r) => r.matchConfidence === "LOW" && r.entityMatchStatus === "matched",
  );

  if (lowConfidenceMatches.length > 0) {
    lines.push("## Low-confidence table matches (review required)", "");
    lines.push("These were fuzzy-matched by Levenshtein distance. Verify each target table is correct.", "");
    lines.push("| Entity | Proposed target | Bubble type |");
    lines.push("|--------|-----------------|-------------|");
    for (const r of lowConfidenceMatches) {
      lines.push(`| ${r.entity} | \`${r.targetTable}\` | \`${r.bubbleType}\` |`);
    }
    lines.push("");
  }

  if (ready.length > 0) {
    lines.push("## Ready for review", "");
    lines.push("| Entity | Target | Confidence | Confirmed | Dropped | Review queue | Blockers |");
    lines.push("|--------|--------|------------|-----------|---------|--------------|----------|");
    for (const r of ready) {
      lines.push(
        `| ${r.entity} | \`${r.targetTable}\` | ${r.matchConfidence ?? "—"} | ${r.autoConfirmedCount} | ${r.droppedCount} | ${r.reviewQueueCount} | ${r.blockerCount} |`,
      );
    }
    lines.push("");
  }

  // Strategic decisions section
  const strategicDecisions: string[] = [];

  // Detect subtasks fold candidate
  const subtasksResult = results.find((r) => r.entity === "subtasks");
  if (subtasksResult) {
    strategicDecisions.push(
      "**subtasks**: fold into `task.parent_id`? If v3 `task` table has `parent_id`, consider folding instead of a separate subtask table. (yes/no)",
    );
  }

  // Flag entities in review queue with >5 items needing decisions
  for (const r of results) {
    if (r.reviewQueueCount > 5 && r.alignmentStatus === "ok") {
      strategicDecisions.push(
        `**${r.entity}**: ${r.reviewQueueCount} fields in review queue — batch decisions needed`,
      );
    }
  }

  if (strategicDecisions.length > 0) {
    lines.push("## Strategic decisions needed", "");
    for (const d of strategicDecisions) {
      lines.push(`- ${d}`);
    }
    lines.push("");
  }

  // Totals
  const totalConfirmed = results.reduce((s, r) => s + r.autoConfirmedCount, 0);
  const totalDropped = results.reduce((s, r) => s + r.droppedCount, 0);
  const totalReview = results.reduce((s, r) => s + r.reviewQueueCount, 0);
  const totalBlockers = results.reduce((s, r) => s + r.blockerCount, 0);

  lines.push("## Totals", "");
  lines.push(`- **Entities processed:** ${results.length}`);
  lines.push(`- **Auto-confirmed fields:** ${totalConfirmed}`);
  lines.push(`- **Dropped fields:** ${totalDropped}`);
  lines.push(`- **Review queue:** ${totalReview}`);
  lines.push(`- **Blockers:** ${totalBlockers}`);
  lines.push("");

  return lines.join("\n");
}
