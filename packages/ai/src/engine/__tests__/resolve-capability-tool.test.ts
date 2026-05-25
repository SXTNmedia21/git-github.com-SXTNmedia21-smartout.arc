// packages/ai/src/engine/__tests__/resolve-capability-tool.test.ts
//
// Unit tests for resolveCapabilityTool (ADR-0424 resolver layer).
//
// These tests use the REAL capability registry to verify that the resolver
// correctly maps (capability, tool) pairs. No DB interaction — the schedule
// capability's read tools never touch Supabase unless execute() is called.

import { describe, it, expect, expectTypeOf, vi } from "vitest";
import { z } from "zod";
import { resolveCapabilityTool, type ResolvedCapabilityTool } from "../resolve-capability-tool.js";
import type { AgentToolContext } from "../../capabilities/types.js";

// ---------------------------------------------------------------------------
// 1. Known capability + known tool → returns ResolvedCapabilityTool
// ---------------------------------------------------------------------------
describe("resolveCapabilityTool — known capability + known tool", () => {
  it("returns a ResolvedCapabilityTool with matching names (schedule / get_my_shifts)", {
    timeout: 30_000,
  }, async () => {
    const resolved = resolveCapabilityTool("schedule", "get_my_shifts");
    expect(resolved).not.toBeNull();
    expect(resolved!.capabilityName).toBe("schedule");
    expect(resolved!.toolName).toBe("get_my_shifts");
  });

  it("exposes an inputSchema that is a Zod type", { timeout: 30_000 }, () => {
    const resolved = resolveCapabilityTool("schedule", "get_my_shifts");
    expect(resolved).not.toBeNull();
    // Zod types have a _def property; validate by calling safeParse.
    const result = resolved!.inputSchema.safeParse({});
    expect(typeof result.success).toBe("boolean");
  });

  it("returns a non-null result for helpdesk_query / list_my_queue", { timeout: 30_000 }, () => {
    const resolved = resolveCapabilityTool("helpdesk_query", "list_my_queue");
    expect(resolved).not.toBeNull();
    expect(resolved!.capabilityName).toBe("helpdesk_query");
    expect(resolved!.toolName).toBe("list_my_queue");
  });

  it("returns a non-null result for communication / get_conversations", { timeout: 30_000 }, () => {
    const resolved = resolveCapabilityTool("communication", "get_conversations");
    expect(resolved).not.toBeNull();
    expect(resolved!.capabilityName).toBe("communication");
    expect(resolved!.toolName).toBe("get_conversations");
  });
});

// ---------------------------------------------------------------------------
// 2. Known capability + unknown tool → returns null
// ---------------------------------------------------------------------------
describe("resolveCapabilityTool — known capability + unknown tool", () => {
  it("returns null for a tool name that does not exist in the capability", { timeout: 30_000 }, () => {
    const resolved = resolveCapabilityTool("schedule", "nonexistent_tool_xyz");
    expect(resolved).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 3. Unknown capability → returns null
// ---------------------------------------------------------------------------
describe("resolveCapabilityTool — unknown capability", () => {
  it("returns null for a capability name not in the registry", { timeout: 30_000 }, () => {
    const resolved = resolveCapabilityTool("totally_unknown_capability", "some_tool");
    expect(resolved).toBeNull();
  });

  it("returns null for an empty string capability name", { timeout: 30_000 }, () => {
    const resolved = resolveCapabilityTool("", "get_my_shifts");
    expect(resolved).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 4. Returned execute() callable — type-checks + behaviour
// ---------------------------------------------------------------------------
describe("resolveCapabilityTool — execute() callable", () => {
  it("execute() returns { ok: true, result: string } when the underlying tool succeeds", async () => {
    // Stub the schedule capability's get_my_shifts tool to return a known string.
    // We bypass the real DB call by mocking the module BEFORE import.
    vi.resetModules();
    vi.doMock("../../capabilities/schedule/tools.js", async (importOriginal) => {
      const original = await importOriginal<
        typeof import("../../capabilities/schedule/tools.js")
      >();
      return {
        ...original,
        getMyShifts: {
          ...original.getMyShifts,
          execute: async (_params: unknown, _ctx: unknown) => "[]",
        },
      };
    });

    const { resolveCapabilityTool: freshResolve } = await import(
      "../resolve-capability-tool.js"
    );

    const resolved = freshResolve("schedule", "get_my_shifts");
    expect(resolved).not.toBeNull();

    const ctx = {} as AgentToolContext;
    const result = await resolved!.execute({}, ctx);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(typeof result.result).toBe("string");
    }

    vi.doUnmock("../../capabilities/schedule/tools.js");
    vi.resetModules();
  });

  it("execute() returns { ok: false, error } when input fails schema validation", async () => {
    // Use helpdesk open_ticket which requires a summary string.
    // Pass a number to trigger Zod parse failure.
    vi.resetModules();
    // No mock needed — just pass bad input; execute() validates internally.
    const { resolveCapabilityTool: freshResolve } = await import(
      "../resolve-capability-tool.js"
    );

    const resolved = freshResolve("helpdesk_query", "open_ticket");
    expect(resolved).not.toBeNull();

    const ctx = {} as AgentToolContext;
    // open_ticket requires { summary: string } — pass wrong type to trigger Zod error.
    const result = await resolved!.execute({ summary: 42 }, ctx);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/input validation failed/i);
    }

    vi.resetModules();
  });

  it("execute() returns { ok: false, error } when the underlying tool throws", async () => {
    vi.resetModules();
    vi.doMock("../../capabilities/helpdesk_query/tools.js", async (importOriginal) => {
      const original = await importOriginal<
        typeof import("../../capabilities/helpdesk_query/tools.js")
      >();
      return {
        ...original,
        listMyQueue: {
          ...original.listMyQueue,
          execute: async (_params: unknown, _ctx: unknown) => {
            throw new Error("simulated tool failure");
          },
        },
      };
    });

    const { resolveCapabilityTool: freshResolve } = await import(
      "../resolve-capability-tool.js"
    );

    const resolved = freshResolve("helpdesk_query", "list_my_queue");
    expect(resolved).not.toBeNull();

    const ctx = {} as AgentToolContext;
    const result = await resolved!.execute({}, ctx);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("simulated tool failure");
    }

    vi.doUnmock("../../capabilities/helpdesk_query/tools.js");
    vi.resetModules();
  });

  it("execute() has the correct return type signature", () => {
    // Compile-time type check: execute must return the discriminated union.
    type ExecuteFn = ResolvedCapabilityTool["execute"];
    type ReturnT = Awaited<ReturnType<ExecuteFn>>;
    expectTypeOf<ReturnT>().toEqualTypeOf<
      { ok: true; result: string } | { ok: false; error: string }
    >();
  });
});
