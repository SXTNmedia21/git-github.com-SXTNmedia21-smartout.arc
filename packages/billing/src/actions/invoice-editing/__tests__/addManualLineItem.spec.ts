// addManualLineItem pure-action contract tests.
//
// Covers:
//   - Guard: rejects when invoice.status != 'draft'
//   - Insert payload shape (line_type='adjustment', usage_snapshot_id=null)
//   - Line totals are computed from (quantity, unit_price, vat_rate)
//   - Invoice totals are re-aggregated from the full line-item set
//
// Emit + auth testing lives at the web wrapper — this pure function
// has no direct telemetry dependency per the mobile-parity contract.

import { describe, expect, test } from "vitest";
import { addManualLineItem } from "../addManualLineItem";

// ─── Mock Supabase client ─────────────────────────────────────────
// Implements the exact chains addManualLineItem walks:
//   1. from("invoice").select().eq().maybeSingle()
//   2. from("invoice_line_item").insert().select("*").single()
//   3. from("invoice_line_item").select().eq()   (for recalc aggregate)
//   4. from("invoice").update().eq().select().single()
//
// Each call is recorded in `calls[]` so tests can assert shapes.

type Call = {
  table: string;
  op: "select" | "insert" | "update" | "delete";
  payload?: Record<string, unknown>;
  filters: Record<string, unknown>;
};

type MockState = {
  invoice: {
    status: "draft" | "issued" | "paid";
    invoice_id: string;
    amount_excl_vat?: number;
    vat_amount?: number;
    amount_incl_vat?: number;
  };
  existingLineItems: Array<{
    amount_excl_vat: number;
    vat_amount: number;
    amount_incl_vat: number;
  }>;
  insertResultRow?: Record<string, unknown>;
};

function createMockClient(state: MockState) {
  const calls: Call[] = [];
  const INVOICE_ID = state.invoice.invoice_id;

  const fromInvoice = () => {
    // The invoice table chain receives either a select-read (load
    // header) or an update (recalc totals). We dispatch on which
    // method the caller hits next.
    return {
      select(_cols: string) {
        return {
          eq(_col: string, _val: unknown) {
            return {
              async maybeSingle() {
                calls.push({ table: "invoice", op: "select", filters: { invoice_id: _val } });
                return {
                  data: {
                    invoice_id: state.invoice.invoice_id,
                    status: state.invoice.status,
                  },
                  error: null,
                };
              },
            };
          },
        };
      },
      update(payload: Record<string, unknown>) {
        calls.push({
          table: "invoice",
          op: "update",
          payload,
          filters: {},
        });
        return {
          eq(_col: string, val: unknown) {
            return {
              select() {
                return {
                  async single() {
                    return {
                      data: {
                        invoice_id: val,
                        amount_excl_vat: payload.amount_excl_vat,
                        vat_amount: payload.vat_amount,
                        amount_incl_vat: payload.amount_incl_vat,
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
  };

  const fromLineItem = () => {
    return {
      insert(row: Record<string, unknown>) {
        calls.push({
          table: "invoice_line_item",
          op: "insert",
          payload: row,
          filters: {},
        });
        // Mirror the row back as the DB would, with a generated uuid.
        const returned = {
          line_item_id: "00000000-0000-0000-0000-000000000099",
          ...row,
          ...(state.insertResultRow ?? {}),
        };
        return {
          select() {
            return {
              async single() {
                return { data: returned, error: null };
              },
            };
          },
        };
      },
      select(_cols: string) {
        return {
          async eq(col: string, val: unknown) {
            calls.push({
              table: "invoice_line_item",
              op: "select",
              filters: { [col]: val },
            });
            return { data: state.existingLineItems, error: null };
          },
        };
      },
    };
  };

  const client = {
    from(table: string) {
      if (table === "invoice") return fromInvoice();
      if (table === "invoice_line_item") return fromLineItem();
      throw new Error(`unexpected table ${table}`);
    },
  };
  void INVOICE_ID;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { client: client as any, calls };
}

describe("addManualLineItem", () => {
  test("refuses to add when invoice is not draft", async () => {
    const { client } = createMockClient({
      invoice: {
        status: "issued",
        invoice_id: "11111111-1111-1111-1111-111111111111",
      },
      existingLineItems: [],
    });

    const result = await addManualLineItem(client, {
      invoice_id: "11111111-1111-1111-1111-111111111111",
      description: "Manuell linje",
      quantity: 1,
      unit_price: 100,
      vat_rate: 25,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("invoice_not_draft");
  });

  test("inserts with line_type='adjustment' + usage_snapshot_id=null", async () => {
    const { client, calls } = createMockClient({
      invoice: {
        status: "draft",
        invoice_id: "11111111-1111-1111-1111-111111111111",
      },
      existingLineItems: [{ amount_excl_vat: 100, vat_amount: 25, amount_incl_vat: 125 }],
    });

    const result = await addManualLineItem(client, {
      invoice_id: "11111111-1111-1111-1111-111111111111",
      description: "Ekstra konsulent",
      quantity: 2,
      unit_price: 500,
      vat_rate: 25,
    });

    expect(result.ok).toBe(true);

    const insertCall = calls.find((c) => c.table === "invoice_line_item" && c.op === "insert");
    expect(insertCall).toBeTruthy();
    expect(insertCall!.payload).toMatchObject({
      invoice_id: "11111111-1111-1111-1111-111111111111",
      line_type: "adjustment",
      usage_snapshot_id: null,
      quantity: 2,
      unit_price: 500,
      vat_rate: 25,
      amount_excl_vat: 1000,
      vat_amount: 250,
      amount_incl_vat: 1250,
    });
  });

  test("recalculates invoice totals from the full line-item set", async () => {
    const { client, calls } = createMockClient({
      invoice: {
        status: "draft",
        invoice_id: "11111111-1111-1111-1111-111111111111",
      },
      // Simulating the state AFTER the insert: two lines returned.
      existingLineItems: [
        { amount_excl_vat: 100, vat_amount: 25, amount_incl_vat: 125 },
        { amount_excl_vat: 1000, vat_amount: 250, amount_incl_vat: 1250 },
      ],
    });

    const result = await addManualLineItem(client, {
      invoice_id: "11111111-1111-1111-1111-111111111111",
      description: "Ekstra konsulent",
      quantity: 2,
      unit_price: 500,
      vat_rate: 25,
    });

    expect(result.ok).toBe(true);

    const updateCall = calls.find((c) => c.table === "invoice" && c.op === "update");
    expect(updateCall).toBeTruthy();
    expect(updateCall!.payload).toMatchObject({
      amount_excl_vat: 1100,
      vat_amount: 275,
      amount_incl_vat: 1375,
    });
  });
});
