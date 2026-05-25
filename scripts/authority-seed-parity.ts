#!/usr/bin/env tsx
/**
 * authority-seed-parity.ts — ADR-0189 CI gate.
 *
 * Prevents regression of the reconciliation.override CVE class: a
 * gateAction({ capability: "x.y", ... }) call site lands in code WITHOUT a
 * corresponding INSERT INTO engine_authority_config seed row. gate_action()
 * default-allows when no config row exists (see
 * supabase/migrations/20260505110000_unified_authority_gate.sql §4), so any
 * un-seeded literal is a silent authority escape in production.
 *
 * What this script does:
 *   1. Walk every *.ts / *.tsx under apps/, packages/, supabase/functions/.
 *      Skip node_modules, build artifacts, types files, tests.
 *   2. Find every call to gate_action(...) (SQL RPC invocation through
 *      supabase.rpc("gate_action", ...)) and gateAction({ capability: "x.y" })
 *      (TS helper in apps/web/src/app/dashboard/_actions/_shared.ts).
 *   3. Extract the capability argument.
 *        - String literal → add to required-seed set.
 *        - Dynamic / non-literal → REQUIRE adjacent comment
 *          /* @authority-gate-ungated *\/ on the same line or the line
 *          above. Otherwise fail.
 *   4. Parse every supabase/migrations/*.sql for capability strings passed
 *      to INSERT INTO engine_authority_config. Collect the seeded set.
 *   5. Diff: every required literal must have a matching seed.
 *      Missing → exit 1, print table + JSON summary.
 *
 * Output: human-readable table on stdout; JSON summary line prefixed
 *         "AUTHORITY_SEED_PARITY_JSON=" on the last line for CI parsing.
 *
 * Run: pnpm run authority-seed-parity
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { Project, SyntaxKind, type CallExpression, type Node, type SourceFile } from "ts-morph";

const ROOT = resolve(__dirname, "..");
const SCAN_ROOTS = ["apps", "packages", "supabase/functions"];
const MIGRATIONS_DIR = join(ROOT, "supabase", "migrations");

const UNGATED_MARKER = "@authority-gate-ungated";

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
  "/database.types.ts",
  "/__tests__/", // test fixtures may contain sentinel capability literals (e.g. "x") not requiring seeds
  "/fixtures/", // fixture files are not production call sites
];

const IGNORE_FILE_PATTERNS = [/\.test\.tsx?$/, /\.spec\.tsx?$/, /\.d\.ts$/, /\.stories\.tsx?$/];

// ────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────

type Finding = {
  file: string; // path relative to ROOT
  line: number;
  column: number;
  callKind: "gateAction" | "rpc.gate_action";
  capability: string | null; // null when dynamic / non-literal
  ungated: boolean; // marker present
  snippet: string;
};

type ParityReport = {
  scannedFiles: number;
  callSites: number;
  literals: string[];
  dynamicUngated: Finding[];
  dynamicMissingMarker: Finding[];
  seededCapabilities: string[];
  missingSeeds: Array<{ capability: string; sites: Finding[] }>;
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

function hasUngatedMarker(call: CallExpression, source: SourceFile): boolean {
  const text = source.getFullText();
  const startPos = call.getStart();

  // 1. Trailing comment on same line after call end.
  const endPos = call.getEnd();
  const lineEndPos = findLineEnd(text, endPos);
  const sameLineTail = text.slice(endPos, lineEndPos);
  if (sameLineTail.includes(UNGATED_MARKER)) return true;

  // 2. Scan the three lines immediately above the call (covers multi-line
  //    block comments and a "comment on line N-1" hint).
  let cursor = findLineStart(text, startPos);
  for (let i = 0; i < 3 && cursor > 0; i += 1) {
    const prevLineEnd = cursor - 1; // position of the \n
    if (prevLineEnd < 0) break;
    const prevLineStart = findLineStart(text, Math.max(0, prevLineEnd - 1));
    const prevLine = text.slice(prevLineStart, prevLineEnd);
    if (prevLine.includes(UNGATED_MARKER)) return true;
    cursor = prevLineStart;
  }

  // 3. Leading trivia attached to the call, its parent expression chain, and
  //    the enclosing statement. ts-morph attaches block comments to the
  //    containing statement, not the deepest CallExpression.
  const visited = new Set<Node>();
  let cur: Node | undefined = call;
  while (cur && !visited.has(cur)) {
    visited.add(cur);
    for (const range of cur.getLeadingCommentRanges()) {
      const commentText = text.slice(range.getPos(), range.getEnd());
      if (commentText.includes(UNGATED_MARKER)) return true;
    }
    // Stop once we've walked up to the enclosing Statement/VariableStatement.
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

/**
 * Extract one or more capability string literals from a node.
 *
 *   - "cap"                         → ["cap"]
 *   - cond ? "a" : "b"              → ["a", "b"]
 *   - variable / member / call      → []
 *
 * Empty array means "dynamic" — the caller must then either demand the
 * @authority-gate-ungated marker or flag it as a missing-marker violation.
 */
