/**
 * packages/ai/src/capabilities/scheduler/__tests__/diagnose-tools.test.ts
 *
 * Vitest unit tests for diagnoseTurnusDisabled tool.
 *
 * 5 tests:
 *   1. Happy: all dimensions present → ready=true, missing=[]
 *   2. Missing D1: no planning_cycle for window → ready=false, D1 entry
 *   3. Missing D4 (no season): empty season result → ready=false, D4 entry
 *   4. Missing D4 (season exists, no budget): D4 says "budget mangler"
 *   5. Missing multiple (D2 + D4): zero contracts + zero season → both entries
 *
 * All DB calls mocked (no real Supabase). Telemetry mocked.
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

// ── Telemetry mock ─────────────────────────────────────────────────────────
vi.mock("@smartout/telemetry", async () => {
  const actual = await vi.importActual<typeof import("@smartout/telemetry")>("@smartout/telemetry");
  return { ...actual, emit: vi.fn(async () => undefined) };
});

import { diagnoseTurnusDisabled } from "../diagnose-tools.js";

// ── Fixtures ───────────────────────────────────────────────────────────────

const WORKSPACE_ID = "ws-00000000-0000-0000-0000-000000000001";
const PROFILE_ID = "p-00000000-0000-0000-0000-000000000001";
const SESSION_ID = "session-00000000-0000-0000-0000-000000000001";
const DEPT_ID = "dept-0000-0000-0000-0000-000000000001";
const SEASON_ID = "season-0000-0000-0000-0000-000000000001";
const BUDGET_ID = "budget-0000-0000-0000-0000-000000000001";
const CYCLE_ID = "cycle-0000-0000-0000-0000-000000000001";

// Target week: 2026-W26 = 2026-06-22 (Mon) → 2026-06-28 (Sun)
const TARGET_WEEK = "2026-W26";

// ── Chainable Supabase mock builder ────────────────────────────────────────

/**
 * makeChain(data, opts):
 *   Returns an object with all Supabase query builder methods that resolve
 *   to { data, error: null } at the leaf. maybeSingle returns the first
 *   item (or null). Array-terminal queries (.select chain without maybeSingle)
 *   return { data: Array.isArray(data) ? data : [data], error: null }.
 */
function makeChain(data: unknown | null, opts: { single?: boolean; error?: string } = {}) {
  const { single = false, error: errorMsg } = opts;

  const resolve = async () => {
    if (errorMsg) return { data: null, error: { message: errorMsg } };
    if (single) return { data: data ?? null, error: null };
    return {
      data: data == null ? [] : Array.isArray(data) ? data : [data],
      error: null,
    };
  };

  const chain: Record<string, unknown> = {};
  const methods = ["eq", "in", "gte", "lte", "is", "or", "order", "limit", "not"];
  for (const m of methods) chain[m] = () => chain;
  chain["maybeSingle"] = single ? resolve : async () => ({ data: null, error: null });
  chain["then"] = async (resolve2: (v: unknown) => unknown) =>
    resolve2(
      data == null
        ? { data: [], error: null }
        : { data: Array.isArray(data) ? data : [data], error: null },
    );

  return chain;
}

/**
 * Build a table-dispatch mock for Supabase where each table returns
 * controlled data.
 *
 * tableMap: key = table name, value = { data, single?, error? }
 * Tables not in the map return empty arrays by default.
 */
function buildSupabaseMock(
  tableMap: Record<string, { data: unknown | null; single?: boolean; error?: string }>,
): SupabaseClient {
  return {
    from: vi.fn((table: string) => {
      const spec = tableMap[table];
      if (!spec) {
        // Default: empty array (table exists, no rows)
        return {
          select: () => makeChain([], { single: false }),
        };
      }
      const chain = makeChain(spec.data, { single: spec.single, error: spec.error });
      return { select: () => chain };
    }),
  } as unknown as SupabaseClient;
}

function makeCtx(channel: "chat" | "voice" = "chat") {
  return {
    workspaceId: WORKSPACE_ID as import("@smartout/telemetry/server").NonEmptyString,
    profileId: PROFILE_ID as import("@smartout/telemetry/server").NonEmptyString,
    sessionId: SESSION_ID,
    channel,
    supabaseAdmin: null as unknown as SupabaseClient, // overridden per test
  };
}

// ── Happy-path data set ────────────────────────────────────────────────────

const HAPPY_TABLES: Record<string, { data: unknown | null; single?: boolean }> = {
  planning_cycle: {
    data: { planning_cycle_id: CYCLE_ID },
    single: true,
  },
  department_operating_hours: {
    data: [{ department_operating_hours_id: "doh-001" }],
  },
  employment_contract: {
    data: [{ employment_contract_id: "contract-001" }],
  },
  framework_rule: {
    data: [{ framework_rule_id: "rule-001" }],
  },
  season: {
    data: { season_id: SEASON_ID, name: "Sommer 2026" },
    single: true,
  },
  season_budget: {
    data: { season_budget_id: BUDGET_ID },
    single: true,
  },
  day_factor: {
    data: [{ day_factor_id: "df-001" }],
  },
  hour_factor: {
    data: [{ hour_factor_id: "hf-001" }],
  },
  workspace: {
    data: { niche: "restaurant" },
    single: true,
  },
  schedule_shift: {
    data: [],
  },
};

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── Test 1: Happy path ───────────────────────────────────────────────────────

