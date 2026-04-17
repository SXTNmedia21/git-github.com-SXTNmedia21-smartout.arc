/**
 * v3_schema.ts
 *
 * Parses Supabase migration SQL files into a typed V3Schema describing all
 * public (and other) tables with their columns, primary keys, nullability,
 * defaults, and foreign keys.
 *
 * OUT OF SCOPE (TODO for future phases):
 *   - CHECK constraints
 *   - Indexes (CREATE INDEX, CREATE UNIQUE INDEX)
 *   - Triggers
 *   - RLS policies and grants
 *   - Views and materialized views
 *   - Functions, stored procedures, RPCs
 *   - ALTER TABLE RENAME COLUMN
 *   - ALTER TABLE ALTER COLUMN TYPE
 *   - ALTER TABLE ADD CONSTRAINT (non-FK)
 *   - Enum types (CREATE TYPE ... AS ENUM)
 *   - Schemas other than the ones already appearing in CREATE TABLE
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import {
  computeV3SchemaHash,
  readAndSortMigrationFiles,
} from "./schema_hash.js";

// ─── Exported interfaces ───────────────────────────────────────────────────

export interface V3Column {
  name: string;
  type: string; // raw type text like "uuid", "text", "timestamptz", "uuid[]"
  nullable: boolean;
  is_primary_key: boolean;
  is_array: boolean;
  default_expr: string | null; // raw default expression text or null
  foreign_key: { table: string; column: string } | null;
}

export interface V3Table {
  schema: string; // "public", "auth", etc.
  name: string; // "workspace", "profile", etc.
  qualified_name: string; // "public.workspace"
  columns: Record<string, V3Column>; // keyed by column name
}

export interface V3Schema {
  tables: Record<string, V3Table>; // keyed by qualified_name
  computed_at: string; // ISO timestamp
  schema_hash: string; // from computeV3SchemaHash
  source_file_count: number;
}

// ─── Internal helpers ──────────────────────────────────────────────────────

/**
 * Strip single-line (--) and multi-line (/* *\/) comments from SQL text.
 */
