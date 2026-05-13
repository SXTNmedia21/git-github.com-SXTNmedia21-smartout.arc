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

// ─────────────────────────────────────────────────────────────────────────────
// IC4 — alias-shim unit test (ADR-0298 §6.2, spec §4.8)
//
// The `aliasTaskVerbs` shim in tool-selector.ts rewrites intents that the
// classifier routes to `personal` but contain task-verb vocabulary ("lag
// oppgave", "todo", "påminnelse") to capability='task'. This test verifies
// the shim fires correctly via `selectTools` (the public entry point that
// calls it) — aliasTaskVerbs is internal so we test through its only caller.
//
// We use the real registry (task capability registered in Phase 2) and a
// 'suggest'-level authority config so the task tools are actually returned.
// ─────────────────────────────────────────────────────────────────────────────

import { selectTools } from "../tool-selector.js";

describe("IC4 — aliasTaskVerbs shim (ADR-0298 §4.8)", () => {
  // The aliasTaskVerbs shim is internal to tool-selector.ts and fires on
  // `intent.intent` (the classifier-returned intent string, NOT the raw user message).
  // It matches TASK_VERB_REGEX: /lag\s+(en\s+)?oppgave|todo|påminnelse|reminder|huske\s+å|task/i
  //
  // Realistic classifier output for a task-verb message might be an intent string
  // like "lag oppgave til bruker" or "personal:create_task" or even carry the
  // original message verbatim in the intent field. This test uses a pattern that
  // satisfies the regex (no extra word between "lag" and "oppgave").

  it("personal+task-verb in intent field routes to task capability tools", () => {
    // Classifier returns personal + intent string matching TASK_VERB_REGEX.
    const fakePersonalIntentWithTaskVerb = {
      intent: "lag oppgave til ringe lege", // matches /lag\s+(en\s+)?oppgave/i
      capability: "personal" as const,
      confidence: 0.82,
      reasoning: "personal task creation",
    };

    // Give both capabilities suggest-level authority so we can observe routing.
    const authorityConfig: Record<string, "suggest"> = {
      personal: "suggest",
      task: "suggest",
    };

    const tools = selectTools(fakePersonalIntentWithTaskVerb, authorityConfig, "chat");

    // The shim must have rewritten personal → task.
    const toolNames = tools.map((t) => (t as unknown as { name: string }).name);

    // list_mine is a canonical task capability read tool (not in personal).
    expect(toolNames).toContain("list_mine");
    // personal capability tools like add_note must NOT be here.
    expect(toolNames).not.toContain("add_note");
  });

  it("personal+non-task-verb intent does NOT alias to task", () => {
    const personalNonTaskIntent = {
      intent: "husk at jeg liker kveldsvakter", // no task-verb match
      capability: "personal" as const,
      confidence: 0.75,
      reasoning: "personal preference",
    };

    const authorityConfig: Record<string, "suggest"> = {
      personal: "suggest",
      task: "suggest",
    };

    const tools = selectTools(personalNonTaskIntent, authorityConfig, "chat");

    // Personal tools returned — list_mine is task-only, must NOT appear.
    const toolNames = tools.map((t) => (t as unknown as { name: string }).name);
    expect(toolNames).not.toContain("list_mine");
    // Personal capability tools should appear (add_note or similar).
    expect(toolNames.length).toBeGreaterThan(0);
  });
});