describe("diagnoseTurnusDisabled", () => {
  it("happy: all dimensions present → ready=true, output says 'Alt klart'", async () => {
    const supabaseMock = buildSupabaseMock(HAPPY_TABLES);
    const ctx = { ...makeCtx("chat"), supabaseAdmin: supabaseMock };

    const result = await diagnoseTurnusDisabled.execute({ target_week_iso: TARGET_WEEK }, ctx);

    expect(typeof result).toBe("string");
    expect(result).toContain("Alt klart");
    expect(result).toContain("JA");
    // No ✗ lines
    expect(result).not.toContain("✗");
  });

  // ─── Test 2: Missing D1 (no planning_cycle) ─────────────────────────────

  it("missing D1: no planning_cycle → ready=false, D1 entry in output", async () => {
    const tables = {
      ...HAPPY_TABLES,
      planning_cycle: {
        data: null, // no row
        single: true,
      },
    };
    const supabaseMock = buildSupabaseMock(tables);
    const ctx = { ...makeCtx("chat"), supabaseAdmin: supabaseMock };

    const result = await diagnoseTurnusDisabled.execute({ target_week_iso: TARGET_WEEK }, ctx);

    expect(result).toContain("NEI");
    expect(result).toContain("D1");
    expect(result).toContain("planning_cycle");
    expect(result).toContain("year-wheel");
  });

  // ─── Test 3: Missing D4 — no active season ───────────────────────────────

  it("missing D4 (no season): empty season query → D4 entry in output", async () => {
    const tables = {
      ...HAPPY_TABLES,
      season: {
        data: null, // no active season
        single: true,
      },
    };
    const supabaseMock = buildSupabaseMock(tables);
    const ctx = { ...makeCtx("chat"), supabaseAdmin: supabaseMock };

    const result = await diagnoseTurnusDisabled.execute({ target_week_iso: TARGET_WEEK }, ctx);

    expect(result).toContain("NEI");
    expect(result).toContain("D4");
    expect(result).toContain("sesong");
  });

  // ─── Test 4: Missing D4 — season exists, no season_budget ───────────────

  it("missing D4 (season exists, no budget): output says 'budget'", async () => {
    const tables = {
      ...HAPPY_TABLES,
      season: {
        data: { season_id: SEASON_ID, name: "Sommer 2026" },
        single: true,
      },
      season_budget: {
        data: null, // no budget
        single: true,
      },
    };
    const supabaseMock = buildSupabaseMock(tables);
    const ctx = { ...makeCtx("chat"), supabaseAdmin: supabaseMock };

    const result = await diagnoseTurnusDisabled.execute({ target_week_iso: TARGET_WEEK }, ctx);

    expect(result).toContain("NEI");
    expect(result).toContain("D4");
    expect(result).toContain("budsjett");
  });

  // ─── Test 5: Missing D1 + D2 + D4 (multiple dimensions) ────────────────

  it("missing D1+D2+D4: no planning_cycle + no contracts + no season → 3 entries", async () => {
    const tables = {
      ...HAPPY_TABLES,
      planning_cycle: {
        data: null, // no planning cycle
        single: true,
      },
      employment_contract: {
        data: [], // no contracts
      },
      season: {
        data: null, // no active season
        single: true,
      },
    };
    const supabaseMock = buildSupabaseMock(tables);
    const ctx = { ...makeCtx("chat"), supabaseAdmin: supabaseMock };

    const result = await diagnoseTurnusDisabled.execute({ target_week_iso: TARGET_WEEK }, ctx);

    expect(result).toContain("NEI");
    expect(result).toContain("D1");
    expect(result).toContain("D2");
    expect(result).toContain("D4");
    // At least 3 missing entries indicated (D1 planning_cycle + D2 + D4)
    const missingCount = (result.match(/✗/g) ?? []).length;
    expect(missingCount).toBeGreaterThanOrEqual(3);
  });

  // ─── Test 6: Voice channel happy path ────────────────────────────────────

  it("voice channel: happy path returns trimmed Norwegian summary (no ✗ lines)", async () => {
    const supabaseMock = buildSupabaseMock(HAPPY_TABLES);
    const ctx = { ...makeCtx("voice"), supabaseAdmin: supabaseMock };

    const result = await diagnoseTurnusDisabled.execute({ target_week_iso: TARGET_WEEK }, ctx);

    expect(typeof result).toBe("string");
    // Voice output is shorter — no ✗ lines, no NEI
    expect(result).not.toContain("✗");
    expect(result).not.toContain("NEI");
    // Voice happy-path says "klart" (ready)
    expect(result.toLowerCase()).toContain("klart");
    // Voice output mentions the week number
    expect(result).toContain("26");
  });

  // ─── Test 7: ISO week parsing — 2026-W26 → Mon 2026-06-22 → Sun 2026-06-28 ─

  it("ISO week parsing: 2026-W26 → start=2026-06-22 (Mon), end=2026-06-28 (Sun)", async () => {
    // We verify by checking that the chat output embeds the correct date range.
    // The tool formats: "uke 26 (2026-06-22 → 2026-06-28)"
    const supabaseMock = buildSupabaseMock(HAPPY_TABLES);
    const ctx = { ...makeCtx("chat"), supabaseAdmin: supabaseMock };

    const result = await diagnoseTurnusDisabled.execute({ target_week_iso: "2026-W26" }, ctx);

    // Chat formatter embeds the date range in the first line.
    expect(result).toContain("2026-06-22");
    expect(result).toContain("2026-06-28");
  });
});
