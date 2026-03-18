/**
 * push-dispatch — sends push notifications to mobile users via Expo Push API.
 *
 * Called from Postgres triggers (via pg_net) when events occur that warrant
 * user notification. Authenticated with PUSH_DISPATCH_SECRET bearer token
 * (not JWT — triggers don't have user context).
 *
 * Flow:
 * 1. Validate bearer token
 * 2. Fetch target profile's expo_push_token
 * 3. Send via Expo Push API
 * 4. For critical events: fall back to SMS via Twilio if no push token
 */
import { createClient } from "jsr:@supabase/supabase-js@2";
import { sendSms } from "../_shared/twilio.ts";
import { corsHeaders } from "../_shared/cors.ts";

/** Events that warrant SMS fallback when push token is unavailable */
const CRITICAL_EVENTS = new Set(["shift_confirmation_reminder", "deviation_reported"]);

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

type ExpoPushMessage = {
  to: string;
  title: string;
  body: string;
  sound: "default";
  priority: "high" | "normal";
  data?: Record<string, string>;
  channelId?: string;
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Validate bearer token — this function is called from DB triggers, not users
  const expectedSecret = Deno.env.get("PUSH_DISPATCH_SECRET");
  if (!expectedSecret) {
    console.error("PUSH_DISPATCH_SECRET not configured");
    return new Response(JSON.stringify({ error: "Server misconfigured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const authHeader = req.headers.get("Authorization");
  const token = authHeader?.replace("Bearer ", "");

  if (token !== expectedSecret) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Parse and validate request body
  let body: PushRequest;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { event, profile_id, workspace_id, payload } = body;
  if (!event || !profile_id || !workspace_id || !payload?.title || !payload?.body) {
    return new Response(
      JSON.stringify({
        error:
          "Missing required fields: event, profile_id, workspace_id, payload.title, payload.body",
      }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // Create Supabase admin client to fetch profile data
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Fetch the target profile's push token
  const { data: profile, error: profileError } = await supabase
    .from("profile")
    .select("expo_push_token, user_id")
    .eq("id", profile_id)
    .eq("workspace_id", workspace_id)
    .single();

  if (profileError || !profile) {
    console.error("Profile not found:", profile_id, profileError?.message);
    return new Response(JSON.stringify({ error: "Profile not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const pushToken = profile.expo_push_token;
  const isCritical = CRITICAL_EVENTS.has(event);

  // If no push token, attempt SMS fallback for critical events
  if (!pushToken) {
    if (isCritical) {
      await attemptSmsFallback(supabase, profile.user_id, payload.body);
    }
    return new Response(
      JSON.stringify({
        sent: false,
        reason: pushToken ? undefined : "no_push_token",
        sms_fallback: isCritical,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // Build Expo push message
  const message: ExpoPushMessage = {
    to: pushToken,
    title: payload.title,
    body: payload.body,
    sound: "default",
    priority: isCritical ? "high" : "normal",
    data: {
      event,
      ...payload.data,
    },
    channelId: "default",
  };

  // Send via Expo Push API
  try {
    const expoRes = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(message),
    });

    const expoData = await expoRes.json();

    if (!expoRes.ok) {
      console.error("Expo Push API error:", expoData);

      // If push fails for critical event, try SMS
      if (isCritical) {
        await attemptSmsFallback(supabase, profile.user_id, payload.body);
      }

      return new Response(
        JSON.stringify({ sent: false, error: "Expo API error", details: expoData }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Check for ticket-level errors (e.g., DeviceNotRegistered)
    const ticket = expoData?.data;
    if (ticket?.status === "error") {
      console.warn("Expo push ticket error:", ticket.message, "details:", ticket.details);

      // Clear invalid token so we don't keep trying
      if (ticket.details?.error === "DeviceNotRegistered") {
        await supabase.from("profile").update({ expo_push_token: null }).eq("id", profile_id);
      }
    }

    return new Response(JSON.stringify({ sent: true, ticket }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("Failed to send push:", msg);

    if (isCritical) {
      await attemptSmsFallback(supabase, profile.user_id, payload.body);
    }

    return new Response(JSON.stringify({ sent: false, error: msg }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
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
