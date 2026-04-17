// Adapter contract tests.
//
// Covers the three Fase 2 B2 adapters (email_customer, email_internal,
// http_api) against the DispatchResult discriminant:
//   2xx             → { status: 'delivered', external_reference }
//   4xx             → { status: 'failed', retryable: false }
//   429 + 5xx       → { status: 'failed', retryable: true }
//   network error   → { status: 'failed', retryable: true }
//   invalid target  → { status: 'failed', retryable: false }
//
// Mocks `fetch` via vi.stubGlobal — no real HTTP. Each test restores
// the stub so tests don't leak side-effects into siblings.

import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import { EmailCustomerAdapter } from "../dispatch/adapters/email-customer";
import { EmailInternalAdapter } from "../dispatch/adapters/email-internal";
import { HttpApiAdapter } from "../dispatch/adapters/http-api";
import type { DispatchInput, DispatchResult } from "../dispatch/types";

// ─── Fixtures ──────────────────────────────────────────────────────

// Only the fields the adapters read — keeps the test invoice tight
// and makes future schema additions opt-in (need to add them here
// explicitly for the test to see them).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function invoice(): any {
  return {
    invoice_id: "11111111-1111-1111-1111-111111111111",
    invoice_number: 42,
    company_id: "22222222-2222-2222-2222-222222222222",
    status: "issued",
    invoice_type: "recurring",
    period_from: "2026-04-01",
    period_to: "2026-04-30",
    issued_at: "2026-05-01T00:00:00Z",
    due_at: "2026-05-15",
    amount_excl_vat: "100.00",
    vat_amount: "25.00",
    amount_incl_vat: "125.00",
    currency: "NOK",
  };
}

function input(overrides: Partial<DispatchInput> = {}): DispatchInput {
  return {
    invoice: invoice(),
    target: { email: "customer@example.com" },
    template: null,
    invoice_dispatch_id: "33333333-3333-3333-3333-333333333333",
    ...overrides,
  };
}

// Restore env + fetch between tests.
const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  process.env.SENDGRID_API_KEY = "SG.test-key";
  process.env.HTTP_DISPATCH_SIGNING_KEY = "test-signing-key";
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

// ─── Helpers for classifying results ───────────────────────────────

function isDelivered(r: DispatchResult): r is Extract<DispatchResult, { status: "delivered" }> {
  return r.status === "delivered";
}
function isFailed(r: DispatchResult): r is Extract<DispatchResult, { status: "failed" }> {
  return r.status === "failed";
}

// ─── EmailCustomerAdapter ──────────────────────────────────────────

describe("EmailCustomerAdapter.send", () => {
  test("2xx → delivered with external_reference from SendGrid x-message-id", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response("", {
            status: 202,
            headers: { "x-message-id": "msg-abc-123" },
          }),
      ),
    );

    const result = await EmailCustomerAdapter.send(input());
    expect(result.status).toBe("delivered");
    if (isDelivered(result)) {
      expect(result.external_reference).toBe("msg-abc-123");
    }
  });

  test("400 → failed, retryable=false", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("Bad request: missing from", { status: 400 })),
    );

    const result = await EmailCustomerAdapter.send(input());
    expect(result.status).toBe("failed");
    if (isFailed(result)) {
      expect(result.retryable).toBe(false);
      expect(result.error_code).toBe("sendgrid_400");
    }
  });

  test("429 → failed, retryable=true", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("Rate limited", { status: 429 })),
    );

    const result = await EmailCustomerAdapter.send(input());
    expect(result.status).toBe("failed");
    if (isFailed(result)) expect(result.retryable).toBe(true);
  });

  test("500 → failed, retryable=true", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("Upstream outage", { status: 500 })),
    );

    const result = await EmailCustomerAdapter.send(input());
    expect(result.status).toBe("failed");
    if (isFailed(result)) expect(result.retryable).toBe(true);
  });

  test("network error → failed, retryable=true", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("getaddrinfo ENOTFOUND api.sendgrid.com");
      }),
    );

    const result = await EmailCustomerAdapter.send(input());
    expect(result.status).toBe("failed");
    if (isFailed(result)) {
      expect(result.retryable).toBe(true);
      expect(result.error_code).toBe("network_error");
    }
  });

  test("missing email target → failed, retryable=false (config error)", async () => {
    const result = await EmailCustomerAdapter.send(input({ target: { not_email: "x" } }));
    expect(result.status).toBe("failed");
    if (isFailed(result)) {
      expect(result.retryable).toBe(false);
      expect(result.error_code).toBe("invalid_target");
    }
  });

  test("missing SENDGRID_API_KEY → failed, retryable=false", async () => {
    delete process.env.SENDGRID_API_KEY;
    const result = await EmailCustomerAdapter.send(input());
    expect(result.status).toBe("failed");
    if (isFailed(result)) {
      expect(result.retryable).toBe(false);
      expect(result.error_code).toBe("sendgrid_not_configured");
    }
  });
});

