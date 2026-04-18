// Billing queries — payment helpers.
//
// Tests exercise the wrapper layer around the Supabase client: filter
// composition for listPayments + pagination cap. Full semantics live
// in pgTAP (B1 coverage); this file pins the JS plumbing.

import { describe, expect, test } from "vitest";

import { fetchPaymentAttempts, fetchPaymentsByInvoice, listPayments } from "../queries";

type FromCall = { action: string; args?: unknown };

function buildPaymentsChain(opts: { data?: unknown; error?: { message: string } | null }) {
  const calls: FromCall[] = [];
  // The chain returned by select().order().limit() supports further
  // .eq / .gte / .lte before the promise settles. We need to track
  // each filter call so the tests can assert on them.
  const filterChain = {
    eq(col: string, val: unknown) {
      calls.push({ action: `eq:${col}`, args: val });
      return filterChain;
    },
    gte(col: string, val: unknown) {
      calls.push({ action: `gte:${col}`, args: val });
      return filterChain;
    },
    lte(col: string, val: unknown) {
      calls.push({ action: `lte:${col}`, args: val });
      return filterChain;
    },
    order() {
      calls.push({ action: "order" });
      return filterChain;
    },
    limit(n: number) {
      calls.push({ action: "limit", args: n });
      return filterChain;
    },
    then(cb: (r: { data: unknown; error: unknown }) => void) {
      cb({ data: opts.data ?? [], error: opts.error ?? null });
    },
  };
  return { filterChain, calls };
}

function buildClient(chainReturn: ReturnType<typeof buildPaymentsChain>) {
  return {
    from() {
      return {
        select() {
          return {
            order() {
              return {
                limit() {
                  return chainReturn.filterChain;
                },
              };
            },
            eq() {
              return chainReturn.filterChain;
            },
          };
        },
      };
    },
  };
}

describe("listPayments", () => {
  test("default limit caps at 50 and orders by created_at desc", async () => {
    const chain = buildPaymentsChain({ data: [] });
    const client = {
      from() {
        return {
          select(arg: string) {
            chain.calls.push({ action: "select", args: arg });
            return {
              order(col: string, opts: unknown) {
                chain.calls.push({ action: "order", args: { col, opts } });
                return {
                  limit(n: number) {
                    chain.calls.push({ action: "limit", args: n });
                    return chain.filterChain;
                  },
                };
              },
            };
          },
        };
      },
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await listPayments(client as any);
    expect(chain.calls.some((c) => c.action === "limit" && c.args === 50)).toBe(true);
    expect(
      chain.calls.some(
        (c) =>
          c.action === "order" &&
          typeof c.args === "object" &&
          c.args !== null &&
          (c.args as { col: string }).col === "created_at",
      ),
    ).toBe(true);
  });

  test("explicit limit above 500 is clamped to 500", async () => {
    const chain = buildPaymentsChain({ data: [] });
    const client = {
      from() {
        return {
          select() {
            return {
              order() {
                return {
                  limit(n: number) {
                    chain.calls.push({ action: "limit", args: n });
                    return chain.filterChain;
                  },
                };
              },
            };
          },
        };
      },
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await listPayments(client as any, { limit: 10_000 });
    expect(chain.calls.find((c) => c.action === "limit")?.args).toBe(500);
  });

  test("status filter issues eq:status", async () => {
    const chain = buildPaymentsChain({ data: [] });
    const client = buildClient(chain);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await listPayments(client as any, { status: "succeeded" });
    expect(chain.calls.some((c) => c.action === "eq:status" && c.args === "succeeded")).toBe(true);
  });

  test("company_id filter issues eq:company_id", async () => {
    const chain = buildPaymentsChain({ data: [] });
    const client = buildClient(chain);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await listPayments(client as any, {
      company_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    });
    expect(
      chain.calls.some(
        (c) => c.action === "eq:company_id" && c.args === "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      ),
    ).toBe(true);
  });

  test("date-range filters issue gte/lte on paid_at", async () => {
    const chain = buildPaymentsChain({ data: [] });
    const client = buildClient(chain);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await listPayments(client as any, {
      paid_from: "2026-01-01",
      paid_to: "2026-12-31",
    });
    expect(chain.calls.some((c) => c.action === "gte:paid_at" && c.args === "2026-01-01")).toBe(
      true,
    );
    expect(chain.calls.some((c) => c.action === "lte:paid_at" && c.args === "2026-12-31")).toBe(
      true,
    );
  });

  test("DB error surfaces as rejected promise", async () => {
    const chain = buildPaymentsChain({ data: null, error: { message: "boom" } });
    const client = buildClient(chain);
    await expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      listPayments(client as any),
    ).rejects.toMatchObject({ message: "boom" });
  });
});

describe("fetchPaymentsByInvoice", () => {
  test("filters by invoice_id and orders by created_at desc", async () => {
    const calls: FromCall[] = [];
    const client = {
      from() {
        return {
          select() {
            return {
              eq(col: string, val: unknown) {
                calls.push({ action: `eq:${col}`, args: val });
                return {
                  order(col: string, opts: unknown) {
                    calls.push({ action: "order", args: { col, opts } });
                    return Promise.resolve({ data: [], error: null });
                  },
                };
              },
            };
          },
        };
      },
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await fetchPaymentsByInvoice(client as any, "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    expect(
      calls.some(
        (c) => c.action === "eq:invoice_id" && c.args === "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      ),
    ).toBe(true);
    expect(
      calls.some(
        (c) =>
          c.action === "order" &&
          typeof c.args === "object" &&
          c.args !== null &&
          (c.args as { col: string }).col === "created_at",
      ),
    ).toBe(true);
  });
});

describe("fetchPaymentAttempts", () => {
  test("orders attempts by attempt_number asc (oldest first)", async () => {
    const calls: FromCall[] = [];
    const client = {
      from() {
        return {
          select() {
            return {
              eq() {
                return {
                  order(col: string, opts: { ascending: boolean }) {
                    calls.push({ action: "order", args: { col, opts } });
                    return Promise.resolve({ data: [], error: null });
                  },
                };
              },
            };
          },
        };
      },
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await fetchPaymentAttempts(client as any, "pay-1");
    const orderCall = calls.find((c) => c.action === "order");
    expect(orderCall).toBeDefined();
    expect((orderCall?.args as { col: string }).col).toBe("attempt_number");
    expect((orderCall?.args as { opts: { ascending: boolean } }).opts.ascending).toBe(true);
  });
});
