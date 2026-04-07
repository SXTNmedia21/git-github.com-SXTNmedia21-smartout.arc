import { describe, it, expect, beforeAll } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { generateText, tool } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";

import { scheduleCapability } from "../index.js";
import { fixtureFileSchema } from "../../__evals__/fixtures/_schema.js";
import {
  buildReport,
  renderReportMarkdown,
  scoreFixture,
  type FixtureScore,
  type ObservedCall,
  type SuiteReport,
} from "../../__evals__/tool-call-scoring.js";
import { scheduleSeed } from "./fixtures/schedule-seed.js";

/**
 * Schedule capability — tool-call eval.
 *
 * Pattern (mirrors `router/__evals__/intent-classifier.eval.ts`):
 *
 *  - Gated by `RUN_EVALS=1` (skipped otherwise).
 *  - Requires `OPENROUTER_API_KEY`.
 *  - Each fixture: prompt + context → real LLM with the schedule capability's
 *    tools → check that the right tool was called with the right args.
 *  - `execute()` is REPLACED with a stub that returns canned text. We are
 *    measuring tool *selection*, not execution. The schedule.ts execute
 *    bodies hit Supabase and would require a real DB to run.
 *  - Reports written to `__evals__/reports/<timestamp>-<suite>.md` and a
 *    stable `latest-<suite>.md` pointer.
 */

const RUN_EVALS = process.env.RUN_EVALS === "1";
const MIN_STRICT_ACCURACY = 0.7;

const thisDir = dirname(fileURLToPath(import.meta.url));
const reportDir = join(thisDir, "reports");

const suite = RUN_EVALS ? describe : describe.skip;

suite("schedule capability — tool calls", () => {
  let parsed: ReturnType<typeof fixtureFileSchema.parse>;
  let rows: FixtureScore[] = [];
  let report: SuiteReport;
  let openrouter: ReturnType<typeof createOpenRouter>;

  beforeAll(() => {
    if (!process.env.OPENROUTER_API_KEY) {
      throw new Error(
        "OPENROUTER_API_KEY required to run evals. Set it in your shell or via 1Password.",
      );
    }
    openrouter = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY });
    parsed = fixtureFileSchema.parse(scheduleSeed);
  });

  it("classifies every fixture and writes a report", async () => {
    rows = [];

    // Build the AI SDK tool map with REAL schemas + descriptions but
    // STUB executes. The model only sees schema + description, so this
    // is a faithful test of tool selection without touching Supabase.
    const tools = Object.fromEntries(
      scheduleCapability.tools.map((t) => [
        t.name,
        tool({
          description: t.description,
          inputSchema: t.schema,
          execute: async () => "(stubbed in eval)",
        }),
      ]),
    );

    for (const fixture of parsed.fixtures) {
      const started = Date.now();
      try {
        const result = await generateText({
          model: openrouter("anthropic/claude-sonnet-4.6"),
          tools,
          system:
            "You are Mr. Botsson, a Norwegian employee assistant. " +
            "Use the available tools to answer schedule questions. " +
            "Always call a tool — never answer from memory.",
          prompt: `Context: ${fixture.context}\n\nUser: ${fixture.prompt}`,
          // Stop after the first model step so we don't loop forever.
          stopWhen: ({ steps }) => steps.length >= 1,
        });

        const calls = result.toolCalls ?? [];
        let observed: ObservedCall | null = null;
        if (calls.length > 0) {
          const c = calls[0]!;
          observed = {
            toolName: c.toolName,
            args: (c.input ?? {}) as Record<string, unknown>,
          };
        }
        rows.push(scoreFixture(fixture, observed, Date.now() - started));
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
