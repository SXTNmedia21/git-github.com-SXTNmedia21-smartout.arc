/**
 * packages/ai/src/capabilities/day-line/__tests__/tools.test.ts
 *
 * Vitest unit tests for the day-line capability tools (ADR-0367 BT1).
 *
 * Scope: 12 test cases covering all 4 tools.
 *
 *   T1: create — voice channel rejected (chat-only guard).
 *   T2: create — session not in workspace → session_belongs_to_different_workspace.
 *   T3: create — no department_location pairing → department_location_pairing_not_found.
 *   T4: create — gate denied → ikke_tillatt error returned.
 *   T5: create — happy path: insert succeeds, emit called, day_line_id returned.
 *   T6: create — fallback hours: no input hours + no session hours → "00:00"/"23:59".
 *   T7: add_item task — happy path: delegates to createSession, emits day_line_item.added.
 *   T8: add_item routine — happy path: delegates to applyTemplate, emits routine.attached.
 *   T9: instantiate_template — happy path: delegates to applyTemplate, emits routine.attached.
 *   T10: update_hours — no-op when values unchanged.
 *   T11: update_hours — patches open + close, emits both changed events.
 *   T12: update_hours — gate denied → ikke_tillatt returned.
 *
 * Mocking strategy:
 *   - @smartout/telemetry: vi.mock → emit = vi.fn(), nonEmpty = identity passthrough.
 *   - gateDayLineAction (./gate.ts): vi.mock → allow: true by default.
 *   - createSession (task/tools.ts): vi.mock → returns JSON { id: "task-uuid" }.
 *   - applyTemplate (timeline-template/tools.ts): vi.mock → returns JSON { ok: true, materialized: { task: 3 } }.
 *   - Supabase hand-rolled double (builder pattern); rpc() routes gate_action.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

// ─────────────────────────────────────────────────────────────────────────────
// Module mocks — must be hoisted before any imports that transitively load them.
// ─────────────────────────────────────────────────────────────────────────────

const emitMock = vi.fn();
vi.mock("@smartout/telemetry", () => ({
  emit: (arg: unknown) => emitMock(arg),
  nonEmpty: (v: string) => v,
}));

// Mock gate to allow by default; override per test.
const gateDayLineActionMock = vi.fn();
vi.mock("../gate.js", () => ({
  gateDayLineAction: (...args: unknown[]) => gateDayLineActionMock(...args),
}));

// Mock task.create_session.
const createSessionMock = vi.fn();
vi.mock("../../task/tools.js", () => ({
  createSession: {
    execute: (...args: unknown[]) => createSessionMock(...args),
  },
  // Other task tools referenced elsewhere — not needed here.
  listMine: {},
  createPersonal: {},
  createDayAdHoc: {},
  complete: {},
  cancelPersonal: {},
}));

// Mock timeline-template.apply_template.
const applyTemplateMock = vi.fn();
vi.mock("../../timeline-template/tools.js", () => ({
  applyTemplate: {
    execute: (...args: unknown[]) => applyTemplateMock(...args),
  },
  saveTemplate: {},
  listTemplates: {},
  archiveTemplate: {},
}));

import { create, addItem, instantiateTemplate, updateHours } from "../tools.js";
import type { AgentToolContext } from "../../types.js";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const SESSION_ID = "aaaaaaaa-0000-0000-0000-000000000001";
const LOCATION_ID = "bbbbbbbb-0000-0000-0000-000000000002";
const DEPT_ID = "cccccccc-0000-0000-0000-000000000003";
const WS_ID = "dddddddd-0000-0000-0000-000000000004";
const ACTOR_ID = "eeeeeeee-0000-0000-0000-000000000005";
const DAY_LINE_ID = "ffffffff-0000-0000-0000-000000000006";
const TEMPLATE_ID = "11111111-0000-0000-0000-000000000007";
const TASK_ID = "22222222-0000-0000-0000-000000000008";

const GATE_ALLOW = {
  allow: true,
  reason: null,
  channelAllowed: true,
  downgradeTo: null,
  minRoleRequired: null,
  requiresFourEyes: false,
  approversNeeded: 0,
  approversPresent: [ACTOR_ID],
  gateEvaluationId: "00000000-gate-0000-0000-000000000001",
};

const GATE_DENY = {
  allow: false,
  reason: "role_below_minimum",
  channelAllowed: true,
  downgradeTo: null,
  minRoleRequired: "manager",
  requiresFourEyes: false,
  approversNeeded: 0,
  approversPresent: [],
  gateEvaluationId: null,
};

// ─────────────────────────────────────────────────────────────────────────────
// Supabase double builder
// ─────────────────────────────────────────────────────────────────────────────

type MaybeSingleResult = { data: unknown; error: unknown };

function makeSupabase(opts: {
  /** table → maybeSingle result */
  tableReads?: Record<string, MaybeSingleResult>;
  /** table → insert select single result */
  insertReturns?: Record<string, MaybeSingleResult>;
  /** table → update result */
  updateReturns?: Record<string, { error: unknown }>;
  capturedInserts?: Array<{ table: string; row: Record<string, unknown> }>;
  capturedUpdates?: Array<{ table: string; patch: Record<string, unknown> }>;
}): SupabaseClient {
  const capturedInserts = opts.capturedInserts ?? [];
  const capturedUpdates = opts.capturedUpdates ?? [];

  function buildChain(table: string): Record<string, unknown> {
    const chain: Record<string, unknown> = {};
    let pendingPatch: Record<string, unknown> | null = null;

    // Standard fluent filters — all return chain.
    for (const m of ["eq", "neq", "in", "or", "gte", "lte", "order", "limit", "is", "filter"]) {
      chain[m] = vi.fn(() => chain);
    }

    chain.select = vi.fn(() => chain);

    chain.insert = vi.fn((row: Record<string, unknown>) => {
      capturedInserts.push({ table, row });
      // Return a new chain that supports .select().single()
      const insertChain: Record<string, unknown> = {};
      for (const m of ["eq", "neq", "filter"]) {
        insertChain[m] = vi.fn(() => insertChain);
      }
      insertChain.select = vi.fn(() => insertChain);
      insertChain.single = vi.fn(() =>
        Promise.resolve(
          opts.insertReturns?.[table] ?? { data: { day_line_id: DAY_LINE_ID }, error: null },
        ),
      );
      return insertChain;
    });

    chain.update = vi.fn((patch: Record<string, unknown>) => {
      pendingPatch = patch;
      capturedUpdates.push({ table, patch });
      return chain;
    });

    chain.maybeSingle = vi.fn(() =>
      Promise.resolve(opts.tableReads?.[table] ?? { data: null, error: { message: "not_found" } }),
    );

    chain.single = vi.fn(() => {
      if (pendingPatch !== null) {
        return Promise.resolve(opts.updateReturns?.[table] ?? { error: null });
      }
      return Promise.resolve(
        opts.tableReads?.[table] ?? { data: null, error: { message: "not_found" } },
      );
    });

    // For plain await on update chain — resolve immediately after .eq filters.
    (chain.eq as ReturnType<typeof vi.fn>).mockImplementation(() => {
      // Return a thenable that resolves to the update result.
      const r =
        pendingPatch !== null
          ? (opts.updateReturns?.[table] ?? { error: null })
          : (opts.tableReads?.[table] ?? { data: null, error: { message: "not_found" } });
      const subChain: Record<string, unknown> = {};
      for (const m2 of ["eq", "neq", "is", "filter"]) {
        subChain[m2] = vi.fn(() => subChain);
      }
      subChain.maybeSingle = vi.fn(() =>
        Promise.resolve(opts.tableReads?.[table] ?? { data: null, error: null }),
      );
      subChain.single = vi.fn(() => Promise.resolve(r));
      // Make thenable so `await supabase.from(t).update(...).eq(...)...` works.
      subChain.then = (resolve: (v: unknown) => void) => resolve(r);
      return subChain;
    });

    return chain;
  }

  return {
    from: vi.fn((table: string) => buildChain(table)),
    rpc: vi.fn(() => Promise.resolve({ data: null, error: null })),
  } as unknown as SupabaseClient;
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared test context factory
// ─────────────────────────────────────────────────────────────────────────────

function makeCtx(
  supabase: SupabaseClient,
  overrides?: Partial<AgentToolContext>,
): AgentToolContext {
  return {
    workspaceId: WS_ID as AgentToolContext["workspaceId"],
    profileId: ACTOR_ID as AgentToolContext["profileId"],
    sessionId: "test-session-id",
    channel: "chat",
    supabaseAdmin: supabase,
    ...overrides,
  } as AgentToolContext;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Default department_session row returned by maybeSingle. */
const mockSession = {
  department_session_id: SESSION_ID,
  department_id: DEPT_ID,
  session_date: "2026-06-20",
  planned_open: "08:00",
  planned_close: "22:00",
  workspace_id: WS_ID,
};

/** Default day_line row. */
const mockDayLine = {
  day_line_id: DAY_LINE_ID,
  workspace_id: WS_ID,
  department_session_id: SESSION_ID,
  location_id: LOCATION_ID,
  business_date: "2026-06-20",
  planned_open: "08:00",
  planned_close: "22:00",
};

/** Default department_location pairing. */
const mockPairing = { department_id: DEPT_ID };

// ─────────────────────────────────────────────────────────────────────────────
// Setup
// ─────────────────────────────────────────────────────────────────────────────

beforeEach(() => {
  emitMock.mockClear();
  gateDayLineActionMock.mockClear();
  createSessionMock.mockClear();
  applyTemplateMock.mockClear();
  // Default gate: allow.
  gateDayLineActionMock.mockResolvedValue(GATE_ALLOW);
  // Default delegate mocks.
  createSessionMock.mockResolvedValue(JSON.stringify({ id: TASK_ID }));
  applyTemplateMock.mockResolvedValue(
    JSON.stringify({ ok: true, materialized: { task: 2, note: 1 }, errors: [] }),
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// T1 — create: voice channel rejected
// ─────────────────────────────────────────────────────────────────────────────

describe("day-line create", () => {
  it("T1: rejects voice channel", async () => {
    const supabase = makeSupabase({});
    const ctx = makeCtx(supabase, { channel: "voice" });

    const result = await create.execute(
      {
        department_session_id: SESSION_ID,
        location_id: LOCATION_ID,
      },
      ctx,
    );

    expect(result).toContain("chat");
    expect(emitMock).not.toHaveBeenCalled();
  });

  // ─── T2: session workspace mismatch ───────────────────────────────────────

  it("T2: returns error when session belongs to a different workspace", async () => {
    const supabase = makeSupabase({
      tableReads: {
        department_session: {
          data: { ...mockSession, workspace_id: "other-workspace-id" },
          error: null,
        },
      },
    });
    const ctx = makeCtx(supabase);

    const result = await create.execute(
      { department_session_id: SESSION_ID, location_id: LOCATION_ID },
      ctx,
    );

    const parsed = JSON.parse(result) as { ok: boolean; error: string };
    expect(parsed.ok).toBe(false);
    expect(parsed.error).toBe("session_belongs_to_different_workspace");
    expect(emitMock).not.toHaveBeenCalled();
  });

  // ─── T3: no department_location pairing ───────────────────────────────────

  it("T3: returns error when department_location pairing not found", async () => {
    const supabase = makeSupabase({
      tableReads: {
        department_session: { data: mockSession, error: null },
        department_location: { data: null, error: null },
      },
    });
    const ctx = makeCtx(supabase);

    const result = await create.execute(
      { department_session_id: SESSION_ID, location_id: LOCATION_ID },
      ctx,
    );

    const parsed = JSON.parse(result) as { ok: boolean; error: string };
    expect(parsed.ok).toBe(false);
    expect(parsed.error).toBe("department_location_pairing_not_found");
  });

  // ─── T4: gate denied ──────────────────────────────────────────────────────

  it("T4: returns ikke_tillatt when gate denies", async () => {
    gateDayLineActionMock.mockResolvedValueOnce(GATE_DENY);

    const supabase = makeSupabase({
      tableReads: {
        department_session: { data: mockSession, error: null },
        department_location: { data: mockPairing, error: null },
      },
    });
    const ctx = makeCtx(supabase);

    const result = await create.execute(
      { department_session_id: SESSION_ID, location_id: LOCATION_ID },
      ctx,
    );

    const parsed = JSON.parse(result) as { ok: boolean; error: string };
    expect(parsed.ok).toBe(false);
    expect(parsed.error).toContain("ikke_tillatt");
    expect(emitMock).not.toHaveBeenCalled();
  });

  // ─── T5: happy path ───────────────────────────────────────────────────────

  it("T5: happy path — inserts row, emits day_line.created, returns day_line_id", async () => {
    const supabase = makeSupabase({
      tableReads: {
        department_session: { data: mockSession, error: null },
        department_location: { data: mockPairing, error: null },
      },
      insertReturns: {
        day_line: { data: { day_line_id: DAY_LINE_ID }, error: null },
      },
    });
    const ctx = makeCtx(supabase);

    const result = await create.execute(
      {
        department_session_id: SESSION_ID,
        location_id: LOCATION_ID,
        planned_open: "09:00",
        planned_close: "21:00",
      },
      ctx,
    );

    const parsed = JSON.parse(result) as { ok: boolean; day_line_id: string };
    expect(parsed.ok).toBe(true);
    expect(parsed.day_line_id).toBe(DAY_LINE_ID);

    // Verify emit fired with correct event shape.
    expect(emitMock).toHaveBeenCalledOnce();
    const emitArg = emitMock.mock.calls[0]![0] as {
      event: string;
      workspace_id: string;
      actor_id: string;
      properties: { data: { planned_open: string } };
    };
    expect(emitArg.event).toBe("day_line.created");
    expect(emitArg.workspace_id).toBe(WS_ID);
    expect(emitArg.actor_id).toBe(ACTOR_ID);
    expect(emitArg.properties.data.planned_open).toBe("09:00");
  });

  // ─── T6: fallback hours ───────────────────────────────────────────────────

  it("T6: uses fallback hours '00:00'/'23:59' when neither input nor session has hours", async () => {
    const supabase = makeSupabase({
      tableReads: {
        department_session: {
          data: {
            ...mockSession,
            planned_open: null,
            planned_close: null,
          },
          error: null,
        },
        department_location: { data: mockPairing, error: null },
      },
      insertReturns: {
        day_line: { data: { day_line_id: DAY_LINE_ID }, error: null },
      },
    });
    const ctx = makeCtx(supabase);

    await create.execute({ department_session_id: SESSION_ID, location_id: LOCATION_ID }, ctx);

    // Check the captured insert row has fallback hours.
    const emitArg = emitMock.mock.calls[0]![0] as {
      properties: { data: { planned_open: string; planned_close: string } };
    };
    expect(emitArg.properties.data.planned_open).toBe("00:00");
    expect(emitArg.properties.data.planned_close).toBe("23:59");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// T7 — add_item task branch
// ─────────────────────────────────────────────────────────────────────────────

describe("day-line add_item", () => {
  it("T7: task branch — delegates to createSession, emits day_line_item.added", async () => {
    const supabase = makeSupabase({
      tableReads: {
        day_line: { data: mockDayLine, error: null },
      },
    });
    const ctx = makeCtx(supabase);

    const result = await addItem.execute(
      {
        day_line_id: DAY_LINE_ID,
        item_type: "task",
        title: "Rengjør kaffemaskinen",
        assigned_to: ACTOR_ID,
      },
      ctx,
    );

    const parsed = JSON.parse(result) as { ok: boolean; task_id: string };
    expect(parsed.ok).toBe(true);
    expect(parsed.task_id).toBe(TASK_ID);

    // Delegation call must have been made.
    expect(createSessionMock).toHaveBeenCalledOnce();
    const delegateArgs = createSessionMock.mock.calls[0]![0] as {
      title: string;
      day_line_id: string;
      actor_capability: string;
      delegated_via: string;
    };
    expect(delegateArgs.title).toBe("Rengjør kaffemaskinen");
    expect(delegateArgs.day_line_id).toBe(DAY_LINE_ID);
    expect(delegateArgs.actor_capability).toBe("task");
    expect(delegateArgs.delegated_via).toBe("day-line");

    // Emit day_line_item.added with ADR-0356 fields.
    expect(emitMock).toHaveBeenCalledOnce();
    const emitArg = emitMock.mock.calls[0]![0] as {
      event: string;
      properties: { data: { item_type: string; actor_capability: string } };
    };
    expect(emitArg.event).toBe("day_line_item.added");
    expect(emitArg.properties.data.item_type).toBe("task");
    expect(emitArg.properties.data.actor_capability).toBe("task");
  });

  // ─── T8: routine branch ───────────────────────────────────────────────────

  it("T8: routine branch — delegates to applyTemplate, emits routine.attached", async () => {
    const supabase = makeSupabase({
      tableReads: {
        day_line: { data: mockDayLine, error: null },
      },
    });
    const ctx = makeCtx(supabase);

    const result = await addItem.execute(
      {
        day_line_id: DAY_LINE_ID,
        item_type: "routine",
        template_id: TEMPLATE_ID,
      },
      ctx,
    );

    const parsed = JSON.parse(result) as { ok: boolean; items_applied: number };
    expect(parsed.ok).toBe(true);
    // 3 items from materialized: { task: 2, note: 1 }.
    expect(parsed.items_applied).toBe(3);

    // applyTemplate called with business_date as target_date.
    expect(applyTemplateMock).toHaveBeenCalledOnce();
    const applyArgs = applyTemplateMock.mock.calls[0]![0] as {
      template_id: string;
      target_date: string;
    };
    expect(applyArgs.template_id).toBe(TEMPLATE_ID);
    expect(applyArgs.target_date).toBe("2026-06-20");

    // Emit routine.attached with ADR-0356 fields.
    expect(emitMock).toHaveBeenCalledOnce();
    const emitArg = emitMock.mock.calls[0]![0] as {
      event: string;
      properties: { data: { items_applied: number; delegated_via: string } };
    };
    expect(emitArg.event).toBe("routine.attached");
    expect(emitArg.properties.data.items_applied).toBe(3);
    expect(emitArg.properties.data.delegated_via).toBe("day-line");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// T9 — instantiate_template
// ─────────────────────────────────────────────────────────────────────────────

describe("day-line instantiate_template", () => {
  it("T9: delegates to applyTemplate, emits routine.attached", async () => {
    const supabase = makeSupabase({
      tableReads: {
        day_line: {
          data: { day_line_id: DAY_LINE_ID, workspace_id: WS_ID, business_date: "2026-06-20" },
          error: null,
        },
      },
    });
    const ctx = makeCtx(supabase);

    const result = await instantiateTemplate.execute(
      { day_line_id: DAY_LINE_ID, template_id: TEMPLATE_ID },
      ctx,
    );

    const parsed = JSON.parse(result) as { ok: boolean; items_applied: number };
    expect(parsed.ok).toBe(true);
    expect(parsed.items_applied).toBe(3);

    expect(applyTemplateMock).toHaveBeenCalledOnce();
    expect(emitMock).toHaveBeenCalledOnce();
    const emitArg = emitMock.mock.calls[0]![0] as { event: string };
    expect(emitArg.event).toBe("routine.attached");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// T10-T12 — update_hours
// ─────────────────────────────────────────────────────────────────────────────

describe("day-line update_hours", () => {
  it("T10: no-op when both values are unchanged", async () => {
    const supabase = makeSupabase({
      tableReads: {
        day_line: { data: mockDayLine, error: null },
      },
    });
    const ctx = makeCtx(supabase);

    const result = await updateHours.execute(
      {
        day_line_id: DAY_LINE_ID,
        planned_open: "08:00", // same as mockDayLine
        planned_close: "22:00", // same as mockDayLine
      },
      ctx,
    );

    const parsed = JSON.parse(result) as { ok: boolean; no_op?: boolean };
    expect(parsed.ok).toBe(true);
    expect(parsed.no_op).toBe(true);
    // Gate should NOT have been called (no-op exits before gate).
    expect(gateDayLineActionMock).not.toHaveBeenCalled();
    expect(emitMock).not.toHaveBeenCalled();
  });

  it("T11: patches both fields and emits two change events", async () => {
    const supabase = makeSupabase({
      tableReads: {
        day_line: { data: mockDayLine, error: null },
      },
      updateReturns: {
        day_line: { error: null },
      },
    });
    const ctx = makeCtx(supabase);

    const result = await updateHours.execute(
      {
        day_line_id: DAY_LINE_ID,
        planned_open: "07:00",
        planned_close: "23:00",
      },
      ctx,
    );

    const parsed = JSON.parse(result) as {
      ok: boolean;
      patched: { planned_open: string; planned_close: string };
    };
    expect(parsed.ok).toBe(true);
    expect(parsed.patched.planned_open).toBe("07:00");
    expect(parsed.patched.planned_close).toBe("23:00");

    // Two emit calls: opening_changed + closing_changed.
    expect(emitMock).toHaveBeenCalledTimes(2);
    const eventNames = emitMock.mock.calls.map((c) => (c[0] as { event: string }).event);
    expect(eventNames).toContain("day_line.opening_changed");
    expect(eventNames).toContain("day_line.closing_changed");

    // Verify old/new payload on opening_changed.
    const openingCall = emitMock.mock.calls.find(
      (c) => (c[0] as { event: string }).event === "day_line.opening_changed",
    )!;
    const openingData = (openingCall[0] as { properties: { data: { old: string; new: string } } })
      .properties.data;
    expect(openingData.old).toBe("08:00");
    expect(openingData.new).toBe("07:00");
  });

  it("T12: returns ikke_tillatt when gate denies update_hours", async () => {
    gateDayLineActionMock.mockResolvedValueOnce(GATE_DENY);

    const supabase = makeSupabase({
      tableReads: {
        day_line: { data: mockDayLine, error: null },
      },
    });
    const ctx = makeCtx(supabase);

    const result = await updateHours.execute(
      { day_line_id: DAY_LINE_ID, planned_open: "07:00" },
      ctx,
    );

    const parsed = JSON.parse(result) as { ok: boolean; error: string };
    expect(parsed.ok).toBe(false);
    expect(parsed.error).toContain("ikke_tillatt");
    expect(emitMock).not.toHaveBeenCalled();
  });
});
