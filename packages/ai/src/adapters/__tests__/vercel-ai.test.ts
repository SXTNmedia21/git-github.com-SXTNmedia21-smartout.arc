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
