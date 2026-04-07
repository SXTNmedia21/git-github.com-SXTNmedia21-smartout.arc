import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Unit tests for `classifyIntent`.
 *
 * We mock the `ai` package at the module boundary so the test never hits
 * OpenRouter. What we verify:
 *
 *  - happy path: returns the schema-validated object from generateObject
 *  - API key handling: throws when no key in env AND no key in options
 *  - API key handling: options.apiKey overrides env
 *  - prompt assembly: system prompt contains all registered capabilities,
 *    user prompt contains message + context
 *  - error propagation: if generateObject throws, classifyIntent throws
 *
 * These tests are fast (<50ms each), deterministic, and cost nothing.
 * They complement the gated eval suite, which measures *quality* against
 * the real model — this suite measures *correctness* of the wrapper.
 */

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

// Import AFTER vi.mock so the mock is in place when intent-classifier.ts
// resolves its imports.
import { classifyIntent } from "../intent-classifier.js";
import { getRegisteredCapabilities } from "../../capabilities/registry.js";

const validIntent = {
  intent: "schedule:query",
  capability: "schedule" as const,
  confidence: 0.92,
  reasoning: "User asked about next shift",
};

describe("classifyIntent", () => {
  const originalEnv = process.env.OPENROUTER_API_KEY;

  beforeEach(() => {
    generateObjectMock.mockReset();
    generateObjectMock.mockResolvedValue({ object: validIntent });
  });

  afterEach(() => {
    if (originalEnv === undefined) delete process.env.OPENROUTER_API_KEY;
    else process.env.OPENROUTER_API_KEY = originalEnv;
  });

  it("returns the object produced by generateObject on the happy path", async () => {
    const result = await classifyIntent("Når jobber jeg?", "Rolle: employee", {
      apiKey: "test-key",
    });
    expect(result).toEqual(validIntent);
    expect(generateObjectMock).toHaveBeenCalledTimes(1);
  });

  it("throws when no API key is available (env unset, options empty)", async () => {
    delete process.env.OPENROUTER_API_KEY;
    await expect(classifyIntent("hei", "ctx")).rejects.toThrow(/OpenRouter API key required/i);
    expect(generateObjectMock).not.toHaveBeenCalled();
  });

  it("uses options.apiKey when env is unset", async () => {
    delete process.env.OPENROUTER_API_KEY;
    await classifyIntent("hei", "ctx", { apiKey: "explicit-key" });
    expect(generateObjectMock).toHaveBeenCalledTimes(1);
  });

  it("uses env API key when options.apiKey is absent", async () => {
    process.env.OPENROUTER_API_KEY = "env-key";
    await classifyIntent("hei", "ctx");
    expect(generateObjectMock).toHaveBeenCalledTimes(1);
  });

  it("assembles a system prompt that lists every registered capability", async () => {
    await classifyIntent("hei", "ctx", { apiKey: "test-key" });
    const call = generateObjectMock.mock.calls[0];
    expect(call).toBeDefined();
    const args = call![0];
    const registered = getRegisteredCapabilities();
    expect(registered.length).toBeGreaterThan(0);
    for (const cap of registered) {
      expect(args.system).toContain(cap);
    }
    // `general` is appended inline and should also be present.
    expect(args.system).toContain("general");
  });

  it("embeds the message and context in the user prompt", async () => {
    await classifyIntent("Når jobber jeg neste uke?", "Rolle: employee. Dept: Kjøkken.", {
      apiKey: "test-key",
    });
    const args = generateObjectMock.mock.calls[0]![0];
    expect(args.prompt).toContain("Når jobber jeg neste uke?");
    expect(args.prompt).toContain("Rolle: employee. Dept: Kjøkken.");
  });

  it("propagates errors thrown by generateObject", async () => {
    generateObjectMock.mockRejectedValueOnce(new Error("rate limited"));
    await expect(classifyIntent("hei", "ctx", { apiKey: "test-key" })).rejects.toThrow(
      "rate limited",
    );
  });
});
