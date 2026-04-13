/**
 * ops-triage — DB-trigger-invoked event classifier and router.
 *
 * Invoked by a DB trigger on engine_event inserts. Classifies the event
 * by type, urgency, and alert tier, then routes notifications to the
 * appropriate recipients via the notification outbox.
 *
 * Auth: WATCHDOG_CRON_SECRET bearer token (trigger-invoked pattern).
 * ADR-0088: AI Operations Intelligence Phase 1 — TRIAGE function.
 */

import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── Classification types ──────────────────────────────────────────────

type AlertTier = "ambient" | "active" | "critical";
type Urgency = "immediate" | "next_break" | "end_of_shift" | "next_day";

type Classification = {
  type: "information" | "action_needed" | "deviation" | "emergency";
  urgency: Urgency;
  tier: AlertTier;
};

// ── Classification rules ──────────────────────────────────────────────

const CRITICAL_PATTERNS = [
  "temperature_violation",
  "no_show",
  "safety",
  "emergency",
];

const ACTIVE_PATTERNS = [
  "overdue",
  "deviation",
  "coverage_gap",
  "understaffing",
  "escalated",
];

function classify(eventType: string, payload: Record<string, unknown>): Classification {
  const type = eventType.toLowerCase();

  if (CRITICAL_PATTERNS.some((p) => type.includes(p)) || payload?.severity === "critical") {
    return { type: "emergency", urgency: "immediate", tier: "critical" };
  }

  if (ACTIVE_PATTERNS.some((p) => type.includes(p)) || payload?.severity === "high") {
    return { type: "action_needed", urgency: "next_break", tier: "active" };
  }

  if (type.includes("deviation") || type.includes("flagged")) {
    return { type: "deviation", urgency: "end_of_shift", tier: "active" };
  }

  return { type: "information", urgency: "next_day", tier: "ambient" };
}

// ── Handler ───────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const authHeader = req.headers.get("authorization");
  const cronSecret = Deno.env.get("WATCHDOG_CRON_SECRET");
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const body = await req.json();
    const eventType: string = body.event_type ?? "";
    const payload: Record<string, unknown> = body.payload ?? {};

    // Loop guard: skip system-origin events
    if (payload.origin === "system") {
      return new Response(JSON.stringify({ skipped: true, reason: "system_origin" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Skip ops.* events to prevent self-triage loops
    if (eventType.startsWith("ops.")) {
      return new Response(JSON.stringify({ skipped: true, reason: "ops_event" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const classification = classify(eventType, payload);

    // Only route active and critical events to notification outbox
    if (classification.tier !== "ambient") {
      const workspaceId = body.workspace_id ?? payload.workspace_id;
      if (workspaceId) {
        await supabase.from("notification").insert({
          workspace_id: workspaceId,
          title: `[${classification.tier.toUpperCase()}] ${eventType.replace(/[._]/g, " ")}`,
          body: JSON.stringify({ classification, event_type: eventType }),
          icon_type: classification.tier === "critical" ? "alert" : "info",
          priority: classification.tier === "critical" ? "critical" : "normal",
          target_type: "workspace",
          target_id: workspaceId,
        });
      }
    }

    // Log the triage result
    await supabase.from("engine_event").insert({
      workspace_id: body.workspace_id ?? payload.workspace_id,
      event_type: "ops.triage.classified",
      payload: {
        original_event: eventType,
        classification,
        origin: "system",
      },
    });

    return new Response(JSON.stringify({ classified: true, ...classification }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
