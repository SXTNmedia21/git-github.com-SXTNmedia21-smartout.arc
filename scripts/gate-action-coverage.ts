#!/usr/bin/env tsx
/**
 * gate-action-coverage.ts — ADR-0287 enforcement CI lint.
 *
 * Walks every capability tool file under
 * `packages/ai/src/capabilities/**\/tools.ts` and rejects any tool whose
 * `execute` body performs a Supabase state mutation (`.insert()`,
 * `.update()`, `.delete()`, `.upsert()`) without a gate call upstream of
 * the mutation. Closes the F-DB-11 enforcement gap from the
 * 2026-05-13 audit.
 *
 * Why this exists:
 *   ADR-0287 promotes "every capability mutation tool calls gate_action
 *   before any DB write" from convention to enforced rule after three
 *   independent occurrences of the omission (shift_swap, contract_intake,
 *   helpdesk Phase 0). Per the same ADR's promotion rule (3 occurrences
 *   → enforced rule), this becomes a hard invariant. ADR-0204's
 *   gatedMutation orchestrator existed but had no CI guarantee its
 *   call-sites were complete. This script is that guarantee.
 *
 * What counts as "a gate call":
 *   Any of the recognised gate-helper identifiers inside the same
 *   `execute` body as the mutation:
 *     - `mutateWithGate(`   — the new ergonomic wrapper (ADR-0287)
 *     - `gatedMutation(`    — the composition orchestrator (ADR-0204)
 *     - `callGateAction(`   — legacy per-cap thin wrapper
 *     - `gateTaskAction(`   — task-specific wrapper (same shape)
 *     - `gate_action`       — direct SQL RPC (transitional / sentinel
 *                             check for files that haven't migrated)
 *   The mutation-call-site check is identifier-based, not ordering-based:
 *   if the body contains both a mutation token AND a gate token, we
 *   trust the author (matches ADR-0287 §"Bad, because" AST fragility
 *   mitigation). The orchestrator + wrappers are the load-bearing
 *   ordering enforcers — they evaluate authority FIRST internally.
 *
 * Override:
 *   Inline `// @gate-action-exempt: ADR-NNNN <reason>` on the line
 *   immediately preceding a `tool({...})` declaration exempts that tool.
 *   Use for read-only-but-shaped-like-a-mutation cases (e.g. tools that
 *   .update() a session-state row that has no workspace_id and no
 *   authority semantics).
 *
 * Modes:
 *   --baseline   (default)  warn + exit 0; documents counts. CI-safe.
 *   --strict                exit 1 on any violation. For local pre-merge
 *                           runs and the post-grace-period CI switch.
 *
 * Run:
 *   npx tsx scripts/gate-action-coverage.ts --baseline
 *   npx tsx scripts/gate-action-coverage.ts --strict
 *
 * Exit codes:
 *   0 — no violations (or --baseline mode irrespective of count).
 *   1 — violations exist and mode is --strict.
 *   2 — script-internal error (parse failure, missing files).
 *
 * canonical helper: packages/ai/src/capabilities/_shared/mutate-with-gate.ts
 * ADR: docs/decisions/0287-gate-action-mandatory-on-mutation-capability-tools.md
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const ROOT = resolve(__dirname, "..");
const CAPABILITIES_DIR = join(ROOT, "packages", "ai", "src", "capabilities");

// ─────────────────────────────────────────────────────────────────────────
// Recognised tokens
// ─────────────────────────────────────────────────────────────────────────

/**
 * Supabase mutation method names. Anchored on `.<method>(` to avoid
 * matching e.g. "updates" or "deleted" in field names. Detection is
 * line-based — we don't need full AST awareness, just "this body
 * contains a mutation call".
 */
