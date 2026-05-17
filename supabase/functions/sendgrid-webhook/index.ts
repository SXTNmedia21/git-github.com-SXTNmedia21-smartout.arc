import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const WEBHOOK_VERIFICATION_KEY = Deno.env.get("SENDGRID_WEBHOOK_VERIFICATION_KEY");

type SendGridEvent = {
  email: string;
  event: string;
  timestamp: number;
  sg_message_id?: string;
  url?: string;
  reason?: string;
  type?: string;
  [key: string]: unknown;
};

/**
 * Verify SendGrid Event Webhook signature using ECDSA P-256 SHA-256.
 * The public key is base64-encoded SPKI format from SendGrid settings.
 * Payload = timestamp + rawBody (must be raw, not re-serialized JSON).
 */
async function verifySignature(
  publicKeyBase64: string,
  signature: string,
  timestamp: string,
  rawBody: string,
): Promise<boolean> {
  try {
    const keyDer = Uint8Array.from(atob(publicKeyBase64), (c) => c.charCodeAt(0));
    const cryptoKey = await crypto.subtle.importKey(
      "spki",
      keyDer,
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["verify"],
    );
    const payload = new TextEncoder().encode(timestamp + rawBody);
    const sig = Uint8Array.from(atob(signature), (c) => c.charCodeAt(0));
    return await crypto.subtle.verify(
      { name: "ECDSA", hash: { name: "SHA-256" } },
      cryptoKey,
      sig,
      payload,
    );
  } catch {
    return false;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  // Read raw body first (needed for both signature verification and parsing)
  const rawBody = await req.text();

  // Fail-closed: SENDGRID_WEBHOOK_VERIFICATION_KEY must always be present in production.
  // Missing env var → 500 (misconfigured), not a silent pass-through.
  // Audit finding H-02 (2026-05-06, slice 13): previous if (KEY) guard skipped verification
  // entirely when env var was absent, allowing anonymous writes to platform_email_suppression
  // and platform_communication_recipient.
  if (!WEBHOOK_VERIFICATION_KEY) {
    return new Response("service misconfigured", { status: 500 });
  }

  const signature = req.headers.get("x-twilio-email-event-webhook-signature");
  const timestamp = req.headers.get("x-twilio-email-event-webhook-timestamp");

  if (!signature || !timestamp) {
    return new Response("Missing signature headers", { status: 401 });
  }

  // F-WH-06: timestamp-window check (replay defense).
  // SendGrid's ECDSA verification confirms payload integrity but does NOT enforce a
  // timestamp window — a captured signed payload remains valid indefinitely. Reject
  // anything older than 5 minutes. Same window Stripe SDK enforces by default.
  const tsSeconds = Number(timestamp);
  if (!Number.isFinite(tsSeconds) || Math.abs(Date.now() / 1000 - tsSeconds) > 300) {
    return new Response("Stale signature", { status: 403 });
  }

  const isValid = await verifySignature(WEBHOOK_VERIFICATION_KEY, signature, timestamp, rawBody);
  if (!isValid) {
    return new Response("Invalid signature", { status: 403 });
  }

  let events: SendGridEvent[];
  try {
    events = JSON.parse(rawBody);
    if (!Array.isArray(events)) {
      return new Response("Expected array", { status: 400 });
    }
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const processedEvents: Array<{
    provider: string;
    event_type: string;
    email: string;
    sg_message_id: string | null;
    raw_payload: SendGridEvent;
    processed_at: string;
  }> = [];

  for (const event of events) {
    const { email, event: eventType, timestamp } = event;
    if (!email || !eventType) continue;

    const eventTime = new Date(timestamp * 1000).toISOString();
    const sgMessageId = event.sg_message_id ?? null;

    // F-WH-03: Idempotency gate for counter-mutating events (open, click).
    // Events without sg_message_id cannot be reliably deduped — log and skip counter mutation.
    // Events WITH sg_message_id: attempt upsert first; if the row already exists (duplicate delivery),
    // skip the counter increment to prevent double-counting.
    const isCounterEvent = eventType === "open" || eventType === "click";

    if (isCounterEvent && !sgMessageId) {
      console.warn(
        `[sendgrid-webhook] ${eventType} event missing sg_message_id — skipping counter update to prevent untracked duplicates`,
        { email, eventType },
      );
      // Still record in processedEvents for audit log (with null sg_message_id, won't dedup via index)
      processedEvents.push({
        provider: "sendgrid",
        event_type: eventType,
        email: email.toLowerCase(),
        sg_message_id: null,
        raw_payload: event,
        processed_at: eventTime,
      });
      continue;
    }

    // For counter events with sg_message_id: pre-check dedup via upsert-and-count.
    // We insert the webhook event row BEFORE processing — if it's a duplicate the upsert
    // returns count=0 (ignoreDuplicates=true), and we skip the counter mutation.
    if (isCounterEvent && sgMessageId) {
      const { count } = await supabase
        .from("platform_webhook_event")
        .upsert(
          {
            provider: "sendgrid",
            event_type: eventType,
            email: email.toLowerCase(),
            sg_message_id: sgMessageId,
            raw_payload: event,
            processed_at: eventTime,
          },
          { onConflict: "platform_webhook_event_provider_sg_msg_id_key", ignoreDuplicates: true, count: "exact" },
        );
      // count is null when ignoreDuplicates=true produces 0 affected rows (duplicate)
      const isNewEvent = (count ?? 0) > 0;

      if (!isNewEvent) {
        console.log(
          `[sendgrid-webhook] Duplicate ${eventType} for sg_message_id=${sgMessageId} — skipping counter update`,
        );
        // Event already logged; don't push to processedEvents again to avoid double upsert below
        continue;
      }

      // Event was new — already inserted above; track it to avoid double-push in bulk upsert
      // We add it to processedEvents so the count in the response is correct, but mark it as
      // pre-inserted so the bulk upsert at the end is a no-op for this row.
      processedEvents.push({
        provider: "sendgrid",
        event_type: eventType,
        email: email.toLowerCase(),
        sg_message_id: sgMessageId,
        raw_payload: event,
        processed_at: eventTime,
      });
    } else {
      // Non-counter event: collect for bulk upsert at the end (idempotent by their own nature)
      processedEvents.push({
        provider: "sendgrid",
        event_type: eventType,
        email: email.toLowerCase(),
        sg_message_id: sgMessageId,
        raw_payload: event,
        processed_at: eventTime,
      });
    }

    switch (eventType) {
      case "open": {
        // isNewEvent is guaranteed true here (duplicate path continued above)
        const { data: recipients } = await supabase
          .from("platform_communication_recipient")
          .select("recipient_id, communication_id, open_count, opened_at")
          .eq("email", email.toLowerCase())
          .order("created_at", { ascending: false })
          .limit(1);

        if (recipients?.[0]) {
          const r = recipients[0];
          await supabase
            .from("platform_communication_recipient")
            .update({
              opened_at: r.opened_at ?? eventTime,
              open_count: (r.open_count ?? 0) + 1,
            })
            .eq("recipient_id", r.recipient_id);

          await supabase.rpc("increment_communication_counter", {
            p_communication_id: r.communication_id,
            p_field: "opened_count",
          });
        }
        break;
      }

      case "click": {
        // isNewEvent is guaranteed true here (duplicate path continued above)
        const { data: recipients } = await supabase
          .from("platform_communication_recipient")
          .select("recipient_id, communication_id, click_count, clicked_at")
          .eq("email", email.toLowerCase())
          .order("created_at", { ascending: false })
          .limit(1);

        if (recipients?.[0]) {
          const r = recipients[0];
          await supabase
            .from("platform_communication_recipient")
            .update({
              clicked_at: r.clicked_at ?? eventTime,
              click_count: (r.click_count ?? 0) + 1,
            })
            .eq("recipient_id", r.recipient_id);

          await supabase.rpc("increment_communication_counter", {
            p_communication_id: r.communication_id,
            p_field: "clicked_count",
          });
        }
        break;
      }

      case "bounce":
      case "dropped": {
        const { data: recipients } = await supabase
          .from("platform_communication_recipient")
          .select("recipient_id")
          .eq("email", email.toLowerCase())
          .order("created_at", { ascending: false })
          .limit(1);

        if (recipients?.[0]) {
          await supabase
            .from("platform_communication_recipient")
            .update({
              status: "bounced",
              error_message: event.reason ?? `${eventType}: ${event.type ?? "unknown"}`,
            })
            .eq("recipient_id", recipients[0].recipient_id);
        }

        if (event.type === "bounce") {
          await supabase.from("platform_email_suppression").upsert(
            {
              email: email.toLowerCase(),
              reason: "bounce",
              source: "sendgrid_webhook",
            },
            { onConflict: "email" },
          );
        }
        break;
      }

      case "unsubscribe":
      case "spamreport": {
        await supabase.from("platform_email_suppression").upsert(
          {
            email: email.toLowerCase(),
            reason: eventType === "spamreport" ? "complaint" : "unsubscribe",
            source: "sendgrid_webhook",
          },
          { onConflict: "email" },
        );
        break;
      }

      case "delivered": {
        const { data: recipients } = await supabase
          .from("platform_communication_recipient")
          .select("recipient_id")
          .eq("email", email.toLowerCase())
          .eq("status", "sent")
          .order("created_at", { ascending: false })
          .limit(1);

        if (recipients?.[0]) {
          await supabase
            .from("platform_communication_recipient")
            .update({
              status: "delivered",
              delivered_at: eventTime,
            })
            .eq("recipient_id", recipients[0].recipient_id);
        }
        break;
      }
    }
  }

  // Bulk upsert remaining webhook events (non-counter events + pre-checked duplicates become no-ops).
  // Counter events with sg_message_id were already upserted individually above before their
  // counter mutations — the bulk upsert here is a no-op for those rows (ignoreDuplicates=true).
  if (processedEvents.length > 0) {
    await supabase
      .from("platform_webhook_event")
      .upsert(processedEvents, { onConflict: "platform_webhook_event_provider_sg_msg_id_key", ignoreDuplicates: true });
  }

  return new Response(JSON.stringify({ processed: processedEvents.length }), {
    headers: { "Content-Type": "application/json" },
  });
});
