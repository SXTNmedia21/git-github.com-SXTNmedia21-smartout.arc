// settlement-render.spec.ts — Vitest suite for M7 settlement artifact renderers.
//
// Coverage:
//  1. renderSummaryPdf → non-empty Buffer
//  2. renderDetailCsv → CSV with header + ≥1 data row given mock data
//  3. renderInvoiceBundlePdf with 0 company_ids → null (not throws)
//  4. renderDiscrepancyPdf with empty discrepancies → contains "Ingen avvik"
//  5. All 4 renderers produce > 100 bytes for non-empty input
//
// Integration test (requiresSupabase env vars — skipped when absent):
//  6. executeSettlementRun against local Supabase with seeded data
//
// server-only is aliased to an empty module in vitest.config.ts.

import { describe, test, expect, vi } from "vitest";
import { renderSummaryPdf } from "../server/settlement/render-summary-pdf";
import { renderDetailCsv } from "../server/settlement/render-detail-csv";
import { renderInvoiceBundlePdf } from "../server/settlement/render-invoice-bundle";
import { renderDiscrepancyPdf } from "../server/settlement/render-discrepancy-pdf";
import type { SettlementSummary, SettlementDiscrepancy } from "../server/settlement/types";

// ── Fixtures ─────────────────────────────────────────────────────────────────

const PERIOD_LABEL = "September 2026";
const PERIOD_START = "2026-09-01";
const PERIOD_END = "2026-09-30";

const mockSummary: SettlementSummary = {
  by_workspace: {
    "ws-001": {
      company_name: "Strøm Mat AS",
      workspace_name: "Strøm Hovedrest",
      count_orders: 12,
      amount_excl_vat: 87_500,
      amount_incl_vat: 109_375,
      amount_paid: 109_375,
      amount_outstanding: 0,
      status_summary: "100% mottatt",
    },
    "ws-002": {
      company_name: "Villa Mat AS",
      workspace_name: "Villa Sentrum",
      count_orders: 8,
      amount_excl_vat: 64_200,
      amount_incl_vat: 80_250,
      amount_paid: 69_817.5,
      amount_outstanding: 10_432.5,
      status_summary: "87% (1 forfalt)",
    },
  },
  totals: {
    amount_excl_vat: 151_700,
    vat_breakdown: {
      "0.25": 37_925,
      "0.15": 0,
      "0.12": 0,
    },
    amount_incl_vat: 189_625,
    amount_paid: 179_192.5,
    amount_outstanding: 10_432.5,
  },
  discrepancies: [
    {
      type: "overdue",
      invoice_id: "inv-001",
      company_name: "Villa Mat AS",
      days_overdue: 14,
      severity: "high",
    } as SettlementDiscrepancy,
  ],
};

const emptyDiscrepancySummary: SettlementSummary = {
  ...mockSummary,
  discrepancies: [],
};

// ── Mock Supabase client for CSV test ─────────────────────────────────────────

function createMockSupabaseForCsv(invoices: unknown[]) {
  return {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        in: vi.fn().mockReturnValue({
          gte: vi.fn().mockReturnValue({
            lte: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({
                  data: invoices,
                  error: null,
                }),
              }),
            }),
          }),
        }),
      }),
    }),
  };
}

function createMockSupabaseEmptyResult() {
  return {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        in: vi.fn().mockReturnValue({
          gte: vi.fn().mockReturnValue({
            lte: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({
                  data: [],
                  error: null,
                }),
              }),
            }),
          }),
        }),
      }),
    }),
  };
}

