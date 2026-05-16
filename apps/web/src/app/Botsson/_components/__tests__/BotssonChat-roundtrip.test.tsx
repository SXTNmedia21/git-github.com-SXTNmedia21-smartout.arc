/**
 * BotssonChat — client-tool roundtrip unit tests.
 *
 * Tests the two exported pure helpers:
 *   - resolveClientToolCalls  — invokes browser-side tool implementations
 *   - executeClientToolRoundtrip — full fetch-loop with loop-safety cap
 *
 * Project convention: vitest runs in node env; no @testing-library/react.
 * We test the exported pure functions directly and mock global.fetch via vi.fn().
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { resolveClientToolCalls, executeClientToolRoundtrip } from "../BotssonChat";
import type { ClientToolCall, ClientToolImplementation } from "@smartout/ai/harness/types";

// ── helpers ─────────────────────────────────────────────────────────────────

function makeCall(id: string, name: string, args: Record<string, unknown> = {}): ClientToolCall {
  return { tool_call_id: id, name, arguments: args };
}

function makeOkResponse(body: unknown) {
  return {
    ok: true,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

function makeErrResponse(status: number, body: unknown) {
  return {
    ok: false,
    status,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

// ── resolveClientToolCalls ───────────────────────────────────────────────────

describe("resolveClientToolCalls", () => {
  it("calls the registered implementation and returns result", async () => {
    const impl: ClientToolImplementation = vi.fn().mockResolvedValue("page 3");
    const calls = [makeCall("tc-1", "goToPage", { page: 3 })];
    const results = await resolveClientToolCalls(calls, { goToPage: impl });

    expect(results).toHaveLength(1);
    expect(results[0]!.tool_call_id).toBe("tc-1");
    expect(results[0]!.result).toBe("page 3");
    expect(results[0]!.is_error).toBeUndefined();
    expect(impl).toHaveBeenCalledWith({ page: 3 });
  });

  it("returns is_error result when implementation throws", async () => {
    const impl: ClientToolImplementation = vi.fn().mockRejectedValue(new Error("DOM node missing"));
    const calls = [makeCall("tc-2", "highlightRow", { id: "r1" })];
    const results = await resolveClientToolCalls(calls, { highlightRow: impl });

    expect(results[0]!.is_error).toBe(true);
    expect(results[0]!.result).toContain("DOM node missing");
    expect(results[0]!.tool_call_id).toBe("tc-2");
  });

  it("returns not-registered message for unknown tool name", async () => {
    const calls = [makeCall("tc-3", "openModal", {})];
    const results = await resolveClientToolCalls(calls, {}); // empty registry

    expect(results[0]!.is_error).toBe(true);
    expect(results[0]!.result).toContain("openModal");
    expect(results[0]!.result).toContain("not registered");
  });

  it("resolves multiple calls in parallel", async () => {
    const implA: ClientToolImplementation = vi.fn().mockResolvedValue("result-A");
    const implB: ClientToolImplementation = vi.fn().mockResolvedValue("result-B");
    const calls = [makeCall("tc-4", "toolA", {}), makeCall("tc-5", "toolB", {})];
    const results = await resolveClientToolCalls(calls, { toolA: implA, toolB: implB });

    expect(results).toHaveLength(2);
    expect(results[0]!.result).toBe("result-A");
    expect(results[1]!.result).toBe("result-B");
  });
});

// ── executeClientToolRoundtrip ───────────────────────────────────────────────

describe("executeClientToolRoundtrip", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    // Reset fetch mock before each test
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("returns final message immediately when response has no client_tool_calls", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(makeOkResponse({ text: "Hei, jeg hjelper deg!", sessionId: "sess-1" }));
    globalThis.fetch = fetchMock;

    const result = await executeClientToolRoundtrip({
      endpoint: "/api/botsson/chat",
      initialBody: { workspaceId: "ws-1", userMessage: "hei" },
      implementations: {},
    });

    expect(result.text).toBe("Hei, jeg hjelper deg!");
    expect(result.sessionId).toBe("sess-1");
    // Only one fetch call — no roundtrip needed
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("performs roundtrip: sends client_tool_results on second request when first response has client_tool_calls", async () => {
    const impl: ClientToolImplementation = vi.fn().mockResolvedValue("tab-3");
    const fetchMock = vi
      .fn()
      // First call — server wants a client tool
      .mockResolvedValueOnce(
        makeOkResponse({
          sessionId: "sess-2",
          client_tool_calls: [makeCall("tc-10", "switchTab", { index: 3 })],
        }),
      )
      // Second call — final response
      .mockResolvedValueOnce(makeOkResponse({ text: "Byttet til fane 3", sessionId: "sess-2" }));
    globalThis.fetch = fetchMock;

    const result = await executeClientToolRoundtrip({
      endpoint: "/api/botsson/chat",
      initialBody: { workspaceId: "ws-1", userMessage: "bytt til fane 3" },
      implementations: { switchTab: impl },
    });

    expect(result.text).toBe("Byttet til fane 3");
    expect(fetchMock).toHaveBeenCalledTimes(2);

    // Second request must include client_tool_results
    const secondCallBody = JSON.parse(
      (fetchMock.mock.calls[1] as [string, RequestInit])[1]!.body as string,
    ) as { client_tool_results?: unknown[]; sessionId?: string };

    expect(secondCallBody.client_tool_results).toHaveLength(1);
    expect((secondCallBody.client_tool_results![0] as { tool_call_id: string }).tool_call_id).toBe(
      "tc-10",
    );
    expect((secondCallBody.client_tool_results![0] as { result: string }).result).toBe("tab-3");

    // session_id must be preserved across rounds
    expect(secondCallBody.sessionId).toBe("sess-2");
  });

  it("captures thrown implementation as is_error result and still sends second request", async () => {
    const impl: ClientToolImplementation = vi.fn().mockRejectedValue(new Error("scrollTo failed"));
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        makeOkResponse({
          client_tool_calls: [makeCall("tc-20", "scrollTo", { target: "header" })],
        }),
      )
      .mockResolvedValueOnce(makeOkResponse({ text: "Forsto det ikke", sessionId: undefined }));
    globalThis.fetch = fetchMock;

    const result = await executeClientToolRoundtrip({
      endpoint: "/api/botsson/chat",
      initialBody: { workspaceId: "ws-1", userMessage: "scroll til toppen" },
      implementations: { scrollTo: impl },
    });

    // Should still complete — error becomes tool result
    expect(result.text).toBe("Forsto det ikke");
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const secondBody = JSON.parse(
      (fetchMock.mock.calls[1] as [string, RequestInit])[1]!.body as string,
    ) as { client_tool_results: Array<{ is_error: boolean; result: string }> };

    expect(secondBody.client_tool_results[0]!.is_error).toBe(true);
    expect(secondBody.client_tool_results[0]!.result).toContain("scrollTo failed");
  });

  it("returns not-registered result and still sends second request for unknown tool", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        makeOkResponse({
          client_tool_calls: [makeCall("tc-30", "unknownTool", {})],
        }),
      )
      .mockResolvedValueOnce(makeOkResponse({ text: "OK", sessionId: undefined }));
    globalThis.fetch = fetchMock;

    await executeClientToolRoundtrip({
      endpoint: "/api/botsson/chat",
      initialBody: { workspaceId: "ws-1", userMessage: "test" },
      implementations: {}, // unknownTool not in registry
    });

    const secondBody = JSON.parse(
      (fetchMock.mock.calls[1] as [string, RequestInit])[1]!.body as string,
    ) as { client_tool_results: Array<{ is_error: boolean; result: string }> };

    expect(secondBody.client_tool_results[0]!.is_error).toBe(true);
    expect(secondBody.client_tool_results[0]!.result).toContain("unknownTool");
    expect(secondBody.client_tool_results[0]!.result).toContain("not registered");
  });

  it("throws loop-cap error after 3 rounds of continuous client_tool_calls", async () => {
    const impl: ClientToolImplementation = vi.fn().mockResolvedValue("done");
    const toolCallResponse = makeOkResponse({
      client_tool_calls: [makeCall("tc-40", "infiniteTool", {})],
    });
    const fetchMock = vi.fn().mockResolvedValue(toolCallResponse);
    globalThis.fetch = fetchMock;

    await expect(
      executeClientToolRoundtrip({
        endpoint: "/api/botsson/chat",
        initialBody: { workspaceId: "ws-1", userMessage: "loop" },
        implementations: { infiniteTool: impl },
      }),
    ).rejects.toThrow("Botsson kept asking for tools");

    // Should have stopped at MAX_ROUNDTRIPS (3) — first request + 2 roundtrips (3 total fetches)
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("throws when fetch response is not ok", async () => {
    const fetchMock = vi.fn().mockResolvedValue(makeErrResponse(500, { error: "server exploded" }));
    globalThis.fetch = fetchMock;

    await expect(
      executeClientToolRoundtrip({
        endpoint: "/api/botsson/chat",
        initialBody: { workspaceId: "ws-1", userMessage: "test" },
        implementations: {},
      }),
    ).rejects.toThrow("server exploded");
  });
});
