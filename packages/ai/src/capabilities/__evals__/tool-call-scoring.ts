import type { Fixture } from "./fixtures/_schema.js";

/**
 * Per-fixture outcome of a tool-call eval.
 *
 *  - `pass`     : correct tool name AND every expected arg matches
 *  - `partial`  : correct tool name BUT at least one arg differs from expected
 *  - `fail`     : wrong tool name (or no tool called)
 *  - `error`    : the LLM call threw, or returned an unexpected shape
 *
 * Partial is its own bucket because "right tool, wrong arg" tells a
 * different story than "wrong tool entirely". A model that picks the
 * right tool but fills in the wrong default value is fixable by prompt
 * tweaks; a model that picks the wrong tool needs a description rewrite.
 */
export type FixtureOutcome = "pass" | "partial" | "fail" | "error";

export type ObservedCall = {
  toolName: string;
  args: Record<string, unknown>;
};

export type FixtureScore = {
  fixtureId: string;
  outcome: FixtureOutcome;
  expectedToolName: string;
  actualToolName: string | null;
  expectedArgs: Record<string, unknown> | null;
  actualArgs: Record<string, unknown> | null;
  /** Args that were checked and did not match (key → expected/actual pair). */
  argMismatches: Array<{ key: string; expected: unknown; actual: unknown }>;
  errorMessage: string | null;
  durationMs: number;
};

export type SuiteReport = {
  suite: string;
  runAt: string;
  totals: {
    count: number;
    pass: number;
    partial: number;
    fail: number;
    error: number;
  };
  /** Strict accuracy = pass / count. */
  accuracy: number;
  /** Lenient accuracy treats `partial` as pass — useful for tracking
   * "right tool, slightly off args". */
  lenientAccuracy: number;
  perTool: Record<
    string,
    {
      count: number;
      pass: number;
      partial: number;
      fail: number;
      error: number;
      accuracy: number;
    }
  >;
  rows: FixtureScore[];
};

/** Score one fixture against an observed tool call (or thrown error). */
export function scoreFixture(
  fixture: Fixture,
  observed: ObservedCall | Error | null,
  durationMs: number,
): FixtureScore {
  const base = {
    fixtureId: fixture.id,
    expectedToolName: fixture.expected.toolName,
    expectedArgs: fixture.expected.args ?? null,
    durationMs,
  };

  if (observed instanceof Error) {
    return {
      ...base,
      outcome: "error" as const,
      actualToolName: null,
      actualArgs: null,
      argMismatches: [],
      errorMessage: observed.message,
    };
  }

  if (observed === null) {
    return {
      ...base,
      outcome: "fail" as const,
      actualToolName: null,
      actualArgs: null,
      argMismatches: [],
      errorMessage: "model returned text instead of calling a tool",
    };
  }

  const toolMatches = observed.toolName === fixture.expected.toolName;
  if (!toolMatches) {
    return {
      ...base,
      outcome: "fail" as const,
      actualToolName: observed.toolName,
      actualArgs: observed.args,
      argMismatches: [],
      errorMessage: null,
    };
  }

  // Right tool — now check the args we care about.
  const expectedArgs = fixture.expected.args ?? {};
  const mismatches: Array<{ key: string; expected: unknown; actual: unknown }> = [];
  for (const [key, expected] of Object.entries(expectedArgs)) {
    const actual = observed.args[key];
    if (!deepEqualPrimitive(expected, actual)) {
      mismatches.push({ key, expected, actual });
    }
  }

  return {
    ...base,
    outcome: mismatches.length === 0 ? ("pass" as const) : ("partial" as const),
    actualToolName: observed.toolName,
    actualArgs: observed.args,
    argMismatches: mismatches,
    errorMessage: null,
  };
}

/** Strict equality for primitives. Object/array equality is deliberately
 * out of scope — fixtures should only assert primitive args. */
function deepEqualPrimitive(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  // Handle number coercion for fixtures that say e.g. days: 7 against
  // a model that returns 7.0 — JS treats them as equal already, so this
  // is mostly defensive.
  if (typeof a === "number" && typeof b === "number") return a === b;
  return false;
}

