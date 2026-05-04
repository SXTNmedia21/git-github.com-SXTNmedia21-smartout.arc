#!/usr/bin/env tsx
/**
 * cascade-gate-entity-type-coverage.ts — ADR-0190 Control 2 (Stage 1).
 *
 * Sister gate to ADR-0189's authority-seed-parity. Covers pathway B
 * (`cascade_gate_write` RPC + `gatedInsert/gatedUpdate/gatedDelete` TS
 * helpers) rather than pathway A (ADR-0099 capability gate).
 *
 * The pathway-B default-allow branches are structurally different from
 * pathway A's — there's no per-capability seed table. Instead, the RPC
 * matches on `framework_trigger.source_entity_type` (see
 * supabase/migrations/20260512100000_cascade_gate_write.sql §2). If no
 * framework_trigger row exists for a given entity_type, the RPC permits
 * with reason = 'no-trigger-match'. That is the failure mode this script
 * closes at the code level.
 *
 * What this script does:
 *   1. AST-walk every *.ts / *.tsx under apps/web/src/** and packages/**
 *      for CallExpressions whose callee identifier is `gatedInsert`,
 *      `gatedUpdate`, or `gatedDelete`.
 *      Skip tests, __tests__, apps/e2e, test-utils, gate-client.ts itself.
 *   2. Extract the `entityType` value from the GateContext arg (3rd arg
 *      for update/delete, 4th for insert — last positional is GateContext).
 *      Operation is derived from the helper name:
 *        gatedInsert → 'create'
 *        gatedUpdate → 'update'
 *        gatedDelete → 'delete'
 *      Dynamic-dispatch sites MUST carry the `@cascade-gate-dynamic-entity`
 *      marker (same-line trailing, preceding line, or leading trivia up
 *      to the enclosing statement). Otherwise the site fails with "dynamic
 *      entity-type without marker".
 *   3. Parse `supabase/migrations/20260424100000_seed_hospitality_framework.sql`
 *      (Stage 1 = hospitality only). Collect every `source_entity_type`
 *      string literal inserted into `framework_trigger`.
 *   4. Diff: every `(entityType, operation)` tuple from code must have
 *      `entityType` present in the seeded set OR appear in `EXEMPT_ENTITY_TYPES`
 *      below with required JSDoc fields.
 *   5. Stage 2 trigger: when a second regulatory_framework is seeded,
 *      per-framework coverage is required. See ADR-0190 §Consequences.
 *
 * Output: human-readable table on stdout; JSON summary line prefixed
 *         "CASCADE_GATE_ENTITY_TYPE_COVERAGE_JSON=" on the last line.
 *
 * Run: pnpm run cascade-gate-entity-type-coverage
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { Project, SyntaxKind, type CallExpression, type Node, type SourceFile } from "ts-morph";

const ROOT = resolve(__dirname, "..");
const SCAN_ROOTS = ["apps/web/src", "packages"];
const HOSPITALITY_SEED = join(
  ROOT,
  "supabase",
  "migrations",
  "20260424100000_seed_hospitality_framework.sql",
);

const DYNAMIC_MARKER = "@cascade-gate-dynamic-entity";

const HELPER_TO_OPERATION = new Map<string, "create" | "update" | "delete">([
  ["gatedInsert", "create"],
  ["gatedUpdate", "update"],
  ["gatedDelete", "delete"],
]);

const IGNORE_PATH_SEGMENTS = [
  "/node_modules/",
  "/.next/",
  "/dist/",
  "/build/",
  "/.turbo/",
  "/coverage/",
  "/.expo/",
  "/ios/",
  "/android/",
  "/apps/e2e/",
  "/__tests__/",
  "/test-utils/",
  "/database.types.ts",
  // The helper itself declares the identifiers; scanning it would collect
  // unresolvable self-references.
  "/packages/supabase/src/gate-client.ts",
];

const IGNORE_FILE_PATTERNS = [/\.test\.tsx?$/, /\.spec\.tsx?$/, /\.d\.ts$/, /\.stories\.tsx?$/];

// ────────────────────────────────────────────────────────────────
// Exemption table
// ────────────────────────────────────────────────────────────────

/**
 * Entity-type tuples that are intentionally permitted to call pathway-B
 * helpers without a framework_trigger seed row. Each entry MUST provide:
 *
 *   - `entityType`       — the `GateContext.entityType` value
 *   - `operation`        — one of 'create' | 'update' | 'delete'
 *   - `reason`           — why this site is exempt (must be specific)
 *   - `adr_or_ticket`    — ADR-XXXX or SMA-XXXX reference
 *   - `expires_at`       — YYYY-MM-DD date by which the exemption is revisited
 *
 * Exemptions ARE tech debt. Keep this list short. An entry older than
 * `expires_at` fails the CI gate regardless of match status — the script
 * rejects "permanent" exemptions.
 */
