// Shared SendGrid client used by EmailCustomerAdapter + EmailInternalAdapter.
//
// Deliberately thin: one function that POSTs a minimal mail/send payload
// and classifies the response per ADR-0128 dual-write expectations and
// the DispatchResult discriminant. Adapters own the template rendering
// and target validation — this function owns the HTTP concern.
//
// Environment:
//   - SENDGRID_API_KEY      — required to send (fail-fast if missing)
//   - SENDGRID_SENDER_EMAIL — optional override; falls back to
//                             "hello@smartout.no" when unset
//
// Retry semantics per mission §Step 2:
//   - 2xx (including 202)  → delivered; external_reference = message_id
//   - 4xx                  → failed, retryable=false
//   - 429 / 5xx            → failed, retryable=true
//   - network error        → failed, retryable=true

import type { DispatchResult } from "../types";

const SENDGRID_ENDPOINT = "https://api.sendgrid.com/v3/mail/send";

export type SendGridInput = {
  to: string;
  subject: string;
  html: string;
  /** Override the default sender email. Adapter reads template metadata. */
  from?: string;
  /** Human-readable sender name (falls back to "Smartout"). */
  fromName?: string;
  /** For observability + SendGrid custom-args mapping. */
  invoiceDispatchId: string;
};

function resolveSender(explicit?: string): { email: string; name: string } {
  const email = explicit ?? process.env.SENDGRID_SENDER_EMAIL ?? "hello@smartout.no";
  return { email, name: "Smartout" };
}

function extractMessageId(headers: Headers): string {
  // SendGrid puts the message id in `x-message-id` on 202 accepted.
  return headers.get("x-message-id") ?? headers.get("X-Message-Id") ?? "";
}

export async function sendViaSendGrid(input: SendGridInput): Promise<DispatchResult> {
  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) {
    return {
      status: "failed",
      error_code: "sendgrid_not_configured",
      error_message: "SENDGRID_API_KEY is not set. Configure the SendGrid env var before retrying.",
      // Not retryable — pure config issue; a dispatch retry will hit the
      // same missing key. Operator must fix the env.
      retryable: false,
    };
  }

  const sender = resolveSender(input.from);

  let response: Response;
  try {
    response = await fetch(SENDGRID_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: input.to }] }],
        from: { email: sender.email, name: input.fromName ?? sender.name },
        subject: input.subject,
        content: [{ type: "text/html", value: input.html }],
        // Custom args land on SendGrid webhooks; lets us reconcile back
        // to the invoice_dispatch row without grepping the body.
        custom_args: {
          invoice_dispatch_id: input.invoiceDispatchId,
        },
      }),
    });
  } catch (error) {
    return {
      status: "failed",
      error_code: "network_error",
      error_message: error instanceof Error ? error.message : String(error),
      retryable: true,
    };
  }

  const messageId = extractMessageId(response.headers);

  if (response.status >= 200 && response.status < 300) {
    return {
      status: "delivered",
      external_reference: messageId || `sendgrid-${input.invoiceDispatchId}`,
    };
  }

  // Read body for the error message — SendGrid returns JSON with errors[].
  let detail = "";
  try {
    detail = await response.text();
  } catch {
    detail = "";
  }

  // 429 and 5xx are transient — engine_state retry loop should try again.
  const retryable = response.status === 429 || response.status >= 500;

  return {
    status: "failed",
    error_code: `sendgrid_${response.status}`,
    error_message: detail.slice(0, 500) || `SendGrid returned HTTP ${response.status}`,
    retryable,
  };
}
