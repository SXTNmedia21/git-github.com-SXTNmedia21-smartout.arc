// ============================================
// webhook-sender.ts
// Async webhook notification system for session events.
// Fires POST requests to callback_url with exponential backoff retry.
// Fire-and-forget — never blocks the response to the agent.
// Connected to: BREAKDOWN.md Epic 5.3
// ============================================

/** Webhook event types sent to callback URLs */
export type WebhookEvent =
  | "session.started"
  | "stage.changed"
  | "stage.progress"
  | "session.completed"
  | "session.abandoned";

/** Payload sent with webhook events */
export type WebhookPayload = {
  event: WebhookEvent;
  session_id: string;
  stage_id?: string;
  progress?: string;
  collected_data?: Record<string, unknown>;
  timestamp: string;
};

/**
 * Sends a webhook notification to the callback URL.
 * Uses exponential backoff: 3 attempts at 1s, 4s, 16s intervals.
 * Fire-and-forget — errors are logged but never thrown.
 *
 * @param callbackUrl - The URL to POST to
 * @param payload - The event payload
 */
export function sendWebhook(callbackUrl: string, payload: WebhookPayload): void {
  // Fire and forget — don't await
  fireWithRetry(callbackUrl, payload).catch((err) => {
    console.error(`[webhook] All retries failed for ${callbackUrl}:`, err.message);
  });
}

/**
 * Internal: attempts to POST the payload with exponential backoff.
 * 3 total attempts with delays: 1s after first failure, 4s after second.
 */
async function fireWithRetry(url: string, payload: WebhookPayload): Promise<void> {
  const maxAttempts = 3;
  const delays = [1000, 4000, 16000];

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10000),
      });

      if (res.ok) {
        console.log(`[webhook] Delivered ${payload.event} to ${url}`);
        return;
      }

      console.warn(`[webhook] Attempt ${attempt + 1}/${maxAttempts} failed: HTTP ${res.status}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "unknown error";
      console.warn(`[webhook] Attempt ${attempt + 1}/${maxAttempts} error: ${message}`);
    }

    // Wait before retry (skip wait after last attempt)
    if (attempt < delays.length) {
      await new Promise((r) => setTimeout(r, delays[attempt]));
    }
  }
}
