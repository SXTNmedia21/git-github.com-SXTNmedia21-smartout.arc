// billing-activity-log.fan-out.test.ts — ADR-0264 fan-out path unit tests.
//
// The billing_activity_log provider gains a fan-out branch triggered when
// data.company_ids is a non-empty string array. Each company_id is verified
// against the DB, then one billing_activity_log row is inserted per company.
// Promise.allSettled ensures a single failed insert does not suppress the rest.
//
// Pattern follows billing-activity-log.nested-entity.test.ts (same directory).
// All Supabase calls are mocked — no real DB required.

import { describe, test, expect, vi, beforeEach } from "vitest";

// ── Mock Supabase before importing the provider ───────────────────────────────

// We mock @supabase/supabase-js so createClient() returns a fully-controllable
// stub. The mock is defined before the import so vitest hoists it.
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockMaybeSingle = vi.fn();
const mockInsert = vi.fn();
const mockFrom = vi.fn();

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from: mockFrom,
  }),
}));

import { writeBillingActivityLog } from "../providers/billing-activity-log";
import type { SmartoutEvent, EventMeta } from "../registry";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const COMPANY_A = "cid-a0000000-0000-4000-8000-000000000001";
const COMPANY_B = "cid-b0000000-0000-4000-8000-000000000002";
const RUN_ID = "run-f47ac10b-58cc-4372-a567-0e02b2c3d479";

const baseEvent = (): SmartoutEvent =>
  ({
    event: "settlement run_completed",
    actor_id: "user-actor-001" as ReturnType<typeof import("../non-empty-string.js").nonEmpty>,
    workspace_id: null,
    properties: {
      entity: { entity_type: "settlement_run", entity_id: RUN_ID },
      data: {
        run_id: RUN_ID,
        period_start: "2026-09-01",
        period_end: "2026-09-30",
        workspace_count: 3,
        artifact_count: 4,
      },
    },
  }) as SmartoutEvent;

const meta: EventMeta = { destinations: ["billing_activity_log"], category: "billing" };

// Helper: produce a settled supabase chain for a company lookup result.
function makeCompanyChain(result: { data: { company_id: string } | null; error: null }) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue(result),
      }),
    }),
  };
}

function makeInsertChain(result: { error: null | { message: string } }) {
  return {
    insert: vi.fn().mockResolvedValue(result),
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  // Set required env vars so getSupabaseClient() does not throw.
  process.env.SUPABASE_URL = "http://localhost:54321";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key-test";
});

