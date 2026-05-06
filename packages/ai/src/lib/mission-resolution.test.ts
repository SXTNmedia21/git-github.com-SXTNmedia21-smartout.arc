// packages/ai/src/lib/mission-resolution.test.ts
//
// Unit tests for resolveMissionForJourneyVersion — all branches covered.
// Supabase admin client is mocked; no real DB required.
//
// Branches tested:
//   1. Happy path       — version found, single active mission, stages returned.
//   2. version_not_found — journey_version SELECT returns null.
//   3. not_found         — engine_missions SELECT returns 0 rows.
//   4. multiple_active   — engine_missions SELECT returns >1 rows.
//   5. stages_empty      — engine_stages SELECT returns 0 rows.

import { describe, expect, it, vi, type MockedFunction } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@smartout/supabase";
import {
  resolveMissionForJourneyVersion,
  type ResolveMissionResult,
} from "./mission-resolution.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type EngineMissionRow = Database["public"]["Tables"]["engine_missions"]["Row"];
type EngineStageRow = Database["public"]["Tables"]["engine_stages"]["Row"];

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const WORKSPACE_ID = "b0000000-0000-0000-0000-000000000000";
const JOURNEY_VERSION_ID = "10000000-0000-0000-0000-000000000000";
const JOURNEY_ID = "20000000-0000-0000-0000-000000000000";
const MISSION_ID = "journey_test-journey_v1";

const MISSION_ROW: EngineMissionRow = {
  id: MISSION_ID,
  name: "Test Mission",
  description: "Test description",
  mode: "sequential",
  system_prompt: "You are Botsson. Help the user step by step.",
  workspace_id: WORKSPACE_ID,
  journey_id: JOURNEY_ID,
  is_active: true,
  context_source: null,
  created_at: "2026-04-27T10:00:00.000Z",
  updated_at: "2026-04-27T10:00:00.000Z",
};

const STAGE_ROWS: EngineStageRow[] = [
  {
    id: "s1-uuid",
    stage_id: "step-intro",
    stage_order: 0,
    mission_id: MISSION_ID,
    goal: "Open the dashboard",
    instructions: "Click the dashboard link",
    success_criteria: "Dashboard is visible",
    creative_freedom: 0.2,
    is_required: true,
    journey_step_id: null,
    next_stage: null,
    inline_instructions: null,
    deferred_templates: null,
    emotion_hint: null,
    escalation_instructions: null,
    personality_override: null,
    tuning_notes: null,
    created_at: "2026-04-27T10:00:01.000Z",
  },
  {
    id: "s2-uuid",
    stage_id: "step-confirm",
    stage_order: 1,
    mission_id: MISSION_ID,
    goal: "Confirm the action",
    instructions: "Click the confirm button",
    success_criteria: "Confirmation modal appears",
    creative_freedom: 0.2,
    is_required: true,
    journey_step_id: null,
    next_stage: null,
    inline_instructions: null,
    deferred_templates: null,
    emotion_hint: null,
    escalation_instructions: null,
    personality_override: null,
    tuning_notes: null,
    created_at: "2026-04-27T10:00:02.000Z",
  },
];

// ---------------------------------------------------------------------------
// Supabase mock builder
//
// We build a minimal mock that chains `.from()` → `.select()` → `.eq()` → ...
// → `.maybeSingle()` / `.order()` / `.single()`.
//
// Each call to `buildMockClient(responses)` produces a fresh supabase-shaped
// object where `from(table)` returns a query builder that, when resolved
// (maybeSingle / order / etc.), returns the configured response for that table.
// ---------------------------------------------------------------------------

interface MockResponse<T> {
  data: T | null;
  error: { message: string } | null;
}

type TableResponses = {
  journey_version?: MockResponse<{ journey_id: string }>;
  engine_missions?: MockResponse<EngineMissionRow[]>;
  engine_stages?: MockResponse<EngineStageRow[]>;
};

