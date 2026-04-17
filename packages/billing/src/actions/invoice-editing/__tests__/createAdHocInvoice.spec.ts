// createAdHocInvoice pure-action contract tests.
//
// Covers:
//   - invoice_type='one_off' is always set
//   - All line items have usage_snapshot_id=null + line_type='adjustment'
//   - Invoice totals aggregate across all lines
//   - Rejects empty line_items
//   - Guards missing company with a clear error

import { describe, expect, test } from "vitest";
import { createAdHocInvoice } from "../createAdHocInvoice";

type Call = {
  table: string;
  op: "select" | "insert" | "delete";
  payload?: unknown;
};

function createMockClient(opts: { companyExists: boolean }) {
  const calls: Call[] = [];
  const INVOICE_ID = "99999999-9999-9999-9999-999999999999";

  const client = {
    from(table: string) {
      if (table === "company") {
        return {
          select() {
            return {
              eq(_col: string, val: unknown) {
                return {
                  async maybeSingle() {
                    calls.push({ table: "company", op: "select" });
                    return {
                      data: opts.companyExists ? { company_id: val } : null,
                      error: null,
                    };
                  },
                };
              },
            };
          },
        };
      }

      if (table === "invoice") {
        return {
          insert(row: unknown) {
            calls.push({ table: "invoice", op: "insert", payload: row });
            return {
              select() {
                return {
                  async single() {
                    return {
                      data: {
                        ...(row as Record<string, unknown>),
                        invoice_id: INVOICE_ID,
                      },
                      error: null,
                    };
                  },
                };
              },
            };
          },
          delete() {
            return {
              eq(_col: string, _val: unknown) {
                calls.push({ table: "invoice", op: "delete" });
                return Promise.resolve({ data: null, error: null });
              },
            };
          },
        };
      }

      if (table === "invoice_line_item") {
        return {
          async insert(rows: unknown[]) {
            calls.push({ table: "invoice_line_item", op: "insert", payload: rows });
            return { data: null, error: null };
          },
        };
      }

      throw new Error(`unexpected table ${table}`);
    },
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { client: client as any, calls, INVOICE_ID };
}

describe("createAdHocInvoice", () => {
  test("rejects empty line_items upfront", async () => {
    const { client } = createMockClient({ companyExists: true });
    const result = await createAdHocInvoice(client, {
      company_id: "11111111-1111-1111-1111-111111111111",
      period_from: "2026-04-01",
      period_to: "2026-04-30",
      line_items: [],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("no_line_items");
  });

  test("rejects when company does not exist", async () => {
    const { client } = createMockClient({ companyExists: false });
    const result = await createAdHocInvoice(client, {
      company_id: "deadbeef-dead-beef-dead-beefdeadbeef",
      period_from: "2026-04-01",
      period_to: "2026-04-30",
      line_items: [{ description: "x", quantity: 1, unit_price: 100, vat_rate: 25 }],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("company_not_found");
  });

  test("sets invoice_type='one_off' and status='draft'", async () => {
    const { client, calls } = createMockClient({ companyExists: true });
    const result = await createAdHocInvoice(client, {
      company_id: "11111111-1111-1111-1111-111111111111",
      period_from: "2026-04-01",
      period_to: "2026-04-30",
      line_items: [{ description: "Setup fee", quantity: 1, unit_price: 5000, vat_rate: 25 }],
    });
    expect(result.ok).toBe(true);

    const insertCall = calls.find((c) => c.table === "invoice" && c.op === "insert");
    expect(insertCall).toBeTruthy();
    expect(insertCall!.payload).toMatchObject({
      invoice_type: "one_off",
      status: "draft",
      company_id: "11111111-1111-1111-1111-111111111111",
    });
  });

  test("aggregates totals across all lines", async () => {
    const { client, calls } = createMockClient({ companyExists: true });
    await createAdHocInvoice(client, {
      company_id: "11111111-1111-1111-1111-111111111111",
      period_from: "2026-04-01",
      period_to: "2026-04-30",
      line_items: [
        { description: "Setup", quantity: 1, unit_price: 5000, vat_rate: 25 },
        { description: "Consulting", quantity: 2, unit_price: 1000, vat_rate: 25 },
      ],
    });

    const insertCall = calls.find((c) => c.table === "invoice" && c.op === "insert");
    expect(insertCall!.payload).toMatchObject({
      amount_excl_vat: 7000,
      vat_amount: 1750,
      amount_incl_vat: 8750,
    });
  });

  test("every line_item has usage_snapshot_id=null + line_type='adjustment'", async () => {
    const { client, calls } = createMockClient({ companyExists: true });
    await createAdHocInvoice(client, {
      company_id: "11111111-1111-1111-1111-111111111111",
      period_from: "2026-04-01",
      period_to: "2026-04-30",
      line_items: [
        { description: "A", quantity: 1, unit_price: 100, vat_rate: 25 },
        { description: "B", quantity: 3, unit_price: 50, vat_rate: 15 },
      ],
    });

    const lineInsert = calls.find((c) => c.table === "invoice_line_item" && c.op === "insert");
    expect(lineInsert).toBeTruthy();
    const rows = lineInsert!.payload as Array<Record<string, unknown>>;
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row.usage_snapshot_id).toBeNull();
      expect(row.line_type).toBe("adjustment");
    }
  });
});
