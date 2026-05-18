/**
 * packages/ai/src/capabilities/routine/__tests__/tools.test.ts
 *
 * Vitest unit-test coverage for the routine capability (ADR-0367 BT2).
 *
 * Test cases:
 *   T1: ADR-0240 grep — no direct session_task.insert in tools.ts source.
 *   T2: Voice channel guard — attach_to_line rejects voice.
 *   T3: day_line not found → error returned, no gate, no emit.
 *   T4: day_line wrong workspace → error returned, no gate, no emit.
 *   T5: Gate deny (routine gate) → error returned, no delegation, no emit.
 *   T6: Happy path — delegates items to task.create_session, emits routine.attached once.
 *   T7: Partial failure — some items fail delegation; result includes errors + partial ok.
 *
 * Mocking strategy:
 *   - @smartout/telemetry: vi.mock → emit = vi.fn(), nonEmpty = identity passthrough.
 *   - gateRoutineAction (routine/gate.ts): vi.mock — default allow; override per test.
 *   - Supabase double handles ALL downstream calls that createSession.execute makes
 *     (day_line lookup, routine gate RPC, task gate RPC, department_session lookup,
 *     session_task.insert). This avoids module-path mock aliasing issues and keeps
 *     the double as the single seam.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";

// ─── Mock @smartout/telemetry BEFORE importing tool modules ───────────────────
const emitMock = vi.fn();
vi.mock("@smartout/telemetry", () => ({
  emit: (arg: unknown) => emitMock(arg),
  nonEmpty: (v: string) => v,
}));

// ─── Mock routine gate helper ─────────────────────────────────────────────────
const gateRoutineActionMock = vi.fn();
vi.mock("../gate.js", () => ({
  gateRoutineAction: (supabase: unknown, workspaceId: string, profileId: string, args: unknown) =>
    gateRoutineActionMock(supabase, workspaceId, profileId, args),
}));

import { attachToLine } from "../tools.js";
import type { AgentToolContext } from "../../types.js";

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────────────────────

const WORKSPACE_ID = "aaaaaaaa-0000-0000-0000-000000000001";
const PROFILE_ID = "bbbbbbbb-0000-0000-0000-000000000001";
const DAY_LINE_ID = "cccccccc-0000-0000-0000-000000000001";
const SESSION_ID = "dddddddd-0000-0000-0000-000000000001";
const TASK_ID_1 = "eeeeeeee-0000-0000-0000-000000000001";
const TASK_ID_2 = "ffffffff-0000-0000-0000-000000000001";

const DEFAULT_DAY_LINE_ROW = {
  day_line_id: DAY_LINE_ID,
  workspace_id: WORKSPACE_ID,
  department_session_id: SESSION_ID,
};

const DEFAULT_SESSION_ROW = {
  department_session_id: SESSION_ID,
  workspace_id: WORKSPACE_ID,
  department_id: "dept-0001",
};

/** Gate allow response used by the task gate (via rpc mock). */
const TASK_GATE_ALLOW = {
  allow: true,
  reason: null,
  channel_allowed: true,
  downgrade_to: null,
  min_role_required: null,
  four_eyes_required: false,
  approvers_needed: 0,
  approvers_present: [],
  gate_evaluation_id: "00000000-0000-0000-0000-000000000001",
};

const ROUTINE_GATE_ALLOW = {
  allow: true,
  reason: null,
  channelAllowed: true,
  downgradeTo: null,
  minRoleRequired: null,
  requiresFourEyes: false,
  approversNeeded: 0,
  approversPresent: [PROFILE_ID],
  gateEvaluationId: "00000000-0000-0000-0000-000000000001",
};

