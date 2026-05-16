// client-tool-rpc.test.ts — Unit tests for the voice-agent client-tool RPC module.
//
// Tests (5 required by spec, 7 total):
//   1. buildClientToolStub returns a FunctionTool with execute body
//   2. resolveToolResult resolves the right pending promise by call_id
//   3. resolveToolResult silently ignores unknown call_id (no throw)
//   4. stub execute: invokes publish + awaits result via manual resolveToolResult
//   5. stub execute: timeout fires after 10 s → returns timeout string
//   6. publish payload shape: { type:"tool_call", call_id, name, arguments }
//   7. stub with no parameters produces schema with empty properties

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── Dependency mocks ──────────────────────────────────────────────────────────
//
// We mock adapter-internal.ts so tests don't need a live LiveKit Room.
// The mock captures the last published payload for assertion.

const publishedPayloads: Array<{ payload: Record<string, unknown>; topic: string }> = [];

vi.mock("../src/adapter-internal.js", () => ({
  _publishOnTopic: (payload: Record<string, unknown>, topic: string) => {
    publishedPayloads.push({ payload, topic });
  },
  _publishActivity: vi.fn(),
  setActiveLkRoom: vi.fn(),
}));

// Import after mocking so the module picks up the mock.
// Use dynamic imports to ensure mock is registered before module load.
const { buildClientToolStub, resolveToolResult } = await import("../src/client-tool-rpc.js");

import type { ClientToolDefinition } from "@smartout/ai/harness/types";

// ── Test fixtures ─────────────────────────────────────────────────────────────

function makeDefinition(
  overrides: Partial<ClientToolDefinition["temporaryTool"]> = {},
): ClientToolDefinition {
  return {
    temporaryTool: {
      modelToolName: "test_tool",
      description: "A test tool",
      dynamicParameters: [
        {
          name: "query",
          location: "body",
          description: "The search query",
          required: true,
          schema: { type: "string" },
        },
      ],
      client: {},
      ...overrides,
    },
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("client-tool-rpc", () => {
  beforeEach(() => {
    publishedPayloads.length = 0;
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // Test 1: buildClientToolStub returns a FunctionTool with execute body
  it("1. buildClientToolStub returns a FunctionTool-like object with description + execute", () => {
    const def = makeDefinition();
    const stub = buildClientToolStub(def);

    expect(stub).toBeDefined();
    expect(stub.type).toBe("function");
    expect(stub.description).toBe("A test tool");
    expect(typeof stub.execute).toBe("function");
  });

  // Test 2: resolveToolResult resolves the right pending promise by call_id.
  // Key: do NOT advance timers before calling resolveToolResult — that would
  // trigger the 10 s timeout and resolve the promise with the timeout string.
  it("2. resolveToolResult resolves the correct pending promise by call_id", async () => {
    const def = makeDefinition({ modelToolName: "tool_a" });
    const stubA = buildClientToolStub(def);

    // Start execute — publishOnTopic is called synchronously before the await.
    const executePromise = stubA.execute({ query: "hello" }, {} as never);

    // Flush one microtask tick so the execute body advances past Promise setup
    // and hits the await resultPromise.
    await Promise.resolve();

    // Publish happened synchronously before the await in execute.
    expect(publishedPayloads.length).toBeGreaterThanOrEqual(1);
    const lastPublish = publishedPayloads[publishedPayloads.length - 1];
    expect(typeof lastPublish?.payload["call_id"]).toBe("string");
    const callId = lastPublish!.payload["call_id"] as string;

    // Resolve before the 10 s timer fires — timer is never advanced here.
    resolveToolResult(callId, "result from browser");

    const result = await executePromise;
    expect(result).toBe("result from browser");
  });

  // Test 3: resolveToolResult silently ignores unknown call_id
  it("3. resolveToolResult ignores unknown call_id without throwing", () => {
    expect(() => {
      resolveToolResult("nonexistent-uuid-1234", "some result");
    }).not.toThrow();
  });

  // Test 4: stub execute body: invokes publish + awaits + returns resolved result
  it("4. stub execute: publishes tool_call + returns result when resolveToolResult is called", async () => {
    const def = makeDefinition({ modelToolName: "my_widget" });
    const stub = buildClientToolStub(def);
    const args = { query: "test query" };

    // Start execute without awaiting — we need to intercept the call_id first.
    const executePromise = stub.execute(args, {} as never);

    // Allow Promise setup inside execute to run (one microtask flush).
    await Promise.resolve();

    // The publish happened synchronously.
    const published = publishedPayloads.find((p) => p.topic === "botsson-tool-call");
    expect(published).toBeDefined();
    expect(published!.payload["type"]).toBe("tool_call");
    expect(published!.payload["name"]).toBe("my_widget");
    expect(published!.payload["arguments"]).toEqual(args);
    const resolveCapture = published!.payload["call_id"] as string;
    expect(typeof resolveCapture).toBe("string");

    // Simulate browser responding.
    resolveToolResult(resolveCapture, "widget executed");

    const result = await executePromise;
    expect(result).toBe("widget executed");
  });

  // Test 5: stub execute body: timeout fires after 10 s → returns timeout string
  it("5. stub execute: returns timeout message after 10 s when no browser response", async () => {
    const def = makeDefinition({ modelToolName: "slow_tool" });
    const stub = buildClientToolStub(def);

    const executePromise = stub.execute({}, {} as never);

    // Advance exactly 10 seconds to trigger timeout.
    vi.advanceTimersByTime(10_000);

    const result = await executePromise;
    expect(result).toMatch(/timed out/i);
    expect(result).toContain("10s");
  });

  // Test 6: publish payload shape contains all required fields
  it("6. publish payload has correct shape: { type, call_id, name, arguments }", async () => {
    const def = makeDefinition({ modelToolName: "shape_check_tool" });
    const stub = buildClientToolStub(def);
    const args = { filter: "active" };

    const executePromise = stub.execute(args, {} as never);
    // Flush one microtask tick so publish fires.
    await Promise.resolve();

    const published = publishedPayloads.find((p) => p.topic === "botsson-tool-call");
    expect(published).toBeDefined();

    const payload = published!.payload;
    expect(payload["type"]).toBe("tool_call");
    expect(typeof payload["call_id"]).toBe("string");
    expect((payload["call_id"] as string).length).toBeGreaterThan(10); // UUID-like
    expect(payload["name"]).toBe("shape_check_tool");
    expect(payload["arguments"]).toEqual(args);
    expect(published!.topic).toBe("botsson-tool-call");

    // Resolve to prevent hanging promise.
    resolveToolResult(payload["call_id"] as string, "ok");
    await executePromise;
  });

  // Test 7: stub with no parameters produces schema with empty properties
  it("7. buildClientToolStub with empty dynamicParameters produces valid empty schema", () => {
    const def = makeDefinition({
      modelToolName: "no_params_tool",
      description: "No params needed",
      dynamicParameters: [],
    });
    const stub = buildClientToolStub(def);

    expect(stub.type).toBe("function");
    expect(stub.description).toBe("No params needed");
    // parameters should be a JSONSchema7-compatible object
    const params = stub.parameters as Record<string, unknown>;
    expect(params["type"]).toBe("object");
    expect(params["properties"]).toEqual({});
    expect(params["additionalProperties"]).toBe(false);
    // no "required" key when dynamicParameters is empty
    expect("required" in params).toBe(false);
  });
});