function literalsFromNode(init: Node | undefined): string[] {
  if (!init) return [];
  const kind = init.getKind();
  if (kind === SyntaxKind.StringLiteral || kind === SyntaxKind.NoSubstitutionTemplateLiteral) {
    return [stripQuotes(init.getText())];
  }
  if (kind === SyntaxKind.ConditionalExpression) {
    const cond = init.asKindOrThrow(SyntaxKind.ConditionalExpression);
    const whenTrue = literalsFromNode(cond.getWhenTrue());
    const whenFalse = literalsFromNode(cond.getWhenFalse());
    // Only "resolve" the ternary if BOTH branches are literal. Otherwise the
    // site is still dynamic and must be marker-annotated.
    if (whenTrue.length > 0 && whenFalse.length > 0) {
      return [...whenTrue, ...whenFalse];
    }
    return [];
  }
  return [];
}

function extractCapabilityFromGateAction(call: CallExpression): {
  capabilities: string[];
  hasArgObject: boolean;
  hasCapabilityProp: boolean;
} {
  const args = call.getArguments();
  if (args.length === 0) {
    return { capabilities: [], hasArgObject: false, hasCapabilityProp: false };
  }
  const first = args[0];
  if (first.getKind() !== SyntaxKind.ObjectLiteralExpression) {
    return { capabilities: [], hasArgObject: false, hasCapabilityProp: false };
  }
  const obj = first.asKindOrThrow(SyntaxKind.ObjectLiteralExpression);
  const prop = obj.getProperty("capability");
  if (!prop) {
    return { capabilities: [], hasArgObject: true, hasCapabilityProp: false };
  }
  const propAssign = prop.asKind(SyntaxKind.PropertyAssignment);
  if (!propAssign) {
    return { capabilities: [], hasArgObject: true, hasCapabilityProp: true };
  }
  return {
    capabilities: literalsFromNode(propAssign.getInitializer()),
    hasArgObject: true,
    hasCapabilityProp: true,
  };
}

function extractCapabilityFromRpc(call: CallExpression): string[] {
  const args = call.getArguments();
  if (args.length < 2) return [];
  const paramsArg = args[1];
  if (paramsArg.getKind() !== SyntaxKind.ObjectLiteralExpression) return [];
  const obj = paramsArg.asKindOrThrow(SyntaxKind.ObjectLiteralExpression);
  const prop = obj.getProperty("p_capability");
  if (!prop) return [];
  const propAssign = prop.asKind(SyntaxKind.PropertyAssignment);
  if (!propAssign) return [];
  return literalsFromNode(propAssign.getInitializer());
}

