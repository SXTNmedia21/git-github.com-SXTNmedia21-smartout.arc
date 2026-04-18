// refundPayment contract tests.
//
// Covers:
//   - Guard: payment.status not in refundable set → conflict
//   - Guard: amount > refundable balance → invalid_input
//   - Guard: amount omitted → defaults to full remaining refundable
//   - Happy path: calls Stripe.refunds.create with idempotency key
//   - Refund type: full vs partial classification
//   - Deliberate non-write: refunded_amount NOT updated by this function
//     (webhook is the single source of truth per ADR-0133)

import { describe, test, expect, beforeEach, vi } from "vitest";

const mockRefundsCreate = vi.fn();

vi.mock("stripe", () => {
  function StripeMock() {
    return {
      refunds: { create: mockRefundsCreate },
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

import { refundPayment } from "../refundPayment";

function makePayment(overrides: Record<string, unknown> = {}) {
  return {
    payment_id: "pmt-uuid-1",
    external_id: "pi_test_456",
    amount: 1000,
    currency: "NOK",
    status: "succeeded",
    refunded_amount: null,
    ...overrides,
  };
}

function createMockClient(opts: { payment: Record<string, unknown> | null }) {
  const calls: Array<{ op: string; table: string }> = [];
  const client = {
    from(table: string) {
      return {
        select(_cols: string) {
          return {
            eq(_col: string, _val: unknown) {
              return {
                async maybeSingle() {
                  calls.push({ op: "select", table });
                  return { data: opts.payment, error: null };
                },
              };
            },
          };
        },
        update(payload: Record<string, unknown>) {
          calls.push({ op: "update", table });
          return {
            eq: () => ({ data: payload, error: null }),
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
  mockRefundsCreate.mockReset();
});

describe("refundPayment", () => {
  test("rejects when payment not found", async () => {
    const { client } = createMockClient({ payment: null });
    const result = await refundPayment(client, {
      payment_id: "pmt-missing",
      reason: "duplicate",
      reason_detail: "Stripe duplicate charge reported",
      idempotency_key: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("payment_not_found");
  });

  test.each(["pending", "processing", "failed", "refunded"])(
    "rejects payment in non-refundable status '%s'",
    async (status) => {
      const { client } = createMockClient({ payment: makePayment({ status }) });
      const result = await refundPayment(client, {
        payment_id: "pmt-uuid-1",
        reason: "duplicate",
        reason_detail: "Automated Stripe refund test",
        idempotency_key: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toContain("payment_not_refundable");
    },
  );

  test("rejects when amount exceeds refundable balance", async () => {
    const { client } = createMockClient({
      payment: makePayment({ refunded_amount: 500 }), // 500 remaining
    });
    const result = await refundPayment(client, {
      payment_id: "pmt-uuid-1",
      amount: 600, // exceeds 500 remaining
      reason: "requested_by_customer",
      reason_detail: "Customer requested larger refund than allowed",
      idempotency_key: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("refund_exceeds_refundable");
  });

  test("full refund: amount omitted → defaults to full remaining balance", async () => {
    mockRefundsCreate.mockResolvedValueOnce({
      id: "re_test_999",
      amount: 100000,
    });
    const { client } = createMockClient({ payment: makePayment() });

    const result = await refundPayment(client, {
      payment_id: "pmt-uuid-1",
      reason: "fraudulent",
      reason_detail: "Confirmed fraudulent charge via Stripe",
      idempotency_key: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.refund_id).toBe("re_test_999");
      expect(result.data.refund_type).toBe("full");
      expect(result.data.refunded_amount).toBe(1000);
    }

    expect(mockRefundsCreate).toHaveBeenCalledOnce();
    const refundArgs = mockRefundsCreate.mock.calls[0]![0] as Record<string, unknown>;
    expect(refundArgs["amount"]).toBe(100000); // 1000 NOK → 100000 øre
    expect(refundArgs["payment_intent"]).toBe("pi_test_456");
    expect(refundArgs["reason"]).toBe("fraudulent");
    const refundOpts = mockRefundsCreate.mock.calls[0]![1] as Record<string, unknown>;
    expect(refundOpts["idempotencyKey"]).toBe("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
  });

  test("partial refund: amount < refundable → refund_type='partial'", async () => {
    mockRefundsCreate.mockResolvedValueOnce({ id: "re_partial_1", amount: 30000 });
    const { client } = createMockClient({ payment: makePayment() });

    const result = await refundPayment(client, {
      payment_id: "pmt-uuid-1",
      amount: 300,
      reason: "requested_by_customer",
      reason_detail: "Partial refund — customer keeps half the service",
      idempotency_key: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.refund_type).toBe("partial");
  });

  test("does NOT UPDATE payment.refunded_amount — webhook is SSoT", async () => {
    mockRefundsCreate.mockResolvedValueOnce({ id: "re_x", amount: 100000 });
    const { client, calls } = createMockClient({ payment: makePayment() });

    await refundPayment(client, {
      payment_id: "pmt-uuid-1",
      reason: "duplicate",
      reason_detail: "Testing no write-side-effect for ADR-0133",
      idempotency_key: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    });

    const updateCall = calls.find((c) => c.op === "update");
    expect(updateCall).toBeUndefined();
  });

  test("rejects when payment has no Stripe external_id", async () => {
    const { client } = createMockClient({
      payment: makePayment({ external_id: null }),
    });
    const result = await refundPayment(client, {
      payment_id: "pmt-uuid-1",
      reason: "duplicate",
      reason_detail: "Testing non-Stripe payment cannot be refunded",
      idempotency_key: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("payment_missing_stripe_reference");
  });
});
