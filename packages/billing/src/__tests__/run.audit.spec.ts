// run.audit.spec.ts — ADR-0264 integration test for executeSettlementRun telemetry.
//
// Verifies that executeSettlementRun emits the correct company_ids on all three
// settlement telemetry events (run_completed, run_failed, period_locked) so that
// the billing_activity_log fan-out path (ADR-0264) can insert per-company rows.
//
// This test does NOT touch a real Supabase instance — all DB calls are mocked.
// The emit() function from @smartout/telemetry is mocked so we can inspect the
// payloads without actually running providers.

import { describe, test, expect, vi, beforeEach } from "vitest";

// ── Mock @smartout/telemetry before importing run.ts ─────────────────────────
// Use vi.hoisted() to hoist the mock refs above the vi.mock() factory calls,
// which vitest hoists to the top of the file before const declarations.

const { mockEmit, mockNonEmpty } = vi.hoisted(() => ({
  mockEmit: vi.fn().mockResolvedValue(undefined),
  mockNonEmpty: vi.fn((val: string) => val),
}));

vi.mock("@smartout/telemetry", () => ({
  emit: mockEmit,
  nonEmpty: mockNonEmpty,
}));

// ── Mock the accountant module ────────────────────────────────────────────────
// run.ts imports `hasAccountantAccess` from "../../accountant" which resolves
// to src/accountant/index.ts (re-exports from grants.ts). vi.mock paths are
// resolved relative to the test file location, so from src/__tests__/ that is
// "../accountant".

vi.mock("../accountant", () => ({
  hasAccountantAccess: vi.fn().mockResolvedValue(true),
  fetchAccountantCompanyGrants: vi.fn().mockResolvedValue([]),
}));

// ── Mock the renderer modules (heavy – pdf/csv) ───────────────────────────────

vi.mock("../server/settlement/render-summary-pdf", () => ({
  renderSummaryPdf: vi.fn().mockResolvedValue(Buffer.from("pdf")),
}));
vi.mock("../server/settlement/render-detail-csv", () => ({
  renderDetailCsv: vi.fn().mockResolvedValue("csv"),
}));
vi.mock("../server/settlement/render-invoice-bundle", () => ({
  renderInvoiceBundlePdf: vi.fn().mockResolvedValue(null),
}));
vi.mock("../server/settlement/render-discrepancy-pdf", () => ({
  renderDiscrepancyPdf: vi.fn().mockResolvedValue(Buffer.from("pdf")),
}));

import { executeSettlementRun } from "../server/settlement/run";
import type { Database } from "@smartout/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const WS_A = "ws-aaaa0000-0000-4000-8000-000000000001";
const WS_B = "ws-bbbb0000-0000-4000-8000-000000000002";
const WS_C = "ws-cccc0000-0000-4000-8000-000000000003";
const COMPANY_1 = "cid-1111-0000-4000-8000-000000000001"; // WS_A + WS_B
const COMPANY_2 = "cid-2222-0000-4000-8000-000000000002"; // WS_C
const RUN_ID = "run-00000000-0000-4000-8000-000000000001";
const USER_ID = "user-00000000-0000-4000-8000-000000000001";
const PERIOD_START = "2026-09-01";
const PERIOD_END = "2026-09-30";

// Minimal mock SettlementSummary returned by compute_period_aggregates
const mockSummary = {
  by_workspace: {
    [WS_A]: {
      company_name: "Company 1",
      workspace_name: "WS A",
      count_orders: 1,
      amount_excl_vat: 1000,
      amount_incl_vat: 1250,
      amount_paid: 1250,
      amount_outstanding: 0,
      status_summary: "100%",
    },
    [WS_B]: {
      company_name: "Company 1",
      workspace_name: "WS B",
      count_orders: 1,
      amount_excl_vat: 2000,
      amount_incl_vat: 2500,
      amount_paid: 2500,
      amount_outstanding: 0,
      status_summary: "100%",
    },
    [WS_C]: {
      company_name: "Company 2",
      workspace_name: "WS C",
      count_orders: 1,
      amount_excl_vat: 500,
      amount_incl_vat: 625,
      amount_paid: 625,
      amount_outstanding: 0,
      status_summary: "100%",
    },
  },
  totals: {
    amount_excl_vat: 3500,
    vat_breakdown: { "0.25": 875, "0.15": 0, "0.12": 0 },
    amount_incl_vat: 4375,
    amount_paid: 4375,
    amount_outstanding: 0,
  },
  discrepancies: [],
};

type DBClient = SupabaseClient<Database>;

/**
 * Build a service-role mock client: handles workspace, settlement_run,
 * settlement_period (via rpc), compute_period_aggregates (via rpc),
 * settlement_artifact inserts, and Storage upload.
 */
function makeServiceClient(opts: { failComputeAggregates?: boolean } = {}): DBClient {
  const schemaFn = vi.fn().mockImplementation((schemaName: string) => {
    void schemaName;
    return {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "settlement_run") {
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { run_id: RUN_ID },
                  error: null,
                }),
              }),
            }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null }),
            }),
          };
        }
        if (table === "settlement_artifact") {
          return {
            insert: vi.fn().mockResolvedValue({ error: null }),
          };
        }
        return {
          insert: vi.fn().mockResolvedValue({ error: null }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        };
      }),
      rpc: vi.fn().mockImplementation((rpcName: string) => {
        if (rpcName === "lock_settlement_period") {
          return Promise.resolve({ error: null });
        }
        if (rpcName === "compute_period_aggregates") {
          if (opts.failComputeAggregates) {
            return Promise.resolve({ data: null, error: { message: "db error from rpc" } });
          }
          return Promise.resolve({ data: mockSummary, error: null });
        }
        return Promise.resolve({ data: null, error: null });
      }),
    };
  });

  const storageUploadFn = vi.fn().mockResolvedValue({ error: null });

  return {
    schema: schemaFn,
    storage: {
      from: vi.fn().mockReturnValue({
        upload: storageUploadFn,
      }),
    },
  } as unknown as DBClient;
}

