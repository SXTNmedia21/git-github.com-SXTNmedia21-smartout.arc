/**
 * packages/ai/src/capabilities/task/__tests__/tools.test.ts
 *
 * Vitest unit-test coverage for the task capability (ADR-0298 Sortie 3).
 *
 * Scope: 9 test cases from spec §6.1.
 *
 *   T1: list_mine returns rows from underlying table queries; strict schema
 *       rejects unknown fields (e.g. body-supplied workspace_id).
 *   T2: create_personal rejects body extras — profile_id triggers strict-schema
 *       parse error before any DB call.
 *   T3: create_personal voice channel → chat_only error; chat channel passes.
 *   T4: create_session rejects assignee_profile_id that belongs to another workspace.
 *   T5: create_session gate-trip: employee role denied; manager passes.
 *   T6: complete source='personal' updates row; source='session' delegates to session_task.
 *   T7: complete source='session' on row assigned to another → manager completes ok (completedVia='manager').
 *       Employee completing task assigned to someone else is allowed by the tool (gate is the auth layer).
 *   T8: cancel_personal self-only; cross-actor (no matching row) → not_found_or_unauthorized.
 *   T9: Telemetry emit shape — "task created" carries { source, actor_kind, assigned_to_self }.
 *
 * Mocking strategy:
 *   - @smartout/telemetry: vi.mock → emit = vi.fn(), nonEmpty = identity passthrough.
 *   - gateTaskAction (./gate.ts rpc): return { allow: true } by default; override per test.
 *   - Supabase hand-rolled double (builder pattern); rpc() routes gate_action.
 *   - No composition orchestrator flag — task capability calls gateTaskAction directly,
 *     which calls rpc("gate_action") without the gatedMutation wrapper.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

// Mock @smartout/telemetry BEFORE importing tool modules.
// nonEmpty is an identity function in prod; keep it that way in tests.
// emitMock typed as vi.fn() (no params) — callers spread-cast via unknown to
// avoid TS2556 "spread argument must have tuple type" on unknown[].
const emitMock = vi.fn();
vi.mock("@smartout/telemetry", () => ({
  // Single-arg wrapper avoids the spread-onto-zero-param TS2556 error.
  emit: (arg: unknown) => emitMock(arg),
  nonEmpty: (v: string) => v,
}));

import {
  listMine,
  createPersonal,
  createSession,
  createDayAdHoc,
  complete,
  cancelPersonal,
} from "../tools.js";
import type { AgentToolContext, SessionChannel } from "../../types.js";
import { nonEmpty } from "@smartout/telemetry";

// ─────────────────────────────────────────────────────────────────────────────
// Test doubles
// ─────────────────────────────────────────────────────────────────────────────

/** Default gate_action RPC response — allow=true, no four-eyes. */
const DEFAULT_GATE_ALLOW = {
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

/** Gate deny response — used by gate-trip tests. */
const GATE_DENY = {
  allow: false,
  reason: "role_below_minimum",
  channel_allowed: true,
  downgrade_to: null,
  min_role_required: "manager",
  four_eyes_required: false,
  approvers_needed: 0,
  approvers_present: [],
  gate_evaluation_id: null,
};

type TableQueryResult = { data: unknown; error: unknown };
type TableReadResult = { data: unknown[] | null; error: unknown };

/**
 * Build a minimal chainable Supabase double.
 *
 * `tableReads`  — per-table data returned by .maybeSingle() or direct await.
 * `tableList`   — per-table data returned by plain await (list-style queries).
 * `rpcHandler`  — optional override for rpc() calls (defaults to gate-allow).
 * `capturedInserts` — array that receives each { table, row } when .insert() fires.
 * `capturedUpdates` — array that receives each { table, payload } when .update() fires.
 */
function makeSupabase(opts: {
  tableReads?: Record<string, TableQueryResult>;
  tableList?: Record<string, TableReadResult>;
  rpcHandler?: (fn: string, args: Record<string, unknown>) => { data: unknown; error: unknown };
  capturedInserts?: Array<{ table: string; row: Record<string, unknown> }>;
  capturedUpdates?: Array<{ table: string; payload: Record<string, unknown> }>;
}): SupabaseClient {
  const captures = {
    inserts: opts.capturedInserts ?? [],
    updates: opts.capturedUpdates ?? [],
  };

  function buildChain(table: string): Record<string, unknown> {
    const chain: Record<string, unknown> = {};
    let pendingUpdate: Record<string, unknown> | null = null;

    // Fluent filter methods — all return self.
    for (const m of ["eq", "neq", "in", "or", "gte", "lte", "order", "limit", "is", "filter"]) {
      chain[m] = vi.fn(() => chain);
    }

    chain.select = vi.fn(() => chain);

    chain.insert = vi.fn((row: Record<string, unknown>) => {
      captures.inserts.push({ table, row });
      // Return an insert chain: .select().single() resolves with tableReads[table].
      const insertResult = opts.tableReads?.[table] ?? { data: { id: "new-id-1" }, error: null };
      return {
        select: () => ({
          single: vi.fn(async () => insertResult),
          maybeSingle: vi.fn(async () => insertResult),
        }),
        single: vi.fn(async () => insertResult),
      };
    });

    chain.update = vi.fn((payload: Record<string, unknown>) => {
      pendingUpdate = payload;
      return chain;
    });

    chain.delete = vi.fn(() => chain);

    // Terminal resolvers.
    chain.maybeSingle = vi.fn(async () => {
      return opts.tableReads?.[table] ?? { data: null, error: null };
    });

    chain.single = vi.fn(async () => {
      const res = opts.tableReads?.[table] ?? { data: null, error: null };
      if (res.data === null && !res.error) {
        // Return "not found" as single() normally does.
        return { data: null, error: { message: "no rows" } };
      }
      return res;
    });

    // Thenability — direct `await supabase.from("x").update({}).eq("id",1)`
    (chain as unknown as { then: (res: (v: unknown) => void) => void }).then = (
      resolve: (v: unknown) => void,
    ) => {
      if (pendingUpdate !== null) {
        captures.updates.push({ table, payload: pendingUpdate });
        // For cancel_personal the tool uses .select("id, title").single() after update.
        // Resolve with the read result if available, else empty OK.
        resolve(opts.tableReads?.[table] ?? { data: null, error: null });
      } else {
        // List-style direct await.
        resolve(opts.tableList?.[table] ?? { data: [], error: null });
      }
    };

    return chain;
  }

  const rpc = vi.fn(
    async (
      fn: string,
      args: Record<string, unknown>,
    ): Promise<{ data: unknown; error: unknown }> => {
      if (opts.rpcHandler) {
        return Promise.resolve(opts.rpcHandler(fn, args));
      }
      if (fn === "gate_action") {
        return { data: DEFAULT_GATE_ALLOW, error: null };
      }
      return { data: null, error: { message: `rpc '${fn}' not stubbed` } };
    },
  );

  return {
    from: vi.fn((table: string) => buildChain(table)),
    rpc,
  } as unknown as SupabaseClient;
}

/** Build a minimal AgentToolContext. All fields server-derived (ADR-0151). */
function makeCtx(overrides: Partial<AgentToolContext> = {}): AgentToolContext {
  return {
    workspaceId: nonEmpty("ws-test-1", "workspaceId"),
    profileId: nonEmpty("profile-owner-1", "profileId"),
    sessionId: "sess-1",
    channel: "chat" as SessionChannel,
    supabaseAdmin: {} as SupabaseClient, // overridden per-test
    ...overrides,
  };
}

// Reset emit mock before each test.
beforeEach(() => {
  emitMock.mockClear();
});

// ─────────────────────────────────────────────────────────────────────────────
// T1 — list_mine returns rows; strict schema rejects body workspace_id
// ─────────────────────────────────────────────────────────────────────────────

describe("T1 — list_mine", () => {
  it("returns normalised rows from all four table arms", async () => {
    const sb = makeSupabase({
      tableList: {
        session_task: {
          data: [
            {
              id: "st-1",
              title: "Session task A",
              description: null,
              status: "pending",
              is_compliance_required: false,
              assigned_to: "profile-owner-1",
              workspace_id: "ws-test-1",
              department_session_id: "ds-1",
              session_hook_id: null,
              created_at: "2026-05-13T10:00:00Z",
              completed_at: null,
            },
          ],
          error: null,
        },
        schedule_day_task: { data: [], error: null },
        personal_task: { data: [], error: null },
        emma_task: { data: [], error: null },
      },
    });

    const ctx = makeCtx({ supabaseAdmin: sb });
    const out = await listMine.execute({}, ctx);
    const parsed = JSON.parse(out);
    expect(parsed.tasks).toHaveLength(1);
    expect(parsed.tasks[0].source).toBe("session");
    expect(parsed.tasks[0].title).toBe("Session task A");
  });

  it("rejects unknown field workspace_id in body (strict schema)", () => {
    // The schema is .strict() so passing workspace_id must throw at parse time.
    // Zod strict() surfaces unknown keys via code="unrecognized_keys" with a
    // `keys` array — the `path` is [] (root-level, not per-key). We assert on
    // the error message which includes the field name.
    const params = { workspace_id: "ws-forged" } as Record<string, unknown>;
    const result = listMine.schema.safeParse(params);
    expect(result.success).toBe(false);
    if (!result.success) {
      const codes = result.error.errors.map((e) => e.code);
      expect(codes).toContain("unrecognized_keys");
      const unrecognised = result.error.errors.find((e) => e.code === "unrecognized_keys");
      expect((unrecognised as unknown as { keys: string[] }).keys).toContain("workspace_id");
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// T2 — create_personal strict schema: profile_id in body → parse error
// ─────────────────────────────────────────────────────────────────────────────

describe("T2 — create_personal strict schema", () => {
  it("rejects profile_id in body before any DB call", () => {
    // Zod strict() reports unknown keys via code="unrecognized_keys" with
    // a `keys` array. Path is [] (root-level). We assert on the keys array.
    const params = { title: "Ringe lege", profile_id: "p-forged" } as Record<string, unknown>;
    const result = createPersonal.schema.safeParse(params);
    expect(result.success).toBe(false);
    if (!result.success) {
      const codes = result.error.errors.map((e) => e.code);
      expect(codes).toContain("unrecognized_keys");
      const unrecognised = result.error.errors.find((e) => e.code === "unrecognized_keys");
      expect((unrecognised as unknown as { keys: string[] }).keys).toContain("profile_id");
    }
  });

  it("accepts valid body (title only)", () => {
    const result = createPersonal.schema.safeParse({ title: "Ringe lege" });
    expect(result.success).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// T3 — create_personal channel guard
// ─────────────────────────────────────────────────────────────────────────────

describe("T3 — create_personal channel guard (ADR-0298 R6)", () => {
  it("voice channel returns chat-only error string without calling gate_action", async () => {
    const rpcCaptures: string[] = [];
    const sb = makeSupabase({
      rpcHandler: (fn) => {
        rpcCaptures.push(fn);
        return { data: DEFAULT_GATE_ALLOW, error: null };
      },
    });

    const ctx = makeCtx({ channel: "voice", supabaseAdmin: sb });
    const out = await createPersonal.execute({ title: "Test", priority: "normal" }, ctx);

    // Must not reach gate_action.
    expect(rpcCaptures).not.toContain("gate_action");
    // Must return a chat-only message (Norwegian).
    expect(out).toMatch(/chat/i);
    expect(out).not.toContain("{"); // not JSON — plain error string
  });

  it("chat channel calls gate_action and on allow inserts personal_task", async () => {
    const inserts: Array<{ table: string; row: Record<string, unknown> }> = [];
    const sb = makeSupabase({
      capturedInserts: inserts,
      tableReads: {
        personal_task: { data: { id: "pt-new-1" }, error: null },
      },
    });

    const ctx = makeCtx({ channel: "chat", supabaseAdmin: sb });
    const out = await createPersonal.execute({ title: "Bestille varer", priority: "normal" }, ctx);

    const parsed = JSON.parse(out);
    expect(parsed.id).toBeTruthy();
    expect(inserts).toHaveLength(1);
    expect(inserts[0]!.table).toBe("personal_task");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// T4 — create_session rejects assignee from another workspace
// ─────────────────────────────────────────────────────────────────────────────

describe("T4 — create_session workspace-membership check (L-0177)", () => {
  const VALID_SESSION_ID = "00000000-0000-0000-0000-000000000010";
  const ASSIGNEE_ID = "00000000-0000-0000-0000-000000000020";

  it("returns assignee_not_in_workspace when assignee belongs to another workspace", async () => {
    const sb = makeSupabase({
      tableReads: {
        // department_session → found in correct workspace
        department_session: {
          data: {
            department_session_id: VALID_SESSION_ID,
            workspace_id: "ws-test-1",
            department_id: "dept-1",
          },
          error: null,
        },
        // profile → NOT found (assignee in different workspace → maybeSingle returns null)
        profile: { data: null, error: null },
      },
    });

    const ctx = makeCtx({ channel: "chat", supabaseAdmin: sb });
    const out = await createSession.execute(
      {
        session_id: VALID_SESSION_ID,
        title: "Rydde kjølen",
        assignee_profile_id: ASSIGNEE_ID,
        reason: "Dagsplan",
      },
      ctx,
    );

    const parsed = JSON.parse(out);
    expect(parsed.ok).toBe(false);
    expect(parsed.error).toBe("assignee_not_in_workspace");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// T5 — create_session gate-trip: employee denied; manager passes
// ─────────────────────────────────────────────────────────────────────────────

describe("T5 — create_session gate-trip by role", () => {
  const VALID_SESSION_ID = "00000000-0000-0000-0000-000000000010";
  const SESSION_ROW = {
    department_session_id: VALID_SESSION_ID,
    workspace_id: "ws-test-1",
    department_id: "dept-1",
  };

  it("returns gate deny when employee role calls create_session", async () => {
    const sb = makeSupabase({
      rpcHandler: (fn) => {
        if (fn === "gate_action") return { data: GATE_DENY, error: null };
        return { data: null, error: null };
      },
      tableReads: {
        department_session: { data: SESSION_ROW, error: null },
      },
    });

    const ctx = makeCtx({ channel: "chat", supabaseAdmin: sb });
    const out = await createSession.execute(
      { session_id: VALID_SESSION_ID, title: "Task for another", reason: "Test" },
      ctx,
    );

    const parsed = JSON.parse(out);
    expect(parsed.ok).toBe(false);
    expect(parsed.error).toMatch(/ikke_tillatt|role_below_minimum/i);
  });

  it("inserts session_task when gate allows (manager role)", async () => {
    const inserts: Array<{ table: string; row: Record<string, unknown> }> = [];
    const sb = makeSupabase({
      capturedInserts: inserts,
      tableReads: {
        department_session: { data: SESSION_ROW, error: null },
        session_task: { data: { id: "st-new-1" }, error: null },
      },
    });

    const ctx = makeCtx({ channel: "chat", supabaseAdmin: sb });
    const out = await createSession.execute(
      { session_id: VALID_SESSION_ID, title: "Rydde fryseren", reason: "Dagsplan" },
      ctx,
    );

    const parsed = JSON.parse(out);
    expect(parsed.id).toBeTruthy();
    expect(inserts).toHaveLength(1);
    expect(inserts[0]!.table).toBe("session_task");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// T6 — complete dispatches correctly per source
// ─────────────────────────────────────────────────────────────────────────────

describe("T6 — complete source dispatch", () => {
  const TASK_ID = "00000000-0000-0000-0000-000000000099";

  it("source=personal: reads personal_task then updates status=done", async () => {
    const updates: Array<{ table: string; payload: Record<string, unknown> }> = [];
    const sb = makeSupabase({
      capturedUpdates: updates,
      tableReads: {
        personal_task: {
          data: { id: TASK_ID, title: "Min oppgave" },
          error: null,
        },
      },
    });

    const ctx = makeCtx({ supabaseAdmin: sb });
    const out = await complete.execute({ id: TASK_ID, source: "personal" }, ctx);

    const parsed = JSON.parse(out);
    expect(parsed.ok).toBe(true);
    expect(updates).toHaveLength(1);
    expect(updates[0]!.table).toBe("personal_task");
    expect(updates[0]!.payload).toMatchObject({ status: "done" });
  });

  it("source=session: reads session_task then updates status=completed with completed_by", async () => {
    const updates: Array<{ table: string; payload: Record<string, unknown> }> = [];
    const sb = makeSupabase({
      capturedUpdates: updates,
      tableReads: {
        session_task: {
          data: {
            id: TASK_ID,
            title: "Sesjonsoppgave",
            workspace_id: "ws-test-1",
            assigned_to: "profile-owner-1",
          },
          error: null,
        },
      },
    });

    const ctx = makeCtx({ supabaseAdmin: sb });
    const out = await complete.execute({ id: TASK_ID, source: "session" }, ctx);

    const parsed = JSON.parse(out);
    expect(parsed.ok).toBe(true);
    expect(updates.some((u) => u.table === "session_task")).toBe(true);
    const sessionUpdate = updates.find((u) => u.table === "session_task");
    expect(sessionUpdate!.payload).toMatchObject({
      status: "completed",
      completed_by: "profile-owner-1",
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// T7 — complete source=session: manager completes task assigned to another
// ─────────────────────────────────────────────────────────────────────────────

describe("T7 — complete source=session cross-actor", () => {
  const TASK_ID = "00000000-0000-0000-0000-000000000099";

  it("manager completing task assigned to someone else returns ok=true (completedVia=manager)", async () => {
    const updates: Array<{ table: string; payload: Record<string, unknown> }> = [];
    const sb = makeSupabase({
      capturedUpdates: updates,
      tableReads: {
        session_task: {
          data: {
            id: TASK_ID,
            title: "Anna sin oppgave",
            workspace_id: "ws-test-1",
            assigned_to: "profile-anna-999", // different from actor (profile-owner-1)
          },
          error: null,
        },
      },
    });

    // Gate passes (manager authority)
    const ctx = makeCtx({ supabaseAdmin: sb });
    const out = await complete.execute({ id: TASK_ID, source: "session" }, ctx);

    const parsed = JSON.parse(out);
    // Tool allows if gate passes — the tool marks completedVia=manager internally
    // and still writes. No early-return deny for cross-assign when gate allows.
    expect(parsed.ok).toBe(true);
    expect(updates.some((u) => u.table === "session_task")).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// T8 — cancel_personal self-only enforcement
// ─────────────────────────────────────────────────────────────────────────────

describe("T8 — cancel_personal self-only", () => {
  const TASK_ID = "00000000-0000-0000-0000-000000000088";

  it("returns ok=true when the task belongs to the calling profile", async () => {
    const sb = makeSupabase({
      // cancel_personal: UPDATE ... .eq("profile_id", ctx.profileId) .select("id,title").single()
      // The tool uses .update().eq(...).select().single() chain — we provide a result row.
      tableReads: {
        personal_task: { data: { id: TASK_ID, title: "Oppgave A" }, error: null },
      },
    });

    const ctx = makeCtx({ supabaseAdmin: sb });
    const out = await cancelPersonal.execute({ id: TASK_ID, reason: "Ikke lenger aktuelt" }, ctx);

    const parsed = JSON.parse(out);
    expect(parsed.ok).toBe(true);
  });

  it("returns not_found_or_unauthorized when row not found (cross-actor or missing)", async () => {
    const sb = makeSupabase({
      tableReads: {
        // single() returns no rows — simulates "not your task"
        personal_task: { data: null, error: { message: "no rows" } },
      },
    });

    const ctx = makeCtx({ supabaseAdmin: sb });
    const out = await cancelPersonal.execute({ id: TASK_ID, reason: "Slett" }, ctx);

    const parsed = JSON.parse(out);
    expect(parsed.ok).toBe(false);
    expect(parsed.error).toBe("not_found_or_unauthorized");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// T9 — Telemetry emit shape on "task created"
// ─────────────────────────────────────────────────────────────────────────────

describe("T9 — telemetry emit shape for task.create_personal", () => {
  it('emits "task created" with required { source, actor_kind, assigned_to_self }', async () => {
    const sb = makeSupabase({
      tableReads: {
        personal_task: { data: { id: "pt-emit-1" }, error: null },
      },
    });

    const ctx = makeCtx({ channel: "chat", supabaseAdmin: sb });
    await createPersonal.execute({ title: "Test emit", priority: "normal" }, ctx);

    // emit must have been called at least once.
    expect(emitMock).toHaveBeenCalled();

    // Find the "task created" call.
    const calls = emitMock.mock.calls as unknown[][];
    const taskCreatedCall = calls.find(
      (args) =>
        typeof args[0] === "object" &&
        args[0] !== null &&
        (args[0] as Record<string, unknown>).event === "task created",
    );
    expect(taskCreatedCall).toBeDefined();

    const emitArg = (taskCreatedCall as unknown[])[0] as Record<string, unknown>;
    const metadata = (emitArg.properties as Record<string, unknown>)?.metadata as Record<
      string,
      unknown
    >;

    expect(metadata).toBeDefined();
    expect(metadata.source).toBe("personal");
    expect(metadata.actor_kind).toBe("human");
    expect(metadata.assigned_to_self).toBe(true);

    // workspace_id + actor_id must be non-empty (ADR-0134).
    expect(emitArg.workspace_id).toBe("ws-test-1");
    expect(emitArg.actor_id).toBe("profile-owner-1");
  });

  it('emits "task created" with assigned_to_self=false when assignee differs from actor', async () => {
    const SESSION_ID = "00000000-0000-0000-0000-000000000010";
    const ASSIGNEE_ID = "00000000-0000-0000-0000-000000000030";

    const inserts: Array<{ table: string; row: Record<string, unknown> }> = [];
    const sb = makeSupabase({
      capturedInserts: inserts,
      tableReads: {
        department_session: {
          data: {
            department_session_id: SESSION_ID,
            workspace_id: "ws-test-1",
            department_id: "dept-1",
          },
          error: null,
        },
        // Profile found (assignee is a workspace member)
        profile: { data: { profile_id: ASSIGNEE_ID }, error: null },
        session_task: { data: { id: "st-emit-2" }, error: null },
      },
    });

    const ctx = makeCtx({ channel: "chat", supabaseAdmin: sb });
    await createSession.execute(
      {
        session_id: SESSION_ID,
        title: "Task for Anna",
        assignee_profile_id: ASSIGNEE_ID,
        reason: "Dagsplan",
      },
      ctx,
    );

    // Find "task created" call with source=session.
    const allCalls = emitMock.mock.calls as unknown[][];
    const sessionCreatedCall = allCalls.find((args) => {
      if (typeof args[0] !== "object" || args[0] === null) return false;
      const a = args[0] as Record<string, unknown>;
      if (a.event !== "task created") return false;
      const meta = (a.properties as Record<string, unknown>)?.metadata as
        | Record<string, unknown>
        | undefined;
      return meta?.source === "session";
    });
    expect(sessionCreatedCall).toBeDefined();

    const sessionEmitArg = (sessionCreatedCall as unknown[])[0] as Record<string, unknown>;
    const metadata = (sessionEmitArg.properties as Record<string, unknown>)?.metadata as Record<
      string,
      unknown
    >;
    expect(metadata.source).toBe("session");
    expect(metadata.assigned_to_self).toBe(false);
  });
});