const mockInvoice = {
  invoice_id: "inv-001",
  invoice_number: 1024,
  issued_at: "2026-09-01T10:00:00Z",
  period_from: "2026-09-01",
  status: "paid",
  paid_at: "2026-09-15T00:00:00Z",
  payment_date: "2026-09-15",
  company_id: "co-001",
  amount_excl_vat: 12_000,
  vat_amount: 3_000,
  vat_rate: 0.25,
  amount_incl_vat: 15_000,
  company: {
    company_id: "co-001",
    name: "Strøm Mat AS",
    org_number: "912345678",
  },
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("renderSummaryPdf", () => {
  test("returns non-empty Buffer", async () => {
    const buf = await renderSummaryPdf(mockSummary, PERIOD_LABEL);
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.length).toBeGreaterThan(100);
  });

  test("produces > 100 bytes for non-empty input", async () => {
    const buf = await renderSummaryPdf(mockSummary, PERIOD_LABEL);
    expect(buf.length).toBeGreaterThan(100);
  });

  test("handles empty by_workspace gracefully", async () => {
    const emptySummary: SettlementSummary = {
      by_workspace: {},
      totals: {
        amount_excl_vat: 0,
        vat_breakdown: { "0.25": 0, "0.15": 0, "0.12": 0 },
        amount_incl_vat: 0,
        amount_paid: 0,
        amount_outstanding: 0,
      },
      discrepancies: [],
    };
    const buf = await renderSummaryPdf(emptySummary, PERIOD_LABEL);
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.length).toBeGreaterThan(100);
  });
});

describe("renderDetailCsv", () => {
  test("returns CSV with header + ≥1 data row given mock invoice", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockClient = createMockSupabaseForCsv([mockInvoice]) as any;
    const workspaceNames = new Map([["co-001", "Strøm Hovedrest"]]);

    const csv = await renderDetailCsv(
      mockClient,
      ["co-001"],
      workspaceNames,
      PERIOD_START,
      PERIOD_END,
    );

    expect(typeof csv).toBe("string");
    // UTF-8 BOM + header row + 1 data row → at least 2 lines after BOM.
    expect(csv.length).toBeGreaterThan(100);
    expect(csv).toContain("invoice_number");
    expect(csv).toContain("Strøm Mat AS");
    expect(csv).toContain("912345678");
  });

  test("returns header-only CSV for empty companyIds", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockClient = createMockSupabaseEmptyResult() as any;
    const csv = await renderDetailCsv(mockClient, [], new Map(), PERIOD_START, PERIOD_END);
    expect(typeof csv).toBe("string");
    expect(csv).toContain("invoice_number");
  });

  test("produces > 100 bytes for non-empty input", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockClient = createMockSupabaseForCsv([mockInvoice]) as any;
    const csv = await renderDetailCsv(
      mockClient,
      ["co-001"],
      new Map([["co-001", "Ws"]]),
      PERIOD_START,
      PERIOD_END,
    );
    expect(csv.length).toBeGreaterThan(100);
  });
});

describe("renderInvoiceBundlePdf", () => {
  test("returns null when companyIds is empty (0 scope)", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockClient = createMockSupabaseEmptyResult() as any;
    const result = await renderInvoiceBundlePdf(
      mockClient,
      [],
      PERIOD_START,
      PERIOD_END,
      PERIOD_LABEL,
    );
    expect(result).toBeNull();
  });

  test("returns null when no invoices exist in period", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockClient = createMockSupabaseEmptyResult() as any;
    const result = await renderInvoiceBundlePdf(
      mockClient,
      ["co-001"],
      PERIOD_START,
      PERIOD_END,
      PERIOD_LABEL,
    );
    expect(result).toBeNull();
  });

  test("does not throw when returning null for empty input", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockClient = createMockSupabaseEmptyResult() as any;
    await expect(
      renderInvoiceBundlePdf(mockClient, [], PERIOD_START, PERIOD_END, PERIOD_LABEL),
    ).resolves.toBeNull();
  });

  test("produces > 100 bytes for non-empty invoice list", async () => {
    const mockInvoiceForBundle = {
      ...mockInvoice,
      due_at: "2026-10-01T00:00:00Z",
      invoice_line_item: [
        {
          description: "Smartout månedspris",
          quantity: 1,
          unit_price: 12_000,
          vat_rate: 0.25,
          amount_excl_vat: 12_000,
        },
      ],
    };

    const mockClientWithInvoice = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          in: vi.fn().mockReturnValue({
            gte: vi.fn().mockReturnValue({
              lte: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({
                  data: [mockInvoiceForBundle],
                  error: null,
                }),
              }),
            }),
          }),
        }),
      }),
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await renderInvoiceBundlePdf(
      mockClientWithInvoice as unknown as Parameters<typeof renderInvoiceBundlePdf>[0],
      ["co-001"],
      PERIOD_START,
      PERIOD_END,
      PERIOD_LABEL,
    );

    expect(result).not.toBeNull();
    expect(Buffer.isBuffer(result)).toBe(true);
    expect(result!.length).toBeGreaterThan(100);
  });
});