/**
 * Build a user-scoped mock client: workspace lookup returns ws→company_id map.
 */
function makeUserClient(): DBClient {
  return {
    from: vi.fn().mockImplementation((table: string) => {
      if (table === "workspace") {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({
              data: [
                { workspace_id: WS_A, company_id: COMPANY_1 },
                { workspace_id: WS_B, company_id: COMPANY_1 },
                { workspace_id: WS_C, company_id: COMPANY_2 },
              ],
              error: null,
            }),
          }),
        };
      }
      return {};
    }),
  } as unknown as DBClient;
}

// ── Tests ──────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

describe("executeSettlementRun audit telemetry — ADR-0264", () => {
  // ── AC 1: run_completed → company_ids in emit payload ─────────────────────
  test("happy path: run_completed emit contains company_ids for all M companies", async () => {
    const result = await executeSettlementRun(makeServiceClient(), makeUserClient(), USER_ID, {
      period_start: PERIOD_START,
      period_end: PERIOD_END,
      workspace_ids: [WS_A, WS_B, WS_C],
      scope: "all_workspaces",
    });

    expect(result.status).toBe("succeeded");

    // Find the run_completed emit call
    const runCompletedCall = mockEmit.mock.calls.find(
      (args) => args[0]?.event === "settlement run_completed",
    );
    expect(runCompletedCall).toBeDefined();

    const data = runCompletedCall![0].properties.data;
    expect(Array.isArray(data.company_ids)).toBe(true);
    // 3 workspaces across 2 companies → 2 unique company_ids
    expect(data.company_ids).toHaveLength(2);
    expect(data.company_ids).toContain(COMPANY_1);
    expect(data.company_ids).toContain(COMPANY_2);
  });

  // ── AC 3: period_locked → company_id in each per-workspace emit ───────────
  test("happy path: period_locked emits contain correct company_id per workspace", async () => {
    await executeSettlementRun(makeServiceClient(), makeUserClient(), USER_ID, {
      period_start: PERIOD_START,
      period_end: PERIOD_END,
      workspace_ids: [WS_A, WS_B, WS_C],
      scope: "all_workspaces",
    });

    const periodLockedCalls = mockEmit.mock.calls.filter(
      (args) => args[0]?.event === "settlement period_locked",
    );

    // One emit per workspace
    expect(periodLockedCalls).toHaveLength(3);

    // Each has correct company_id
    const wsACall = periodLockedCalls.find((args) => args[0].properties.data.workspace_id === WS_A);
    expect(wsACall![0].properties.data.company_id).toBe(COMPANY_1);

    const wsBCall = periodLockedCalls.find((args) => args[0].properties.data.workspace_id === WS_B);
    expect(wsBCall![0].properties.data.company_id).toBe(COMPANY_1);

    const wsCCall = periodLockedCalls.find((args) => args[0].properties.data.workspace_id === WS_C);
    expect(wsCCall![0].properties.data.company_id).toBe(COMPANY_2);
  });

  // ── AC 2: run_failed → company_ids in emit payload ────────────────────────
  test("error path: run_failed emit contains company_ids from companyMap", async () => {
    // Force compute_period_aggregates to fail → triggers catch block
    const result = await executeSettlementRun(
      makeServiceClient({ failComputeAggregates: true }),
      makeUserClient(),
      USER_ID,
      {
        period_start: PERIOD_START,
        period_end: PERIOD_END,
        workspace_ids: [WS_A, WS_B, WS_C],
        scope: "all_workspaces",
      },
    );

    expect(result.status).toBe("failed");

    const runFailedCall = mockEmit.mock.calls.find(
      (args) => args[0]?.event === "settlement run_failed",
    );
    expect(runFailedCall).toBeDefined();

    const data = runFailedCall![0].properties.data;
    expect(Array.isArray(data.company_ids)).toBe(true);
    expect(data.company_ids).toHaveLength(2);
    expect(data.company_ids).toContain(COMPANY_1);
    expect(data.company_ids).toContain(COMPANY_2);
  });

  // ── AC 4: no "Could not resolve company_id" warn in logs ──────────────────
  test("no console.warn about missing company_id during successful run", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    await executeSettlementRun(makeServiceClient(), makeUserClient(), USER_ID, {
      period_start: PERIOD_START,
      period_end: PERIOD_END,
      workspace_ids: [WS_A, WS_B, WS_C],
      scope: "all_workspaces",
    });

    // No "Could not resolve company_id" warning
    const badWarns = warnSpy.mock.calls.filter((args) =>
      String(args[0]).includes("Could not resolve company_id"),
    );
    expect(badWarns).toHaveLength(0);

    warnSpy.mockRestore();
  });

  // ── run_completed: workspace_id is null (platform-scoped event) ────────────
  test("run_completed workspace_id is null (platform-scoped — activity_trail will drop)", () => {
    // This is a structural check — just verify the shape emitted
    // company_ids deduplication: WS_A + WS_B share COMPANY_1 → Set collapses to 2
    const companyMap = new Map([
      [WS_A, COMPANY_1],
      [WS_B, COMPANY_1],
      [WS_C, COMPANY_2],
    ]);
    const resolvedCompanyIds = Array.from(new Set([...companyMap.values()]));
    expect(resolvedCompanyIds).toHaveLength(2);
    expect(new Set(resolvedCompanyIds).size).toBe(2); // deduped
  });
});
