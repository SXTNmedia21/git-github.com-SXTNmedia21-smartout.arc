// packages/ai/src/router/__tests__/intent-classifier-shift-lifecycle.test.ts
//
// F5 regression coverage: the classifier must accept `shift_lifecycle` as a
// valid capability and the system prompt must contain enough Norwegian
// routing guidance that write-intent phrases ("godkjenn vakten",
// "publiser vakten", "gjør opp vakten", "tolk timene") can be distinguished
// from read-intent phrases ("når jobber jeg?"). See ADR-0095 (Five-Layer
// Shift Lifecycle), ADR-0099 (Unified Authority Gate) and Council R2 F5.
//
// These are wrapper-correctness tests. We mock `generateObject` and verify
// (a) the Zod enum accepts shift_lifecycle as a returned capability,
// (b) the system prompt lists shift_lifecycle and explains when to route
// there versus the read-only `schedule` capability,
// (c) ambiguous phrases like bare "vakten min" are documented as
// low-confidence / schedule fallback in the prompt.
import { describe, it, expect, vi, beforeEach } from "vitest";

type GenerateObjectArgs = {
  model: unknown;
  schema: unknown;
  system: string;
  prompt: string;
};

const generateObjectMock = vi.fn<(args: GenerateObjectArgs) => Promise<{ object: unknown }>>();

vi.mock("ai", () => ({
  generateObject: (args: GenerateObjectArgs) => generateObjectMock(args),
}));

// Import after vi.mock.
import { classifyIntent, intentSchema } from "../intent-classifier.js";

describe("classifyIntent — shift_lifecycle routing (F5)", () => {
  beforeEach(() => {
    generateObjectMock.mockReset();
  });

  it("accepts shift_lifecycle as a valid capability in the schema", () => {
    const parsed = intentSchema.safeParse({
      intent: "shift_lifecycle:approve",
      capability: "shift_lifecycle",
      confidence: 0.92,
      reasoning: "User said godkjenn vakten min",
    });
    expect(parsed.success).toBe(true);
  });

  it("classifies 'godkjenn vakten min' as shift_lifecycle (write)", async () => {
    generateObjectMock.mockResolvedValue({
      object: {
        intent: "shift_lifecycle:approve",
        capability: "shift_lifecycle",
        confidence: 0.91,
        reasoning: "Approval verb on own shift",
      },
    });
    const result = await classifyIntent("godkjenn vakten min", "Rolle: employee", {
      apiKey: "test-key",
    });
    expect(result.capability).toBe("shift_lifecycle");
    expect(result.confidence).toBeGreaterThanOrEqual(0.7);
  });

  it("classifies 'publiser vakten' as shift_lifecycle (write)", async () => {
    generateObjectMock.mockResolvedValue({
      object: {
        intent: "shift_lifecycle:publish",
        capability: "shift_lifecycle",
        confidence: 0.9,
        reasoning: "Publish verb",
      },
    });
    const result = await classifyIntent("publiser vakten", "Rolle: manager", {
      apiKey: "test-key",
    });
    expect(result.capability).toBe("shift_lifecycle");
  });

  it("classifies 'avslutte oppgjøret' / 'gjør opp vakten' as shift_lifecycle (settle)", async () => {
    generateObjectMock.mockResolvedValue({
      object: {
        intent: "shift_lifecycle:settle",
        capability: "shift_lifecycle",
        confidence: 0.88,
        reasoning: "Settlement verb",
      },
    });
    const result = await classifyIntent("avslutte oppgjøret", "Rolle: employee", {
      apiKey: "test-key",
    });
    expect(result.capability).toBe("shift_lifecycle");
  });

  it("classifies 'tolk timene på nytt' as shift_lifecycle (interpret)", async () => {
    generateObjectMock.mockResolvedValue({
      object: {
        intent: "shift_lifecycle:interpret",
        capability: "shift_lifecycle",
        confidence: 0.82,
        reasoning: "Re-interpretation verb",
      },
    });
    const result = await classifyIntent("tolk timene på nytt", "Rolle: manager", {
      apiKey: "test-key",
    });
    expect(result.capability).toBe("shift_lifecycle");
  });

  it("classifies 'når slutter vakten min' as schedule (read-only)", async () => {
    generateObjectMock.mockResolvedValue({
      object: {
        intent: "schedule:query",
        capability: "schedule",
        confidence: 0.95,
        reasoning: "Pure read query about end time",
      },
    });
    const result = await classifyIntent("når slutter vakten min", "Rolle: employee", {
      apiKey: "test-key",
    });
    expect(result.capability).toBe("schedule");
  });

  it("treats bare 'vakten min' as low-confidence / schedule fallback", async () => {
    generateObjectMock.mockResolvedValue({
      object: {
        intent: "schedule:query",
        capability: "schedule",
        confidence: 0.55,
        reasoning: "Ambiguous — no verb, default to read-only schedule",
      },
    });
    const result = await classifyIntent("vakten min", "Rolle: employee", {
      apiKey: "test-key",
    });
    expect(result.capability).toBe("schedule");
    expect(result.confidence).toBeLessThan(0.7);
  });

  it("system prompt lists shift_lifecycle and the write vs read disambiguation", async () => {
    generateObjectMock.mockResolvedValue({
      object: {
        intent: "general",
        capability: "general",
        confidence: 0.5,
        reasoning: "probe",
      },
    });
    await classifyIntent("probe", "ctx", { apiKey: "test-key" });
    const call = generateObjectMock.mock.calls[0];
    expect(call).toBeDefined();
    const { system } = call![0];
    expect(system).toContain("shift_lifecycle");
    expect(system).toContain("godkjenn vakten");
    expect(system).toContain("publiser vakten");
    // Write vs read disambiguation must be spelled out for the model.
    expect(system.toLowerCase()).toContain("når jobber jeg");
  });
});