type Exemption = {
  entityType: string;
  operation: "create" | "update" | "delete";
  reason: string;
  adr_or_ticket: string;
  expires_at: string; // YYYY-MM-DD
};

const EXEMPT_ENTITY_TYPES: readonly Exemption[] = [] as const;

// ────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────

type Finding = {
  file: string; // path relative to ROOT
  line: number;
  column: number;
  helper: "gatedInsert" | "gatedUpdate" | "gatedDelete";
  operation: "create" | "update" | "delete";
  entityType: string | null; // null when dynamic / non-literal
  dynamicMarkerPresent: boolean;
  snippet: string;
};

type CoverageReport = {
  scannedFiles: number;
  callSites: number;
  literalTuples: Array<{ entityType: string; operation: string; sites: Finding[] }>;
  dynamicMarked: Finding[];
  dynamicMissingMarker: Finding[];
  seededEntityTypes: string[];
  unmatchedTuples: Array<{ entityType: string; operation: string; sites: Finding[] }>;
  expiredExemptions: Exemption[];
  ok: boolean;
};

// ────────────────────────────────────────────────────────────────
// File discovery
// ────────────────────────────────────────────────────────────────

function walkTsFiles(rootDir: string): string[] {
  const out: string[] = [];
  const stack = [rootDir];
  while (stack.length > 0) {
    const dir = stack.pop()!;
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      continue;
    }
    for (const entry of entries) {
      const abs = join(dir, entry);
      const rel = relative(ROOT, abs);
      if (IGNORE_PATH_SEGMENTS.some((seg) => ("/" + rel + "/").includes(seg))) {
        continue;
      }
      let st;
      try {
        st = statSync(abs);
      } catch {
        continue;
      }
      if (st.isDirectory()) {
        stack.push(abs);
        continue;
      }
      if (!st.isFile()) continue;
      if (!/\.(ts|tsx)$/.test(entry)) continue;
      if (IGNORE_FILE_PATTERNS.some((re) => re.test(entry))) continue;
      out.push(abs);
    }
  }
  return out;
}

// ────────────────────────────────────────────────────────────────
// TS AST scan
// ────────────────────────────────────────────────────────────────

function hasDynamicMarker(call: CallExpression, source: SourceFile): boolean {
  const text = source.getFullText();
  const startPos = call.getStart();

  // 1. Trailing comment on same line after call end.
  const endPos = call.getEnd();
  const lineEndPos = findLineEnd(text, endPos);
  const sameLineTail = text.slice(endPos, lineEndPos);
  if (sameLineTail.includes(DYNAMIC_MARKER)) return true;

  // 2. Scan the three lines immediately above the call.
  let cursor = findLineStart(text, startPos);
  for (let i = 0; i < 3 && cursor > 0; i += 1) {
    const prevLineEnd = cursor - 1;
    if (prevLineEnd < 0) break;
    const prevLineStart = findLineStart(text, Math.max(0, prevLineEnd - 1));
    const prevLine = text.slice(prevLineStart, prevLineEnd);
    if (prevLine.includes(DYNAMIC_MARKER)) return true;
    cursor = prevLineStart;
  }

  // 3. Leading trivia attached to the call, its parent expression chain,
  //    and the enclosing statement (covers block comments attached to the
  //    containing VariableStatement/ExpressionStatement).
  const visited = new Set<Node>();
  let cur: Node | undefined = call;
  while (cur && !visited.has(cur)) {
    visited.add(cur);
    for (const range of cur.getLeadingCommentRanges()) {
      const commentText = text.slice(range.getPos(), range.getEnd());
      if (commentText.includes(DYNAMIC_MARKER)) return true;
    }
    const k = cur.getKind();
    if (
      k === SyntaxKind.VariableStatement ||
      k === SyntaxKind.ExpressionStatement ||
      k === SyntaxKind.ReturnStatement ||
      k === SyntaxKind.IfStatement ||
      k === SyntaxKind.Block
    ) {
      break;
    }
    cur = cur.getParent();
  }
  return false;
}