const ROUTINE_GATE_DENY = {
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

type InsertCapture = { table: string; row: Record<string, unknown> };

/**
 * Build a minimal chainable Supabase double that handles the full delegation chain.
 *
 * This double must handle:
 *   1. day_line.select(...).eq(...).maybeSingle()  → dayLineResult
 *   2. rpc("gate_action", ...)                     → taskGateResult (task's own gate)
 *   3. department_session.select(...).eq(...).maybeSingle() → sessionResult
 *   4. session_task.insert(...).select("id").single() → insertResult[n]
 *
 * capturedInserts receives each session_task insert payload for assertion.
 */
function makeSupabase(opts: {
  dayLineResult?: { data: Record<string, unknown> | null; error: unknown };
  sessionResult?: { data: Record<string, unknown> | null; error: unknown };
  insertResults?: Array<{ data: Record<string, unknown> | null; error: unknown }>;
  capturedInserts?: InsertCapture[];
}): SupabaseClient {
  const capturedInserts = opts.capturedInserts ?? [];
  let insertCallIndex = 0;

  function buildChain(table: string): Record<string, unknown> {
    const chain: Record<string, unknown> = {};

    for (const m of ["eq", "neq", "in", "or", "gte", "lte", "order", "limit", "is", "filter"]) {
      chain[m] = vi.fn(() => chain);
    }

    chain.select = vi.fn(() => chain);

    chain.insert = vi.fn((row: Record<string, unknown>) => {
      capturedInserts.push({ table, row });
      const idx = insertCallIndex++;
      const insertResult = opts.insertResults?.[idx] ?? {
        data: { id: `auto-task-${idx}` },
        error: null,
      };
      return {
        select: () => ({
          single: vi.fn(async () => insertResult),
          maybeSingle: vi.fn(async () => insertResult),
        }),
        single: vi.fn(async () => insertResult),
      };
    });

    chain.update = vi.fn(() => chain);
    chain.delete = vi.fn(() => chain);

    chain.maybeSingle = vi.fn(async () => {
      if (table === "day_line") {
        return opts.dayLineResult ?? { data: DEFAULT_DAY_LINE_ROW, error: null };
      }
      if (table === "department_session") {
        return opts.sessionResult ?? { data: DEFAULT_SESSION_ROW, error: null };
      }
      if (table === "profile") {
        // resolveAssigneeWorkspaceMembership — return active member by default.
        return { data: { profile_id: PROFILE_ID }, error: null };
      }
      return { data: null, error: null };
    });

    chain.single = vi.fn(async () => {
      return { data: null, error: { message: "no rows" } };
    });

    return chain;
  }

  return {
    from: (table: string) => buildChain(table),
    rpc: vi.fn(async () => ({ data: TASK_GATE_ALLOW, error: null })),
  } as unknown as SupabaseClient;
}

/** Build a minimal AgentToolContext. */
function makeCtx(override?: Partial<AgentToolContext>): AgentToolContext {
  return {
    workspaceId: WORKSPACE_ID as AgentToolContext["workspaceId"],
    profileId: PROFILE_ID as AgentToolContext["profileId"],
    sessionId: "sess-0001",
    supabaseAdmin: makeSupabase({}) as unknown as SupabaseClient,
    channel: "chat",
    ...override,
  } as AgentToolContext;
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  gateRoutineActionMock.mockResolvedValue(ROUTINE_GATE_ALLOW);
});