function stripQuotes(s: string): string {
  return s.replace(/^['"`]|['"`]$/g, "");
}

function isRpcGateAction(call: CallExpression): boolean {
  // Pattern: <expr>.rpc("gate_action", ...)
  const expr = call.getExpression();
  if (expr.getKind() !== SyntaxKind.PropertyAccessExpression) return false;
  const propAccess = expr.asKindOrThrow(SyntaxKind.PropertyAccessExpression);
  if (propAccess.getName() !== "rpc") return false;
  const args = call.getArguments();
  if (args.length < 1) return false;
  const firstText = args[0].getText();
  return firstText === '"gate_action"' || firstText === "'gate_action'";
}

function isGateActionHelper(call: CallExpression): boolean {
  const expr = call.getExpression();
  // bare identifier: gateAction({...})
  if (expr.getKind() === SyntaxKind.Identifier) {
    return expr.getText() === "gateAction";
  }
  // namespaced: something.gateAction({...})
  if (expr.getKind() === SyntaxKind.PropertyAccessExpression) {
    const pa = expr.asKindOrThrow(SyntaxKind.PropertyAccessExpression);
    return pa.getName() === "gateAction";
  }
  return false;
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
    let callKind: Finding["callKind"] | null = null;
    let capabilities: string[] = [];

    if (isGateActionHelper(call)) {
      callKind = "gateAction";
      capabilities = extractCapabilityFromGateAction(call).capabilities;
    } else if (isRpcGateAction(call)) {
      callKind = "rpc.gate_action";
      capabilities = extractCapabilityFromRpc(call);
    }

    if (!callKind) return;
    scan.callSites += 1;

    const start = call.getStartLineNumber();
    const col = call.getStart() - findLineStart(source.getFullText(), call.getStart());
    const ungated = hasUngatedMarker(call, source);
    const base = {
      file: relative(ROOT, filePath),
      line: start,
      column: col + 1,
      callKind,
      ungated,
      snippet: snippet(call),
    };

    if (capabilities.length === 0) {
      findings.push({ ...base, capability: null });
    } else {
      // Emit one finding per literal so the reporter can track sites per-cap.
      for (const cap of capabilities) {
        findings.push({ ...base, capability: cap });
      }
    }
  });
  // don't keep every SourceFile in memory
  project.removeSourceFile(source);
}

// ────────────────────────────────────────────────────────────────
// SQL seed scan
// ────────────────────────────────────────────────────────────────

