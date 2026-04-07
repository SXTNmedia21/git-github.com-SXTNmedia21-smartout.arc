import type { Capability, Fixture } from "./fixtures/_schema.js";
import type { IntentResult } from "../intent-classifier.js";

/**
 * Per-fixture result of running the intent classifier.
 *
 * We distinguish three outcomes:
 *  - `pass`: capability matches AND confidence >= minConfidence
 *  - `hedged`: capability matches but confidence < minConfidence
 *              (model was right but unsure — soft fail)
 *  - `fail`: capability does not match (hard fail)
 *  - `error`: classifier threw (API error, schema violation, etc.)
 */
export type FixtureOutcome = "pass" | "hedged" | "fail" | "error";

export type FixtureScore = {
  fixtureId: string;
  outcome: FixtureOutcome;
  expectedCapability: Capability;
  actualCapability: Capability | null;
  confidence: number | null;
  minConfidence: number;
  errorMessage: string | null;
  durationMs: number;
};

export type SuiteReport = {
  suite: string;
  runAt: string;
  totals: {
    count: number;
    pass: number;
    hedged: number;
    fail: number;
    error: number;
  };
  /** Accuracy = pass / count. Hedged NOT counted as pass. */
  accuracy: number;
  /** Accuracy where hedged counts as pass — useful for tracking "right answer, unsure model". */
  lenientAccuracy: number;
  perCapability: Record<
    string,
    { count: number; pass: number; hedged: number; fail: number; error: number; accuracy: number }
  >;
  /** Rows for each fixture, in stable order. */
  rows: FixtureScore[];
};

/** Score a single fixture against an IntentResult (or an error). */
export function scoreFixture(
  fixture: Fixture,
  result: IntentResult | Error,
  durationMs: number,
): FixtureScore {
  if (result instanceof Error) {
    return {
      fixtureId: fixture.id,
      outcome: "error",
      expectedCapability: fixture.expected.capability,
      actualCapability: null,
      confidence: null,
      minConfidence: fixture.expected.minConfidence,
      errorMessage: result.message,
      durationMs,
    };
  }

  const matches = result.capability === fixture.expected.capability;
  const confident = result.confidence >= fixture.expected.minConfidence;

  let outcome: FixtureOutcome;
  if (!matches) outcome = "fail";
  else if (!confident) outcome = "hedged";
  else outcome = "pass";

  return {
    fixtureId: fixture.id,
    outcome,
    expectedCapability: fixture.expected.capability,
    // Cast is safe: the classifier schema restricts this to Capability.
    actualCapability: result.capability as Capability,
    confidence: result.confidence,
    minConfidence: fixture.expected.minConfidence,
    errorMessage: null,
    durationMs,
  };
}

/** Aggregate fixture scores into a suite-level report. */
export function buildReport(suite: string, rows: FixtureScore[]): SuiteReport {
  const totals = { count: rows.length, pass: 0, hedged: 0, fail: 0, error: 0 };
  const perCap: SuiteReport["perCapability"] = {};

  for (const row of rows) {
    totals[row.outcome] += 1;

    const bucket = (perCap[row.expectedCapability] ??= {
      count: 0,
      pass: 0,
      hedged: 0,
      fail: 0,
      error: 0,
      accuracy: 0,
    });
    bucket.count += 1;
    bucket[row.outcome] += 1;
  }

  for (const bucket of Object.values(perCap)) {
    bucket.accuracy = bucket.count === 0 ? 0 : bucket.pass / bucket.count;
  }

  return {
    suite,
    runAt: new Date().toISOString(),
    totals,
    accuracy: totals.count === 0 ? 0 : totals.pass / totals.count,
    lenientAccuracy: totals.count === 0 ? 0 : (totals.pass + totals.hedged) / totals.count,
    perCapability: perCap,
    rows,
  };
}

/** Render a suite report as a human-readable markdown document. */
export function renderReportMarkdown(report: SuiteReport): string {
  const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
  const lines: string[] = [];

  lines.push(`# Eval report — ${report.suite}`);
  lines.push("");
  lines.push(`Run at: \`${report.runAt}\``);
  lines.push("");
  lines.push("## Totals");
  lines.push("");
  lines.push("| Metric | Value |");
  lines.push("| --- | --- |");
  lines.push(`| Fixtures | ${report.totals.count} |`);
  lines.push(`| Pass | ${report.totals.pass} |`);
  lines.push(`| Hedged | ${report.totals.hedged} |`);
  lines.push(`| Fail | ${report.totals.fail} |`);
  lines.push(`| Error | ${report.totals.error} |`);
  lines.push(`| Accuracy (strict) | ${pct(report.accuracy)} |`);
  lines.push(`| Accuracy (lenient) | ${pct(report.lenientAccuracy)} |`);
  lines.push("");

  lines.push("## Per-capability");
  lines.push("");
  lines.push("| Capability | Count | Pass | Hedged | Fail | Error | Accuracy |");
  lines.push("| --- | --- | --- | --- | --- | --- | --- |");
  for (const [cap, b] of Object.entries(report.perCapability)) {
    lines.push(
      `| ${cap} | ${b.count} | ${b.pass} | ${b.hedged} | ${b.fail} | ${b.error} | ${pct(b.accuracy)} |`,
    );
  }
  lines.push("");

  lines.push("## Fixtures");
  lines.push("");
  lines.push("| ID | Outcome | Expected | Actual | Confidence | ms |");
  lines.push("| --- | --- | --- | --- | --- | --- |");
  for (const row of report.rows) {
    const conf = row.confidence === null ? "—" : row.confidence.toFixed(2);
    const actual = row.actualCapability ?? (row.errorMessage ? `ERROR: ${row.errorMessage}` : "—");
    lines.push(
      `| ${row.fixtureId} | ${row.outcome} | ${row.expectedCapability} | ${actual} | ${conf} | ${row.durationMs} |`,
    );
  }
  lines.push("");

  return lines.join("\n");
}
