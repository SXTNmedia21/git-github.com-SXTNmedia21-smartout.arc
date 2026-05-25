/**
 * push-dispatch — sends push notifications via OneSignal (ADR-0389).
 *
 * Called over HTTP by process-notifications (cron fan-out) with a
 * PUSH_DISPATCH_SECRET bearer token. Targets OneSignal by External ID
 * (= profile_id; set client-side via OneSignal.login). For critical
 * events with no subscribed device (OneSignal recipients = 0), falls
 * back to SMS via Twilio. Deep link rides the OneSignal `url` field.
 */
import { createClient } from "jsr:@supabase/supabase-js@2";
import { sendSms } from "../_shared/twilio.ts";
import { sendOneSignalPush } from "../_shared/onesignal.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

/** Events that warrant SMS fallback when push token is unavailable */
const CRITICAL_EVENTS = new Set([
  "shift_confirmation_reminder",
  "deviation_reported",
  "contract.signed",
  "contract.expired",
]);

type PushRequest = {
  event: string;
  profile_id: string;
  workspace_id: string;
  payload: {
    title: string;
    body: string;
    data?: Record<string, string>;
  };
};


Deno.serve(async (req) => {
  const cors = getCorsHeaders(req);
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  // Validate bearer token — this function is called from DB triggers, not users
  const expectedSecret = Deno.env.get("PUSH_DISPATCH_SECRET");
  if (!expectedSecret) {
    console.error("PUSH_DISPATCH_SECRET not configured");
    return new Response(JSON.stringify({ error: "Server misconfigured" }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const authHeader = req.headers.get("Authorization");
  const token = authHeader?.replace("Bearer ", "");

  if (token !== expectedSecret) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  // Parse and validate request body
  let body: PushRequest;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const { event, profile_id, workspace_id, payload } = body;
  if (!event || !profile_id || !workspace_id || !payload?.title || !payload?.body) {
    return new Response(
      JSON.stringify({
        error:
          "Missing required fields: event, profile_id, workspace_id, payload.title, payload.body",
      }),
      { status: 400, headers: { ...cors, "Content-Type": "application/json" } },
    );
  }

  // Create Supabase admin client to fetch profile data
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Fetch the target profile's user_id (for SMS fallback lookup)
  const { data: profile, error: profileError } = await supabase
    .from("profile")
    .select("user_id")
    .eq("profile_id", profile_id)
    .eq("workspace_id", workspace_id)
    .single();

  if (profileError || !profile) {
    console.error("Profile not found:", profile_id, profileError?.message);
    return new Response(JSON.stringify({ error: "Profile not found" }), {
      status: 404,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const isCritical = CRITICAL_EVENTS.has(event);

  // Build the deep link (absolute PWA URL) from action_url, if present
  const actionUrl = payload.data?.action_url;
  const deepLinkBase = Deno.env.get("ONESIGNAL_DEEP_LINK_BASE") ?? "";
  const url = actionUrl ? `${deepLinkBase}${actionUrl}` : undefined;

  const appId = Deno.env.get("ONESIGNAL_APP_ID");
  const restApiKey = Deno.env.get("ONESIGNAL_REST_API_KEY");
  if (!appId || !restApiKey) {
    console.error("OneSignal not configured");
    return new Response(JSON.stringify({ error: "Server misconfigured" }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const result = await sendOneSignalPush({
    appId,
    restApiKey,
    externalIds: [profile_id],
    title: payload.title,
    body: payload.body,
    url,
    data: { event, ...payload.data },
  });

  // No subscribed device (or send failed) → SMS fallback for critical events
  if ((!result.ok || result.recipients === 0) && isCritical) {
    await attemptSmsFallback(supabase, profile.user_id, payload.body);
  }

  return new Response(
    JSON.stringify({
      sent: result.ok && result.recipients > 0,
      recipients: result.recipients,
      sms_fallback: isCritical && (!result.ok || result.recipients === 0),
      error: result.error,
    }),
    { status: 200, headers: { ...cors, "Content-Type": "application/json" } },
  );
});

/**
 * Attempt to send an SMS as fallback for critical events.
 * Looks up the user's phone number from user_identity.
 */
async function attemptSmsFallback(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  messageBody: string,
): Promise<void> {
  try {
    const { data: identity } = await supabase
      .from("user_identity")
      .select("phone")
      .eq("user_id", userId)
      .single();

    if (identity?.phone) {
      const result = await sendSms(identity.phone, messageBody);
      if (!result.success) {
        console.warn("SMS fallback failed:", result.error);
      }
    } else {
      console.warn("No phone number for SMS fallback, user:", userId);
    }
  } catch (error) {
    console.warn("SMS fallback error:", error);
  }
}