function findLineStart(text: string, pos: number): number {
  let i = pos;
  while (i > 0 && text[i - 1] !== "\n") i--;
  return i;
}

function findLineEnd(text: string, pos: number): number {
  let i = pos;
  while (i < text.length && text[i] !== "\n") i++;
  return i;
}

function snippet(call: CallExpression): string {
  const t = call.getText();
  return t.length > 180 ? t.slice(0, 180) + "…" : t;
}

function stripQuotes(s: string): string {
  return s.replace(/^['"`]|['"`]$/g, "");
}

/**
 * Extract a single string literal from a node, or null if not literal.
 */
function literalOrNull(init: Node | undefined): string | null {
  if (!init) return null;
  const kind = init.getKind();
  if (kind === SyntaxKind.StringLiteral || kind === SyntaxKind.NoSubstitutionTemplateLiteral) {
    return stripQuotes(init.getText());
  }
  return null;
}

/**
 * Given an ObjectLiteralExpression, return the string-literal value of its
 * `entityType` property if statically resolvable; null otherwise.
 */
function entityTypeFromObjectLiteral(obj: Node): string | null {
  if (obj.getKind() !== SyntaxKind.ObjectLiteralExpression) return null;
  const objLit = obj.asKindOrThrow(SyntaxKind.ObjectLiteralExpression);
  const prop = objLit.getProperty("entityType");
  if (!prop) return null;
  const propAssign = prop.asKind(SyntaxKind.PropertyAssignment);
  if (!propAssign) {
    // Shorthand `{ entityType }` — dynamic reference; not resolvable.
    return null;
  }
  return literalOrNull(propAssign.getInitializer());
}

/**
 * The GateContext object is the LAST positional argument on every helper:
 *   gatedInsert(client, table, rows,  ctx)   // 4 args
 *   gatedUpdate(client, table, patch, ctx)   // 4 args
 *   gatedDelete(client, table,        ctx)   // 3 args
 *
 * Resolution strategy for the final arg:
 *   1. If it's an inline ObjectLiteralExpression, extract `entityType` directly.
 *   2. If it's an Identifier referencing a `const ctx = { ... }` in the same
 *      file, follow the reference and extract from the initializer.
 *   3. If it's an Identifier referencing a `const ctx: GateContext = { ... }`
 *      (with type annotation), same treatment.
 *   4. Otherwise return null → caller must annotate with
 *      `@cascade-gate-dynamic-entity`.
 */
function extractEntityTypeFromGatedCall(call: CallExpression): string | null {
  const args = call.getArguments();
  if (args.length === 0) return null;
  const last = args[args.length - 1];

  // Case 1: inline object literal.
  if (last.getKind() === SyntaxKind.ObjectLiteralExpression) {
    return entityTypeFromObjectLiteral(last);
  }

  // Case 2 + 3: Identifier — resolve to its declaration in the same file.
  if (last.getKind() === SyntaxKind.Identifier) {
    const id = last.asKindOrThrow(SyntaxKind.Identifier);
    // ts-morph's getDefinitions() needs the language service; but
    // findReferences / getDefinitionNodes works with skipFileDependencyResolution
    // as long as the declaration is in the same file.
    const defs = id.getDefinitionNodes();
    for (const def of defs) {
      // VariableDeclaration — `const ctx = { ... }` or `const ctx: T = { ... }`.
      if (def.getKind() === SyntaxKind.VariableDeclaration) {
        const vd = def.asKindOrThrow(SyntaxKind.VariableDeclaration);
        const init = vd.getInitializer();
        if (init && init.getKind() === SyntaxKind.ObjectLiteralExpression) {
          const t = entityTypeFromObjectLiteral(init);
          if (t) return t;
        }
      }
    }
  }

  return null;
}

function isGatedHelperCall(
  call: CallExpression,
): "gatedInsert" | "gatedUpdate" | "gatedDelete" | null {
  const expr = call.getExpression();
  let name: string | null = null;
  if (expr.getKind() === SyntaxKind.Identifier) {
    name = expr.getText();
  } else if (expr.getKind() === SyntaxKind.PropertyAccessExpression) {
    const pa = expr.asKindOrThrow(SyntaxKind.PropertyAccessExpression);
    name = pa.getName();
  }
  if (!name) return null;
  if (name === "gatedInsert" || name === "gatedUpdate" || name === "gatedDelete") {
    return name;
  }
  return null;
}

function scanFile(
  filePath: string,
  project: Project,
  findings: Finding[],
  scan: { callSites: number },
): void {
  let source: SourceFile;
  try {
    source = project.addSourceFileAtPath(filePath);
  } catch {
    return;
  }
  source.forEachDescendant((node: Node) => {
    if (node.getKind() !== SyntaxKind.CallExpression) return;
    const call = node.asKindOrThrow(SyntaxKind.CallExpression);
    const helper = isGatedHelperCall(call);
    if (!helper) return;

    scan.callSites += 1;

    const entityType = extractEntityTypeFromGatedCall(call);
    const operation = HELPER_TO_OPERATION.get(helper)!;

    const start = call.getStartLineNumber();
    const col = call.getStart() - findLineStart(source.getFullText(), call.getStart());
    const dynamicMarkerPresent = hasDynamicMarker(call, source);

    findings.push({
      file: relative(ROOT, filePath),
      line: start,
      column: col + 1,
      helper,
      operation,
      entityType,
      dynamicMarkerPresent,
      snippet: snippet(call),
    });
  });
  project.removeSourceFile(source);
}

// ────────────────────────────────────────────────────────────────
// SQL seed scan — hospitality framework_trigger.source_entity_type
// ────────────────────────────────────────────────────────────────

function extractSeededEntityTypes(seedPath: string): Set<string> {
  const seeded = new Set<string>();
  let sql: string;
  try {
    sql = readFileSync(seedPath, "utf8");
  } catch {
    return seeded;
  }

  // Strip comments so any entity_type mentioned in prose doesn't leak in.
  const stripped = sql.replace(/--[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");

  // Locate the INSERT INTO framework_trigger statement and walk its VALUES
  // tuples. The seed uses positional inserts with column list:
  //   (framework_id, code, description, description_no, trigger_mode,
  //    source_entity_type, evaluation_config, ...)
  // source_entity_type is the 6th column → the 6th comma-separated element
  // of each tuple. We parse tuples naively by tracking paren depth because
  // embedded JSONB literals (::jsonb casts) contain commas.
  const insertRe = /INSERT\s+INTO\s+framework_trigger\b[\s\S]*?;/gi;
  for (const ins of stripped.matchAll(insertRe)) {
    const stmt = ins[0];
    // Find the VALUES region.
    const valuesIdx = stmt.search(/\bVALUES\b/i);
    if (valuesIdx < 0) continue;
    const valuesRegion = stmt.slice(valuesIdx + 6);

    // Walk each top-level (…) tuple at paren-depth 1.
    let depth = 0;
    let tupleStart = -1;
    for (let i = 0; i < valuesRegion.length; i += 1) {
      const ch = valuesRegion[i];
      // Skip quoted strings to avoid counting parens inside literals.
      if (ch === "'") {
        i += 1;
        while (i < valuesRegion.length) {
          if (valuesRegion[i] === "'" && valuesRegion[i + 1] === "'") {
            i += 2;
            continue;
          }
          if (valuesRegion[i] === "'") break;
          i += 1;
        }
        continue;
      }
      if (ch === "(") {
        if (depth === 0) tupleStart = i + 1;
        depth += 1;
      } else if (ch === ")") {
        depth -= 1;
        if (depth === 0 && tupleStart >= 0) {
          const tupleText = valuesRegion.slice(tupleStart, i);
          extractSixthColumnLiteral(tupleText, seeded);
          tupleStart = -1;
        }
      }
    }
  }

  return seeded;
}

/**
 * Pick the 6th top-level comma-separated value out of an INSERT tuple,
 * stripping quotes. Top-level means comma-splitting only at paren-depth 0
 * and outside quoted strings (so `::jsonb` casts with embedded commas
 * don't mis-split).
 */
function extractSixthColumnLiteral(tupleText: string, out: Set<string>): void {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < tupleText.length; i += 1) {
    const ch = tupleText[i];
    if (ch === "'") {
      i += 1;
      while (i < tupleText.length) {
        if (tupleText[i] === "'" && tupleText[i + 1] === "'") {
          i += 2;
          continue;
        }
        if (tupleText[i] === "'") break;
        i += 1;
      }
      continue;
    }
    if (ch === "(") depth += 1;
    else if (ch === ")") depth -= 1;
    else if (ch === "," && depth === 0) {
      parts.push(tupleText.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(tupleText.slice(start));
  if (parts.length < 6) return;
  const sixth = parts[5].trim();
  // Expect a single-quoted string literal. Strip surrounding whitespace,
  // trailing cast, and quotes.
  const m = sixth.match(/^'([a-z_][a-z0-9_]*)'(::[a-z_]+)?$/i);
  if (m) out.add(m[1]);
}

// ────────────────────────────────────────────────────────────────
// Exemption validation
// ────────────────────────────────────────────────────────────────

function findExpiredExemptions(today: Date): Exemption[] {
  const expired: Exemption[] = [];
  const todayStr = today.toISOString().slice(0, 10);
  for (const ex of EXEMPT_ENTITY_TYPES) {
    if (ex.expires_at < todayStr) expired.push(ex);
  }
  return expired;
}

function isExempt(entityType: string, operation: string): boolean {
  return EXEMPT_ENTITY_TYPES.some(
    (ex) => ex.entityType === entityType && ex.operation === operation,
  );
}

// ────────────────────────────────────────────────────────────────
// Main
// ────────────────────────────────────────────────────────────────

function main(): void {
  const findings: Finding[] = [];
  const scan = { callSites: 0 };

  const project = new Project({
    skipAddingFilesFromTsConfig: true,
    skipFileDependencyResolution: true,
    compilerOptions: {
      allowJs: false,
      noEmit: true,
      target: 99,
    },
  });

  let scannedFiles = 0;
  for (const root of SCAN_ROOTS) {
    const abs = join(ROOT, root);
    const files = walkTsFiles(abs);
    scannedFiles += files.length;
    for (const f of files) {
      scanFile(f, project, findings, scan);
    }
  }

  // Partition.
  const tupleSites = new Map<string, Finding[]>(); // key: entityType|operation
  const dynamicMarked: Finding[] = [];
  const dynamicMissingMarker: Finding[] = [];
  for (const f of findings) {
    if (f.entityType === null) {
      if (f.dynamicMarkerPresent) dynamicMarked.push(f);
      else dynamicMissingMarker.push(f);
      continue;
    }
    const key = `${f.entityType}|${f.operation}`;
    const arr = tupleSites.get(key) ?? [];
    arr.push(f);
    tupleSites.set(key, arr);
  }

  const literalTuples = [...tupleSites.entries()]
    .map(([key, sites]) => {
      const [entityType, operation] = key.split("|");
      return { entityType, operation, sites };
    })
    .sort((a, b) =>
      a.entityType === b.entityType
        ? a.operation.localeCompare(b.operation)
        : a.entityType.localeCompare(b.entityType),
    );

  const seeded = extractSeededEntityTypes(HOSPITALITY_SEED);

  const unmatched: Array<{ entityType: string; operation: string; sites: Finding[] }> = [];
  for (const t of literalTuples) {
    if (seeded.has(t.entityType)) continue;
    if (isExempt(t.entityType, t.operation)) continue;
    unmatched.push(t);
  }

  const expiredExemptions = findExpiredExemptions(new Date());

  const report: CoverageReport = {
    scannedFiles,
    callSites: scan.callSites,
    literalTuples,
    dynamicMarked,
    dynamicMissingMarker,
    seededEntityTypes: [...seeded].sort(),
    unmatchedTuples: unmatched,
    expiredExemptions,
    ok:
      unmatched.length === 0 && dynamicMissingMarker.length === 0 && expiredExemptions.length === 0,
  };

  renderReport(report);

  console.log("CASCADE_GATE_ENTITY_TYPE_COVERAGE_JSON=" + JSON.stringify(report));

  process.exit(report.ok ? 0 : 1);
}

function renderReport(report: CoverageReport): void {
  const log = (s: string = "") => console.log(s);
  log("");
  log("============================================================");
  log("ADR-0190 Control 2 — Cascade Gate Entity-Type Coverage Report");
  log("============================================================");
  log(`Scanned files           : ${report.scannedFiles}`);
  log(`gatedInsert/Update/Delete sites : ${report.callSites}`);
  log(`Literal (entityType, op) tuples : ${report.literalTuples.length}`);
  log(`Seeded entity types (hospitality): ${report.seededEntityTypes.length}`);
  log(`  [${report.seededEntityTypes.join(", ")}]`);
  log("");

  if (report.literalTuples.length > 0) {
    log("Literal tuples found:");
    for (const t of report.literalTuples) {
      const head = t.sites[0];
      log(
        `  ${(t.entityType + " / " + t.operation).padEnd(40)}  ${
          head ? head.file + ":" + head.line : "(no site)"
        }  (${t.sites.length} site${t.sites.length === 1 ? "" : "s"})`,
      );
    }
    log("");
  }

  if (report.dynamicMissingMarker.length > 0) {
    log("Dynamic entity-type without @cascade-gate-dynamic-entity marker:");
    for (const f of report.dynamicMissingMarker) {
      log(`  ${f.file}:${f.line}:${f.column}  [${f.helper}]`);
      log(`    ${f.snippet}`);
    }
    log("");
  }

  if (report.dynamicMarked.length > 0) {
    log(
      `  ${report.dynamicMarked.length} dynamic call(s) annotated with @cascade-gate-dynamic-entity (accepted).`,
    );
    log("");
  }

  if (report.unmatchedTuples.length === 0) {
    log("Every literal (entityType, operation) tuple resolves to a seeded framework_trigger.");
  } else {
    log(`Unmatched tuples — no framework_trigger seed AND no EXEMPT entry:`);
    log("");
    log("  entityType / operation                  site(s)");
    log("  ──────────────────────────────────────  ─────────────────────────────────────────");
    for (const m of report.unmatchedTuples) {
      const head = m.sites[0];
      log(
        `  ${(m.entityType + " / " + m.operation).padEnd(38)}  ${
          head ? head.file + ":" + head.line : "(no site)"
        }`,
      );
      for (const site of m.sites.slice(1)) {
        log(`  ${"".padEnd(38)}  ${site.file}:${site.line}`);
      }
    }
    log("");
    log("Fix: add a framework_trigger row with source_entity_type=<entityType> to");
    log("     supabase/migrations/20260424100000_seed_hospitality_framework.sql (or a");
    log("     new migration), OR add an entry to EXEMPT_ENTITY_TYPES with adr_or_ticket");
    log("     and expires_at fields.");
  }

  if (report.expiredExemptions.length > 0) {
    log("");
    log("Exemptions past their expires_at:");
    for (const ex of report.expiredExemptions) {
      log(`  ${ex.entityType} / ${ex.operation} — ${ex.adr_or_ticket} — expired ${ex.expires_at}`);
    }
    log("Revisit these and either remove the exemption or extend with justification.");
  }

  log("");
  log(report.ok ? "PASS" : "FAIL");
  log("============================================================");
}

main();
