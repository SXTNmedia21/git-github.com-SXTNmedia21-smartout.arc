/**
 * journey capability — unit tests (S1.4).
 *
 * Covers:
 *   - CapabilityDefinition shape (allowedChannels, readOnlyTools, tools, suggestTools)
 *   - ADR-0173 tool-name invariants (exactly 4 tools, frozen names)
 *   - ADR-0134 compliance (Gate A C-3) — every execute() rejects empty
 *     workspaceId / profileId BEFORE any emit side-effect.
 *
 * SS-4 (Council 2026-04-23, ADR-0204): `callGateAction` now delegates to
 * the composition orchestrator `gatedMutation()` which calls BOTH
 * `gate_action` AND `cascade_gate_write`. Mocks that previously returned
 * a single shape for all rpc calls need to discriminate by fn name so
 * Pathway B gets a valid `cascade_gate_write` response
 * (`{allowed:true, outcome:"applied"}`). The journey test helper
 * `makeJourneyRpc()` wraps a test-supplied gate_action response and
 * auto-defaults cascade_gate_write; mocks also need a no-op
 * `from("gate_evaluation").update().eq()` for the orchestrator's
 * correlation stamp.
 *
 * emit() is mocked — S1.4 only cares that the guard runs first and that the
 * capability shape matches ADR-0173. Full end-to-end emit wiring is already
 * exercised by packages/telemetry/src/__tests__/ + the per-destination
 * provider tests (S1.1).
 */

import { afterAll, beforeAll, describe, it, expect, vi, beforeEach } from "vitest";
import {
  journeyCapability,
  runDevTool,
  publishMissionTool,
  publishGuideTool,
  runGuidedTool,
} from "../index.js";
import type { AgentToolContext } from "../../types.js";
import { emit } from "@smartout/telemetry";

// emit() is async and must not throw. Same pattern as helpdesk_query tests.
vi.mock("@smartout/telemetry", () => ({
  emit: vi.fn().mockResolvedValue(undefined),
}));

// SS-4: enable the composition orchestrator for this test file.
const ORIGINAL_ORCHESTRATOR_FLAG = process.env.SMARTOUT_COMPOSITION_ORCHESTRATOR_ENABLED;
beforeAll(() => {
  process.env.SMARTOUT_COMPOSITION_ORCHESTRATOR_ENABLED = "true";
});
afterAll(() => {
  if (ORIGINAL_ORCHESTRATOR_FLAG === undefined) {
    delete process.env.SMARTOUT_COMPOSITION_ORCHESTRATOR_ENABLED;
  } else {
    process.env.SMARTOUT_COMPOSITION_ORCHESTRATOR_ENABLED = ORIGINAL_ORCHESTRATOR_FLAG;
  }
});

// SS-4: default cascade_gate_write response for the orchestrator's
// Pathway B. The sentinel entity_type hits `no-active-framework` in
// production, so `applied` is the correct stub.
const DEFAULT_CASCADE_WRITE = {
  allowed: true,
  outcome: "applied",
  reason: "no-active-framework",
  gate_evaluation_id: "gate-eval-b",
};

/**
 * Build an `rpc` handler that discriminates `gate_action` vs
 * `cascade_gate_write`. Tests pass in their desired gate_action
 * response; cascade_gate_write is auto-defaulted.
 *
 * For `gate_action` error cases, pass `{data: null, error: {...}}`.
 * For `gate_action` allow: `{data: {allow: true}, error: null}`.
 */
function makeJourneyRpc(gateActionResponse: {
  data: unknown;
  error: unknown;
}): (fn: string) => Promise<{ data: unknown; error: unknown }> {
  return async (fn: string) => {
    if (fn === "gate_action") return gateActionResponse;
    if (fn === "cascade_gate_write") {
      // If gate_action errored, the orchestrator short-circuits
      // before calling cascade_gate_write. But include a sensible
      // default anyway for defence against test-double drift.
      return { data: DEFAULT_CASCADE_WRITE, error: null };
    }
    return { data: null, error: null };
  };
}

/**
 * Build a `from()` handler that:
 *   - Routes `gate_evaluation` to a no-op update().eq() chain (SS-4
 *     orchestrator's correlation stamp).
 *   - Delegates everything else to the user-supplied handler.
 */
function wrapFrom(userFrom: (table: string) => unknown): (table: string) => unknown {
  return (table: string) => {
    if (table === "gate_evaluation") {
      return {
        update: () => ({
          eq: async () => ({ data: null, error: null }),
        }),
      };
    }
    return userFrom(table);
  };
}

const emitMock = vi.mocked(emit);

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