describe("routine.attach_to_line", () => {
  // ── T1: ADR-0240 source-code grep ─────────────────────────────────────────
  it("T1: forbids direct session_task.insert in tools.ts source (ADR-0240)", () => {
    const source = readFileSync(join(__dirname, "../tools.ts"), "utf-8");
    expect(source).not.toMatch(/\.from\(["']session_task["']\)\s*\.\s*insert/);
  });

  // ── T2: Voice channel guard ────────────────────────────────────────────────
  it("T2: rejects voice channel (ADR-0078 V1 chat-only)", async () => {
    const ctx = makeCtx({ channel: "voice" });
    const result = await attachToLine.execute(
      {
        day_line_id: DAY_LINE_ID,
        items: [{ title: "Åpne kassa" }],
      },
      ctx,
    );
    expect(result).toContain("chat");
    expect(gateRoutineActionMock).not.toHaveBeenCalled();
    expect(emitMock).not.toHaveBeenCalled();
  });

  // ── T3: day_line not found ─────────────────────────────────────────────────
  it("T3: returns error when day_line not found", async () => {
    const supabase = makeSupabase({ dayLineResult: { data: null, error: null } });
    const ctx = makeCtx({ supabaseAdmin: supabase });

    const result = await attachToLine.execute(
      {
        day_line_id: DAY_LINE_ID,
        items: [{ title: "Åpne kassa" }],
      },
      ctx,
    );

    const parsed = JSON.parse(result) as Record<string, unknown>;
    expect(parsed.ok).toBe(false);
    expect(parsed.error).toBe("day_line_not_found");
    expect(gateRoutineActionMock).not.toHaveBeenCalled();
    expect(emitMock).not.toHaveBeenCalled();
  });

  // ── T4: day_line wrong workspace ───────────────────────────────────────────
  it("T4: returns error when day_line belongs to a different workspace", async () => {
    const supabase = makeSupabase({
      dayLineResult: {
        data: {
          day_line_id: DAY_LINE_ID,
          workspace_id: "ffffffff-ffff-ffff-ffff-ffffffffffff",
          department_session_id: SESSION_ID,
        },
        error: null,
      },
    });
    const ctx = makeCtx({ supabaseAdmin: supabase });

    const result = await attachToLine.execute(
      {
        day_line_id: DAY_LINE_ID,
        items: [{ title: "Åpne kassa" }],
      },
      ctx,
    );

    const parsed = JSON.parse(result) as Record<string, unknown>;
    expect(parsed.ok).toBe(false);
    expect(parsed.error).toBe("day_line_wrong_workspace");
    expect(gateRoutineActionMock).not.toHaveBeenCalled();
    expect(emitMock).not.toHaveBeenCalled();
  });

  // ── T5: Routine gate deny ──────────────────────────────────────────────────
  it("T5: returns error when routine gate denies (role below minimum)", async () => {
    gateRoutineActionMock.mockResolvedValue(ROUTINE_GATE_DENY);

    const result = await attachToLine.execute(
      {
        day_line_id: DAY_LINE_ID,
        items: [{ title: "Åpne kassa" }],
      },
      makeCtx({}),
    );

    const parsed = JSON.parse(result) as Record<string, unknown>;
    expect(parsed.ok).toBe(false);
    expect(parsed.error).toBe("role_below_minimum");
    expect(emitMock).not.toHaveBeenCalled();
  });

  // ── T6: Happy path ─────────────────────────────────────────────────────────
  it("T6: delegates all items to task.create_session and emits routine.attached once", async () => {
    const capturedInserts: InsertCapture[] = [];
    const supabase = makeSupabase({
      insertResults: [
        { data: { id: TASK_ID_1 }, error: null },
        { data: { id: TASK_ID_2 }, error: null },
      ],
      capturedInserts,
    });
    const ctx = makeCtx({ supabaseAdmin: supabase });

    const result = await attachToLine.execute(
      {
        day_line_id: DAY_LINE_ID,
        items: [
          { title: "Åpne kassa", description: "Sjekk kassa ved start" },
          { title: "Temperaturlogg" },
        ],
      },
      ctx,
    );

    const parsed = JSON.parse(result) as Record<string, unknown>;
    expect(parsed.ok).toBe(true);
    expect(parsed.items_applied).toBe(2);
    expect(parsed.session_task_ids).toEqual([TASK_ID_1, TASK_ID_2]);

    // Routine gate was called once.
    expect(gateRoutineActionMock).toHaveBeenCalledTimes(1);
    expect(gateRoutineActionMock).toHaveBeenCalledWith(
      expect.anything(),
      WORKSPACE_ID,
      PROFILE_ID,
      expect.objectContaining({ actionType: "routine.attach_to_line" }),
    );

    // session_task inserts captured — both have day_line_id set (Pattern B).
    expect(capturedInserts.filter((c) => c.table === "session_task")).toHaveLength(2);
    for (const c of capturedInserts.filter((c) => c.table === "session_task")) {
      expect(c.row.day_line_id).toBe(DAY_LINE_ID);
      expect(c.row.workspace_id).toBe(WORKSPACE_ID);
    }

    // routine.attached emitted once (not per item — ADR-0134 cardinality).
    expect(emitMock).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "routine.attached",
      }),
    );
    const routineEmits = emitMock.mock.calls.filter(
      (c: unknown[]) => (c[0] as Record<string, unknown>).event === "routine.attached",
    );
    expect(routineEmits).toHaveLength(1);
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const emitArg = routineEmits[0]![0] as Record<string, unknown>;
    expect((emitArg.properties as Record<string, unknown>).data).toMatchObject({
      day_line_id: DAY_LINE_ID,
      items_applied: 2,
      actor_capability: "task",
      delegated_via: "routine",
    });
  });

  // ── T7: Partial failure ────────────────────────────────────────────────────
  it("T7: partial failure — emits routine.attached for successful items, returns errors for failed", async () => {
    const capturedInserts: InsertCapture[] = [];
    const supabase = makeSupabase({
      insertResults: [
        { data: { id: TASK_ID_1 }, error: null },
        // Second item: session_not_found — task gate passes but session lookup fails.
        // We simulate this by returning null from department_session for that call.
        // Simpler: make the second insert fail.
        { data: null, error: { message: "insert_failed" } },
      ],
      capturedInserts,
    });
    const ctx = makeCtx({ supabaseAdmin: supabase });

    const result = await attachToLine.execute(
      {
        day_line_id: DAY_LINE_ID,
        items: [{ title: "Åpne kassa" }, { title: "Mislykket oppgave" }],
      },
      ctx,
    );

    const parsed = JSON.parse(result) as Record<string, unknown>;
    expect(parsed.ok).toBe(true); // at least one succeeded
    expect(parsed.items_applied).toBe(1);
    expect(parsed.session_task_ids).toEqual([TASK_ID_1]);
    // errors array present
    expect(Array.isArray(parsed.errors)).toBe(true);

    // routine.attached emitted for the 1 successful item.
    const routineEmits = emitMock.mock.calls.filter(
      (c: unknown[]) => (c[0] as Record<string, unknown>).event === "routine.attached",
    );
    expect(routineEmits).toHaveLength(1);
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const t7EmitArg = routineEmits[0]![0] as Record<string, unknown>;
    const t7Data = (t7EmitArg.properties as Record<string, unknown>).data as Record<
      string,
      unknown
    >;
    expect(t7Data.items_applied).toBe(1);
  });
});
