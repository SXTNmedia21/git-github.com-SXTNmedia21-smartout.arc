/**
 * activate-season-action.test.ts
 *
 * Unit tests for `activateSeasonAction` — the Server Action that calls the
 * `activate_season` RPC (ADR-0200).
 *
 * Per Invariant 10 of ADR-0200 and L-0125 / L-0118: we assert on emit names,
 * return shapes, AND that the RPC is not called when gate or validation
 * rejects (no phantom-ok, no phantom emit).
 *
 * Scope:
 *  - Gate rejection path → `insufficient_authority`, no RPC, no `season activated`
 *  - Missing budget     → `missing_budget`, no RPC, no `season activated`
 *  - Happy path (rows generated) → both success emits fire
 *  - Already-active skip → `season activated` fires with `had_existing_hours=true`,
 *    `season operating_hours_generated` does NOT fire (rows_generated=0)
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const { resolveCurrentProfileMock, gateActionMock, createAdminClientMock, emitMock } = vi.hoisted(
  () => ({
    resolveCurrentProfileMock: vi.fn(),
    gateActionMock: vi.fn(),
    createAdminClientMock: vi.fn(),
    emitMock: vi.fn(),
  }),
);

vi.mock("../_shared", () => ({
  resolveCurrentProfile: resolveCurrentProfileMock,
  gateAction: gateActionMock,
}));

vi.mock("@smartout/supabase/admin", () => ({
  createAdminClient: createAdminClientMock,
}));

vi.mock("@smartout/telemetry", () => ({
  emit: emitMock,
  nonEmpty: (v: string) => v,
}));

// Import AFTER vi.mock is registered — Server Actions in Next.js 16 under
// Vitest resolve their dependencies eagerly, so late import is safest.
import { activateSeasonAction } from "../activate-season-action";

// ---------------------------------------------------------------------------
// Fixture constants — valid UUIDs to survive any downstream type-guards
// ---------------------------------------------------------------------------
const WS_ID = "11111111-1111-4111-8111-111111111111";
const PROFILE_ID = "22222222-2222-4222-8222-222222222222";
const SEASON_ID = "33333333-3333-4333-8333-333333333333";
const BUDGET_ID = "44444444-4444-4444-8444-444444444444";

/**
 * Builds the `from('season_budget').select(...).eq(...).eq(...).maybeSingle()`
 * chain used by the server-side validation step.
 */
function buildBudgetChain(result: {
  data: { season_budget_id: string; total_target_revenue: number | null } | null;
  error: unknown;
}) {
  const maybeSingle = vi.fn().mockResolvedValue(result);
  const secondEq = vi.fn().mockReturnValue({ maybeSingle });
  const firstEq = vi.fn().mockReturnValue({ eq: secondEq });
  const select = vi.fn().mockReturnValue({ eq: firstEq });
  return { select };
}

/**
 * Builds a `from('day_factor' | 'hour_factor').select(...,{count,head}).eq(...).eq(...)`
 * chain. The two `.eq` calls return a thenable-shaped object directly (no
 * terminal `.maybeSingle()` — the Supabase client resolves the chain on await).
 */
function buildFactorChain(count: number | null) {
  const result = { count, error: null, data: null };
  // day_factor uses two .eq chains, hour_factor uses one. We always terminate
  // after the last .eq with a thenable Promise that resolves to `result`.
  const secondEq = vi.fn().mockResolvedValue(result);
  const firstEq = vi.fn().mockReturnValue({ eq: secondEq, then: undefined });
  // Allow single-.eq chain (hour_factor): firstEq itself must be awaitable.
  // We emulate a thenable on firstEq's return value by layering both.
  const firstEqThenable = {
    eq: secondEq,
    then: (resolve: (v: typeof result) => void) => resolve(result),
  };
  const firstEqFn = vi.fn().mockReturnValue(firstEqThenable);
  const select = vi.fn().mockReturnValue({ eq: firstEqFn });
  return { select };
}