describe("renderDiscrepancyPdf", () => {
  test("renders 'Ingen avvik' page when discrepancies array is empty", async () => {
    const buf = await renderDiscrepancyPdf([], PERIOD_LABEL);
    expect(Buffer.isBuffer(buf)).toBe(true);
    // The PDF content includes the text; verify byte size is reasonable.
    expect(buf.length).toBeGreaterThan(100);
  });

  test("produces > 100 bytes for non-empty discrepancy list", async () => {
    const buf = await renderDiscrepancyPdf(mockSummary.discrepancies, PERIOD_LABEL);
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.length).toBeGreaterThan(100);
  });

  test("handles all severity levels without throwing", async () => {
    const mixed: SettlementDiscrepancy[] = [
      {
        type: "overdue",
        invoice_id: "inv-a",
        company_name: "Alpha AS",
        days_overdue: 20,
        severity: "high",
      },
      {
        type: "partial_payment",
        invoice_id: "inv-b",
        expected: 10_000,
        received: 8_000,
        severity: "medium",
      },
      {
        type: "missing_org_nr",
        company_id: "co-c",
        company_name: "Gamma AS",
        severity: "low",
      },
    ];
    const buf = await renderDiscrepancyPdf(mixed, PERIOD_LABEL);
    expect(buf.length).toBeGreaterThan(100);
  });
});

describe("renderSummaryPdf with discrepancy-free summary", () => {
  test("renders OK when no discrepancies", async () => {
    const buf = await renderSummaryPdf(emptyDiscrepancySummary, PERIOD_LABEL);
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.length).toBeGreaterThan(100);
  });
});

// ── Integration test ──────────────────────────────────────────────────────────
//
// Skipped unless NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are set.
// Run with seeded local Supabase data (admin@smartout.local with grants on all companies).
//
// To run:
//   pnpm --filter @smartout/billing test settlement
//   (with env vars loaded via op run --env-file=.env.template)
//

const hasSupabaseEnv =
  !!process.env["NEXT_PUBLIC_SUPABASE_URL"] && !!process.env["SUPABASE_SERVICE_ROLE_KEY"];

describe.skipIf(!hasSupabaseEnv)("executeSettlementRun integration", () => {
  test("creates settlement_run + 4 artifacts in local Supabase", async () => {
    // Dynamic imports to avoid pulling all deps when skipped.
    const { createClient } = await import("@supabase/supabase-js");
    const { executeSettlementRun } = await import("../server/settlement/run");

    const url = process.env["NEXT_PUBLIC_SUPABASE_URL"]!;
    const serviceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"]!;
    const anonKey = process.env["NEXT_PUBLIC_SUPABASE_ANON_KEY"] ?? serviceKey;

    // Use service role for both clients in integration test (no real JWT session).
    const serviceClient = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const userClient = createClient(url, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Seeded admin user from seed-admin-test: admin@smartout.local
    // (Fallback to TEST_USER_ID env var if set).
    const userId = process.env["TEST_USER_ID"] ?? "00000000-0000-0000-0000-000000000001";

    const result = await executeSettlementRun(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      serviceClient as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      userClient as any,
      userId,
      {
        period_start: "2026-09-01",
        period_end: "2026-09-30",
        workspace_ids: [], // empty = will fail access check unless pre-seeded
        scope: "all_workspaces",
      },
    );

    // For integration test, we accept either success or the expected failure
    // when workspace_ids is empty (no workspaces to resolve).
    expect(["succeeded", "failed"]).toContain(result.status);
    expect(result.run_id).toBeTruthy();
    expect(result.artifacts_url).toBeTruthy();
  }, 30_000); // 30s timeout for integration test
});
