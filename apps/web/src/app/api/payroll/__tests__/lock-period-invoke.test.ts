/**
 * Vitest for POST /api/payroll/lock-period — covers the period-locked-handler
 * invoke path added in SMA-347 (Blocker 2 fix-up).
 *
 * Verified contract:
 *   1. Happy path: admin.functions.invoke called with correct payload after lock
 *   2. Invoke failure is silenced (lock still returns ok:true)
 *   3. Empty affected_profile_ids: invoke still called, empty array passed
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

// ─── Hoist mocks ──────────────────────────────────────────────────────────────

const { rejectCrossOriginMock, resolvePayrollAuthMock } = vi.hoisted(() => ({
  rejectCrossOriginMock: vi.fn(),
  resolvePayrollAuthMock: vi.fn(),
}));

const { gateActionMock } = vi.hoisted(() => ({
  gateActionMock: vi.fn(),
}));

const { emitMock, nonEmptyMock } = vi.hoisted(() => ({
  emitMock: vi.fn(),
  nonEmptyMock: vi.fn((v: string) => v),
}));

const functionsInvokeSpy = vi.fn();

const { createAdminClientMock } = vi.hoisted(() => ({
  createAdminClientMock: vi.fn(),
}));

vi.mock("@/app/api/payroll/_shared", () => ({
  rejectCrossOrigin: rejectCrossOriginMock,
  resolvePayrollAuth: resolvePayrollAuthMock,
}));

vi.mock("@/app/dashboard/_actions/_shared", () => ({
  gateAction: gateActionMock,
}));

vi.mock("@smartout/supabase/admin", () => ({
  createAdminClient: createAdminClientMock,
}));

vi.mock("@smartout/telemetry", () => ({
  emit: emitMock,
  nonEmpty: nonEmptyMock,
}));

// ─── Fixtures ────────────────────────────────────────────────────────────────

const WORKSPACE_ID = "aaaaaaaa-1111-4111-8111-111111111111";
const PERIOD_ID = "bbbbbbbb-2222-4222-8222-222222222222";
const PROFILE_1 = "cccccccc-3333-4333-8333-333333333333";
const PROFILE_2 = "dddddddd-4444-4444-8444-444444444444";

const AUTH_STUB = {
  userId: "user-u1",
  workspaceId: WORKSPACE_ID,
  profileId: "actor-prof",
  surface: "runtime_web" as const,
};

function makePeriodRow(start = "2026-05-01") {
  return { id: PERIOD_ID, status: "open", start_date: start, end_date: "2026-05-31" };
}

function makeAdminStub(opts: {
  period?: ReturnType<typeof makePeriodRow> | null;
  calcRows?: { profile_id: string; id: string }[];
  invokeResult?: { data: unknown; error: unknown };
}) {
  const periodResult = { data: opts.period ?? makePeriodRow(), error: null };
  const deviationResult = { data: [], error: null };
  const calcResult = { data: opts.calcRows ?? [], error: null };
  const updateResult = { error: null };

  // Chain builder — each from() call returns a builder with all necessary methods.
  function makeMaybeSelectBuilder(result: { data: unknown; error: unknown }) {
    return {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue(result),
    };
  }

  // Build a select chain that supports unlimited .eq() / .is() before resolving.
  function makeSelectBuilder(result: { data: unknown; error: unknown }) {
    // Return an object where all chaining methods return 'this', and awaiting resolves.
    const chain: Record<string, unknown> = {};
    const thenable = {
      then: (resolve: (v: unknown) => void) => resolve(result),
    };
    const proxy: typeof chain = new Proxy(chain, {
      get(_t, prop) {
        if (prop === "then") return thenable.then;
        if (prop === "select" || prop === "eq" || prop === "is" || prop === "neq") {
          return vi.fn().mockReturnValue(proxy);
        }
        return undefined;
      },
    });
    return proxy as unknown as ReturnType<typeof makeSelectBuilder>;
  }

  function makeUpdateBuilder(result: { error: unknown }) {
    const chain: Record<string, unknown> = {};
    const thenable = {
      then: (resolve: (v: unknown) => void) => resolve(result),
    };
    const proxy: typeof chain = new Proxy(chain, {
      get(_t, prop) {
        if (prop === "then") return thenable.then;
        if (prop === "update" || prop === "eq" || prop === "match") {
          return vi.fn().mockReturnValue(proxy);
        }
        return undefined;
      },
    });
    return proxy as unknown as ReturnType<typeof makeUpdateBuilder>;
  }

  let periodCallCount = 0;
  const schemaMock = {
    from: vi.fn().mockImplementation((table: string) => {
      if (table === "period" && periodCallCount === 0) {
        periodCallCount++;
        return makeMaybeSelectBuilder(periodResult);
      }
      if (table === "deviation") {
        return makeSelectBuilder(deviationResult);
      }
      if (table === "calculation") {
        return makeSelectBuilder(calcResult);
      }
      if (table === "period") {
        // second call — update
        return makeUpdateBuilder(updateResult);
      }
      return makeSelectBuilder({ data: null, error: null });
    }),
  };

  return {
    schema: vi.fn().mockReturnValue(schemaMock),
    functions: {
      invoke: functionsInvokeSpy.mockResolvedValue(
        opts.invokeResult ?? { data: { dispatched: 1, skipped: 0 }, error: null },
      ),
    },
  };
}

function makeReq(body: unknown): NextRequest {
  return {
    json: vi.fn().mockResolvedValue(body),
    headers: { get: vi.fn().mockReturnValue(null) },
  } as unknown as NextRequest;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("POST /api/payroll/lock-period — period-locked-handler invoke (SMA-347)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rejectCrossOriginMock.mockReturnValue(null);
    resolvePayrollAuthMock.mockResolvedValue(AUTH_STUB);
    gateActionMock.mockResolvedValue({ allow: true });
    emitMock.mockResolvedValue(undefined);
  });

  it("invokes payroll-period-locked-handler after successful lock", async () => {
    const adminStub = makeAdminStub({
      calcRows: [
        { profile_id: PROFILE_1, id: "calc-1" },
        { profile_id: PROFILE_2, id: "calc-2" },
      ],
    });
    createAdminClientMock.mockReturnValue(adminStub);

    const { POST } = await import("../lock-period/route");
    const res = await POST(makeReq({ workspace_id: WORKSPACE_ID, period_id: PERIOD_ID }));

    expect(res.status).toBe(200);
    expect(functionsInvokeSpy).toHaveBeenCalledTimes(1);
    expect(functionsInvokeSpy).toHaveBeenCalledWith("payroll-period-locked-handler", {
      body: expect.objectContaining({
        workspace_id: WORKSPACE_ID,
        period_id: PERIOD_ID,
        period_label: "2026-05",
        affected_profile_ids: expect.arrayContaining([PROFILE_1, PROFILE_2]),
      }),
    });
  });

  it("returns ok:true even when invoke throws", async () => {
    const adminStub = makeAdminStub({
      calcRows: [{ profile_id: PROFILE_1, id: "calc-1" }],
      invokeResult: undefined,
    });
    // Override invoke to throw
    adminStub.functions.invoke = functionsInvokeSpy.mockRejectedValue(
      new Error("Edge Function unavailable"),
    );
    createAdminClientMock.mockReturnValue(adminStub);

    const { POST } = await import("../lock-period/route");
    const res = await POST(makeReq({ workspace_id: WORKSPACE_ID, period_id: PERIOD_ID }));

    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.ok).toBe(true);
  });

  it("invokes with empty affected_profile_ids when no calculations exist", async () => {
    const adminStub = makeAdminStub({ calcRows: [] });
    createAdminClientMock.mockReturnValue(adminStub);

    const { POST } = await import("../lock-period/route");
    await POST(makeReq({ workspace_id: WORKSPACE_ID, period_id: PERIOD_ID }));

    expect(functionsInvokeSpy).toHaveBeenCalledWith("payroll-period-locked-handler", {
      body: expect.objectContaining({
        affected_profile_ids: [],
      }),
    });
  });
});
