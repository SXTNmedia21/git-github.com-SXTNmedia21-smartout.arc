import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const WEBHOOK_SECRET = Deno.env.get("SENDGRID_WEBHOOK_VERIFICATION_KEY");

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

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  // Verify webhook signature
  const signature = req.headers.get("x-twilio-email-event-webhook-signature");
  if (WEBHOOK_SECRET && !signature) {
    return new Response("Missing signature", { status: 401 });
  }

  let events: SendGridEvent[];
  try {
    events = await req.json();
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
    raw_payload: SendGridEvent;
    processed_at: string;
  }> = [];

  for (const event of events) {
    const { email, event: eventType, timestamp } = event;
    if (!email || !eventType) continue;

    const eventTime = new Date(timestamp * 1000).toISOString();

    processedEvents.push({
      provider: "sendgrid",
      event_type: eventType,
      email: email.toLowerCase(),
      raw_payload: event,
      processed_at: eventTime,
    });

    switch (eventType) {
      case "open": {
        const { data: recipients } = await supabase
          .from("platform_communication_recipient")
          .select("recipient_id, communication_id, open_count")
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

  // Bulk insert webhook events
  if (processedEvents.length > 0) {
    await supabase.from("platform_webhook_event").insert(processedEvents);
  }

  return new Response(JSON.stringify({ processed: processedEvents.length }), {
    headers: { "Content-Type": "application/json" },
  });
});
