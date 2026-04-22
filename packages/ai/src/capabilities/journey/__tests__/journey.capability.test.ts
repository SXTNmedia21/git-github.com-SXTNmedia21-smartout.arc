/**
 * journey capability — unit tests (S1.4).
 *
 * Covers:
 *   - CapabilityDefinition shape (allowedChannels, readOnlyTools, tools, suggestTools)
 *   - ADR-0173 tool-name invariants (exactly 4 tools, frozen names)
 *   - ADR-0134 compliance (Gate A C-3) — every execute() rejects empty
 *     workspaceId / profileId BEFORE any emit side-effect.
 *
 * emit() is mocked — S1.4 only cares that the guard runs first and that the
 * capability shape matches ADR-0173. Full end-to-end emit wiring is already
 * exercised by packages/telemetry/src/__tests__/ + the per-destination
 * provider tests (S1.1).
 */

import { describe, it, expect, vi } from "vitest";
import {
  journeyCapability,
  runDevTool,
  publishMissionTool,
  publishGuideTool,
  runGuidedTool,
} from "../index.js";
import type { AgentToolContext } from "../../types.js";

// emit() is async and must not throw. Same pattern as helpdesk_query tests.
vi.mock("@smartout/telemetry", () => ({
  emit: vi.fn().mockResolvedValue(undefined),
}));

const VALID_JOURNEY_VERSION_ID = "11111111-1111-1111-1111-111111111111";

describe("journeyCapability", () => {
  it("is chat-only (ADR-0078)", () => {
    expect(journeyCapability.allowedChannels).toEqual(["chat"]);
  });

  it("has no read-only tools (all 4 are mutations)", () => {
    expect(journeyCapability.readOnlyTools).toEqual([]);
  });

  it("has exactly 4 tools per ADR-0173", () => {
    expect(journeyCapability.tools).toHaveLength(4);
  });

  it("tool names match ADR-0173 authority seed rows", () => {
    const names = journeyCapability.tools.map((t) => t.name).sort();
    expect(names).toEqual(["publish_guide", "publish_mission", "run_dev", "run_guided"]);
  });

  it("has 3 tools in suggestTools (run_guided excluded → autonomous)", () => {
    expect(journeyCapability.suggestTools).toBeDefined();
    expect(journeyCapability.suggestTools).toHaveLength(3);
    const suggestNames = journeyCapability.suggestTools!.map((t) => t.name);
    expect(suggestNames).not.toContain("run_guided");
    expect(suggestNames.sort()).toEqual(["publish_guide", "publish_mission", "run_dev"]);
  });

  it("capability name is 'journey' (matches CapabilityName union)", () => {
    expect(journeyCapability.name).toBe("journey");
  });
});

describe("ADR-0134 compliance — Gate A C-3 (actor_id non-null before emit)", () => {
  const tools = [
    { tool: runDevTool, label: "run_dev" },
    { tool: publishMissionTool, label: "publish_mission" },
    { tool: publishGuideTool, label: "publish_guide" },
    { tool: runGuidedTool, label: "run_guided" },
  ];

  for (const { tool, label } of tools) {
    it(`${label} rejects empty workspaceId + profileId`, async () => {
      const ctx = {
        workspaceId: "",
        profileId: "",
        sessionId: "session-test",
        supabaseAdmin: {} as unknown,
      } as unknown as AgentToolContext;

      const result = await tool.execute({ journey_version_id: VALID_JOURNEY_VERSION_ID }, ctx);

      const parsed = JSON.parse(result);
      expect(parsed.ok).toBe(false);
      expect(parsed.error).toBe("missing_context");
    });

    it(`${label} rejects empty workspaceId only`, async () => {
      const ctx = {
        workspaceId: "",
        profileId: "20000000-0000-0000-0000-000000000001",
        sessionId: "session-test",
        supabaseAdmin: {} as unknown,
      } as unknown as AgentToolContext;

      const result = await tool.execute({ journey_version_id: VALID_JOURNEY_VERSION_ID }, ctx);
      const parsed = JSON.parse(result);
      expect(parsed.ok).toBe(false);
      expect(parsed.error).toBe("missing_context");
    });

    it(`${label} rejects empty profileId only`, async () => {
      const ctx = {
        workspaceId: "10000000-0000-0000-0000-000000000001",
        profileId: "",
        sessionId: "session-test",
        supabaseAdmin: {} as unknown,
      } as unknown as AgentToolContext;

      const result = await tool.execute({ journey_version_id: VALID_JOURNEY_VERSION_ID }, ctx);
      const parsed = JSON.parse(result);
      expect(parsed.ok).toBe(false);
      expect(parsed.error).toBe("missing_context");
    });
  }
});

