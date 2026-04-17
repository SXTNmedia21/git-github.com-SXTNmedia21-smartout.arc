// markInvoicePaidByWorkspaceAdmin pure-action contract tests.
//
// Covers:
//   - Guard: rejects when invoice.status != 'issued'
//   - Happy path: flips status to 'paid' + sets bank_transfer channel
//   - Race: UPDATE affects zero rows → invoice_status_changed error

import { describe, expect, test } from "vitest";
import { markInvoicePaidByWorkspaceAdmin } from "../markInvoicePaidByWorkspaceAdmin";

type Call = {
  table: string;
  op: "select" | "update";
  payload?: Record<string, unknown>;
};

function createMockClient(opts: {
  currentStatus: "draft" | "issued" | "paid" | "void" | null;
  updateReturns: "row" | "null";
}) {
  const calls: Call[] = [];
  const INVOICE_ID = "11111111-1111-1111-1111-111111111111";

  const client = {
    from(table: string) {
      if (table !== "invoice") throw new Error(`unexpected table ${table}`);

      return {
        select(_cols: string) {
          return {
            eq(_col: string, _val: unknown) {
              return {
                async maybeSingle() {
                  calls.push({ table, op: "select" });
                  if (opts.currentStatus === null) {
                    return { data: null, error: null };
                  }
                  return {
                    data: { invoice_id: INVOICE_ID, status: opts.currentStatus },
                    error: null,
                  };
                },
              };
            },
          };
        },
        update(payload: Record<string, unknown>) {
          calls.push({ table, op: "update", payload });
          return {
            eq(_col: string, _val: unknown) {
              return {
                eq(_col2: string, _val2: unknown) {
                  return {
                    select() {
                      return {
                        async maybeSingle() {
                          if (opts.updateReturns === "null") {
                            return { data: null, error: null };
                          }
                          return {
                            data: {
                              invoice_id: INVOICE_ID,
                              status: "paid",
                              ...payload,
                            },
                            error: null,
                          };
                        },
                      };
                    },
                  };
                },
              };
            },
          };
        },
      };
    },
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { client: client as any, calls, INVOICE_ID };
}

describe("markInvoicePaidByWorkspaceAdmin", () => {
  test("rejects when invoice status is not 'issued'", async () => {
    const { client, INVOICE_ID } = createMockClient({
      currentStatus: "paid",
      updateReturns: "row",
    });
    const result = await markInvoicePaidByWorkspaceAdmin(client, {
      invoice_id: INVOICE_ID,
      payment_date: "2026-04-15",
      payment_reference: "KID 12345",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("invoice_not_issued");
  });

  test("rejects when invoice is draft", async () => {
    const { client, INVOICE_ID } = createMockClient({
      currentStatus: "draft",
      updateReturns: "row",
    });
    const result = await markInvoicePaidByWorkspaceAdmin(client, {
      invoice_id: INVOICE_ID,
      payment_date: "2026-04-15",
      payment_reference: "KID 12345",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("invoice_not_issued");
  });

  test("rejects when invoice does not exist", async () => {
    const { client, INVOICE_ID } = createMockClient({
      currentStatus: null,
      updateReturns: "row",
    });
    const result = await markInvoicePaidByWorkspaceAdmin(client, {
      invoice_id: INVOICE_ID,
      payment_date: "2026-04-15",
      payment_reference: "KID 12345",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("invoice_not_found");
  });

  test("happy path: flips status to paid and hardcodes bank_transfer channel", async () => {
    const { client, calls, INVOICE_ID } = createMockClient({
      currentStatus: "issued",
      updateReturns: "row",
    });
    const result = await markInvoicePaidByWorkspaceAdmin(client, {
      invoice_id: INVOICE_ID,
      payment_date: "2026-04-15",
      payment_reference: "KID 12345",
    });
    expect(result.ok).toBe(true);

    const updateCall = calls.find((c) => c.op === "update");
    expect(updateCall).toBeTruthy();
    expect(updateCall!.payload).toMatchObject({
      status: "paid",
      payment_date: "2026-04-15",
      payment_reference: "KID 12345",
      payment_channel: "bank_transfer",
    });
    expect(updateCall!.payload!.paid_at).toBeTypeOf("string");
  });

  test("race: UPDATE affects zero rows → invoice_status_changed", async () => {
    const { client, INVOICE_ID } = createMockClient({
      currentStatus: "issued",
      updateReturns: "null",
    });
    const result = await markInvoicePaidByWorkspaceAdmin(client, {
      invoice_id: INVOICE_ID,
      payment_date: "2026-04-15",
      payment_reference: "KID 12345",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("invoice_status_changed");
  });
});
