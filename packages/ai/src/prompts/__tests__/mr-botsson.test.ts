// packages/ai/src/prompts/__tests__/mr-botsson.test.ts
//
// Verify that the Mr. Botsson system prompt includes all PII-handling rules
// mandated by ADR-0077 and ADR-0078.
import { describe, it, expect } from "vitest";
import { buildBotssonPromptFromContext } from "../mr-botsson.js";
import type { AgentContext } from "../../context/types.js";

function makeContext(): AgentContext {
  return {
    profile: {
      id: "00000000-0000-0000-0000-000000000001",
      name: "Test User",
      role: "employee",
      department: "Test",
      team: "A",
      status: "active",
      preferredLanguage: "no",
    },
    agentProfile: {
      id: "00000000-0000-0000-0000-000000000002",
      displayName: "Mr. Botsson",
      greeting: "Hei!",
      language: "no",
      defaultVoice: "alloy",
      voiceSpeed: 1,
      voiceTemperature: 0.7,
      voiceStability: 0.5,
      personality: {
        formality: 0.5,
        assertiveness: 0.5,
        warmth: 0.7,
        humor: 0.3,
        verbosity: 0.5,
      },
      adaptFlags: { role: true, situation: true, authority: true },
    },
    resolvedPosture: {
      formality: 0.5,
      assertiveness: 0.5,
      warmth: 0.7,
      humor: 0.3,
      verbosity: 0.5,
    },
    relationship: {
      totalConversations: 3,
      familiarityScore: 0.5,
      sentimentScore: 0.6,
      trustScore: 0.5,
      relationshipScore: 0.5,
      lastInteraction: null,
    },
    relevantMemories: [],
    currentTime: "2026-04-09T10:00:00Z",
    dayOfWeek: "Wednesday",
    activeShift: null,
    personalTasks: [],
  } satisfies AgentContext;
}

describe("Mr. Botsson PII prompt rules", () => {
  const prompt = buildBotssonPromptFromContext(makeContext(), []);

  it("contains decline handling rule", () => {
    expect(prompt).toContain("decline_intake");
    expect(prompt).toContain("Aldri spor igjen");
  });

  it("contains admin PII proxy refusal", () => {
    expect(prompt).toContain("paa vegne av andre ansatte");
    expect(prompt).toContain("/dashboard/people/");
  });

  it("contains voice channel PII refusal", () => {
    expect(prompt).toContain("voice-kanaler");
    expect(prompt).toContain("chat-vinduet");
  });

  it("contains no-echo rule", () => {
    expect(prompt).toContain("ALDRI gjenta verdien");
    expect(prompt).toContain("Takk, lagret");
  });
});
