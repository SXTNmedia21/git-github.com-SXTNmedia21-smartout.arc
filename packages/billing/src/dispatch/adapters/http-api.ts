// HttpApiAdapter — generic outbound JSON POST with HMAC-SHA256 signature.
//
// The workspace configures a dispatch_rule with target:
//   { endpoint: "https://hooks.example.com/invoices",
//     signing_key_ref: "op://smartout_ai/http_dispatch_hmac/signing_key" }
//
// The op:// reference is resolved at RUNTIME on the Node side via env var
// lookup — we never store plaintext secrets in the DB. The adapter reads
// HTTP_DISPATCH_SIGNING_KEY from the environment (1Password injects this
// at process start via `op run`).
//
// Wire protocol:
//   POST {endpoint}
//   X-Smartout-Signature: sha256=<hex HMAC of body>
//   X-Smartout-Invoice-Dispatch-Id: <uuid>  (idempotency key per spec §Step 2)
//   Content-Type: application/json
//   Body: normalised invoice payload (spec §3.3)

import type {
  DispatchAdapter,
  DispatchInput,
  DispatchResult,
  TestConnectionResult,
} from "../types";

const DEFAULT_TIMEOUT_MS = 10_000;

type HttpApiTarget = {
  endpoint: string;
  /** Optional override of the env var name for the signing key. */
  signing_key_env?: string;
};

function parseTarget(target: Record<string, unknown>): HttpApiTarget | { error: string } {
  const endpoint = target["endpoint"];
  if (typeof endpoint !== "string" || !endpoint.startsWith("https://")) {
    return {
      error: "http_api target.endpoint must be an https:// URL string.",
    };
  }
  const signing_key_env =
    typeof target["signing_key_env"] === "string"
      ? (target["signing_key_env"] as string)
      : undefined;
  return { endpoint, signing_key_env };
}

function buildInvoicePayload(
  invoice: DispatchInput["invoice"],
  invoice_dispatch_id: string,
): Record<string, unknown> {
  // Keep this stable — external consumers depend on field names. If the
  // payload needs to evolve, bump a `version` field.
  return {
    version: 1,
    invoice_dispatch_id,
    invoice: {
      invoice_id: invoice.invoice_id,
      invoice_number: invoice.invoice_number ?? null,
      company_id: invoice.company_id,
      status: invoice.status,
      invoice_type: invoice.invoice_type,
      period_from: invoice.period_from,
      period_to: invoice.period_to,
      issued_at: invoice.issued_at ?? null,
      due_at: invoice.due_at ?? null,
      amount_excl_vat: invoice.amount_excl_vat,
      vat_amount: invoice.vat_amount,
      amount_incl_vat: invoice.amount_incl_vat,
      currency: invoice.currency,
    },
  };
}

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  // WebCrypto is available in Node >= 18 and in Deno. Keeps this module
  // runtime-agnostic (same binary works in Server Actions + Edge Functions
  // if a future refactor imports it there).
  const keyData = new TextEncoder().encode(secret);
  const msgData = new TextEncoder().encode(message);
  const key = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, msgData);
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export const HttpApiAdapter: DispatchAdapter = {
  channel: "http_api",

  async send(input: DispatchInput): Promise<DispatchResult> {
    const parsed = parseTarget(input.target);
    if ("error" in parsed) {
      return {
        status: "failed",
        error_code: "invalid_target",
        error_message: parsed.error,
        retryable: false,
      };
    }

    const secret = process.env[parsed.signing_key_env ?? "HTTP_DISPATCH_SIGNING_KEY"];
    if (!secret) {
      return {
        status: "failed",
        error_code: "signing_key_missing",
        error_message: `Signing key env var (${parsed.signing_key_env ?? "HTTP_DISPATCH_SIGNING_KEY"}) is not configured.`,
        retryable: false,
      };
    }

    const payload = buildInvoicePayload(input.invoice, input.invoice_dispatch_id);
    const body = JSON.stringify(payload);
    const signature = await hmacSha256Hex(secret, body);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(parsed.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Smartout-Signature": `sha256=${signature}`,
          "X-Smartout-Invoice-Dispatch-Id": input.invoice_dispatch_id,
        },
        body,
        signal: controller.signal,
      });
    } catch (error) {
      clearTimeout(timer);
      const isAbort =
        error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError");
      return {
        status: "failed",
        error_code: isAbort ? "timeout" : "network_error",
        error_message: error instanceof Error ? error.message : String(error),
        // Timeout + network errors are transient — safe to retry.
        retryable: true,
      };
    } finally {
      clearTimeout(timer);
    }

    if (response.status >= 200 && response.status < 300) {
      // Prefer the remote's id if it returns one; otherwise fall back to
      // the dispatch id so there is always a trace handle.
      let externalId = input.invoice_dispatch_id;
      try {
        const json = (await response.json()) as Record<string, unknown>;
        if (typeof json.id === "string") externalId = json.id;
      } catch {
        // Response was empty or non-JSON — fine, keep the fallback id.
      }
      return {
        status: "delivered",
        external_reference: externalId,
      };
    }

    let detail = "";
    try {
      detail = await response.text();
    } catch {
      detail = "";
    }

    // 429 and 5xx are transient; 4xx means the payload / endpoint is bad
    // and a retry loop would only amplify the failure.
    const retryable = response.status === 429 || response.status >= 500;

    return {
      status: "failed",
      error_code: `http_${response.status}`,
      error_message: detail.slice(0, 500) || `Remote responded with HTTP ${response.status}`,
      retryable,
    };
  },

  async testConnection(target: Record<string, unknown>): Promise<TestConnectionResult> {
    const parsed = parseTarget(target);
    if ("error" in parsed) {
      return { status: "error", message: parsed.error };
    }
    const secret = process.env[parsed.signing_key_env ?? "HTTP_DISPATCH_SIGNING_KEY"];
    if (!secret) {
      return {
        status: "error",
        message: `Signing key env var (${parsed.signing_key_env ?? "HTTP_DISPATCH_SIGNING_KEY"}) is not configured.`,
      };
    }

    // Actual round-trip to the endpoint is Fase 3 (spec §4.5 — "Test
    // connection" UI with 4 outcomes). In B2 we validate config only.
    return { status: "ok" };
  },
};