function stripComments(sql: string): string {
  // Remove block comments first (non-greedy)
  let result = sql.replace(/\/\*[\s\S]*?\*\//g, " ");
  // Remove line comments
  result = result.replace(/--[^\n]*/g, "");
  return result;
}

/**
 * Normalize whitespace for easier regex matching.
 */
function normalize(sql: string): string {
  return sql.replace(/\s+/g, " ").trim();
}

/**
 * Parse a fully-qualified table name like "public.workspace" or just "workspace".
 * Returns { schema, name, qualified_name }.
 */
function parseQualifiedName(raw: string): {
  schema: string;
  name: string;
  qualified_name: string;
} {
  const parts = raw.trim().split(".");
  if (parts.length === 2) {
    const schema = parts[0].trim();
    const name = parts[1].trim();
    return { schema, name, qualified_name: `${schema}.${name}` };
  }
  // No schema qualifier → assume "public"
  return {
    schema: "public",
    name: parts[0].trim(),
    qualified_name: `public.${parts[0].trim()}`,
  };
}

/**
 * Parse a raw SQL type string into { type, is_array }.
 * Handles "uuid[]", "text[]", "uuid ARRAY", etc.
 * All other types are returned as-is (lowercased).
 */
function parseType(rawType: string): { type: string; is_array: boolean } {
  let t = rawType.trim().toLowerCase();
  // Handle ARRAY keyword
  const isArrayKeyword = /\barray\b/.test(t);
  t = t.replace(/\barray\b/g, "").trim();
  // Handle [] suffix
  const isArraySuffix = t.endsWith("[]");
  if (isArraySuffix) {
    t = t.slice(0, -2).trim();
  }
  const is_array = isArrayKeyword || isArraySuffix;
  // Strip precision/length modifiers like (6), (255), (10, 2)
  t = t.replace(/\(\s*\d+(?:\s*,\s*\d+)?\s*\)/, "").trim();
  return { type: t, is_array };
}

/**
 * Find the matching closing parenthesis index in `text` starting from `openIdx`.
 * Returns -1 if not found.
 */
function findMatchingParen(text: string, openIdx: number): number {
  let depth = 0;
  for (let i = openIdx; i < text.length; i++) {
    if (text[i] === "(") depth++;
    else if (text[i] === ")") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/**
 * Extract the body (content between outermost parens) of a CREATE TABLE statement.
 * `sql` should be the full SQL text with the CREATE TABLE header already consumed up to the opening paren.
 */
function extractCreateTableBody(
  fullSql: string,
  startSearchFrom: number,
): { body: string; endIdx: number } | null {
  const openIdx = fullSql.indexOf("(", startSearchFrom);
  if (openIdx === -1) return null;
  const closeIdx = findMatchingParen(fullSql, openIdx);
  if (closeIdx === -1) return null;
  return {
    body: fullSql.slice(openIdx + 1, closeIdx),
    endIdx: closeIdx,
  };
}

/**
 * Split column definitions by top-level commas (not inside nested parens).
 */
function splitTopLevelCommas(body: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (ch === "(") {
      depth++;
      current += ch;
    } else if (ch === ")") {
      depth--;
      current += ch;
    } else if (ch === "," && depth === 0) {
      parts.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

/**
 * Parse a DEFAULT expression value. Returns the raw expression text.
 * Handles parenthesized defaults like DEFAULT (now() + interval '7 days').
 */
function parseDefaultExpr(tokenStr: string): string {
  return tokenStr.trim();
}

/**
 * Parse a single column definition token string into a V3Column.
 * Returns null if this is a table constraint (CONSTRAINT, PRIMARY KEY, FOREIGN KEY, etc.)
 */
function parseColumnDef(
  rawDef: string,
): V3Column | { isTableConstraint: true; raw: string } | null {
  const def = normalize(rawDef);
  if (!def) return null;

  // Skip table-level constructs
  const upperDef = def.toUpperCase();
  if (
    upperDef.startsWith("CONSTRAINT ") ||
    upperDef.startsWith("PRIMARY KEY ") ||
    upperDef.startsWith("FOREIGN KEY ") ||
    upperDef.startsWith("UNIQUE ") ||
    upperDef.startsWith("CHECK ") ||
    upperDef.startsWith("EXCLUDE ")
  ) {
    return { isTableConstraint: true, raw: def };
  }

  // A column definition starts with a valid identifier (possibly quoted)
  // Extract column name
  let rest = def;
  let colName: string;

  if (rest.startsWith('"')) {
    // Quoted identifier
    const closeQuote = rest.indexOf('"', 1);
    if (closeQuote === -1) return null;
    colName = rest.slice(1, closeQuote);
    rest = rest.slice(closeQuote + 1).trim();
  } else {
    // Unquoted identifier — ends at first whitespace
    const spaceIdx = rest.search(/\s/);
    if (spaceIdx === -1) return null;
    colName = rest.slice(0, spaceIdx).toLowerCase();
    rest = rest.slice(spaceIdx).trim();
  }

  // The type follows next. We need to extract it carefully because it may
  // include array markers, type modifiers, etc.
  // Strategy: consume tokens until we hit a keyword we recognize.
  const keywords = [
    "NOT NULL",
    "NULL",
    "DEFAULT",
    "PRIMARY KEY",
    "REFERENCES",
    "UNIQUE",
    "CHECK",
  ];

  // Find where the type ends: first occurrence of any keyword (case-insensitive)
  let typeEnd = rest.length;
  const restUpper = rest.toUpperCase();
  for (const kw of keywords) {
    const idx = restUpper.indexOf(kw);
    if (idx !== -1 && idx < typeEnd) {
      typeEnd = idx;
    }
  }

  const rawType = rest.slice(0, typeEnd).trim();
  rest = rest.slice(typeEnd).trim();

  if (!rawType) return null;

  const { type, is_array } = parseType(rawType);

  // Parse modifiers
  let nullable = true;
  let is_primary_key = false;
  let default_expr: string | null = null;
  let foreign_key: { table: string; column: string } | null = null;

  const restUpper2 = rest.toUpperCase();

  // NOT NULL
  if (restUpper2.includes("NOT NULL")) nullable = false;

  // PRIMARY KEY
  if (restUpper2.includes("PRIMARY KEY")) {
    is_primary_key = true;
    nullable = false;
  }

  // DEFAULT <expr>
  const defaultMatch = rest.match(
    /DEFAULT\s+((?:'[^']*'|\([^)]*\)|[^\s,]+)(?:\s*\+\s*(?:'[^']*'|\([^)]*\)|[^\s,]+))*)/i,
  );
  if (defaultMatch) {
    default_expr = parseDefaultExpr(defaultMatch[1]);
  }

  // REFERENCES <table>(<col>)
  const refsMatch = rest.match(/REFERENCES\s+([\w.]+)\s*\(\s*([\w]+)\s*\)/i);
  if (refsMatch) {
    const refTable = refsMatch[1];
    const refCol = refsMatch[2];
    foreign_key = { table: refTable, column: refCol };
  }

  return {
    name: colName,
    type,
    nullable,
    is_primary_key,
    is_array,
    default_expr,
    foreign_key,
  };
}

/**
 * Handle table-level constraint and update columns accordingly.
 * Modifies `columns` in-place.
 */
function applyTableConstraint(
  raw: string,
  columns: Record<string, V3Column>,
): void {
  const def = normalize(raw).toUpperCase();

  // PRIMARY KEY (col1, col2, ...)
  const pkMatch = raw.match(/PRIMARY\s+KEY\s*\(([^)]+)\)/i);
  if (pkMatch) {
    const pkCols = pkMatch[1].split(",").map((c) => c.trim().toLowerCase());
    for (const col of pkCols) {
      if (columns[col]) {
        columns[col].is_primary_key = true;
        columns[col].nullable = false;
      }
    }
    return;
  }

  // FOREIGN KEY (col) REFERENCES table(col)
  const fkMatch = raw.match(
    /FOREIGN\s+KEY\s*\(\s*([\w"]+)\s*\)\s+REFERENCES\s+([\w.]+)\s*\(\s*([\w]+)\s*\)/i,
  );
  if (fkMatch) {
    const colName = fkMatch[1].replace(/"/g, "").toLowerCase();
    const refTable = fkMatch[2];
    const refCol = fkMatch[3];
    if (columns[colName]) {
      columns[colName].foreign_key = { table: refTable, column: refCol };
    }
    return;
  }

  void def; // suppress unused var warning
}

/**
 * Parse the body of a CREATE TABLE statement, returning a Record<string, V3Column>.
 */
function parseTableBody(body: string): Record<string, V3Column> {
  const columns: Record<string, V3Column> = {};
  const defs = splitTopLevelCommas(body);

  // First pass: parse column definitions
  const tableConstraints: string[] = [];
  for (const rawDef of defs) {
    const result = parseColumnDef(rawDef);
    if (result === null) continue;
    if ("isTableConstraint" in result) {
      tableConstraints.push(result.raw);
    } else {
      columns[result.name] = result;
    }
  }

  // Second pass: apply table-level constraints
  for (const constraint of tableConstraints) {
    applyTableConstraint(constraint, columns);
  }

  return columns;
}

/**
 * Parse an ALTER TABLE ... ADD COLUMN statement and return the column.
 */
function parseAlterAddColumn(stmt: string): {
  qualifiedTable: string;
  column: V3Column;
} | null {
  // Match: ALTER TABLE [IF EXISTS] <table> ADD COLUMN [IF NOT EXISTS] <col_def>
  const m = stmt.match(
    /ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?([\w.]+)\s+ADD\s+COLUMN\s+(?:IF\s+NOT\s+EXISTS\s+)?(.+)/is,
  );
  if (!m) return null;

  const { qualified_name } = parseQualifiedName(m[1]);
  const colDefRaw = m[2].trim().replace(/;$/, "").trim();
  const result = parseColumnDef(colDefRaw);
  if (!result || "isTableConstraint" in result) return null;

  return { qualifiedTable: qualified_name, column: result };
}

/**
 * Parse an ALTER TABLE ... DROP COLUMN statement.
 */
function parseAlterDropColumn(stmt: string): {
  qualifiedTable: string;
  columnName: string;
} | null {
  const m = stmt.match(
    /ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?([\w.]+)\s+DROP\s+COLUMN\s+(?:IF\s+EXISTS\s+)?(\w+)/is,
  );
  if (!m) return null;
  const { qualified_name } = parseQualifiedName(m[1]);
  return { qualifiedTable: qualified_name, columnName: m[2].toLowerCase() };
}

// ─── Main parser ───────────────────────────────────────────────────────────

/**
 * Parse one SQL file's content and accumulate into the tables map.
 * Processes CREATE TABLE and ALTER TABLE ADD/DROP COLUMN in document order.
 */
function parseSqlContent(
  sql: string,
  tables: Record<string, V3Table>,
): void {
  const clean = stripComments(sql);

  // We process the file character by character to find top-level statements.
  // Strategy: split on semicolons that are at depth 0 (not inside parens or strings).
  const statements = splitStatements(clean);

  for (const rawStmt of statements) {
    const stmt = normalize(rawStmt);
    if (!stmt) continue;

    const upperStmt = stmt.toUpperCase();

    // ── CREATE TABLE ──
    if (
      upperStmt.startsWith("CREATE TABLE ") ||
      upperStmt.startsWith("CREATE TABLE IF NOT EXISTS ")
    ) {
      // Extract table name
      const m = stmt.match(
        /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([\w.]+)\s*\(/i,
      );
      if (!m) continue;

      const { schema, name, qualified_name } = parseQualifiedName(m[1]);

      // Find the opening paren position in the original (non-normalized) clean text
      // We use the normalized stmt to extract body
      const openParenIdx = stmt.indexOf("(", m[0].length - 1);
      if (openParenIdx === -1) continue;

      const bodyResult = extractCreateTableBody(stmt, openParenIdx);
      if (!bodyResult) continue;

      const columns = parseTableBody(bodyResult.body);

      // If table already exists (e.g. CREATE TABLE IF NOT EXISTS in a later migration),
      // only add new columns, don't overwrite existing.
      if (tables[qualified_name]) {
        for (const [colName, col] of Object.entries(columns)) {
          if (!tables[qualified_name].columns[colName]) {
            tables[qualified_name].columns[colName] = col;
          }
        }
      } else {
        tables[qualified_name] = { schema, name, qualified_name, columns };
      }
      continue;
    }

    // ── ALTER TABLE ADD COLUMN ──
    if (upperStmt.includes("ADD COLUMN")) {
      const result = parseAlterAddColumn(stmt);
      if (result) {
        const table = tables[result.qualifiedTable];
        if (table) {
          table.columns[result.column.name] = result.column;
        }
        // If table not found, it may be in a schema we don't track — ignore.
      }
      continue;
    }

    // ── ALTER TABLE DROP COLUMN ──
    if (upperStmt.includes("DROP COLUMN")) {
      const result = parseAlterDropColumn(stmt);
      if (result) {
        const table = tables[result.qualifiedTable];
        if (table) {
          delete table.columns[result.columnName];
        }
      }
      continue;
    }
  }
}

/**
 * Split SQL text into individual statements by semicolons at depth 0.
 * Handles nested parentheses. Does NOT handle string literals fully,
 * but is sufficient for DDL migration files.
 */
function splitStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = "";
  let depth = 0;
  let inSingleQuote = false;
  let inDollarQuote = false;
  let dollarTag = "";

  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];

    // Dollar-quoting detection (PostgreSQL specific: $$, $tag$)
    if (!inSingleQuote && !inDollarQuote && ch === "$") {
      const tagEnd = sql.indexOf("$", i + 1);
      if (tagEnd !== -1) {
        const tag = sql.slice(i, tagEnd + 1);
        // Check if it's a valid dollar-quote tag
        if (/^\$[A-Za-z_]*\$$/.test(tag)) {
          inDollarQuote = true;
          dollarTag = tag;
          current += sql.slice(i, tagEnd + 1);
          i = tagEnd;
          continue;
        }
      }
    }
    if (inDollarQuote) {
      current += ch;
      if (sql.startsWith(dollarTag, i)) {
        current += sql.slice(i + 1, i + dollarTag.length);
        i += dollarTag.length - 1;
        inDollarQuote = false;
        dollarTag = "";
      }
      continue;
    }

    if (ch === "'" && !inSingleQuote) {
      inSingleQuote = true;
      current += ch;
      continue;
    }
    if (ch === "'" && inSingleQuote) {
      // Check for escaped single quote ('')
      if (sql[i + 1] === "'") {
        current += "''";
        i++;
      } else {
        inSingleQuote = false;
        current += ch;
      }
      continue;
    }

    if (inSingleQuote) {
      current += ch;
      continue;
    }

    if (ch === "(") {
      depth++;
      current += ch;
    } else if (ch === ")") {
      depth--;
      current += ch;
    } else if (ch === ";" && depth === 0) {
      const trimmed = current.trim();
      if (trimmed) statements.push(trimmed);
      current = "";
    } else {
      current += ch;
    }
  }
  const trimmed = current.trim();
  if (trimmed) statements.push(trimmed);
  return statements;
}

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * Parse an ordered list of migration file paths into a V3Schema.
 * Files must already be sorted (use readAndSortMigrationFiles).
 */
export async function parseV3Schema(
  migrationFilePaths: string[],
): Promise<V3Schema> {
  const tables: Record<string, V3Table> = {};

  for (const filePath of migrationFilePaths) {
    const content = await readFile(filePath, "utf-8");
    parseSqlContent(content, tables);
  }

  const schema_hash = await computeV3SchemaHash(migrationFilePaths);

  return {
    tables,
    computed_at: new Date().toISOString(),
    schema_hash,
    source_file_count: migrationFilePaths.length,
  };
}

/**
 * Convenience function: reads, sorts, parses migration files from a directory,
 * writes the result to a JSON file, and returns the schema.
 */
export async function readAndWriteV3Schema(
  migrationsDir: string,
  outputPath: string,
): Promise<V3Schema> {
  const files = await readAndSortMigrationFiles(migrationsDir);
  const schema = await parseV3Schema(files);

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, JSON.stringify(schema, null, 2) + "\n", "utf-8");

  return schema;
}