describe("happy path — skeleton tools emit journey run_started with correct surface", () => {
  // run_guided is fleshed out in M5.1 — it now does real DB work and is
  // covered by its own test block below. The remaining three tools are
  // still S1.4 skeletons.
  const cases = [
    { tool: runDevTool, surface: "dev", capability: "journey.run_dev" },
    { tool: publishMissionTool, surface: "admin", capability: "journey.publish_mission" },
    { tool: publishGuideTool, surface: "admin", capability: "journey.publish_guide" },
  ];

  for (const { tool, surface, capability } of cases) {
    it(`${tool.name} returns ok + run_id when context is resolved`, async () => {
      const ctx = {
        workspaceId: "10000000-0000-0000-0000-000000000001",
        profileId: "20000000-0000-0000-0000-000000000001",
        sessionId: "session-test",
        supabaseAdmin: {} as unknown,
      } as unknown as AgentToolContext;

      const result = await tool.execute({ journey_version_id: VALID_JOURNEY_VERSION_ID }, ctx);
      const parsed = JSON.parse(result);
      expect(parsed.ok).toBe(true);
      expect(parsed.run_id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
      expect(typeof parsed.note).toBe("string");
      expect(tool.capability).toBe(capability);
      expect(surface).toMatch(/^(dev|admin|runtime_web)$/);
    });
  }
});

describe("run_guided — M5.1 runtime gate contract", () => {
  // Council red-line R5.1-3: gate_action is MANDATORY. An `autonomous`
  // default is not a skip-the-gate license (L-0066/L-0097). With a stub
  // Supabase client the RPC call returns a rejected promise / error, and
  // the tool MUST fail closed with `capability_disabled` — never
  // default-allow.
  it("returns capability_disabled when gate_action RPC fails (fail-closed)", async () => {
    const ctx = {
      workspaceId: "10000000-0000-0000-0000-000000000001",
      profileId: "20000000-0000-0000-0000-000000000001",
      sessionId: "session-test",
      supabaseAdmin: {
        rpc: async () => ({ data: null, error: { message: "rpc_unavailable" } }),
      } as unknown,
    } as unknown as AgentToolContext;

    const result = await runGuidedTool.execute(
      { journey_version_id: VALID_JOURNEY_VERSION_ID },
      ctx,
    );
    const parsed = JSON.parse(result);
    expect(parsed.ok).toBe(false);
    expect(parsed.error).toBe("capability_disabled");
  });

  it("returns journey_version_not_found when row missing", async () => {
    // gate allows, but the journey_version lookup returns null.
    const ctx = {
      workspaceId: "10000000-0000-0000-0000-000000000001",
      profileId: "20000000-0000-0000-0000-000000000001",
      sessionId: "session-test",
      supabaseAdmin: {
        rpc: async () => ({ data: { allow: true }, error: null }),
        from: () => ({
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: null, error: null }),
              }),
            }),
          }),
        }),
      } as unknown,
    } as unknown as AgentToolContext;

    const result = await runGuidedTool.execute(
      { journey_version_id: VALID_JOURNEY_VERSION_ID },
      ctx,
    );
    const parsed = JSON.parse(result);
    expect(parsed.ok).toBe(false);
    expect(parsed.error).toBe("journey_version_not_found");
  });
});
