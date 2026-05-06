import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";

// Mock @smartout/telemetry before importing the adapter
vi.mock("@smartout/telemetry", () => ({
  emit: vi.fn().mockResolvedValue(undefined),
}));

import { toVercelTools } from "../vercel-ai.js";
import { emit } from "@smartout/telemetry";

const ctx = {
  workspaceId: "w1",
  profileId: "p1",
  sessionId: "s1",
  requestId: "req-1",
};

beforeEach(() => {
  vi.mocked(emit).mockClear();
});

describe("toVercelTools auto-emit", () => {
  it("emits botsson.tool_invoked on success", async () => {
    const tools = toVercelTools(
      [
        {
          name: "test_tool",
          description: "t",
          capability: "schedule",
          schema: z.object({ x: z.number() }),
          execute: async () => "ok",
        },
      ],
      ctx,
    );
    await tools.test_tool!.execute!({ x: 1 }, { toolCallId: "tc1", messages: [] });
    expect(emit).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "botsson.tool_invoked",
        workspace_id: "w1",
        actor_id: "p1",
        correlation_id: "req-1",
        properties: expect.objectContaining({
          data: expect.objectContaining({
            session_id: "s1",
            capability: "schedule",
            tool: "test_tool",
            success: true,
          }),
        }),
      }),
    );
  });

  it("emits botsson.tool_failed when tool throws", async () => {
    const tools = toVercelTools(
      [
        {
          name: "bad",
          description: "t",
          capability: "schedule",
          schema: z.object({}),
          execute: async () => {
            throw new Error("boom");
          },
        },
      ],
      ctx,
    );
    await expect(tools.bad!.execute!({}, { toolCallId: "tc1", messages: [] })).rejects.toThrow(
      "boom",
    );
    expect(emit).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "botsson.tool_failed",
        properties: expect.objectContaining({
          data: expect.objectContaining({
            tool: "bad",
            capability: "schedule",
            error_message: "boom",
          }),
        }),
      }),
    );
  });

  // SMA-301 — Bedrock/Anthropic enforce tool-name pattern
  // ^[a-zA-Z0-9_-]{1,128}$. We sanitize at the wire boundary by replacing
  // `.` with `__` so the LLM-visible key validates while internal registry
  // keys (used in `gate_action`, ADR-0195 per-tool authority) keep dotted
  // form. Telemetry payload keeps the dotted name for observability.
  it("rewrites dotted tool names to double-underscore at the wire boundary", async () => {
    const tools = toVercelTools(
      [
        {
          name: "season.get_readiness",
          description: "t",
          capability: "season.get_readiness",
          schema: z.object({}),
          execute: async () => "ok",
        },
        {
          name: "tips.set_pot",
          description: "t",
          capability: "tips.set_pot",
          schema: z.object({}),
          execute: async () => "ok",
        },
      ],
      ctx,
    );
    expect(Object.keys(tools)).toEqual(["season__get_readiness", "tips__set_pot"]);
    expect(tools["season__get_readiness"]).toBeDefined();
    expect(tools["season.get_readiness"]).toBeUndefined();

    // Telemetry preserves dotted internal name for observability.
    await tools["season__get_readiness"]!.execute!({}, { toolCallId: "tc1", messages: [] });
    expect(emit).toHaveBeenCalledWith(
      expect.objectContaining({
        properties: expect.objectContaining({
          data: expect.objectContaining({ tool: "season.get_readiness" }),
        }),
      }),
    );
  });

  it("preserves snake_case names unchanged", async () => {
    const tools = toVercelTools(
      [
        {
          name: "get_my_shifts",
          description: "t",
          capability: "schedule",
          schema: z.object({}),
          execute: async () => "ok",
        },
      ],
      ctx,
    );
    expect(Object.keys(tools)).toEqual(["get_my_shifts"]);
  });

  it("falls back to capability 'unknown' when field missing", async () => {
    const tools = toVercelTools(
      [
        {
          name: "x",
          description: "t",
          schema: z.object({}),
          execute: async () => "ok",
        },
      ],
      ctx,
    );
    await tools.x!.execute!({}, { toolCallId: "tc1", messages: [] });
    expect(emit).toHaveBeenCalledWith(
      expect.objectContaining({
        properties: expect.objectContaining({
          data: expect.objectContaining({ capability: "unknown" }),
        }),
      }),
    );
  });
});
