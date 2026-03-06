import { describe, it, expect } from "vitest";
import {
  computeJourneyProgress,
  computeUnderstandingScore,
  inferUserProfile,
  formatDuration,
} from "../lib/showcase-journey";

describe("showcase journey domain", () => {
  it("computes progress from step + checkpoints", () => {
    expect(
      computeJourneyProgress({
        stepIndex: 2,
        totalSteps: 3,
        scrapeSuccesses: 1,
        hasQuizAnswer: true,
      }),
    ).toBeGreaterThan(70);
  });

  it("computes understanding score with bounded cap", () => {
    const score = computeUnderstandingScore({
      quizCorrect: 2,
      questionsAsked: 4,
      scrapeSuccesses: 2,
      interactionCount: 40,
    });
    expect(score).toBeLessThanOrEqual(100);
    expect(score).toBeGreaterThan(0);
  });

  it("infers profile label from behavior", () => {
    expect(inferUserProfile({ scrapeAttempts: 1, questionsAsked: 2, interactionCount: 8 })).toBe(
      "Data-drevet utforsker",
    );
  });

  it("formats durations consistently", () => {
    expect(formatDuration(3200)).toBe("3s");
    expect(formatDuration(65000)).toBe("1m 5s");
  });
});