/** Aggregate fixture scores into a suite-level report. */
export function buildReport(suite: string, rows: FixtureScore[]): SuiteReport {
  const totals = { count: rows.length, pass: 0, partial: 0, fail: 0, error: 0 };
  const perTool: SuiteReport["perTool"] = {};

  for (const row of rows) {
    totals[row.outcome] += 1;
    const bucket = (perTool[row.expectedToolName] ??= {
      count: 0,
      pass: 0,
      partial: 0,
      fail: 0,
      error: 0,
      accuracy: 0,
    });
    bucket.count += 1;
    bucket[row.outcome] += 1;
  }

  for (const bucket of Object.values(perTool)) {
    bucket.accuracy = bucket.count === 0 ? 0 : bucket.pass / bucket.count;
  }

  return {
    suite,
    runAt: new Date().toISOString(),
    totals,
    accuracy: totals.count === 0 ? 0 : totals.pass / totals.count,
    lenientAccuracy: totals.count === 0 ? 0 : (totals.pass + totals.partial) / totals.count,
    perTool,
    rows,
  };
}

/** Render a suite report as a markdown document. */
export function renderReportMarkdown(report: SuiteReport): string {
  const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
  const lines: string[] = [];

  lines.push(`# Tool-call eval report — ${report.suite}`);
  lines.push("");
  lines.push(`Run at: \`${report.runAt}\``);
  lines.push("");

  lines.push("## Totals");
  lines.push("");
  lines.push("| Metric | Value |");
  lines.push("| --- | --- |");
  lines.push(`| Fixtures | ${report.totals.count} |`);
  lines.push(`| Pass | ${report.totals.pass} |`);
  lines.push(`| Partial | ${report.totals.partial} |`);
  lines.push(`| Fail | ${report.totals.fail} |`);
  lines.push(`| Error | ${report.totals.error} |`);
  lines.push(`| Accuracy (strict) | ${pct(report.accuracy)} |`);
  lines.push(`| Accuracy (lenient) | ${pct(report.lenientAccuracy)} |`);
  lines.push("");

  lines.push("## Per-tool");
  lines.push("");
  lines.push("| Tool | Count | Pass | Partial | Fail | Error | Accuracy |");
  lines.push("| --- | --- | --- | --- | --- | --- | --- |");
  for (const [name, b] of Object.entries(report.perTool)) {
    lines.push(
      `| ${name} | ${b.count} | ${b.pass} | ${b.partial} | ${b.fail} | ${b.error} | ${pct(b.accuracy)} |`,
    );
  }
  lines.push("");

  lines.push("## Fixtures");
  lines.push("");
  lines.push("| ID | Outcome | Expected | Actual | Args | ms |");
  lines.push("| --- | --- | --- | --- | --- | --- |");
  for (const row of report.rows) {
    const actual = row.actualToolName ?? (row.errorMessage ? `ERROR` : "—");
    const argsCell = renderArgsCell(row);
    lines.push(
      `| ${row.fixtureId} | ${row.outcome} | ${row.expectedToolName} | ${actual} | ${argsCell} | ${row.durationMs} |`,
    );
  }
  lines.push("");

  // If there were errors, list their messages so debug doesn't require
  // re-running the eval.
  const errorRows = report.rows.filter((r) => r.errorMessage);
  if (errorRows.length > 0) {
    lines.push("## Error details");
    lines.push("");
    for (const row of errorRows) {
      lines.push(`- **${row.fixtureId}**: ${row.errorMessage}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

function renderArgsCell(row: FixtureScore): string {
  if (row.outcome === "pass" && row.expectedArgs && Object.keys(row.expectedArgs).length > 0) {
    return "✓";
  }
  if (row.outcome === "partial" && row.argMismatches.length > 0) {
    return row.argMismatches
      .map((m) => `${m.key}: ${JSON.stringify(m.expected)}→${JSON.stringify(m.actual)}`)
      .join("; ");
  }
  if (row.actualArgs) return JSON.stringify(row.actualArgs).slice(0, 60);
  return "—";
}