// ─── EmailInternalAdapter ──────────────────────────────────────────
// Same SendGrid path — spot-check a single success path to prove the
// adapter is wired correctly. Failure paths are covered by the
// EmailCustomerAdapter suite since they share sendViaSendGrid().

describe("EmailInternalAdapter.send", () => {
  test("2xx → delivered (channel reports email_internal)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response("", {
            status: 202,
            headers: { "x-message-id": "msg-internal-1" },
          }),
      ),
    );

    expect(EmailInternalAdapter.channel).toBe("email_internal");
    const result = await EmailInternalAdapter.send(input());
    expect(result.status).toBe("delivered");
  });
});

// ─── HttpApiAdapter ────────────────────────────────────────────────

describe("HttpApiAdapter.send", () => {
  const httpTarget = {
    endpoint: "https://hooks.example.com/invoices",
  };

  test("2xx with { id } in response → delivered, id used", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ id: "ext-777" }), {
            status: 200,
            headers: { "content-type": "application/json" },
          }),
      ),
    );

    const result = await HttpApiAdapter.send(input({ target: httpTarget }));
    expect(result.status).toBe("delivered");
    if (isDelivered(result)) {
      expect(result.external_reference).toBe("ext-777");
    }
  });

  test("2xx without { id } → delivered, falls back to dispatch id", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 204 })),
    );

    const result = await HttpApiAdapter.send(input({ target: httpTarget }));
    expect(result.status).toBe("delivered");
    if (isDelivered(result)) {
      expect(result.external_reference).toBe("33333333-3333-3333-3333-333333333333");
    }
  });

  test("404 → failed, retryable=false", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("Not found", { status: 404 })),
    );

    const result = await HttpApiAdapter.send(input({ target: httpTarget }));
    expect(result.status).toBe("failed");
    if (isFailed(result)) {
      expect(result.retryable).toBe(false);
      expect(result.error_code).toBe("http_404");
    }
  });

  test("503 → failed, retryable=true", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("Down", { status: 503 })),
    );

    const result = await HttpApiAdapter.send(input({ target: httpTarget }));
    expect(result.status).toBe("failed");
    if (isFailed(result)) expect(result.retryable).toBe(true);
  });

  test("timeout → failed, retryable=true", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        const err = new Error("Aborted");
        err.name = "AbortError";
        throw err;
      }),
    );

    const result = await HttpApiAdapter.send(input({ target: httpTarget }));
    expect(result.status).toBe("failed");
    if (isFailed(result)) {
      expect(result.retryable).toBe(true);
      expect(result.error_code).toBe("timeout");
    }
  });

  test("non-https endpoint → failed, retryable=false", async () => {
    const result = await HttpApiAdapter.send(
      input({ target: { endpoint: "http://insecure.example.com" } }),
    );
    expect(result.status).toBe("failed");
    if (isFailed(result)) {
      expect(result.retryable).toBe(false);
      expect(result.error_code).toBe("invalid_target");
    }
  });

  test("missing signing key env → failed, retryable=false", async () => {
    delete process.env.HTTP_DISPATCH_SIGNING_KEY;
    const result = await HttpApiAdapter.send(input({ target: httpTarget }));
    expect(result.status).toBe("failed");
    if (isFailed(result)) {
      expect(result.retryable).toBe(false);
      expect(result.error_code).toBe("signing_key_missing");
    }
  });

  test("idempotency header carries the invoice_dispatch_id", async () => {
    let capturedHeaders: Headers | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: RequestInit) => {
        capturedHeaders = new Headers(init.headers as HeadersInit);
        return new Response("{}", { status: 200 });
      }),
    );

    await HttpApiAdapter.send(input({ target: httpTarget }));
    expect(capturedHeaders?.get("X-Smartout-Invoice-Dispatch-Id")).toBe(
      "33333333-3333-3333-3333-333333333333",
    );
    expect(capturedHeaders?.get("X-Smartout-Signature")).toMatch(/^sha256=[a-f0-9]{64}$/);
  });
});
