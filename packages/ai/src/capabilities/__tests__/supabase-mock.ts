/**
 * supabase-mock.ts — Schema-validated Supabase test mock (L-0087 ship-block).
 *
 * L-0081 established that chainable-proxy mocks silently echo any column
 * name, hiding schema-divergence from unit tests. L-0087 generalized the
 * pattern: every additive migration re-opens the trap at N new columns.
 *
 * This helper replaces the chainable proxy with a schema-validated stub.
 * At `.select('a, b, c')` or `.insert({...})` calls, the mock verifies
 * every referenced column exists in the Zod schema for that table. Unknown
 * columns throw with a clear message naming the offending table + column.
 *
 * Design:
 *   - TABLE_SCHEMAS is hand-maintained per migration. New column → add
 *     to schema. Removed column → remove from schema. Migration PR must
 *     include the schema update.
 *   - Schemas are intentionally the minimal subset used by capability
 *     tests, not full Database["public"]["Tables"] mirrors. Keep narrow,
 *     extend as tests need new columns.
 *   - The mock remains chainable for ergonomics; it just fails loudly
 *     when a test claims a column that does not exist.
 *
 * Update protocol: when `supabase/migrations/**` adds/removes a column
 * referenced by any capability test, update the corresponding table's
 * schema below in the same PR. `pnpm db:gen-types` is the source of
 * truth for column names — copy from there.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { vi } from "vitest";
import { z } from "zod";

// ── Known table schemas ────────────────────────────────────────────
// Minimal subset of columns used by capability tests. Keep narrow; extend
// per test need, not per "this column exists in production" urge.

const CHANNEL_SCHEMA = z.object({
  id: z.string().uuid(),
  workspace_id: z.string().uuid(),
  channel_type: z.string(),
  helpdesk_enabled: z.boolean().optional(),
  privacy_mode: z.enum(["public", "private_per_requester"]).nullable().optional(),
  responsible_profile_id: z.string().uuid().nullable().optional(),
  parent_channel_id: z.string().uuid().nullable().optional(),
  name: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
  created_by: z.string().uuid().nullable().optional(),
});

const CHANNEL_MEMBER_SCHEMA = z.object({
  channel_id: z.string().uuid(),
  profile_id: z.string().uuid(),
  workspace_id: z.string().uuid(),
  role: z.string(),
  left_at: z.string().nullable().optional(),
});

// ADR-0166 added classification_metadata / redacted_at / original_content_hash
// to support the soft-hold PII classifier. Every capability test that touches
// channel_message must declare these columns (L-0087 ship-block) so schema
// divergence surfaces loudly in unit tests rather than silently at runtime.
const CHANNEL_MESSAGE_SCHEMA = z.object({
  id: z.string().uuid(),
  channel_id: z.string().uuid(),
  workspace_id: z.string().uuid(),
  sender_id: z.string().uuid().nullable().optional(),
  content: z.string().nullable().optional(),
  classification_metadata: z.record(z.unknown()).nullable().optional(),
  redacted_at: z.string().nullable().optional(),
  original_content_hash: z.string().nullable().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

const ENGINE_STATE_SCHEMA = z.object({
  id: z.string().uuid(),
  workspace_id: z.string().uuid(),
  process_id: z.string(),
  entity_type: z.string().optional(),
  entity_id: z.string().optional(),
  assignee_id: z.string().uuid().nullable().optional(),
  current_step: z.number().optional(),
  status: z.string(),
  context: z.record(z.unknown()).optional(),
  started_at: z.string().optional(),
  completed_at: z.string().nullable().optional(),
  updated_at: z.string().optional(),
});

const WORKSPACE_SCHEMA = z.object({
  workspace_id: z.string().uuid(),
  company_id: z.string().uuid().nullable().optional(),
  name: z.string().optional(),
});

const COMPANY_MEMBER_SCHEMA = z.object({
  user_id: z.string().uuid(),
  company_id: z.string().uuid(),
  role: z.string(),
});

const PROFILE_SCHEMA = z.object({
  profile_id: z.string().uuid(),
  user_id: z.string().uuid().nullable().optional(),
  workspace_id: z.string().uuid(),
  display_name: z.string().nullable().optional(),
  avatar_url: z.string().nullable().optional(),
  role: z.string().optional(),
  is_active: z.boolean().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

// ADR-0229 / T9 — observer-resolver chain reads team_member → team. Minimal
// subset of columns the resolver actually reads (no need for color/icon/etc).
const TEAM_SCHEMA = z.object({
  team_id: z.string().uuid(),
  workspace_id: z.string().uuid(),
  leader_profile_id: z.string().uuid().nullable().optional(),
  name: z.string().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

const TEAM_MEMBER_SCHEMA = z.object({
  team_member_id: z.string().uuid().optional(),
  team_id: z.string().uuid(),
  profile_id: z.string().uuid(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

// Gate G5 (2026-04-22) added lineage + lifecycle columns.
// Minimal subset — fork/publish/deprecate tests touch these columns;
// extend as new tests need them. `is_system` is immutable (trigger G3).
const CONTRACT_TEMPLATE_SCHEMA = z.object({
  template_id: z.string().uuid(),
  workspace_id: z.string().uuid().nullable().optional(),
  name: z.string(),
  description: z.string().nullable().optional(),
  is_system: z.boolean().nullable().optional(),
  is_active: z.boolean().nullable().optional(),
  version: z.number().nullable().optional(),
  // Lineage + lifecycle (Gate G5)
  source_template_id: z.string().uuid().nullable().optional(),
  source_template_version: z.string().nullable().optional(),
  forked_at: z.string().nullable().optional(),
  published_at: z.string().nullable().optional(),
  deprecated_at: z.string().nullable().optional(),
  // Content (not asserted in Gate G4 tool tests, but present on the row)
  contract_type: z.string().optional(),
  language: z.string().optional(),
  content_html: z.string().nullable().optional(),
  content_css: z.string().nullable().optional(),
  header_html: z.string().nullable().optional(),
  footer_html: z.string().nullable().optional(),
  placeholders: z.unknown().optional(),
  employment_category: z.string().nullable().optional(),
  created_by: z.string().uuid().nullable().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

const TABLE_SCHEMAS: Record<string, z.ZodObject<z.ZodRawShape>> = {
  channel: CHANNEL_SCHEMA,
  channel_member: CHANNEL_MEMBER_SCHEMA,
  channel_message: CHANNEL_MESSAGE_SCHEMA,
  engine_state: ENGINE_STATE_SCHEMA,
  workspace: WORKSPACE_SCHEMA,
  company_member: COMPANY_MEMBER_SCHEMA,
  profile: PROFILE_SCHEMA,
  contract_template: CONTRACT_TEMPLATE_SCHEMA,
  team: TEAM_SCHEMA,
  team_member: TEAM_MEMBER_SCHEMA,
};

// ── Validators ─────────────────────────────────────────────────────

/**
 * Throw if any column in the select spec is unknown to the table's schema.
 * Accepts comma-separated lists and nested relation forms like
 * `id, channel:channel(id, name)` — but only validates bare column names
 * at the top level of the spec.
 */
