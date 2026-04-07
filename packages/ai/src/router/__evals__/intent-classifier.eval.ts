import { describe, it, expect, beforeAll } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { classifyIntent } from "../intent-classifier.js";
import { fixtureFileSchema, type Fixture } from "./fixtures/_schema.js";
import { intentSeed } from "./fixtures/intent-seed.js";
import {
  buildReport,
  renderReportMarkdown,
  scoreFixture,
  type FixtureScore,
  type SuiteReport,
} from "./scoring.js";

/**
 * Intent classifier eval.
 *
 * Calls the real OpenRouter-backed classifier for each fixture and
 * produces a markdown report at `reports/<timestamp>-<suite>.md`.
 *
 * Gating:
 *  - `RUN_EVALS=1` must be set (otherwise the suite is skipped).
 *  - `OPENROUTER_API_KEY` must be set (the classifier throws without it).
 *
 * Eval is NOT a strict pass/fail suite. The only hard assertion is that
 * strict accuracy does not fall below `MIN_STRICT_ACCURACY`. Everything
 * else is observed via the generated report.
 */

const RUN_EVALS = process.env.RUN_EVALS === "1";
const MIN_STRICT_ACCURACY = 0.7;

const thisDir = dirname(fileURLToPath(import.meta.url));
const reportDir = join(thisDir, "reports");

// Skip the entire suite if not explicitly opted in — keeps CI free.
const suite = RUN_EVALS ? describe : describe.skip;

suite("intent-classifier eval", () => {
  let parsed: { suite: string; fixtures: Fixture[] };
  let rows: FixtureScore[] = [];
  let report: SuiteReport;

  beforeAll(() => {
    parsed = fixtureFileSchema.parse(intentSeed);
    if (!process.env.OPENROUTER_API_KEY) {
      throw new Error(
        "OPENROUTER_API_KEY required to run evals. Set it in your shell or via 1Password.",
      );
    }
  });

  it("classifies every fixture and writes a report", async () => {
    rows = [];

    for (const fixture of parsed.fixtures) {
      const started = Date.now();
      try {
        const result = await classifyIntent(fixture.message, fixture.context);
        rows.push(scoreFixture(fixture, result, Date.now() - started));
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        rows.push(scoreFixture(fixture, error, Date.now() - started));
      }
    }

    report = buildReport(parsed.suite, rows);

    mkdirSync(reportDir, { recursive: true });
    const markdown = renderReportMarkdown(report);
    const stamp = report.runAt.replace(/[:.]/g, "-");
    const timestampedPath = join(reportDir, `${stamp}-${parsed.suite}.md`);
    // `latest.md` is a stable path so diffs and CI jobs can reference
    // "the most recent eval" without knowing the timestamp. Overwritten
    // on every run; the timestamped file is the immutable history.
    const latestPath = join(reportDir, `latest-${parsed.suite}.md`);
    writeFileSync(timestampedPath, markdown, "utf8");
    writeFileSync(latestPath, markdown, "utf8");

    // Log a short summary to the eval runner stdout so the user can
    // see at-a-glance accuracy without opening the markdown file.
    // eslint-disable-next-line no-console
    console.log(
      `\n[eval] ${parsed.suite}: strict=${(report.accuracy * 100).toFixed(1)}% ` +
        `lenient=${(report.lenientAccuracy * 100).toFixed(1)}% ` +
        `(pass=${report.totals.pass} hedged=${report.totals.hedged} ` +
        `fail=${report.totals.fail} error=${report.totals.error})\n` +
        `       history: ${timestampedPath}\n` +
        `       latest:  ${latestPath}\n`,
    );
  });

  it("strict accuracy is above regression floor", () => {
    expect(report.accuracy).toBeGreaterThanOrEqual(MIN_STRICT_ACCURACY);
  });
});
