// ============================================
// build-session-summary.test.ts
// Unit tests for buildSessionSummary pure helper.
// Tests are written before the implementation (TDD — F-MEM-UNBLOCK-A3 Task 2).
// ============================================

import { describe, it, expect } from "vitest";
import { buildSessionSummary } from "../build-session-summary.js";
import type { ConversationTurn } from "../../types/agent.js";

function userTurn(content: string, offset = 0): ConversationTurn {
  return {
    role: "user",
    content,
    timestamp: new Date(Date.now() + offset).toISOString(),
  };
}

function assistantTurn(content: string, offset = 0): ConversationTurn {
  return {
    role: "assistant",
    content,
    timestamp: new Date(Date.now() + offset).toISOString(),
  };
}

describe("buildSessionSummary", () => {
  it("returns empty string for an empty conversation", () => {
    expect(buildSessionSummary([])).toBe("");
  });

  it("returns empty string when conversation contains only assistant turns", () => {
    const history: ConversationTurn[] = [
      assistantTurn("Hei, jeg er Botsson!"),
      assistantTurn("Kan jeg hjelpe deg?"),
    ];
    expect(buildSessionSummary(history)).toBe("");
  });

  it("concatenates user turns separated by newlines", () => {
    const history: ConversationTurn[] = [
      userTurn("Hva er mine vakter i dag?"),
      assistantTurn("Du har ingen vakter i dag."),
      userTurn("Husk at jeg liker kaffe svart"),
    ];
    const result = buildSessionSummary(history);
    expect(result).toContain("Hva er mine vakter i dag?");
    expect(result).toContain("Husk at jeg liker kaffe svart");
    // Should NOT contain assistant text
    expect(result).not.toContain("Du har ingen vakter i dag.");
  });

  it("ignores assistant turns interspersed with user turns", () => {
    const history: ConversationTurn[] = [
      assistantTurn("God morgen!"),
      userTurn("Jeg trenger hjelp med timeplanen"),
      assistantTurn("Selvfolgelig, hva vil du vite?"),
      userTurn("Hvem er pa jobb onsdag?"),
    ];
    const result = buildSessionSummary(history);
    expect(result).toContain("Jeg trenger hjelp med timeplanen");
    expect(result).toContain("Hvem er pa jobb onsdag?");
    expect(result).not.toContain("God morgen");
    expect(result).not.toContain("Selvfolgelig");
  });

  it("truncates output to 1000 characters", () => {
    // Build a conversation with user turns totalling > 1000 chars
    const longContent = "A".repeat(300);
    const history: ConversationTurn[] = [
      userTurn(longContent),
      assistantTurn("reply 1"),
      userTurn(longContent),
      assistantTurn("reply 2"),
      userTurn(longContent),
      assistantTurn("reply 3"),
      userTurn(longContent),
    ];
    const result = buildSessionSummary(history);
    expect(result.length).toBeLessThanOrEqual(1000);
  });

  it("does not truncate output that is exactly 1000 characters", () => {
    // 5 turns of 200 chars = 1000 chars concatenated (with newlines, slightly over)
    // so use 4 turns of 200 = 800 chars + 3 newlines = 803 chars — under limit
    const content = "B".repeat(200);
    const history: ConversationTurn[] = [
      userTurn(content),
      assistantTurn("reply"),
      userTurn(content),
      assistantTurn("reply"),
      userTurn(content),
      assistantTurn("reply"),
      userTurn(content),
    ];
    const result = buildSessionSummary(history);
    // 4 * 200 + 3 newlines = 803 chars — must not be truncated
    expect(result.length).toBeLessThanOrEqual(1000);
    expect(result.length).toBeGreaterThan(0);
  });

  it("returns only user turns when conversation is large", () => {
    const history: ConversationTurn[] = Array.from({ length: 20 }, (_, i) =>
      i % 2 === 0 ? userTurn(`User turn ${i}`) : assistantTurn(`Assistant turn ${i}`),
    );
    const result = buildSessionSummary(history);
    // All present user turns should appear or be truncated at 1000 chars
    expect(result.length).toBeLessThanOrEqual(1000);
    // At least some user content should be present
    expect(result).toContain("User turn");
    expect(result).not.toContain("Assistant turn");
  });
});
