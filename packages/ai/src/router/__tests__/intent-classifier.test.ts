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
import { classifyIntent, type ClassifierContext } from "../intent-classifier.js";
import { getRegisteredCapabilities } from "../../capabilities/registry.js";
import type { NonEmptyString } from "@smartout/telemetry/server";

/** Test fixture — a populated employee context used across tests below. */
const employeeCtx: ClassifierContext = {
  role: "employee",
  departmentName: null,
  workspaceId: "ws-test" as NonEmptyString,
  channel: "chat",
};

/** Minimal stand-in for the legacy "ctx" string — used where the test only
 *  cares about key handling / error paths, not the context payload itself. */
const minimalCtx: ClassifierContext = {
  role: null,
  departmentName: null,
  workspaceId: null,
  channel: null,
};

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
    const result = await classifyIntent("Når jobber jeg?", employeeCtx, {
      apiKey: "test-key",
    });
    expect(result).toEqual(validIntent);
    expect(generateObjectMock).toHaveBeenCalledTimes(1);
  });

  it("throws when no API key is available (env unset, options empty)", async () => {
    delete process.env.OPENROUTER_API_KEY;
    await expect(classifyIntent("hei", minimalCtx)).rejects.toThrow(/OpenRouter API key required/i);
    expect(generateObjectMock).not.toHaveBeenCalled();
  });

  it("uses options.apiKey when env is unset", async () => {
    delete process.env.OPENROUTER_API_KEY;
    await classifyIntent("hei", minimalCtx, { apiKey: "explicit-key" });
    expect(generateObjectMock).toHaveBeenCalledTimes(1);
  });

  it("uses env API key when options.apiKey is absent", async () => {
    process.env.OPENROUTER_API_KEY = "env-key";
    await classifyIntent("hei", minimalCtx);
    expect(generateObjectMock).toHaveBeenCalledTimes(1);
  });

  it("assembles a system prompt that lists every registered capability", async () => {
    await classifyIntent("hei", minimalCtx, { apiKey: "test-key" });
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

  it("embeds the message and serialized structured context in the user prompt", async () => {
    await classifyIntent(
      "Når jobber jeg neste uke?",
      { role: "employee", departmentName: "Kjøkken", workspaceId: null, channel: "chat" },
      { apiKey: "test-key" },
    );
    const args = generateObjectMock.mock.calls[0]![0];
    expect(args.prompt).toContain("Når jobber jeg neste uke?");
    // Serialized fields appear in the prompt (we don't assert exact format so
    // `serializeClassifierContext` can evolve freely — we assert presence).
    expect(args.prompt).toContain("employee");
    expect(args.prompt).toContain("Kjøkken");
    expect(args.prompt).toContain("chat");
  });

  it("emits a neutral marker when the context object is fully empty (no empty-string prompt)", async () => {
    await classifyIntent("hei", minimalCtx, { apiKey: "test-key" });
    const args = generateObjectMock.mock.calls[0]![0];
    // Empty-string context was the previous phantom contract. We now emit a
    // neutral Norwegian marker so the prompt is never literally "".
    expect(args.prompt).not.toMatch(/Employee context:\s*\n/);
    expect(args.prompt).toContain("(ingen kontekst tilgjengelig)");
  });

  it("includes the optional `hint` verbatim in the prompt", async () => {
    await classifyIntent(
      "hei",
      { ...minimalCtx, hint: "Workspace: hospitality. Periode: mars." },
      { apiKey: "test-key" },
    );
    const args = generateObjectMock.mock.calls[0]![0];
    expect(args.prompt).toContain("Workspace: hospitality. Periode: mars.");
  });

  it("propagates errors thrown by generateObject", async () => {
    generateObjectMock.mockRejectedValueOnce(new Error("rate limited"));
    await expect(classifyIntent("hei", minimalCtx, { apiKey: "test-key" })).rejects.toThrow(
      "rate limited",
    );
  });
});