const MUTATION_PATTERNS: RegExp[] = [
  /\.insert\s*\(/,
  /\.update\s*\(/,
  /\.delete\s*\(/,
  /\.upsert\s*\(/,
];

/**
 * Gate-helper identifiers. Any of these in the same execute body
 * counts as "this tool is gated". See module docstring for rationale.
 *
 * The patterns deliberately catch the canonical entry points
 * (`mutateWithGate`, `gatedMutation`, `callGateAction`) plus the
 * conventional camelCase shape `gate<PascalCase>(...)` which captures
 * per-capability wrappers without an allow-list. Examples:
 *   - `gateTaskAction(`           — task/gate.ts
 *   - `gateMutation(`             — contract/tools.ts local helper
 *   - `gateScheduleAction(`       — schedule (when wired)
 *   - `gatePayrollAction(`        — payroll/gate.ts
 *
 * The convention is documented in ADR-0287: per-capability gate
 * wrappers SHOULD start with `gate` and call into `callGateAction` or
 * `gatedMutation`. Calling these helpers IS calling the gate.
 *
 * Final pattern `gate_action` catches the rare direct supabase.rpc()
 * sentinel.
 */
const GATE_PATTERNS: RegExp[] = [
  /\bmutateWithGate\s*\(/,
  /\bgatedMutation\s*\(/,
  /\bcallGateAction\s*\(/,
  /\bgate[A-Z]\w*\s*\(/, // gateMutation, gateTaskAction, gateScheduleAction, …
  /\bgate_action\b/, // direct supabase.rpc("gate_action", …) sentinel
];

const EXEMPT_ANNOTATION = /^\s*\/\/\s*@gate-action-exempt:\s*(.+)$/;

// ─────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────

type ToolFinding = {
  capability: string;
  file: string;
  toolStartLine: number; // 1-indexed
  toolName: string | null; // best-effort from name: "..." field
  hasMutation: boolean;
  hasGate: boolean;
  exemptReason: string | null;
};

type Counts = {
  passing: number;
  violating: number;
  exempt: number;
  readOnly: number; // tool exists, no mutation, no gate needed
};

// ─────────────────────────────────────────────────────────────────────────
// Walk capabilities/
// ─────────────────────────────────────────────────────────────────────────

function findToolsFiles(): string[] {
  if (!existsSync(CAPABILITIES_DIR)) return [];

  const out: string[] = [];
  for (const entry of readdirSync(CAPABILITIES_DIR)) {
    if (entry.startsWith("_") || entry.startsWith("__")) continue; // _shared, __tests__
    const sub = join(CAPABILITIES_DIR, entry);
    const stat = statSync(sub);
    if (!stat.isDirectory()) continue;
    const toolsFile = join(sub, "tools.ts");
    if (existsSync(toolsFile)) out.push(toolsFile);
  }
  return out.sort();
}

// ─────────────────────────────────────────────────────────────────────────
// Parse tools.ts → enumerate tools with start/end line spans
// ─────────────────────────────────────────────────────────────────────────

/**
 * Identify each `defineTool({...})` (or compatible factory) block via a
 * brace-counting walk.
 *
 * Why not ts-morph: this file ships in `scripts/` and runs in pure
 * Node. Avoiding ts-morph keeps the script lightweight + dependency-
 * scoped. The brace-counter is sufficient because tool declarations
 * have a stable shape:
 *
 *   export const foo = defineTool({
 *     name: "foo",
 *     description: "...",
 *     parameters: ...,
 *     execute: async (params, ctx) => { ... },
 *   });
 *
 * We don't need full TypeScript parsing — just "find each
 * `defineTool({` opening and walk braces to its closing `})`". The
 * mutation + gate token checks then run on the substring.
 *
 * The pattern matches `defineTool` (canonical) and `tool` (Vercel AI SDK
 * alias used by a few legacy capabilities) — both produce the same shape.
 */
function findToolBlocks(text: string): Array<{ start: number; end: number; startLine: number }> {
  const blocks: Array<{ start: number; end: number; startLine: number }> = [];
  const lines = text.split("\n");

  let charIdx = 0;
  const lineStartOffsets: number[] = [0];
  for (let i = 0; i < lines.length; i++) {
    charIdx += lines[i].length + 1; // +1 for newline
    lineStartOffsets.push(charIdx);
  }

  // Walk text searching for `defineTool({` (or `tool({`) openings.
  // Capability `defineTool` is the SmartoutTool factory; `tool` is the
  // Vercel-AI-SDK alias used by a few tools that wire directly to AI SDK.
  const re = /\b(?:defineTool|tool)\s*\(\s*{/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const openIdx = m.index + m[0].length - 1; // index of the `{`
    // Brace-walk forward to find the matching close.
    let depth = 1;
    let i = openIdx + 1;
    let inString: "'" | '"' | "`" | null = null;
    let inLineComment = false;
    let inBlockComment = false;
    while (i < text.length && depth > 0) {
      const ch = text[i];
      const next = text[i + 1];
      if (inLineComment) {
        if (ch === "\n") inLineComment = false;
      } else if (inBlockComment) {
        if (ch === "*" && next === "/") {
          inBlockComment = false;
          i++;
        }
      } else if (inString) {
        if (ch === "\\") {
          i++;
        } else if (ch === inString) {
          inString = null;
        }
      } else {
        if (ch === "/" && next === "/") inLineComment = true;
        else if (ch === "/" && next === "*") {
          inBlockComment = true;
          i++;
        } else if (ch === "'" || ch === '"' || ch === "`") inString = ch;
        else if (ch === "{") depth++;
        else if (ch === "}") depth--;
      }
      i++;
    }
    if (depth !== 0) continue; // malformed; skip

    const closeIdx = i; // position just after the matching `}`
    // Find the `tool(` open line (1-indexed).
    let startLine = 1;
    for (let l = 0; l < lineStartOffsets.length - 1; l++) {
      if (lineStartOffsets[l] <= m.index && m.index < lineStartOffsets[l + 1]) {
        startLine = l + 1;
        break;
      }
    }
    blocks.push({ start: m.index, end: closeIdx, startLine });
    // Restart regex from the closing brace so we don't recurse.
    re.lastIndex = closeIdx;
  }
  return blocks;
}

/**
 * Pull the `name: "..."` literal out of a tool body, best-effort.
 * Used only for diagnostic output — a tool with no name field still
 * runs the gate-coverage check.
 */
function extractToolName(toolBody: string): string | null {
  const m = toolBody.match(/\bname\s*:\s*["']([^"']+)["']/);
  return m ? m[1] : null;
}

/**
 * Find a preceding `// @gate-action-exempt:` annotation on any of the
 * three lines immediately above the tool opening.
 *
 * Why three lines: tool declarations often have a JSDoc block above
 * them; the exempt annotation is usually placed between the JSDoc and
 * the `export const x = tool(`. We accept up to 3 lines of leeway.
 */
function findExemption(lines: string[], startLine: number): string | null {
  for (let i = startLine - 2; i >= Math.max(0, startLine - 5); i--) {
    const line = lines[i];
    if (line === undefined) break;
    const trimmed = line.trim();
    if (trimmed === "") continue;
    const m = trimmed.match(EXEMPT_ANNOTATION);
    if (m) return m[1];
    // First non-blank, non-exempt line → stop scanning upward.
    break;
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────
// Main check
// ─────────────────────────────────────────────────────────────────────────

function analyzeFile(filePath: string): ToolFinding[] {
  const text = readFileSync(filePath, "utf8");
  const lines = text.split("\n");
  const capability = relative(CAPABILITIES_DIR, filePath).split("/")[0];

  const blocks = findToolBlocks(text);
  const findings: ToolFinding[] = [];

  for (const block of blocks) {
    const body = text.slice(block.start, block.end);
    const toolName = extractToolName(body);
    const exemptReason = findExemption(lines, block.startLine);

    const hasMutation = MUTATION_PATTERNS.some((re) => re.test(body));
    const hasGate = GATE_PATTERNS.some((re) => re.test(body));

    findings.push({
      capability,
      file: filePath,
      toolStartLine: block.startLine,
      toolName,
      hasMutation,
      hasGate,
      exemptReason,
    });
  }

  return findings;
}

function classify(finding: ToolFinding): "passing" | "violating" | "exempt" | "read-only" {
  if (!finding.hasMutation) return "read-only";
  if (finding.exemptReason) return "exempt";
  if (finding.hasGate) return "passing";
  return "violating";
}

function summarize(findings: ToolFinding[]): Map<string, Counts> {
  const byCapability = new Map<string, Counts>();
  for (const f of findings) {
    const cur = byCapability.get(f.capability) ?? {
      passing: 0,
      violating: 0,
      exempt: 0,
      readOnly: 0,
    };
    const c = classify(f);
    if (c === "passing") cur.passing++;
    else if (c === "violating") cur.violating++;
    else if (c === "exempt") cur.exempt++;
    else cur.readOnly++;
    byCapability.set(f.capability, cur);
  }
  return byCapability;
}

function renderTable(byCapability: Map<string, Counts>): string {
  const rows: string[] = [];
  rows.push(
    "Capability".padEnd(30) +
      "passing".padStart(9) +
      "violating".padStart(11) +
      "exempt".padStart(9) +
      "read-only".padStart(11),
  );
  rows.push("-".repeat(70));
  let totalPass = 0,
    totalViol = 0,
    totalExempt = 0,
    totalRO = 0;
  const caps = Array.from(byCapability.keys()).sort();
  for (const cap of caps) {
    const c = byCapability.get(cap)!;
    totalPass += c.passing;
    totalViol += c.violating;
    totalExempt += c.exempt;
    totalRO += c.readOnly;
    rows.push(
      cap.padEnd(30) +
        String(c.passing).padStart(9) +
        String(c.violating).padStart(11) +
        String(c.exempt).padStart(9) +
        String(c.readOnly).padStart(11),
    );
  }
  rows.push("-".repeat(70));
  rows.push(
    "TOTAL".padEnd(30) +
      String(totalPass).padStart(9) +
      String(totalViol).padStart(11) +
      String(totalExempt).padStart(9) +
      String(totalRO).padStart(11),
  );
  return rows.join("\n");
}

function renderViolations(findings: ToolFinding[]): string {
  const violators = findings.filter((f) => classify(f) === "violating");
  if (violators.length === 0) return "";
  const lines: string[] = [];
  lines.push(`\n${violators.length} tool(s) mutate without gate (ADR-0287):`);
  for (const v of violators) {
    const rel = relative(ROOT, v.file);
    const named = v.toolName ?? "<unnamed>";
    lines.push(`  ✗ ${rel}:${v.toolStartLine}  tool="${named}"  capability=${v.capability}`);
  }
  lines.push("");
  lines.push("Fix: wrap the mutation in mutateWithGate(...) or call callGateAction(...)");
  lines.push("     before the .insert / .update / .delete / .upsert.");
  lines.push("Helper:   packages/ai/src/capabilities/_shared/mutate-with-gate.ts");
  lines.push("ADR:      docs/decisions/0287-gate-action-mandatory-on-mutation-capability-tools.md");
  lines.push("");
  lines.push("If the tool is intentionally exempt, add this line ABOVE the tool({…})");
  lines.push("declaration with a justifying ADR or ticket:");
  lines.push("  // @gate-action-exempt: ADR-NNNN <one-line reason>");
  return lines.join("\n");
}

// ─────────────────────────────────────────────────────────────────────────
// Entry
// ─────────────────────────────────────────────────────────────────────────

function main(): void {
  const strict = process.argv.includes("--strict");
  const baseline = process.argv.includes("--baseline") || !strict;

  const files = findToolsFiles();
  if (files.length === 0) {
    console.warn(
      `[gate-action-coverage] no capability tools.ts files found under ${CAPABILITIES_DIR}`,
    );
    process.exit(2);
  }

  const allFindings: ToolFinding[] = [];
  for (const f of files) {
    try {
      allFindings.push(...analyzeFile(f));
    } catch (err) {
      console.error(`[gate-action-coverage] parse failed: ${relative(ROOT, f)}: ${err}`);
      process.exit(2);
    }
  }

  const byCapability = summarize(allFindings);
  const violators = allFindings.filter((f) => classify(f) === "violating");

  // Always render the table — operators want to see the shape regardless
  // of mode.
  const header = strict
    ? "[gate-action-coverage] STRICT mode (ADR-0287 enforcement)"
    : "[gate-action-coverage] BASELINE mode (warn-only)";
  console.log(header);
  console.log("");
  console.log(renderTable(byCapability));

  if (violators.length > 0) {
    console.log(renderViolations(allFindings));
  } else {
    console.log("\nAll capability tools are gated. Nothing to report.");
  }

  if (violators.length > 0 && strict) {
    process.exit(1);
  }
  process.exit(0);
}

main();
