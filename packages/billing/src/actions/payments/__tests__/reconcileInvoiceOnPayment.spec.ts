// reconcileInvoiceOnPayment contract tests.
//
// Covers:
//   - Flips invoice.status='paid' when sum(payments) >= amount_incl_vat
//     and invoice was in ('issued','sent','overdue')
//   - Does NOT flip if already 'paid'
//   - Does NOT flip if partially covered
//   - Handles missing payment / missing invoice gracefully

import { describe, test, expect } from "vitest";
import { reconcileInvoiceOnPayment } from "../reconcileInvoiceOnPayment";

function createMockClient(opts: {
  payment: { invoice_id: string } | null;
  invoice: { invoice_id: string; status: string; amount_incl_vat: number } | null;
  paymentsForInvoice: Array<{ amount: number }>;
  updateError?: { message: string } | null;
}) {
  const calls: Array<{ op: string; table: string; payload?: unknown }> = [];
  const client = {
    from(table: string) {
      if (table === "payment") {
        return {
          select(_cols: string) {
            return {
              eq(_col: string, _val: unknown) {
                return {
                  async maybeSingle() {
                    calls.push({ op: "select", table: "payment" });
                    return { data: opts.payment, error: null };
                  },
                  in(_col2: string, _val2: unknown) {
                    calls.push({ op: "select-in", table: "payment" });
                    return { data: opts.paymentsForInvoice, error: null };
                  },
                };
              },
            };
          },
        };
      }
      if (table === "invoice") {
        return {
          select(_cols: string) {
            return {
              eq(_col: string, _val: unknown) {
                return {
                  async maybeSingle() {
                    calls.push({ op: "select", table: "invoice" });
                    return { data: opts.invoice, error: null };
                  },
                };
              },
            };
          },
          update(payload: Record<string, unknown>) {
            calls.push({ op: "update", table: "invoice", payload });
            return {
              eq(_col: string, _val: unknown) {
                return {
                  in(_col2: string, _val2: unknown) {
                    return Promise.resolve({ error: opts.updateError ?? null });
                  },
                };
              },
            };
          },
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { client: client as any, calls };
}

describe("reconcileInvoiceOnPayment", () => {
  test("flips invoice.status to paid when sum covers amount_incl_vat", async () => {
    const { client, calls } = createMockClient({
      payment: { invoice_id: "inv-1" },
      invoice: { invoice_id: "inv-1", status: "issued", amount_incl_vat: 1000 },
      paymentsForInvoice: [{ amount: 1000 }],
    });
    const result = await reconcileInvoiceOnPayment(client, "pmt-1");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.invoice_settled).toBe(true);

    const updateCall = calls.find((c) => c.op === "update");
    expect(updateCall).toBeTruthy();
    const payload = updateCall!.payload as Record<string, unknown>;
    expect(payload["status"]).toBe("paid");
    expect(payload["paid_at"]).toBeTypeOf("string");
  });

  test("does NOT flip when invoice is already paid", async () => {
    const { client, calls } = createMockClient({
      payment: { invoice_id: "inv-1" },
      invoice: { invoice_id: "inv-1", status: "paid", amount_incl_vat: 1000 },
      paymentsForInvoice: [{ amount: 1000 }],
    });
    const result = await reconcileInvoiceOnPayment(client, "pmt-1");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.invoice_settled).toBe(false);

    const updateCall = calls.find((c) => c.op === "update");
    expect(updateCall).toBeUndefined();
  });

  test("does NOT flip when invoice is void", async () => {
    const { client, calls } = createMockClient({
      payment: { invoice_id: "inv-1" },
      invoice: { invoice_id: "inv-1", status: "void", amount_incl_vat: 1000 },
      paymentsForInvoice: [{ amount: 1000 }],
    });
    const result = await reconcileInvoiceOnPayment(client, "pmt-1");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.invoice_settled).toBe(false);
    expect(calls.find((c) => c.op === "update")).toBeUndefined();
  });

  test("does NOT flip when sum covers less than amount_incl_vat (partial payment)", async () => {
    const { client, calls } = createMockClient({
      payment: { invoice_id: "inv-1" },
      invoice: { invoice_id: "inv-1", status: "issued", amount_incl_vat: 1000 },
      paymentsForInvoice: [{ amount: 500 }],
    });
    const result = await reconcileInvoiceOnPayment(client, "pmt-1");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.invoice_settled).toBe(false);
    expect(calls.find((c) => c.op === "update")).toBeUndefined();
  });

  test("flips when cumulative payments just cross the threshold", async () => {
    const { client } = createMockClient({
      payment: { invoice_id: "inv-1" },
      invoice: { invoice_id: "inv-1", status: "overdue", amount_incl_vat: 1000 },
      paymentsForInvoice: [{ amount: 600 }, { amount: 400 }],
    });
    const result = await reconcileInvoiceOnPayment(client, "pmt-1");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.invoice_settled).toBe(true);
  });

  test("graceful when payment not found", async () => {
    const { client } = createMockClient({
      payment: null,
      invoice: null,
      paymentsForInvoice: [],
    });
    const result = await reconcileInvoiceOnPayment(client, "pmt-missing");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("payment_not_found");
  });
});