function validateSelectColumns(table: string, spec: string): void {
  const schema = TABLE_SCHEMAS[table];
  if (!schema) {
    throw new Error(
      `supabase-mock: unknown table '${table}'. Add a Zod schema in TABLE_SCHEMAS before using this table in tests.`,
    );
  }
  const known = new Set(Object.keys(schema.shape));
  if (spec === "*") return;

  // Strip nested relation forms to get the top-level column list.
  const topLevel = spec.replace(/\w+:\w+\([^)]*\)/g, "").replace(/\w+\([^)]*\)/g, "");
  const columns = topLevel
    .split(",")
    .map((c) => c.trim().split(/\s+/)[0])
    .filter((c) => c && !c.includes(":") && !c.includes("("));

  for (const col of columns) {
    if (!col) continue;
    if (col === "*") continue;
    if (!known.has(col)) {
      throw new Error(
        `supabase-mock: unknown column '${col}' on table '${table}'. Known columns: ${[...known].join(", ")}. Did you rename in a migration?`,
      );
    }
  }
}

/** Throw if an insert/update/upsert row contains columns not in schema. */
function validateRowShape(table: string, row: Record<string, unknown>, op: string): void {
  const schema = TABLE_SCHEMAS[table];
  if (!schema) {
    throw new Error(
      `supabase-mock: unknown table '${table}' for ${op}. Add schema before testing.`,
    );
  }
  const known = new Set(Object.keys(schema.shape));
  for (const key of Object.keys(row)) {
    if (!known.has(key)) {
      throw new Error(
        `supabase-mock: ${op} on '${table}' with unknown column '${key}'. Known: ${[...known].join(", ")}.`,
      );
    }
  }
}

