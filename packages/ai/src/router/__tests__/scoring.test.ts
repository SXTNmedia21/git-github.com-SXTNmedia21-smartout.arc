import { describe, it, expect } from "vitest";
import { buildReport, renderReportMarkdown, scoreFixture } from "../__evals__/scoring.js";
import type { Fixture } from "../__evals__/fixtures/_schema.js";
import type { IntentResult } from "../intent-classifier.js";

const baseFixture = (
  id: string,
  capability: Fixture["expected"]["capability"],
  minConfidence = 0.7,
): Fixture => ({
  id,
  message: "test message",
  context: "test context",
  expected: { capability, minConfidence },
  tags: [],
});

const makeResult = (capability: IntentResult["capability"], confidence: number): IntentResult => ({
  intent: `${capability}:test`,
  capability,
  confidence,
  reasoning: "test",
});

describe("scoreFixture", () => {
  it("marks correct capability above threshold as pass", () => {
    const fx = baseFixture("schedule-1", "schedule");
    const score = scoreFixture(fx, makeResult("schedule", 0.9), 120);
    expect(score.outcome).toBe("pass");
    expect(score.actualCapability).toBe("schedule");
    expect(score.confidence).toBe(0.9);
  });

  it("marks correct capability below threshold as hedged", () => {
    const fx = baseFixture("schedule-2", "schedule", 0.8);
    const score = scoreFixture(fx, makeResult("schedule", 0.5), 110);
    expect(score.outcome).toBe("hedged");
  });

  it("marks wrong capability as fail regardless of confidence", () => {
    const fx = baseFixture("schedule-3", "schedule");
    const score = scoreFixture(fx, makeResult("training", 0.99), 90);
    expect(score.outcome).toBe("fail");
    expect(score.actualCapability).toBe("training");
  });

  it("marks thrown errors as error", () => {
    const fx = baseFixture("schedule-4", "schedule");
    const score = scoreFixture(fx, new Error("openrouter down"), 200);
    expect(score.outcome).toBe("error");
    expect(score.errorMessage).toBe("openrouter down");
    expect(score.actualCapability).toBeNull();
  });
});

describe("buildReport", () => {
  it("computes strict and lenient accuracy", () => {
    const fx = (id: string, cap: Fixture["expected"]["capability"]) => baseFixture(id, cap);

    const rows = [
      scoreFixture(fx("a", "schedule"), makeResult("schedule", 0.9), 100), // pass
      scoreFixture(fx("b", "schedule"), makeResult("schedule", 0.5), 100), // hedged
      scoreFixture(fx("c", "training"), makeResult("schedule", 0.9), 100), // fail
      scoreFixture(fx("d", "training"), new Error("boom"), 100), // error
    ];

    const report = buildReport("test-suite", rows);

    expect(report.totals.count).toBe(4);
    expect(report.totals.pass).toBe(1);
    expect(report.totals.hedged).toBe(1);
    expect(report.totals.fail).toBe(1);
    expect(report.totals.error).toBe(1);
    expect(report.accuracy).toBeCloseTo(0.25);
    expect(report.lenientAccuracy).toBeCloseTo(0.5);
  });

  it("groups accuracy per expected capability", () => {
    const fx = (id: string, cap: Fixture["expected"]["capability"]) => baseFixture(id, cap);
    const rows = [
      scoreFixture(fx("s1", "schedule"), makeResult("schedule", 0.9), 100),
      scoreFixture(fx("s2", "schedule"), makeResult("training", 0.9), 100),
      scoreFixture(fx("t1", "training"), makeResult("training", 0.9), 100),
    ];
    const report = buildReport("per-cap", rows);
    expect(report.perCapability.schedule?.accuracy).toBeCloseTo(0.5);
    expect(report.perCapability.training?.accuracy).toBeCloseTo(1.0);
  });
});

describe("renderReportMarkdown", () => {
  it("produces a markdown document with totals and per-capability sections", () => {
    const rows = [scoreFixture(baseFixture("a", "schedule"), makeResult("schedule", 0.95), 80)];
    const report = buildReport("render-test", rows);
    const md = renderReportMarkdown(report);

    expect(md).toContain("# Eval report — render-test");
    expect(md).toContain("| Pass | 1 |");
    expect(md).toContain("| schedule |");
    expect(md).toContain("| a | pass |");
  });
});
