// M3 billing queries — accountant + order system helpers.
//
// Tests exercise the new query functions added in M3:
//   - fetchOrdersForAccountant (grantedCompanyIds + filters)
//   - fetchInvoiceDispatches (wrapper around getDispatchesByInvoice)
//   - fetchInvoicePayments (wrapper around fetchPaymentsByInvoice)
//
// SQL semantics live in pgTAP; this file pins the JS plumbing.

import { describe, expect, test } from "vitest";

import { fetchInvoiceDispatches, fetchInvoicePayments, fetchOrdersForAccountant } from "../queries";

// ─── Minimal mock chain builder ─────────────────────────────────────

type FilterChain = {
  eq: (col: string, val: unknown) => FilterChain;
  in: (col: string, val: unknown) => FilterChain;
  is: (col: string, val: unknown) => FilterChain;
  gte: (col: string, val: unknown) => FilterChain;
  lte: (col: string, val: unknown) => FilterChain;
  order: () => FilterChain;
  limit: (n: number) => FilterChain;
  select: (cols?: string) => FilterChain;
  maybeSingle: () => Promise<{ data: unknown; error: unknown }>;
  then: (cb: (r: { data: unknown; error: unknown }) => void) => void;
};

function buildChain(opts: { data?: unknown; error?: { message: string } | null }): {
  chain: FilterChain;
  calls: Array<{ action: string; args?: unknown }>;
} {
  const calls: Array<{ action: string; args?: unknown }> = [];

  const chain: FilterChain = {
    eq(col, val) {
      calls.push({ action: `eq:${col}`, args: val });
      return chain;
    },
    in(col, val) {
      calls.push({ action: `in:${col}`, args: val });
      return chain;
    },
    is(col, val) {
      calls.push({ action: `is:${col}`, args: val });
      return chain;
    },
    gte(col, val) {
      calls.push({ action: `gte:${col}`, args: val });
      return chain;
    },
    lte(col, val) {
      calls.push({ action: `lte:${col}`, args: val });
      return chain;
    },
    order() {
      calls.push({ action: "order" });
      return chain;
    },
    limit(n) {
      calls.push({ action: "limit", args: n });
      return chain;
    },
    select() {
      calls.push({ action: "select" });
      return chain;
    },
    async maybeSingle() {
      return { data: opts.data ?? null, error: opts.error ?? null };
    },
    then(cb) {
      cb({ data: opts.data ?? [], error: opts.error ?? null });
    },
  };
  return { chain, calls };
}

function buildClient(chainReturn: ReturnType<typeof buildChain>) {
  return {
    from() {
      return chainReturn.chain;
    },
  };
}

// ─── fetchOrdersForAccountant ─────────────────────────────────────

describe("fetchOrdersForAccountant", () => {
  test("returns empty array when grantedCompanyIds is empty", async () => {
    const { chain, calls } = buildChain({ data: [] });
    const client = buildClient({ chain, calls });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await fetchOrdersForAccountant(client as any, []);
    expect(result).toEqual([]);
    // Should not even touch the DB
    expect(calls.length).toBe(0);
  });

  test("applies .in(company_id) filter with granted IDs", async () => {
    const ids = ["uuid-a", "uuid-b"];
    const { chain, calls } = buildChain({ data: [] });
    const client = buildClient({ chain, calls });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await fetchOrdersForAccountant(client as any, ids);
    expect(calls.some((c) => c.action === "in:company_id")).toBe(true);
    const inCall = calls.find((c) => c.action === "in:company_id");
    expect(inCall?.args).toEqual(ids);
  });

  test("applies status filter when provided", async () => {
    const { chain, calls } = buildChain({ data: [] });
    const client = buildClient({ chain, calls });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await fetchOrdersForAccountant(client as any, ["uuid-a"], { status: "issued" });
    expect(calls.some((c) => c.action === "eq:status" && c.args === "issued")).toBe(true);
  });

  test("caps limit at 500", async () => {
    const { chain, calls } = buildChain({ data: [] });
    const client = buildClient({ chain, calls });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await fetchOrdersForAccountant(client as any, ["uuid-a"], { limit: 9999 });
    const limitCall = calls.find((c) => c.action === "limit");
    expect(limitCall?.args).toBe(500);
  });

  test("ignores company filter if not in grantedCompanyIds", async () => {
    const { chain, calls } = buildChain({ data: [] });
    const client = buildClient({ chain, calls });
    // "uuid-z" is a valid UUID but NOT in grantedCompanyIds
    const grantedIds = ["00000000-0000-0000-0000-000000000001"];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await fetchOrdersForAccountant(client as any, grantedIds, {
      company: "00000000-0000-0000-0000-000000000002",
    });
    // Should NOT apply a company_id filter for an ungrantedid
    expect(calls.some((c) => c.action === "eq:company_id")).toBe(false);
  });

  test("throws on DB error", async () => {
    const { chain, calls } = buildChain({ error: { message: "db error" } });
    const client = buildClient({ chain, calls });
    await expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fetchOrdersForAccountant(client as any, ["uuid-a"]),
    ).rejects.toMatchObject({ message: "db error" });
  });
});

// ─── fetchInvoiceDispatches ──────────────────────────────────────

describe("fetchInvoiceDispatches", () => {
  test("calls underlying getDispatchesByInvoice and returns rows", async () => {
    const row = {
      invoice_dispatch_id: "d1",
      invoice_id: "i1",
      dispatch_rule_id: null,
      channel: "email",
      target: {},
      status: "delivered",
      attempts: 1,
      last_attempt_at: null,
      delivered_at: null,
      error_code: null,
      error_message: null,
      external_reference: null,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
      rule: null,
    };
    const { chain, calls } = buildChain({ data: [row] });
    const client = buildClient({ chain, calls });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await fetchInvoiceDispatches(client as any, "i1");
    expect(result).toHaveLength(1);
    expect(result[0]!.invoice_dispatch_id).toBe("d1");
    expect(calls.some((c) => c.action === "eq:invoice_id")).toBe(true);
  });
});

// ─── fetchInvoicePayments ────────────────────────────────────────

describe("fetchInvoicePayments", () => {
  test("calls underlying fetchPaymentsByInvoice and returns rows", async () => {
    const row = {
      payment_id: "p1",
      invoice_id: "i1",
      company_id: "c1",
      workspace_id: null,
      amount: 1000,
      refunded_amount: null,
      currency: "NOK",
      status: "succeeded",
      payment_method: "bank_transfer",
      payment_method_type: "bank_transfer",
      external_id: null,
      metadata: null,
      paid_at: "2026-01-01T00:00:00Z",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    };
    const { chain, calls } = buildChain({ data: [row] });
    const client = buildClient({ chain, calls });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await fetchInvoicePayments(client as any, "i1");
    expect(result).toHaveLength(1);
    expect(result[0]!.payment_id).toBe("p1");
    expect(calls.some((c) => c.action === "eq:invoice_id")).toBe(true);
  });
});
