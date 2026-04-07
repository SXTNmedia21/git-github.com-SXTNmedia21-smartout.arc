import type { Fixture } from "./fixtures/_schema.js";

/**
 * Per-fixture outcome of an extraction eval.
 *
 *  - `pass`     : every asserted field matched its assertion
 *  - `partial`  : at least one assertion matched but at least one failed
 *  - `fail`     : zero assertions matched, or extracted object is invalid
 *  - `error`    : extraction call threw
 *
 * Partial is its own bucket because field-level extraction is rarely
 * all-or-nothing — a model might get 4 of 5 fields right. The strict
 * accuracy uses `pass`, the lenient accuracy adds `partial` for
 * "mostly-there" tracking.
 */
export type FixtureOutcome = "pass" | "partial" | "fail" | "error";

export type AssertionResult = {
  field: string;
  passed: boolean;
  reason: string;
};

export type FixtureScore = {
  fixtureId: string;
  outcome: FixtureOutcome;
  /** Per-field assertion outcomes. Empty when outcome is "error". */
  assertions: AssertionResult[];
  /** The actual extracted object. Null when extraction threw. */
  extracted: Record<string, unknown> | null;
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
  accuracy: number;
  lenientAccuracy: number;
  /** Per-field hit rate across all fixtures (across whichever fixtures
   * asserted on that field). */
  perField: Record<string, { asserted: number; passed: number; rate: number }>;
  rows: FixtureScore[];
};

/**
 * Score one fixture against an extracted object (or thrown error).
 */
export function scoreFixture(
  fixture: Fixture,
  extracted: Record<string, unknown> | Error,
  durationMs: number,
): FixtureScore {
  if (extracted instanceof Error) {
    return {
      fixtureId: fixture.id,
      outcome: "error",
      assertions: [],
      extracted: null,
      errorMessage: extracted.message,
      durationMs,
    };
  }

  const results: AssertionResult[] = [];
  for (const [field, assertion] of Object.entries(fixture.expected)) {
    const actual = extracted[field];
    results.push(checkAssertion(field, actual, assertion));
  }

  const passedCount = results.filter((r) => r.passed).length;
  let outcome: FixtureOutcome;
  if (passedCount === results.length) outcome = "pass";
  else if (passedCount === 0) outcome = "fail";
  else outcome = "partial";

  return {
    fixtureId: fixture.id,
    outcome,
    assertions: results,
    extracted,
    errorMessage: null,
    durationMs,
  };
}

function checkAssertion(
  field: string,
  actual: unknown,
  assertion: Fixture["expected"][string],
): AssertionResult {
  switch (assertion.kind) {
    case "present": {
      if (actual === null || actual === undefined) {
        return { field, passed: false, reason: "expected present, got null/undefined" };
      }
      if (Array.isArray(actual) && actual.length === 0) {
        return { field, passed: false, reason: "expected present, got empty array" };
      }
      if (typeof actual === "string" && actual.trim() === "") {
        return { field, passed: false, reason: "expected present, got empty string" };
      }
      return { field, passed: true, reason: "present" };
    }
    case "absent": {
      const isAbsent =
        actual === null ||
        actual === undefined ||
        (Array.isArray(actual) && actual.length === 0) ||
        (typeof actual === "string" && actual.trim() === "");
      return {
        field,
        passed: isAbsent,
        reason: isAbsent ? "absent" : `expected absent, got ${shortRender(actual)}`,
      };
    }
    case "equals": {
      const equals = deepEqual(actual, assertion.value);
      return {
        field,
        passed: equals,
        reason: equals
          ? "equals"
          : `expected ${shortRender(assertion.value)}, got ${shortRender(actual)}`,
      };
    }
  }
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((v, i) => v === b[i]);
  }
  return false;
}

function shortRender(v: unknown): string {
  if (v === null) return "null";
  if (v === undefined) return "undefined";
  if (Array.isArray(v)) return `[${v.slice(0, 3).map(String).join(", ")}${v.length > 3 ? "…" : ""}]`;
  if (typeof v === "string") return `"${v.slice(0, 30)}${v.length > 30 ? "…" : ""}"`;
  return String(v);
}

export function buildReport(suite: string, rows: FixtureScore[]): SuiteReport {
  const totals = { count: rows.length, pass: 0, partial: 0, fail: 0, error: 0 };
  const perField: SuiteReport["perField"] = {};

  for (const row of rows) {
    totals[row.outcome] += 1;
    for (const a of row.assertions) {
      const bucket = (perField[a.field] ??= { asserted: 0, passed: 0, rate: 0 });
      bucket.asserted += 1;
      if (a.passed) bucket.passed += 1;
    }
  }

  for (const bucket of Object.values(perField)) {
    bucket.rate = bucket.asserted === 0 ? 0 : bucket.passed / bucket.asserted;
  }

  return {
    suite,
    runAt: new Date().toISOString(),
    totals,
    accuracy: totals.count === 0 ? 0 : totals.pass / totals.count,
    lenientAccuracy:
      totals.count === 0 ? 0 : (totals.pass + totals.partial) / totals.count,
    perField,
    rows,
  };
}

export function renderReportMarkdown(report: SuiteReport): string {
  const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
  const lines: string[] = [];

  lines.push(`# Extraction eval report — ${report.suite}`);
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

  lines.push("## Per-field hit rate");
  lines.push("");
  lines.push("| Field | Asserted | Passed | Rate |");
  lines.push("| --- | --- | --- | --- |");
  for (const [field, b] of Object.entries(report.perField)) {
    lines.push(`| ${field} | ${b.asserted} | ${b.passed} | ${pct(b.rate)} |`);
  }
  lines.push("");

  lines.push("## Fixtures");
  lines.push("");
  lines.push("| ID | Outcome | Pass / Asserted | ms |");
  lines.push("| --- | --- | --- | --- |");
  for (const row of report.rows) {
    const passed = row.assertions.filter((a) => a.passed).length;
    lines.push(
      `| ${row.fixtureId} | ${row.outcome} | ${passed} / ${row.assertions.length} | ${row.durationMs} |`,
    );
  }
  lines.push("");

  // Surface failing assertions and error messages so debug doesn't need a re-run.
  const detailRows = report.rows.filter(
    (r) => r.outcome === "fail" || r.outcome === "partial" || r.errorMessage,
  );
  if (detailRows.length > 0) {
    lines.push("## Failure details");
    lines.push("");
    for (const row of detailRows) {
      lines.push(`### ${row.fixtureId}`);
      if (row.errorMessage) {
        lines.push(`- ERROR: ${row.errorMessage}`);
      } else {
        for (const a of row.assertions.filter((x) => !x.passed)) {
          lines.push(`- **${a.field}**: ${a.reason}`);
        }
      }
      lines.push("");
    }
  }

  return lines.join("\n");
}