// ── Chainable builder ──────────────────────────────────────────────

type MockRow = Record<string, unknown>;
type MockResult = { data: MockRow | MockRow[] | null; error: unknown | null };

/**
 * Build a chainable stub for one table's query flow. Validates column names
 * on `.select(...)` and row shape on `.insert(...)` / `.update(...)` /
 * `.upsert(...)`. All chain methods return the same proxy so fluent call
 * chains work (`.eq(...).eq(...).single()`).
 */
function chainableForTable(table: string, result: MockResult) {
  const proxy: Record<string, unknown> = {};
  const methods = [
    "eq",
    "in",
    "ilike",
    "neq",
    "order",
    "limit",
    "gte",
    "lte",
    "gt",
    "lt",
    "or",
    "filter",
    "is",
  ];
  for (const m of methods) proxy[m] = vi.fn().mockReturnValue(proxy);

  proxy.select = vi.fn((spec?: string) => {
    if (spec) validateSelectColumns(table, spec);
    return proxy;
  });

  proxy.insert = vi.fn((row: MockRow | MockRow[]) => {
    const rows = Array.isArray(row) ? row : [row];
    for (const r of rows) validateRowShape(table, r, "insert");
    return proxy;
  });

  proxy.update = vi.fn((row: MockRow) => {
    validateRowShape(table, row, "update");
    return proxy;
  });

  proxy.upsert = vi.fn((row: MockRow) => {
    validateRowShape(table, row, "upsert");
    return proxy;
  });

  proxy.delete = vi.fn().mockReturnValue(proxy);
  proxy.maybeSingle = vi.fn().mockResolvedValue(result);
  proxy.single = vi.fn().mockResolvedValue(result);

  // Terminal awaits without .single() / .maybeSingle():
  (proxy as { then?: (resolve: (r: MockResult) => void) => void }).then = (resolve) =>
    resolve(result);

  return proxy;
}

// ── Public API ─────────────────────────────────────────────────────

export type TableMocks = Record<
  string,
  MockResult | ((callIndex: number) => MockResult) | Array<MockResult> // per-call results
>;

/**
 * Build a mock SupabaseClient whose `.from(table)` returns a schema-validated
 * chainable stub. Configure each table's result (or sequence of results)
 * via the `tables` argument.
 *
 * Usage:
 *   const sb = mockSupabase({
 *     channel: { data: { id: ..., workspace_id: ..., channel_type: 'desk', helpdesk_enabled: true }, error: null },
 *     engine_state: { data: { id: ..., started_at: '2026-04-20T10:00:00Z', ... }, error: null },
 *   });
 *
 * Per-call sequence (for tests where the same table is queried multiple times):
 *   channel: [
 *     { data: firstDesk, error: null },
 *     { data: newThread, error: null },
 *   ]
 */
export function mockSupabase(tables: TableMocks = {}): SupabaseClient {
  const callCounts: Record<string, number> = {};

  const from = vi.fn((name: string) => {
    const config = tables[name];
    if (!config) {
      // Unknown table returns an error so tests fail loudly rather than silently.
      return chainableForTable(name, {
        data: null,
        error: { message: `supabase-mock: table '${name}' has no configured result` },
      });
    }

    const callIndex = callCounts[name] ?? 0;
    callCounts[name] = callIndex + 1;

    let result: MockResult;
    if (Array.isArray(config)) {
      const last = config[config.length - 1];
      if (!last) {
        throw new Error(`supabase-mock: table '${name}' configured with empty array`);
      }
      result = config[callIndex] ?? last;
    } else if (typeof config === "function") {
      result = config(callIndex);
    } else {
      result = config;
    }

    return chainableForTable(name, result);
  });

  return { from } as unknown as SupabaseClient;
}

/** Re-export for tests that want to assert against the table schemas directly. */
export { TABLE_SCHEMAS };