/**
 * Builds the top-level admin client stub.
 *
 * @param params.budgetResult - What `season_budget` lookup returns.
 * @param params.dayFactorCount - Count returned by day_factor head query.
 * @param params.hourFactorCount - Count returned by hour_factor head query.
 * @param params.rpcResult - What `activate_season` RPC returns.
 */
function buildAdminClient(params: {
  budgetResult: {
    data: { season_budget_id: string; total_target_revenue: number | null } | null;
    error: unknown;
  };
  dayFactorCount?: number | null;
  hourFactorCount?: number | null;
  rpcResult?: { data: unknown; error: unknown };
}) {
  const budgetChain = buildBudgetChain(params.budgetResult);
  const dayFactorChain = buildFactorChain(params.dayFactorCount ?? 7);
  const hourFactorChain = buildFactorChain(params.hourFactorCount ?? 24);

  const from = vi.fn((table: string) => {
    if (table === "season_budget") return budgetChain;
    if (table === "day_factor") return dayFactorChain;
    if (table === "hour_factor") return hourFactorChain;
    throw new Error(`unexpected from(${table})`);
  });

  const rpc = vi.fn().mockResolvedValue(params.rpcResult ?? { data: null, error: null });

  return { from, rpc };
}

beforeEach(() => {
  resolveCurrentProfileMock.mockReset();
  gateActionMock.mockReset();
  createAdminClientMock.mockReset();
  emitMock.mockReset();

  // Default: authenticated manager
  resolveCurrentProfileMock.mockResolvedValue({
    profileId: PROFILE_ID,
    workspaceId: WS_ID,
    role: "manager",
  });
});

describe("activateSeasonAction — gate rejection", () => {
  it("returns insufficient_authority when gate denies, does NOT call RPC, does NOT emit 'season activated'", async () => {
    gateActionMock.mockResolvedValue({
      allow: false,
      reason: "role_floor",
      downgrade_to: null,
      min_role_required: "manager",
      channel_allowed: true,
      four_eyes_required: false,
      approvers_needed: 0,
    });

    const admin = buildAdminClient({
      budgetResult: { data: null, error: null }, // shouldn't be reached
    });
    createAdminClientMock.mockReturnValue(admin);

    const result = await activateSeasonAction(SEASON_ID);

    expect(result).toEqual({ ok: false, error: "insufficient_authority" });
    expect(admin.rpc).not.toHaveBeenCalled();
    expect(admin.from).not.toHaveBeenCalled();

    // Exactly one failure emit; no `season activated`
    const events = emitMock.mock.calls.map((c) => c[0]?.event);
    expect(events).toContain("season activation_failed");
    expect(events).not.toContain("season activated");
    expect(events).not.toContain("season operating_hours_generated");
  });
});

describe("activateSeasonAction — missing budget", () => {
  it("returns missing_budget when no budget row exists, does NOT call RPC", async () => {
    gateActionMock.mockResolvedValue({
      allow: true,
      reason: null,
      downgrade_to: null,
      min_role_required: null,
      channel_allowed: true,
      four_eyes_required: false,
      approvers_needed: 0,
    });

    const admin = buildAdminClient({
      budgetResult: { data: null, error: null },
    });
    createAdminClientMock.mockReturnValue(admin);

    const result = await activateSeasonAction(SEASON_ID);

    expect(result).toEqual({ ok: false, error: "missing_budget" });
    expect(admin.rpc).not.toHaveBeenCalled();

    const events = emitMock.mock.calls.map((c) => c[0]?.event);
    const reasons = emitMock.mock.calls.map((c) => c[0]?.properties?.data?.reason);
    expect(events).toContain("season activation_failed");
    expect(reasons).toContain("missing_budget");
    expect(events).not.toContain("season activated");
  });

  it("returns missing_budget when budget has zero total_target_revenue", async () => {
    gateActionMock.mockResolvedValue({
      allow: true,
      reason: null,
      downgrade_to: null,
      min_role_required: null,
      channel_allowed: true,
      four_eyes_required: false,
      approvers_needed: 0,
    });

    const admin = buildAdminClient({
      budgetResult: {
        data: { season_budget_id: BUDGET_ID, total_target_revenue: 0 },
        error: null,
      },
    });
    createAdminClientMock.mockReturnValue(admin);

    const result = await activateSeasonAction(SEASON_ID);

    expect(result).toEqual({ ok: false, error: "missing_budget" });
    expect(admin.rpc).not.toHaveBeenCalled();
  });
});