describe("billing-activity-log fan-out: ADR-0264", () => {
  // ── Test 1: both companies verified → 2 inserts ────────────────────────────
  test("data.company_ids=['cid-A','cid-B'] — both verified → 2 inserts, 0 warnings", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    // company lookup returns a row for both company_ids
    let callCount = 0;
    mockFrom.mockImplementation((table: string) => {
      if (table === "company") {
        callCount++;
        const cid = callCount === 1 ? COMPANY_A : COMPANY_B;
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () => Promise.resolve({ data: { company_id: cid }, error: null }),
            }),
          }),
        };
      }
      // billing_activity_log insert
      return { insert: () => Promise.resolve({ error: null }) };
    });

    const event = baseEvent();
    (event.properties as Record<string, unknown>).data = {
      ...(event.properties as { data: Record<string, unknown> }).data,
      company_ids: [COMPANY_A, COMPANY_B],
    };

    await writeBillingActivityLog(event, meta);

    // No warnings expected
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();

    // from() called at least 4 times: 2 company lookups + 2 inserts
    expect(mockFrom).toHaveBeenCalledTimes(4);
  });

  // ── Test 2: one company not found → 1 insert + 1 console.warn ─────────────
  test("data.company_ids includes unknown cid → warn + skip unknown, insert known", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    let callCount = 0;
    mockFrom.mockImplementation((table: string) => {
      if (table === "company") {
        callCount++;
        if (callCount === 1) {
          // First company found
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: () =>
                  Promise.resolve({ data: { company_id: COMPANY_A }, error: null }),
              }),
            }),
          };
        } else {
          // Second company NOT found
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: () => Promise.resolve({ data: null, error: null }),
              }),
            }),
          };
        }
      }
      return { insert: () => Promise.resolve({ error: null }) };
    });

    const event = baseEvent();
    (event.properties as Record<string, unknown>).data = {
      ...(event.properties as { data: Record<string, unknown> }).data,
      company_ids: [COMPANY_A, "cid-NOT-FOUND"],
    };

    await writeBillingActivityLog(event, meta);

    // Exactly 1 warn for the unknown company
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0]![0]).toContain("cid-NOT-FOUND");
    warnSpy.mockRestore();

    // 2 company lookups + 1 insert (not 2)
    expect(mockFrom).toHaveBeenCalledTimes(3);
  });

  // ── Test 3: empty company_ids → falls through to single-company path ────────
  test("data.company_ids=[] → falls through, no fan-out insert (regression guard)", async () => {
    // Single-company path needs no invoice_id + no company_id → warn about company_id
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    // mockFrom should NOT be called for company lookup (fan-out never triggered)
    mockFrom.mockReturnValue({
      select: () => ({
        eq: () => ({
          maybeSingle: () => Promise.resolve({ data: null, error: null }),
        }),
      }),
      insert: () => Promise.resolve({ error: null }),
    });

    const event = baseEvent();
    (event.properties as Record<string, unknown>).data = {
      ...(event.properties as { data: Record<string, unknown> }).data,
      company_ids: [],
    };

    await writeBillingActivityLog(event, meta);

    // Reaches single-company path → warns "Could not resolve company_id" (no invoice_id, no company_id)
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("Could not resolve company_id"));
    warnSpy.mockRestore();
  });

  // ── Test 4: company_ids absent → falls through to single-company path ───────
  test("data.company_ids absent → falls through (existing behavior preserved)", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    mockFrom.mockReturnValue({
      select: () => ({
        eq: () => ({
          maybeSingle: () => Promise.resolve({ data: null, error: null }),
        }),
      }),
      insert: () => Promise.resolve({ error: null }),
    });

    const event = baseEvent(); // no company_ids in data

    await writeBillingActivityLog(event, meta);

    // Should warn about unresolved company_id (single-company path reached)
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("Could not resolve company_id"));
    warnSpy.mockRestore();
  });

  // ── Test 5: insert error on one of two rows → other succeeds (allSettled) ───
  test("insert error on 1 of 2 companies → console.error + other row succeeds", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    let companyCallCount = 0;
    let insertCallCount = 0;
    mockFrom.mockImplementation((table: string) => {
      if (table === "company") {
        companyCallCount++;
        const cid = companyCallCount === 1 ? COMPANY_A : COMPANY_B;
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () => Promise.resolve({ data: { company_id: cid }, error: null }),
            }),
          }),
        };
      }
      // billing_activity_log
      insertCallCount++;
      const err = insertCallCount === 1 ? { message: "db error" } : null;
      return { insert: () => Promise.resolve({ error: err }) };
    });

    const event = baseEvent();
    (event.properties as Record<string, unknown>).data = {
      ...(event.properties as { data: Record<string, unknown> }).data,
      company_ids: [COMPANY_A, COMPANY_B],
    };

    await writeBillingActivityLog(event, meta);

    // Exactly 1 error for the failed insert
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy.mock.calls[0]![0]).toContain("fan-out insert failed");
    // No warns (both companies found)
    expect(warnSpy).not.toHaveBeenCalled();

    errorSpy.mockRestore();
    warnSpy.mockRestore();
  });

  // ── Test 6: single-element array → 1 insert via fan-out path (boundary) ─────
  test("data.company_ids=['cid-A'] (single element) → 1 insert via fan-out path", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    mockFrom.mockImplementation((table: string) => {
      if (table === "company") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () => Promise.resolve({ data: { company_id: COMPANY_A }, error: null }),
            }),
          }),
        };
      }
      return { insert: () => Promise.resolve({ error: null }) };
    });

    const event = baseEvent();
    (event.properties as Record<string, unknown>).data = {
      ...(event.properties as { data: Record<string, unknown> }).data,
      company_ids: [COMPANY_A],
    };

    await writeBillingActivityLog(event, meta);

    // No warns (company found, insert ok)
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();

    // from() called twice: 1 company lookup + 1 insert
    expect(mockFrom).toHaveBeenCalledTimes(2);
  });
});
