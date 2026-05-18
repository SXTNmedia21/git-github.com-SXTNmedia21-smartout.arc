// deno-lint-ignore-file no-console
// ============================================================================
// _tests/day-line-push.test.ts
// ----------------------------------------------------------------------------
// Mock-based Deno tests for the day-line-push tick handler (ADR-0367 §5.7).
//
// Tests cover the three required idempotency / guard cases:
//   T1 — skip-no-token:       expo_push_token NULL → 0 pushes sent
//   T2 — skip-not-clocked-in: shift_session.status='scheduled' → 0 pushes
//   T3 — idempotency:         existing engine_event row → skip; same key
//                              on second invocation → no duplicate push
//
// We use a thin mock Supabase client rather than a live DB connection so
// the suite runs offline and without a local Supabase instance. The mock
// covers only the query paths exercised by dispatchDayLinePush.
//
// Run: deno test supabase/functions/engine-dispatch/_tests/day-line-push.test.ts
// ============================================================================

import { assertEquals } from "jsr:@std/assert@1";
import { dispatchDayLinePush } from "../handlers/day-line-push.ts";

// ─── Minimal mock Supabase builder ───────────────────────────────
// Builds a chainable query mock that returns pre-canned data.
// Each table registered separately so tests control per-table results.

type MockQueryResult<T = unknown> = { data: T; error: null | { message: string; code?: string } };

interface TableMock {
  rows: unknown[];
  insertError?: { message: string; code?: string };
}

function buildMockClient(tableMocks: Record<string, TableMock>) {
  // Tracks insert calls for idempotency assertions
  const insertedKeys: string[] = [];

  function makeQuery(tableName: string) {
    let filterEq: Record<string, unknown> = {};
    let filterNot = false;
    let filterIn: string[] | null = null;
    let filterInColumn = "";
    let filterGte: string | null = null;
    let filterLt: string | null = null;
    let filterIs: { col: string; val: null | string } | null = null;
    let selectedColumns: string | null = null;

    const mock = tableMocks[tableName] ?? { rows: [] };

    const chain = {
      select(cols: string) {
        selectedColumns = cols;
        return chain;
      },
      eq(col: string, val: unknown) {
        filterEq = { ...filterEq, [col]: val };
        return chain;
      },
      not(_col: string, _op: string, _val: unknown) {
        filterNot = true;
        return chain;
      },
      gte(_col: string, _val: string) {
        filterGte = _val;
        return chain;
      },
      lt(_col: string, _val: string) {
        filterLt = _val;
        return chain;
      },
      in(col: string, vals: string[]) {
        filterIn = vals;
        filterInColumn = col;
        return chain;
      },
      is(col: string, val: null | string) {
        filterIs = { col, val };
        return chain;
      },
      maybeSingle() {
        const rows = applyFilters();
        return Promise.resolve<MockQueryResult>(
          rows.length > 0
            ? { data: rows[0], error: null }
            : { data: null, error: null },
        );
      },
      then(resolve: (v: MockQueryResult) => unknown) {
        // Makes `await chain` work
        const rows = applyFilters();
        return Promise.resolve({ data: rows, error: null }).then(resolve);
      },
    };

    function applyFilters(): unknown[] {
      let rows = mock.rows;
      if (filterNot) {
        // Filter out nulls for the day_line_id IS NOT NULL condition
        rows = rows.filter((r) => (r as Record<string, unknown>)["day_line_id"] !== null);
      }
      for (const [col, val] of Object.entries(filterEq)) {
        rows = rows.filter((r) => (r as Record<string, unknown>)[col] === val);
      }
      if (filterIn !== null) {
        const vals = filterIn;
        const col = filterInColumn;
        rows = rows.filter((r) => vals.includes((r as Record<string, unknown>)[col] as string));
      }
      if (filterIs !== null && filterIs.val === null) {
        // .is(col, null) — keep rows where col IS null
        rows = rows.filter(
          (r) => (r as Record<string, unknown>)[filterIs!.col] === null,
        );
      }
      if (filterGte !== null) {
        // scheduled_at >= windowStart
        rows = rows.filter(
          (r) =>
            String((r as Record<string, unknown>)["scheduled_at"]) >= filterGte!,
        );
      }
      if (filterLt !== null) {
        // scheduled_at < windowEnd
        rows = rows.filter(
          (r) =>
            String((r as Record<string, unknown>)["scheduled_at"]) < filterLt!,
        );
      }
      void selectedColumns;
      return rows;
    }

    return chain;
  }

  // Mock insert for engine_event (idempotency)
  function makeInsert(tableName: string) {
    return (row: Record<string, unknown>) => {
      if (tableName === "engine_event") {
        const key = row["idempotency_key"] as string;
        if (insertedKeys.includes(key)) {
          return Promise.resolve({
            data: null,
            error: { code: "23505", message: "unique violation" },
          });
        }
        insertedKeys.push(key);
        return Promise.resolve({ data: { id: "evt-1" }, error: null });
      }
      const mock = tableMocks[tableName];
      if (mock?.insertError) {
        return Promise.resolve({ data: null, error: mock.insertError });
      }
      return Promise.resolve({ data: { id: "new-row" }, error: null });
    };
  }

  const client = {
    from(tableName: string) {
      return {
        select(cols: string) {
          return makeQuery(tableName).select(cols);
        },
        insert(row: Record<string, unknown>) {
          return makeInsert(tableName)(row);
        },
      };
    },
    // Expose for assertions
    _insertedKeys: insertedKeys,
  };

  return client;
}

