/**
 * session-lifecycle — Cron-triggered session status transitions.
 *
 * Runs every 15 minutes. Handles time-based session transitions:
 * - upcoming → active: when NOW >= session_date + planned_open
 * - active → pending_signoff: when NOW >= session_date + planned_close
 * - upcoming → missed: when NOW > session_date + planned_close + 2h (never opened)
 *
 * Auth: WATCHDOG_CRON_SECRET bearer token (cron-only pattern).
 */

import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Combines a date string (YYYY-MM-DD) and a time string (HH:MM:SS or HH:MM)
 * into a UTC Date. Sessions use Europe/Oslo conceptually, but stored as UTC.
 */
function combineDateAndTime(dateStr: string, timeStr: string): Date {
  return new Date(`${dateStr}T${timeStr}`);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const authHeader = req.headers.get("authorization");
  const cronSecret = Deno.env.get("WATCHDOG_CRON_SECRET");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const now = new Date();
  const today = now.toISOString().split("T")[0]!;
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split("T")[0]!;

  const results = { opened: 0, pending_signoff: 0, missed: 0 };

  // 1. upcoming → active: session_date is today, NOW >= planned_open
  const { data: upcomingToday } = await supabase
    .from("department_session")
    .select(
      "department_session_id, workspace_id, department_id, session_date, planned_open, planned_close",
    )
    .eq("status", "upcoming")
    .eq("session_date", today)
    .not("planned_open", "is", null);

  for (const session of upcomingToday ?? []) {
    const openTime = combineDateAndTime(session.session_date, session.planned_open);
    if (now >= openTime) {
      const { error } = await supabase
        .from("department_session")
        .update({ status: "active", opened_at: now.toISOString() })
        .eq("department_session_id", session.department_session_id);
      if (!error) {
        results.opened++;
        // Emit engine event for downstream processes (ADR-0069)
        await supabase.from("engine_event").insert({
          workspace_id: session.workspace_id,
          event_type: "department_session.opened",
          payload: {
            department_session_id: session.department_session_id,
            department_id: session.department_id,
            session_date: session.session_date,
          },
        });
      }
    }
  }

  // 2. active → pending_signoff: NOW >= planned_close
  const { data: activeSessions } = await supabase
    .from("department_session")
    .select("department_session_id, workspace_id, department_id, session_date, planned_close")
    .eq("status", "active")
    .in("session_date", [today, yesterdayStr])
    .not("planned_close", "is", null);

  for (const session of activeSessions ?? []) {
    const closeTime = combineDateAndTime(session.session_date, session.planned_close);
    if (now >= closeTime) {
      // Emit fires via trg_session_pending_signoff on the UPDATE above.
      // Do NOT insert into engine_event inline here — ADR-0187.
      const { error } = await supabase
        .from("department_session")
        .update({ status: "pending_signoff" })
        .eq("department_session_id", session.department_session_id);
      if (!error) {
        results.pending_signoff++;
      }
    }
  }

  // 3. upcoming → missed: never opened, NOW > planned_close + 2h
  const { data: staleUpcoming } = await supabase
    .from("department_session")
    .select("department_session_id, workspace_id, department_id, session_date, planned_close")
    .eq("status", "upcoming")
    .in("session_date", [today, yesterdayStr])
    .not("planned_close", "is", null);

  for (const session of staleUpcoming ?? []) {
    const closeTime = combineDateAndTime(session.session_date, session.planned_close);
    const missedThreshold = new Date(closeTime);
    missedThreshold.setHours(missedThreshold.getHours() + 2);
    if (now > missedThreshold) {
      const { error } = await supabase
        .from("department_session")
        .update({ status: "missed" })
        .eq("department_session_id", session.department_session_id);
      if (!error) {
        results.missed++;
        // Emit engine event for missed session tracking (ADR-0069)
        await supabase.from("engine_event").insert({
          workspace_id: session.workspace_id,
          event_type: "department_session.missed",
          payload: {
            department_session_id: session.department_session_id,
            department_id: session.department_id,
            session_date: session.session_date,
          },
        });
      }
    }
  }

  return new Response(
    JSON.stringify({
      message: "Session lifecycle transitions complete",
      ...results,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