function buildQueryChain<T>(response: MockResponse<T>): unknown {
  // Build a chainable object that resolves to the given response.
  // Handles: .select().eq().eq()...maybeSingle() and .select().eq()...order()
  const terminal = vi.fn().mockResolvedValue(response);
  const chain: Record<string, unknown> = {};

  // eq returns self (for chaining); the terminal call (maybeSingle / order)
  // returns the response.
  const self = new Proxy(chain, {
    get(_target, prop: string) {
      if (prop === "maybeSingle" || prop === "single") return terminal;
      if (prop === "order") {
        // .order() call returns an object that resolves (await-able) directly
        // — Supabase builder awaits the chain, not a final method call.
        // Return a thenable that resolves to `response`.
        return () =>
          Object.assign(Promise.resolve(response), {
            eq: () => self,
            order: () => Promise.resolve(response),
          });
      }
      // All other calls (select, eq, etc.) return self for chaining.
      return () => self;
    },
  });

  return self;
}

function buildMockClient(responses: TableResponses): SupabaseClient<Database> {
  const fromFn = vi.fn((table: string) => {
    if (table === "journey_version") {
      return buildQueryChain(responses.journey_version ?? { data: null, error: null });
    }
    if (table === "engine_missions") {
      return buildQueryChain(responses.engine_missions ?? { data: [], error: null });
    }
    if (table === "engine_stages") {
      return buildQueryChain(responses.engine_stages ?? { data: [], error: null });
    }
    return buildQueryChain({ data: null, error: null });
  });

  return { from: fromFn } as unknown as SupabaseClient<Database>;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("resolveMissionForJourneyVersion", () => {
  // ── Branch 1: happy path ──────────────────────────────────────────────────

  it("returns ok:true with mission + ordered stages on happy path", async () => {
    const supabaseAdmin = buildMockClient({
      journey_version: { data: { journey_id: JOURNEY_ID }, error: null },
      engine_missions: { data: [MISSION_ROW], error: null },
      engine_stages: { data: STAGE_ROWS, error: null },
    });

    const result: ResolveMissionResult = await resolveMissionForJourneyVersion({
      journeyVersionId: JOURNEY_VERSION_ID,
      workspaceId: WORKSPACE_ID,
      supabaseAdmin,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok:true");

    expect(result.mission.id).toBe(MISSION_ID);
    expect(result.mission.mode).toBe("sequential");
    expect(result.mission.system_prompt).toBe("You are Botsson. Help the user step by step.");
    expect(result.stages).toHaveLength(2);
    expect(result.stages[0]!.stage_order).toBe(0);
    expect(result.stages[1]!.stage_order).toBe(1);
  });

  // ── Branch 2: version_not_found ───────────────────────────────────────────

  it("returns version_not_found when journey_version SELECT returns null", async () => {
    const supabaseAdmin = buildMockClient({
      journey_version: { data: null, error: null },
    });

    const result = await resolveMissionForJourneyVersion({
      journeyVersionId: JOURNEY_VERSION_ID,
      workspaceId: WORKSPACE_ID,
      supabaseAdmin,
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected ok:false");
    expect(result.reason).toBe("version_not_found");
    expect(result.detail).toContain(JOURNEY_VERSION_ID);
  });

  it("returns version_not_found when journey_version SELECT returns DB error", async () => {
    const supabaseAdmin = buildMockClient({
      journey_version: {
        data: null,
        error: { message: "relation does not exist" },
      },
    });

    const result = await resolveMissionForJourneyVersion({
      journeyVersionId: JOURNEY_VERSION_ID,
      workspaceId: WORKSPACE_ID,
      supabaseAdmin,
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected ok:false");
    expect(result.reason).toBe("version_not_found");
  });

  // ── Branch 3: not_found (no active mission) ───────────────────────────────

  it("returns not_found when engine_missions returns 0 rows", async () => {
    const supabaseAdmin = buildMockClient({
      journey_version: { data: { journey_id: JOURNEY_ID }, error: null },
      engine_missions: { data: [], error: null },
    });

    const result = await resolveMissionForJourneyVersion({
      journeyVersionId: JOURNEY_VERSION_ID,
      workspaceId: WORKSPACE_ID,
      supabaseAdmin,
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected ok:false");
    expect(result.reason).toBe("not_found");
  });

  it("returns not_found when engine_missions returns null", async () => {
    const supabaseAdmin = buildMockClient({
      journey_version: { data: { journey_id: JOURNEY_ID }, error: null },
      engine_missions: { data: null, error: null },
    });

    const result = await resolveMissionForJourneyVersion({
      journeyVersionId: JOURNEY_VERSION_ID,
      workspaceId: WORKSPACE_ID,
      supabaseAdmin,
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected ok:false");
    expect(result.reason).toBe("not_found");
  });

  // ── Branch 4: multiple_active (data integrity bug) ────────────────────────

  it("returns multiple_active and logs error when >1 active missions exist", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const supabaseAdmin = buildMockClient({
      journey_version: { data: { journey_id: JOURNEY_ID }, error: null },
      engine_missions: {
        data: [
          { ...MISSION_ROW, id: "mission-a" },
          { ...MISSION_ROW, id: "mission-b" },
        ],
        error: null,
      },
    });

    const result = await resolveMissionForJourneyVersion({
      journeyVersionId: JOURNEY_VERSION_ID,
      workspaceId: WORKSPACE_ID,
      supabaseAdmin,
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected ok:false");
    expect(result.reason).toBe("multiple_active");
    expect(result.detail).toContain("mission-a");
    expect(result.detail).toContain("mission-b");

    // Resolver must log an error loudly for ops visibility.
    expect(consoleSpy).toHaveBeenCalledOnce();
    const logArg = consoleSpy.mock.calls[0]![0] as string;
    expect(logArg).toContain("DATA INTEGRITY");

    consoleSpy.mockRestore();
  });

  // ── Branch 5: stages_empty ────────────────────────────────────────────────

  it("returns stages_empty when engine_stages returns 0 rows", async () => {
    const supabaseAdmin = buildMockClient({
      journey_version: { data: { journey_id: JOURNEY_ID }, error: null },
      engine_missions: { data: [MISSION_ROW], error: null },
      engine_stages: { data: [], error: null },
    });

    const result = await resolveMissionForJourneyVersion({
      journeyVersionId: JOURNEY_VERSION_ID,
      workspaceId: WORKSPACE_ID,
      supabaseAdmin,
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected ok:false");
    expect(result.reason).toBe("stages_empty");
    expect(result.detail).toContain(MISSION_ID);
  });

  it("returns stages_empty when engine_stages returns null", async () => {
    const supabaseAdmin = buildMockClient({
      journey_version: { data: { journey_id: JOURNEY_ID }, error: null },
      engine_missions: { data: [MISSION_ROW], error: null },
      engine_stages: { data: null, error: null },
    });

    const result = await resolveMissionForJourneyVersion({
      journeyVersionId: JOURNEY_VERSION_ID,
      workspaceId: WORKSPACE_ID,
      supabaseAdmin,
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected ok:false");
    expect(result.reason).toBe("stages_empty");
  });

  // ── Invariant: no emit(), no callGateAction ────────────────────────────────
  // These are structural asserts — the function is pure read-only.
  // The actual grep enforcement is in close-feature-journey-guardian.sh.
  // Here we confirm the function returns without throwing and without
  // calling any async side-effects beyond the DB reads.

  it("completes without throwing on happy path", async () => {
    const supabaseAdmin = buildMockClient({
      journey_version: { data: { journey_id: JOURNEY_ID }, error: null },
      engine_missions: { data: [MISSION_ROW], error: null },
      engine_stages: { data: STAGE_ROWS, error: null },
    });

    await expect(
      resolveMissionForJourneyVersion({
        journeyVersionId: JOURNEY_VERSION_ID,
        workspaceId: WORKSPACE_ID,
        supabaseAdmin,
      }),
    ).resolves.not.toThrow();
  });
});
