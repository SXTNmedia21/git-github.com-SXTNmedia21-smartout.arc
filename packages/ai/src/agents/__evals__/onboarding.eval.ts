import { describe, it, expect, beforeAll } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import type { ModelMessage } from "ai";

import { extractOnboardingIntelligence } from "../onboarding.js";
import { fixtureFileSchema } from "./fixtures/_schema.js";
import {
  buildReport,
  renderReportMarkdown,
  scoreFixture,
  type FixtureScore,
  type SuiteReport,
} from "./extraction-scoring.js";
import { onboardingSeed } from "./fixtures/onboarding-seed.js";

/**
 * Onboarding extraction eval.
 *
 * Calls `extractOnboardingIntelligence` for each fixture and asserts
 * field-by-field that the model recovered what the conversation
 * contained (and only that — fields that weren't discussed must remain
 * null/empty). Field-by-field assertions because exact-match on names
 * would be too brittle ("Solsiden Bistro" vs "Solsiden bistro").
 *
 * This eval was added in Phase 4.5 follow-up. The function had been
 * fixed earlier in the same session (model bump + .describe() removal),
 * but verification was a one-off manual smoke test. This suite makes
 * the regression check permanent and gated, mirroring the
 * intent-classifier and capability eval patterns.
 */

const RUN_EVALS = process.env.RUN_EVALS === "1";
const MIN_STRICT_ACCURACY = 0.7;

const thisDir = dirname(fileURLToPath(import.meta.url));
const reportDir = join(thisDir, "reports");

const suite = RUN_EVALS ? describe : describe.skip;

suite("onboarding extraction eval", () => {
  let parsed: ReturnType<typeof fixtureFileSchema.parse>;
  let rows: FixtureScore[] = [];
  let report: SuiteReport;

  beforeAll(() => {
    if (!process.env.OPENROUTER_API_KEY) {
      throw new Error(
        "OPENROUTER_API_KEY required to run evals. Set it in your shell or via 1Password.",
      );
    }
    parsed = fixtureFileSchema.parse(onboardingSeed);
  });

  it("extracts every fixture and writes a report", async () => {
    rows = [];

    for (const fixture of parsed.fixtures) {
      const conversation: ModelMessage[] = fixture.conversation.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const started = Date.now();
      try {
        const extracted = await extractOnboardingIntelligence({
          conversationHistory: conversation,
        });
        rows.push(
          scoreFixture(
            fixture,
            extracted as unknown as Record<string, unknown>,
            Date.now() - started,
          ),
        );
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
    const latestPath = join(reportDir, `latest-${parsed.suite}.md`);
    writeFileSync(timestampedPath, markdown, "utf8");
    writeFileSync(latestPath, markdown, "utf8");

    // eslint-disable-next-line no-console
    console.log(
      `\n[eval] ${parsed.suite}: strict=${(report.accuracy * 100).toFixed(1)}% ` +
        `lenient=${(report.lenientAccuracy * 100).toFixed(1)}% ` +
        `(pass=${report.totals.pass} partial=${report.totals.partial} ` +
        `fail=${report.totals.fail} error=${report.totals.error})\n` +
        `       history: ${timestampedPath}\n` +
        `       latest:  ${latestPath}\n`,
    );
  });

  it("strict accuracy is above regression floor", () => {
    expect(report.accuracy).toBeGreaterThanOrEqual(MIN_STRICT_ACCURACY);
  });
});