function extractSeededCapabilities(migrationsDir: string): Set<string> {
  const seeded = new Set<string>();
  let files: string[];
  try {
    files = readdirSync(migrationsDir).filter((f: string) => f.endsWith(".sql"));
  } catch {
    return seeded;
  }

  // We recognize four seed shapes — and ONLY these four, so the seeded
  // set stays precise (no false positives leaking from unrelated INSERTs).
  //
  //   A. INSERT INTO [public.]engine_authority_config (...) VALUES ('cap', …);
  //      (possibly multiple tuples)
  //
  //   B. INSERT INTO [public.]engine_authority_config (...) SELECT …
  //      FROM … CROSS JOIN (VALUES ('cap', …) [, ...]) AS alias(column, …);
  //      This is the canonical seed pattern used in
  //      20260516100000_seed_reconciliation_authority.sql and siblings.
  //
  //   C. gate_action(p_capability => 'cap', ...) invocation inside a seed
  //      migration that runs the gate directly (used by
  //      20260516110000_consolidate_session_signoff_emitter.sql as
  //      side-effect seeding).
  //
  //   D. INSERT INTO [public.]engine_authority_config (...) SELECT w.workspace_id,
  //      'cap', ... FROM public.workspace w ...;
  //      Legacy single-INSERT-per-capability pattern used by older seeds
  //      (e.g. 20260515130300_helpdesk_query_authority_seed.sql). The
  //      capability literal appears as a bare string in the SELECT column list,
  //      not inside a VALUES clause. We extract all string literals from the
  //      SELECT column list of each matching INSERT..SELECT statement that are
  //      allowlisted (single-word allowlist or dotted form).

  // Allow hyphens in both top-level identifier and dotted segments — ADR-0367
  // introduced hyphen-form capability names ("day-line"). Predates the dotted-
  // form convention's strict `_` alphabet, but ships as canonical literal.
  const DOTTED_RE = /^[a-z_][a-z0-9_-]*(\.[a-z_][a-z0-9_-]*)+$/;
  // Legacy single-word capabilities that predate dotted-form convention (ADR-0195/0201/0298).
  // Migration to dotted form is deferred to a follow-up architectural sortie. Until then,
  // these capabilities are seeded via single-word literals in migrations and must be
  // allowlisted so the parity gate doesn't false-positive them.
  const SINGLE_WORD_ALLOWLIST = new Set([
    "billing_query",
    // ADR-0407 K1a bootstrap-gate capability.
    "bootstrap",
    "contract",
    // ADR-0367 D6 dag-linje lifecycle (hyphen in literal — see DOTTED_RE).
    "day-line",
    "handbook_chapter",
    "helpdesk_query",
    "memory",
    // ADR-0367 BT2 org-structure area-management.
    "org",
    "payroll",
    "policy",
    "protocol",
    // ADR-0367 BT2 routine attachment.
    "routine",
    // ADR-0306 open-shift marketplace — top-level capability literal at call-sites
    // (e.g. apps/web/src/app/api/marketplace/action/route.ts). Sub-actions
    // shift_marketplace.override are also seeded as dotted.
    "shift_marketplace",
    "task",
  ]);
  // Capability literal regex — same alphabet as DOTTED_RE for consistency.
  // Allows hyphen in both the head and any dotted segment.
  const CAP_LIT = /'([a-z_][a-z0-9_-]*(?:\.[a-z_][a-z0-9_-]*)*)'/g;

  function accept(candidate: string): boolean {
    return DOTTED_RE.test(candidate) || SINGLE_WORD_ALLOWLIST.has(candidate);
  }

  for (const file of files) {
    const abs = join(migrationsDir, file);
    let sql: string;
    try {
      sql = readFileSync(abs, "utf8");
    } catch {
      continue;
    }
    if (!/engine_authority_config/i.test(sql)) continue;

    // Strip comments so authority-mentioning doc prose doesn't trip shape A/B.
    const stripped = sql.replace(/--[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");

    // Shape A+B: locate every INSERT INTO [public.]engine_authority_config
    // and consume the SQL statement up to the terminating semicolon. Extract
    // any VALUES (...) tuples inside that span.
    const insertRe = /INSERT\s+INTO\s+(?:public\.)?engine_authority_config\b[\s\S]*?;/gi;
    for (const ins of stripped.matchAll(insertRe)) {
      const stmt = ins[0];
      const valuesRe = /\bVALUES\s*(\([\s\S]*?\)(?:\s*,\s*\([\s\S]*?\))*)/gi;
      for (const vm of stmt.matchAll(valuesRe)) {
        const tupleRegion = vm[1];
        for (const m of tupleRegion.matchAll(CAP_LIT)) {
          if (accept(m[1])) seeded.add(m[1]);
        }
      }

      // Shape D: INSERT INTO engine_authority_config (...) SELECT ... 'cap', ...
      // Legacy pattern where capability literal appears bare in SELECT column list
      // rather than inside a VALUES clause. Only extract allowlisted strings to
      // stay precise (avoids false positives from string literals in WHERE clauses
      // or COALESCE expressions that aren't capability names).
      if (/\bSELECT\b/i.test(stmt) && !/\bCROSS\s+JOIN\b/i.test(stmt)) {
        // Extract the SELECT column list (between SELECT and FROM).
        const selectColMatch = stmt.match(/\bSELECT\b([\s\S]*?)\bFROM\b/i);
        if (selectColMatch) {
          const colList = selectColMatch[1];
          for (const m of colList.matchAll(CAP_LIT)) {
            if (accept(m[1])) seeded.add(m[1]);
          }
        }
      }
    }

    // Shape C: gate_action(p_capability => 'cap', ...) — named-arg only.
    const gateCallRe = /gate_action\s*\(([\s\S]*?)\)/gi;
    for (const gm of stripped.matchAll(gateCallRe)) {
      const argsRegion = gm[1];
      const named = argsRegion.match(
        /p_capability\s*=>\s*'([a-z_][a-z0-9_]*(?:\.[a-z_][a-z0-9_]*)*)'/i,
      );
      if (named && accept(named[1])) {
        seeded.add(named[1]);
      }
    }
  }
  return seeded;
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

  const literals = new Set<string>();
  const dynamicUngated: Finding[] = [];
  const dynamicMissingMarker: Finding[] = [];
  const literalSites = new Map<string, Finding[]>();

  for (const f of findings) {
    if (f.capability === null) {
      if (f.ungated) dynamicUngated.push(f);
      else dynamicMissingMarker.push(f);
      continue;
    }
    literals.add(f.capability);
    const arr = literalSites.get(f.capability) ?? [];
    arr.push(f);
    literalSites.set(f.capability, arr);
  }

  const seeded = extractSeededCapabilities(MIGRATIONS_DIR);

  const missing: Array<{ capability: string; sites: Finding[] }> = [];
  for (const cap of [...literals].sort()) {
    if (!seeded.has(cap)) {
      missing.push({ capability: cap, sites: literalSites.get(cap) ?? [] });
    }
  }

  const report: ParityReport = {
    scannedFiles,
    callSites: scan.callSites,
    literals: [...literals].sort(),
    dynamicUngated,
    dynamicMissingMarker,
    seededCapabilities: [...seeded].sort(),
    missingSeeds: missing,
    ok: missing.length === 0 && dynamicMissingMarker.length === 0,
  };

  renderReport(report);

  // Last line: JSON summary for CI parsing.
  // eslint-disable-next-line no-console
  console.log("AUTHORITY_SEED_PARITY_JSON=" + JSON.stringify(report));

  process.exit(report.ok ? 0 : 1);
}

function renderReport(report: ParityReport): void {
  const log = (s: string = "") => console.log(s);
  log("");
  log("============================================================");
  log("ADR-0189 — Authority Seed Parity Report");
  log("============================================================");
  log(`Scanned files       : ${report.scannedFiles}`);
  log(`gate_action sites   : ${report.callSites}`);
  log(`Literal capabilities: ${report.literals.length}`);
  log(`Seeded capabilities : ${report.seededCapabilities.length}`);
  log("");

  if (report.dynamicMissingMarker.length > 0) {
    log("❌ Dynamic capability args without @authority-gate-ungated marker:");
    for (const f of report.dynamicMissingMarker) {
      log(`  ${f.file}:${f.line}:${f.column}  [${f.callKind}]`);
      log(`    ${f.snippet}`);
    }
    log("");
  }

  if (report.dynamicUngated.length > 0) {
    log(
      `ℹ  ${report.dynamicUngated.length} dynamic call(s) annotated with @authority-gate-ungated (accepted).`,
    );
    log("");
  }

  if (report.missingSeeds.length === 0) {
    log("✅ Every literal capability has a matching engine_authority_config seed.");
  } else {
    log(`❌ Missing seeds for ${report.missingSeeds.length} capability literal(s):`);
    log("");
    log("  capability                                        site(s)");
    log(
      "  ────────────────────────────────────────────────  ──────────────────────────────────────────",
    );
    for (const m of report.missingSeeds) {
      const head = m.sites[0];
      log(`  ${m.capability.padEnd(48)}  ${head ? head.file + ":" + head.line : "(no site)"}`);
      for (const site of m.sites.slice(1)) {
        log(`  ${"".padEnd(48)}  ${site.file}:${site.line}`);
      }
    }
    log("");
    log("Fix: add an INSERT INTO engine_authority_config row for each missing capability");
    log("     in a new supabase/migrations/*.sql file (follow pattern from");
    log("     20260516100000_seed_reconciliation_authority.sql).");
  }
  log("");
  log(report.ok ? "PASS" : "FAIL");
  log("============================================================");
}

main();