describe("publish_* neutered (Phase 0 remediation — ADR-0196 Invariant 11)", () => {
  // Phase 0 honesty: publish_mission and publish_guide are NEUTERED until
  // their real bodies land in Phase 3. They MUST return
  // {ok:false, error:"not_implemented"} on a happy-path invocation and MUST
  // NOT emit any telemetry (L-0119 / L-0120 / ADR-0197 class rule).
  // run_dev (N-C) and run_guided (M5.1) do real work — see their own blocks.

  beforeEach(() => {
    emitMock.mockClear();
  });

  it("publish_mission returns not_implemented + references ADR-0194", async () => {
    const ctx = {
      workspaceId: "10000000-0000-0000-0000-000000000001",
      profileId: "20000000-0000-0000-0000-000000000001",
      sessionId: "session-test",
      supabaseAdmin: {} as unknown,
    } as unknown as AgentToolContext;

    const result = await publishMissionTool.execute(
      { journey_version_id: VALID_JOURNEY_VERSION_ID },
      ctx,
    );
    const parsed = JSON.parse(result);

    expect(parsed.ok).toBe(false);
    expect(parsed.error).toBe("not_implemented");
    expect(parsed.message).toMatch(/ADR-0194/);
    expect(publishMissionTool.capability).toBe("journey.publish_mission");
    // Phantom-emit guard: a neutered tool must not fire success telemetry.
    expect(emitMock).not.toHaveBeenCalled();
  });

  it("publish_guide returns not_implemented + references Phase 0/Phase 3", async () => {
    const ctx = {
      workspaceId: "10000000-0000-0000-0000-000000000001",
      profileId: "20000000-0000-0000-0000-000000000001",
      sessionId: "session-test",
      supabaseAdmin: {} as unknown,
    } as unknown as AgentToolContext;

    const result = await publishGuideTool.execute(
      { journey_version_id: VALID_JOURNEY_VERSION_ID },
      ctx,
    );
    const parsed = JSON.parse(result);

    expect(parsed.ok).toBe(false);
    expect(parsed.error).toBe("not_implemented");
    expect(parsed.message).toMatch(/Phase 3|Phase 0/);
    expect(publishGuideTool.capability).toBe("journey.publish_guide");
    // Phantom-emit guard: a neutered tool must not fire success telemetry.
    expect(emitMock).not.toHaveBeenCalled();
  });
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
        rpc: makeJourneyRpc({ data: { allow: true }, error: null }),
        from: wrapFrom(() => ({
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: null, error: null }),
              }),
            }),
          }),
        })),
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

describe("run_dev — N-C queued-intent contract", () => {
  // N-C flesh-out: run_dev is no longer a skeleton. It records run intent in
  // engine_state + engine_state_step (L-0023 runtime state) and emits
  // `journey run_started` + `journey step_reached` (both already registered,
  // no new events per council R5.1-5). Playwright is invoked out-of-band by
  // a worker that polls engine_state rows with status='queued'.

  it("returns capability_disabled when gate_action RPC fails (fail-closed)", async () => {
    const ctx = {
      workspaceId: "10000000-0000-0000-0000-000000000001",
      profileId: "20000000-0000-0000-0000-000000000001",
      sessionId: "session-test",
      supabaseAdmin: {
        rpc: async () => ({ data: null, error: { message: "rpc_unavailable" } }),
      } as unknown,
    } as unknown as AgentToolContext;

    const result = await runDevTool.execute({ journey_version_id: VALID_JOURNEY_VERSION_ID }, ctx);
    const parsed = JSON.parse(result);
    expect(parsed.ok).toBe(false);
    expect(parsed.error).toBe("capability_disabled");
  });

  it("returns journey_version_not_found when row missing", async () => {
    const ctx = {
      workspaceId: "10000000-0000-0000-0000-000000000001",
      profileId: "20000000-0000-0000-0000-000000000001",
      sessionId: "session-test",
      supabaseAdmin: {
        rpc: makeJourneyRpc({ data: { allow: true }, error: null }),
        from: wrapFrom(() => ({
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: null, error: null }),
              }),
            }),
          }),
        })),
      } as unknown,
    } as unknown as AgentToolContext;

    const result = await runDevTool.execute({ journey_version_id: VALID_JOURNEY_VERSION_ID }, ctx);
    const parsed = JSON.parse(result);
    expect(parsed.ok).toBe(false);
    expect(parsed.error).toBe("journey_version_not_found");
  });

  it("returns journey_not_compiled when parent journey has null engine_process_id", async () => {
    // Sequence:
    //   1st from('journey_version').select(...).eq(...).eq(...).maybeSingle() → versionRow
    //   2nd from('journey').select(...).eq(...).eq(...).maybeSingle() → journeyRow (engine_process_id: null)
    //
    // SS-4 note: counting "1st, 2nd" is against the tool's from() calls,
    // not the orchestrator's stamp calls — wrapFrom() routes
    // gate_evaluation to a no-op BEFORE incrementing fromCall.
    let fromCall = 0;
    const ctx = {
      workspaceId: "10000000-0000-0000-0000-000000000001",
      profileId: "20000000-0000-0000-0000-000000000001",
      sessionId: "session-test",
      supabaseAdmin: {
        rpc: makeJourneyRpc({ data: { allow: true }, error: null }),
        from: wrapFrom(() => {
          fromCall += 1;
          const isVersion = fromCall === 1;
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: async () =>
                    isVersion
                      ? {
                          data: {
                            journey_version_id: VALID_JOURNEY_VERSION_ID,
                            workspace_id: "10000000-0000-0000-0000-000000000001",
                            ir_json: {
                              version: "2.0.0",
                              slug: "test",
                              title: "Test",
                              module: "test",
                              steps: [],
                            },
                            journey_id: "30000000-0000-0000-0000-000000000001",
                            status: "draft",
                          },
                          error: null,
                        }
                      : {
                          data: {
                            journey_id: "30000000-0000-0000-0000-000000000001",
                            engine_process_id: null,
                          },
                          error: null,
                        },
                }),
              }),
            }),
          };
        }),
      } as unknown,
    } as unknown as AgentToolContext;

    const result = await runDevTool.execute({ journey_version_id: VALID_JOURNEY_VERSION_ID }, ctx);
    const parsed = JSON.parse(result);
    expect(parsed.ok).toBe(false);
    expect(parsed.error).toBe("journey_not_compiled");
  });
});
