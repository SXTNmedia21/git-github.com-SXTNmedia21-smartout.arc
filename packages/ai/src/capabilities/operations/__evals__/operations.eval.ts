import { describe, it, expect, beforeAll } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { generateText, tool } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";

import { operationsCapability } from "../index.js";
import { fixtureFileSchema } from "../../__evals__/fixtures/_schema.js";
import {
  buildReport,
  renderReportMarkdown,
  scoreFixture,
  type FixtureScore,
  type ObservedCall,
  type SuiteReport,
} from "../../__evals__/tool-call-scoring.js";
import { operationsSeed } from "./fixtures/operations-seed.js";

/**
 * Operations capability — tool-call eval.
 *
 * Mirrors `schedule.eval.ts`. The interesting twist is that operations
 * has a WRITE tool (`create_deviation`). The fixtures test whether the
 * model is willing to call the write tool when the user is explicit.
 * complete_task was hard-deleted from this capability (ADR-0298 Sortie 5b).
 *
 * As with the schedule eval, `execute()` is stubbed so no Supabase
 * writes happen during the eval.
 */

const RUN_EVALS = process.env.RUN_EVALS === "1";
const MIN_STRICT_ACCURACY = 0.7;

const thisDir = dirname(fileURLToPath(import.meta.url));
const reportDir = join(thisDir, "reports");

const suite = RUN_EVALS ? describe : describe.skip;

suite("operations capability — tool calls", () => {
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
    parsed = fixtureFileSchema.parse(operationsSeed);
  });

  it("classifies every fixture and writes a report", async () => {
    rows = [];

    const tools = Object.fromEntries(
      operationsCapability.tools.map((t) => [
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
            "You are Mr. Botsson, a Norwegian employee assistant for daily operations. " +
            "Use the available tools to answer questions and perform actions. " +
            "When the user explicitly asks you to do a write action (mark complete, " +
            "report a deviation), call the appropriate tool. Never answer from memory.",
          prompt: `Context: ${fixture.context}\n\nUser: ${fixture.prompt}`,
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
