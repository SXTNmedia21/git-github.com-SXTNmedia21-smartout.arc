// initiatePayment contract tests.
//
// Covers:
//   - Guard: rejects when invoice.status is not in ('issued','sent','overdue')
//   - Guard: rejects when invoice missing
//   - Happy path: inserts payment row with status='pending' + external_id
//     matches Stripe PaymentIntent id
//
// Stripe SDK is mocked — no real HTTP. The adapter itself is covered
// separately; this suite asserts the orchestration pure-function
// contract (status gate + DB INSERT + return shape).

import { describe, test, expect, beforeEach, vi } from "vitest";

// Mock Stripe before importing initiatePayment so the module-level
// import resolves to the mock.
const mockCreate = vi.fn();
const mockList = vi.fn();

vi.mock("stripe", () => {
  function StripeMock() {
    return {
      checkout: {
        sessions: {
          create: mockCreate,
          list: mockList,
        },
      },
    };
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (StripeMock as any).errors = {
    StripeError: class StripeError extends Error {
      type = "StripeError";
      code?: string;
    },
  };
  return { default: StripeMock };
});

import { initiatePayment } from "../initiatePayment";

// Minimal invoice fixture matching Invoice row shape.
function makeInvoice(overrides: Record<string, unknown> = {}) {
  return {
    invoice_id: "11111111-1111-1111-1111-111111111111",
    invoice_number: 42,
    company_id: "22222222-2222-2222-2222-222222222222",
    status: "issued",
    invoice_type: "recurring",
    period_from: "2026-04-01",
    period_to: "2026-04-30",
    amount_excl_vat: 100,
    vat_amount: 25,
    amount_incl_vat: 125,
    currency: "NOK",
    issued_at: "2026-05-01T00:00:00Z",
    due_at: "2026-05-15",
    paid_at: null,
    ...overrides,
  };
}

function createMockClient(opts: {
  invoice: Record<string, unknown> | null;
  existingPayment?: { payment_id: string } | null;
  insertReturns?: { payment_id: string } | null;
}) {
  const calls: Array<{ op: string; table: string; payload?: unknown }> = [];
  const client = {
    from(table: string) {
      return {
        select(_cols: string) {
          return {
            eq(_col: string, _val: unknown) {
              return {
                async maybeSingle() {
                  calls.push({ op: "select", table });
                  if (table === "invoice") return { data: opts.invoice, error: null };
                  if (table === "payment")
                    return { data: opts.existingPayment ?? null, error: null };
                  return { data: null, error: null };
                },
              };
            },
          };
        },
        insert(payload: Record<string, unknown>) {
          calls.push({ op: "insert", table, payload });
          return {
            select(_cols: string) {
              return {
                async single() {
                  return {
                    data: opts.insertReturns ?? { payment_id: "pmt-new-xyz" },
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { client: client as any, calls };
}

beforeEach(() => {
  // Stripe SDK needs SOMETHING present so getStripe() doesn't throw the
  // config-missing guard. The actual API key value is never used because
  // we vi.mock the entire module above.
  process.env["STRIPE_SECRET_KEY"] = "test-placeholder-value";
  process.env["NEXT_PUBLIC_APP_URL"] = "http://localhost:3060";
  mockCreate.mockReset();
  mockList.mockReset();
});

describe("initiatePayment", () => {
  test("rejects when invoice not found", async () => {
    const { client } = createMockClient({ invoice: null });
    const result = await initiatePayment(client, {
      invoice_id: "11111111-1111-1111-1111-111111111111",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("invoice_not_found");
  });

  test.each(["draft", "paid", "void", "uncollectible"])(
    "rejects when invoice status is '%s'",
    async (status) => {
      const { client } = createMockClient({ invoice: makeInvoice({ status }) });
      const result = await initiatePayment(client, {
        invoice_id: "11111111-1111-1111-1111-111111111111",
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toContain("invoice_not_payable");
    },
  );

  test("happy path: creates Checkout Session and inserts pending payment", async () => {
    mockCreate.mockResolvedValueOnce({
      id: "cs_test_123",
      url: "https://checkout.stripe.com/pay/cs_test_123",
      payment_intent: "pi_test_456",
    });
    const { client, calls } = createMockClient({
      invoice: makeInvoice(),
      insertReturns: { payment_id: "pmt-new-xyz" },
    });
    const result = await initiatePayment(client, {
      invoice_id: "11111111-1111-1111-1111-111111111111",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.payment_id).toBe("pmt-new-xyz");
      expect(result.data.checkout_url).toBe("https://checkout.stripe.com/pay/cs_test_123");
      expect(result.data.external_id).toBe("pi_test_456");
    }

    // Stripe was called with rounded cents (125 NOK → 12500).
    expect(mockCreate).toHaveBeenCalledOnce();
    const sessionArgs = mockCreate.mock.calls[0]![0] as Record<string, unknown>;
    const lineItems = sessionArgs["line_items"] as Array<Record<string, unknown>>;
    const priceData = lineItems[0]!["price_data"] as Record<string, unknown>;
    expect(priceData["unit_amount"]).toBe(12500);
    expect(priceData["currency"]).toBe("nok");

    // Idempotency key derived from invoice_id.
    const sessionOpts = mockCreate.mock.calls[0]![1] as Record<string, unknown>;
    expect(sessionOpts["idempotencyKey"]).toBe(
      "initiate-payment-11111111-1111-1111-1111-111111111111",
    );

    // payment row inserted with status='pending'.
    const insertCall = calls.find((c) => c.op === "insert" && c.table === "payment");
    expect(insertCall).toBeTruthy();
    const payload = insertCall!.payload as Record<string, unknown>;
    expect(payload["status"]).toBe("pending");
    expect(payload["external_id"]).toBe("pi_test_456");
    expect(payload["payment_method"]).toBe("stripe_card");
  });

  test("returns existing payment_id when Stripe idempotency returned the same Session", async () => {
    mockCreate.mockResolvedValueOnce({
      id: "cs_test_123",
      url: "https://checkout.stripe.com/pay/cs_test_123",
      payment_intent: "pi_test_456",
    });
    const { client, calls } = createMockClient({
      invoice: makeInvoice(),
      existingPayment: { payment_id: "pmt-existing-uuid" },
    });
    const result = await initiatePayment(client, {
      invoice_id: "11111111-1111-1111-1111-111111111111",
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.payment_id).toBe("pmt-existing-uuid");
    // No insert call because existing row was found first.
    const insertCall = calls.find((c) => c.op === "insert");
    expect(insertCall).toBeUndefined();
  });

  test("rejects when NEXT_PUBLIC_APP_URL falls back but STRIPE_SECRET_KEY is missing", async () => {
    delete process.env["STRIPE_SECRET_KEY"];
    const { client } = createMockClient({ invoice: makeInvoice() });
    const result = await initiatePayment(client, {
      invoice_id: "11111111-1111-1111-1111-111111111111",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("STRIPE_SECRET_KEY");
  });
});
