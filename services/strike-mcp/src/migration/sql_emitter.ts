import type { EmittedRow } from "./types.js";

export interface SqlMeta {
  entity: string;
  workspaceId: string;
  workspaceSlug: string;
  generatedAt: string;
  bubbleSourceRevision?: string;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function escapeString(s: string): string {
  return `'${s.replace(/'/g, "''")}'`;
}

function isUuidArray(arr: unknown[]): arr is string[] {
  if (arr.length === 0) return true; // empty → treat as uuid[] (caller decides to emit ARRAY[]::uuid[])
  return arr.every((v) => typeof v === "string" && UUID_PATTERN.test(v));
}

function literal(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "string") return escapeString(value);
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "NULL";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (Array.isArray(value)) {
    // Emit as uuid[] array literal when all elements are UUIDs (or array is empty)
    if (isUuidArray(value)) {
      if (value.length === 0) return "ARRAY[]::uuid[]";
      const uuids = value.map((u) => `'${u}'`).join(",");
      return `ARRAY[${uuids}]::uuid[]`;
    }
    // Fallback: JSON-serialize as jsonb
    return escapeString(JSON.stringify(value));
  }
  // Objects — JSON-serialize then quote (Postgres jsonb)
  return escapeString(JSON.stringify(value));
}

export function emitSql(rows: EmittedRow[], meta: SqlMeta): string {
  const header = [
    "-- strike-mcp generated migration",
    `-- entity: ${meta.entity}`,
    `-- workspace: ${meta.workspaceId}`,
    `-- workspace_slug: ${meta.workspaceSlug}`,
    `-- generated: ${meta.generatedAt}`,
    `-- rows: ${rows.length}`,
    meta.bubbleSourceRevision ? `-- source bubble revision: ${meta.bubbleSourceRevision}` : null,
    "-- REVIEW BEFORE APPLYING",
    "",
  ]
    .filter((l) => l !== null)
    .join("\n");

  const inserts = rows.map((row) => {
    const cols = Object.keys(row.values);
    const vals = cols.map((c) => literal(row.values[c]));
    return `INSERT INTO ${row.table} (${cols.join(", ")}) VALUES (${vals.join(", ")});`;
  });

  return ["BEGIN;", "", header, ...inserts, "", "COMMIT;", ""].join("\n");
}