// ─── Emit spy ────────────────────────────────────────────────────

function makeEmitSpy() {
  const calls: unknown[] = [];
  const emit = (evt: unknown) => {
    calls.push(evt);
    return Promise.resolve();
  };
  return { emit, calls };
}

// ─── Shared task fixture ─────────────────────────────────────────

const NOW_ISO = new Date().toISOString();

const BASE_TASK = {
  id: "task-uuid-001",
  day_line_id: "dl-uuid-001",
  workspace_id: "ws-uuid-001",
  title: "Check prep station",
  description: "Verify mise en place is complete",
  department_session_id: "ds-uuid-001",
  status: "pending",
  scheduled_at: NOW_ISO,
};

const SHIFT_SESSION = {
  shift_session_id: "ss-uuid-001",
  employee_id: "emp-uuid-001",
  workspace_id: "ws-uuid-001",
  status: "clocked_in",
};

const DAY_LINE_JUNCTION = {
  shift_session_id: "ss-uuid-001",
  day_line_id: "dl-uuid-001",
};

// ─── T1 — skip-no-token ──────────────────────────────────────────

Deno.test("T1 skip-no-token: profile.expo_push_token NULL → 0 pushes sent", async () => {
  const client = buildMockClient({
    session_task: { rows: [BASE_TASK] },
    shift_session_day_line: { rows: [DAY_LINE_JUNCTION] },
    shift_session: { rows: [SHIFT_SESSION] },
    profile: {
      rows: [{ profile_id: "emp-uuid-001", expo_push_token: null }],
    },
    engine_event: { rows: [] },
  });

  const { emit, calls } = makeEmitSpy();

  const result = await dispatchDayLinePush({
    sb: client as unknown as Parameters<typeof dispatchDayLinePush>[0]["sb"],
    emit,
  });

  assertEquals(result.sent, 0, "no sends when token is null");
  assertEquals(result.skipped_no_token, 1, "one skip counted for null token");
  assertEquals(calls.length, 0, "no emit when token missing");
});

// ─── T2 — skip-not-clocked-in ────────────────────────────────────

Deno.test("T2 skip-not-clocked-in: shift_session.status='scheduled' → 0 pushes", async () => {
  const scheduledSession = { ...SHIFT_SESSION, status: "scheduled" };

  const client = buildMockClient({
    session_task: { rows: [BASE_TASK] },
    shift_session_day_line: { rows: [DAY_LINE_JUNCTION] },
    shift_session: { rows: [scheduledSession] }, // status = scheduled, not clocked_in
    profile: {
      rows: [{ profile_id: "emp-uuid-001", expo_push_token: "ExponentPushToken[abc123]" }],
    },
    engine_event: { rows: [] },
  });

  const { emit, calls } = makeEmitSpy();

  const result = await dispatchDayLinePush({
    sb: client as unknown as Parameters<typeof dispatchDayLinePush>[0]["sb"],
    emit,
  });

  assertEquals(result.sent, 0, "no sends when session not clocked_in");
  assertEquals(result.skipped_not_clocked_in, 1, "skip counted for non-clocked-in session");
  assertEquals(calls.length, 0, "no emit when session is not active");
});

// ─── T3 — idempotency ────────────────────────────────────────────

Deno.test(
  "T3 idempotency: existing engine_event row with same key → skip, second call → no duplicate push",
  async () => {
    const client = buildMockClient({
      session_task: { rows: [BASE_TASK] },
      shift_session_day_line: { rows: [DAY_LINE_JUNCTION] },
      shift_session: { rows: [SHIFT_SESSION] },
      profile: {
        rows: [
          {
            profile_id: "emp-uuid-001",
            expo_push_token: "ExponentPushToken[abc123]",
          },
        ],
      },
      engine_event: { rows: [] },
    });

    const { emit: emit1, calls: calls1 } = makeEmitSpy();

    // First invocation — should succeed and push once.
    const result1 = await dispatchDayLinePush({
      sb: client as unknown as Parameters<typeof dispatchDayLinePush>[0]["sb"],
      emit: emit1,
    });

    // We cannot actually send Expo push in unit tests (no network), but we
    // can verify the idempotency key was recorded so the second call skips.
    // The push itself will fail with a network error in the test environment.
    // We assert on idempotency key insertion and emit call count.
    const idempotencyKey = `${BASE_TASK.id}:${SHIFT_SESSION.shift_session_id}`;
    assertEquals(
      (client as unknown as { _insertedKeys: string[] })._insertedKeys.includes(idempotencyKey),
      true,
      "idempotency key must be recorded after first invocation",
    );

    // Second invocation with the same client — engine_event INSERT returns 23505.
    const { emit: emit2, calls: calls2 } = makeEmitSpy();
    const result2 = await dispatchDayLinePush({
      sb: client as unknown as Parameters<typeof dispatchDayLinePush>[0]["sb"],
      emit: emit2,
    });

    assertEquals(result2.skipped_idempotent, 1, "second call must skip as idempotent");
    assertEquals(result2.sent, 0, "second call must not send again");
    assertEquals(calls2.length, 0, "no emit on idempotent skip");

    // The first call either sent (if Expo network available) or errored — but
    // its idempotency key was recorded. The critical invariant is that result2
    // reports skipped_idempotent=1.
    void result1;
    void calls1;
  },
);