describe("activateSeasonAction — happy path (rows generated)", () => {
  it("emits 'season activated' and 'season operating_hours_generated' on success", async () => {
    gateActionMock.mockResolvedValue({
      allow: true,
      reason: null,
      downgrade_to: null,
      min_role_required: null,
      channel_allowed: true,
      four_eyes_required: false,
      approvers_needed: 0,
    });

    const admin = buildAdminClient({
      budgetResult: {
        data: { season_budget_id: BUDGET_ID, total_target_revenue: 500_000 },
        error: null,
      },
      dayFactorCount: 7,
      hourFactorCount: 24,
      rpcResult: {
        data: {
          ok: true,
          season_id: SEASON_ID,
          departments_affected: 3,
          rows_generated: 21,
        },
        error: null,
      },
    });
    createAdminClientMock.mockReturnValue(admin);

    const result = await activateSeasonAction(SEASON_ID);

    expect(result).toEqual({
      ok: true,
      season_id: SEASON_ID,
      departments_affected: 3,
      rows_generated: 21,
    });
    expect(admin.rpc).toHaveBeenCalledTimes(1);
    expect(admin.rpc).toHaveBeenCalledWith("activate_season", {
      p_workspace_id: WS_ID,
      p_season_id: SEASON_ID,
    });

    const events = emitMock.mock.calls.map((c) => c[0]?.event);
    // Invariant 3: exactly one `season activated` on the ok:true branch
    expect(events.filter((e) => e === "season activated")).toHaveLength(1);
    expect(events).toContain("season operating_hours_generated");
    expect(events).not.toContain("season activation_failed");

    // had_existing_hours must be false when rows were actually generated
    const activated = emitMock.mock.calls.find((c) => c[0]?.event === "season activated")?.[0];
    expect(activated?.properties?.data?.had_existing_hours).toBe(false);
    expect(activated?.properties?.data?.departments_affected).toBe(3);
    expect(activated?.properties?.data?.rows_generated).toBe(21);
  });
});

describe("activateSeasonAction — already-active skip (idempotent)", () => {
  it("emits 'season activated' with had_existing_hours=true, DOES NOT emit operating_hours_generated", async () => {
    gateActionMock.mockResolvedValue({
      allow: true,
      reason: null,
      downgrade_to: null,
      min_role_required: null,
      channel_allowed: true,
      four_eyes_required: false,
      approvers_needed: 0,
    });

    const admin = buildAdminClient({
      budgetResult: {
        data: { season_budget_id: BUDGET_ID, total_target_revenue: 500_000 },
        error: null,
      },
      dayFactorCount: 7,
      hourFactorCount: 24,
      rpcResult: {
        data: {
          ok: true,
          skipped: true,
          reason: "already_active",
          season_id: SEASON_ID,
          departments_affected: 0,
          rows_generated: 0,
        },
        error: null,
      },
    });
    createAdminClientMock.mockReturnValue(admin);

    const result = await activateSeasonAction(SEASON_ID);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.skipped).toBe(true);
      expect(result.reason).toBe("already_active");
      expect(result.departments_affected).toBe(0);
      expect(result.rows_generated).toBe(0);
    }

    const events = emitMock.mock.calls.map((c) => c[0]?.event);
    expect(events).toContain("season activated");
    // L-0094: never emit `season operating_hours_generated` if rows_generated=0
    expect(events).not.toContain("season operating_hours_generated");
    expect(events).not.toContain("season activation_failed");

    const activated = emitMock.mock.calls.find((c) => c[0]?.event === "season activated")?.[0];
    expect(activated?.properties?.data?.had_existing_hours).toBe(true);
  });
});
