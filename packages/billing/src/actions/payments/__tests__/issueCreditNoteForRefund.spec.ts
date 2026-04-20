// issueCreditNoteForRefund contract tests — ADR-0142 auto credit-note.
//
// Covers:
//   - Full refund: mirrors original invoice amounts exactly
//   - Partial refund: single synthetic "Delvis refusjon" line with
//     correct VAT split
//   - credits_invoice_id FK set to the original invoice
//   - invoice_type='credit_note', status='issued'
//   - Amounts stored POSITIVE per ADR-0120 §8 (not negative)
//   - Rejects nesting (credit-of-credit-note)
//   - void_reason captures Stripe refund id for audit

import { describe, test, expect } from "vitest";
import { issueCreditNoteForRefund } from "../issueCreditNoteForRefund";

function makeOriginal(overrides: Record<string, unknown> = {}) {
  return {
    invoice_id: "inv-original-uuid",
    company_id: "cmp-1",
    invoice_type: "recurring",
    period_from: "2026-04-01",
    period_to: "2026-04-30",
    currency: "NOK",
    delivery_channel: "manual",
    vat_rate: 25,
    amount_excl_vat: 100,
    vat_amount: 25,
    amount_incl_vat: 125,
    ...overrides,
  };
}

function createMockClient(opts: {
  original: Record<string, unknown> | null;
  originalLines?: Array<Record<string, unknown>>;
  insertCreditNoteReturns?: { invoice_id: string; invoice_number: number | null } | null;
}) {
  const calls: Array<{ op: string; table: string; payload?: unknown }> = [];
  const client = {
    from(table: string) {
      return {
        select(_cols: string) {
          return {
            eq(_col: string, _val: unknown) {
              calls.push({ op: "select", table });
              return {
                async maybeSingle() {
                  if (table === "invoice") return { data: opts.original, error: null };
                  return { data: null, error: null };
                },
                // For invoice_line_item select flow
                data: opts.originalLines ?? [],
                error: null,
                then(resolve: (v: unknown) => unknown) {
                  if (table === "invoice_line_item") {
                    return resolve({ data: opts.originalLines ?? [], error: null });
                  }
                  return resolve({ data: [], error: null });
                },
              };
            },
          };
        },
        insert(payload: Record<string, unknown> | Array<Record<string, unknown>>) {
          calls.push({ op: "insert", table, payload });
          if (table === "invoice") {
            return {
              select(_cols: string) {
                return {
                  async maybeSingle() {
                    return {
                      data: opts.insertCreditNoteReturns ?? {
                        invoice_id: "cn-uuid-1",
                        invoice_number: 1001,
                      },
                      error: null,
                    };
                  },
                };
              },
            };
          }
          // invoice_line_item insert returns void
          return Promise.resolve({ error: null });
        },
      };
    },
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { client: client as any, calls };
}

describe("issueCreditNoteForRefund — full refund", () => {
  test("creates credit-note with mirror of original amounts (positive, not negative)", async () => {
    const { client, calls } = createMockClient({
      original: makeOriginal(),
      originalLines: [
        {
          description: "Månedlig abonnement april 2026",
          line_type: "base_plan",
          quantity: 1,
          unit_price: 100,
          vat_rate: 25,
          addon_key: null,
          period_reference: "2026-04",
        },
      ],
    });

    const result = await issueCreditNoteForRefund(client, {
      original_invoice_id: "inv-original-uuid",
      refund_amount: 125,
      stripe_refund_id: "re_test_full",
      is_full_refund: true,
    });

    expect(result.ok).toBe(true);

    // Credit-note row insert
    const cnInsert = calls.find((c) => c.op === "insert" && c.table === "invoice");
    expect(cnInsert).toBeTruthy();
    const cnPayload = cnInsert!.payload as Record<string, unknown>;
    expect(cnPayload["invoice_type"]).toBe("credit_note");
    expect(cnPayload["status"]).toBe("issued");
    expect(cnPayload["credits_invoice_id"]).toBe("inv-original-uuid");
    // Amounts positive per ADR-0120 §8 — not negative.
    expect(cnPayload["amount_incl_vat"]).toBe(125);
    expect(cnPayload["amount_excl_vat"]).toBe(100);
    expect(cnPayload["vat_amount"]).toBe(25);
    // void_reason captures Stripe refund id
    expect(cnPayload["void_reason"]).toContain("stripe_full_refund");
    expect(cnPayload["void_reason"]).toContain("re_test_full");
    // Period mirrored
    expect(cnPayload["period_from"]).toBe("2026-04-01");
    expect(cnPayload["period_to"]).toBe("2026-04-30");
  });
});

describe("issueCreditNoteForRefund — partial refund", () => {
  test("single 'Delvis refusjon' line with refund_amount + computed VAT split", async () => {
    const { client, calls } = createMockClient({
      original: makeOriginal(),
    });

    const result = await issueCreditNoteForRefund(client, {
      original_invoice_id: "inv-original-uuid",
      refund_amount: 50,
      stripe_refund_id: "re_test_partial",
      is_full_refund: false,
    });

    expect(result.ok).toBe(true);

    const cnInsert = calls.find((c) => c.op === "insert" && c.table === "invoice");
    const cnPayload = cnInsert!.payload as Record<string, unknown>;
    expect(cnPayload["amount_incl_vat"]).toBe(50);
    // 50 incl @ 25% = 40 excl + 10 vat
    expect(cnPayload["amount_excl_vat"]).toBe(40);
    expect(cnPayload["vat_amount"]).toBe(10);
    expect(cnPayload["void_reason"]).toContain("stripe_partial_refund");
    expect(cnPayload["void_reason"]).toContain("re_test_partial");

    // Line item with 'Delvis refusjon' prefix
    const lineInsert = calls.find((c) => c.op === "insert" && c.table === "invoice_line_item");
    expect(lineInsert).toBeTruthy();
    const linePayload = lineInsert!.payload as Record<string, unknown>;
    expect(linePayload["description"]).toContain("Delvis refusjon");
    expect(linePayload["description"]).toContain("re_test_partial");
    expect(linePayload["line_type"]).toBe("adjustment");
  });
});

describe("issueCreditNoteForRefund — guards", () => {
  test("rejects nested credit-note (original is already a credit_note)", async () => {
    const { client } = createMockClient({
      original: makeOriginal({ invoice_type: "credit_note" }),
    });

    const result = await issueCreditNoteForRefund(client, {
      original_invoice_id: "inv-original-uuid",
      refund_amount: 125,
      stripe_refund_id: "re_test",
      is_full_refund: true,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("cannot_credit_a_credit_note");
  });

  test("rejects when original invoice not found", async () => {
    const { client } = createMockClient({ original: null });
    const result = await issueCreditNoteForRefund(client, {
      original_invoice_id: "missing",
      refund_amount: 100,
      stripe_refund_id: "re_test",
      is_full_refund: true,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("original_invoice_not_found");
  });
});
