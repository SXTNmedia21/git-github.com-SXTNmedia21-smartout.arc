/**
 * ops-day-brief — Cron-triggered Day Brief compiler.
 *
 * Runs daily at 05:00 UTC (07:00 Oslo). For each workspace with an active
 * season, queries all departments with sessions today and compiles a
 * Day Brief for each. Inserts a notification per department with the brief.
 *
 * Auth: WATCHDOG_CRON_SECRET bearer token (cron-only pattern).
 * ADR-0088: AI Operations Intelligence Phase 1 — COMPILE Day Brief.
 */

import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

  try {
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

    // Find all department_sessions for today across all workspaces
    const { data: sessions, error: sessionsError } = await supabase
      .from("department_session")
      .select("department_session_id, workspace_id, department_id, planned_open, planned_close, department:department_id(name)")
      .eq("session_date", today)
      .in("status", ["upcoming", "active"]);

    if (sessionsError) throw sessionsError;
    if (!sessions || sessions.length === 0) {
      return new Response(JSON.stringify({ compiled: 0, message: "No sessions today" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let compiled = 0;

    for (const session of sessions) {
      // Parallel: handoff, shifts, pending tasks, deviations
      const [handoff, shifts, tasks, deviations] = await Promise.all([
        supabase
          .from("department_session")
          .select("handoff_notes, status")
          .eq("workspace_id", session.workspace_id)
          .eq("department_id", session.department_id)
          .eq("session_date", yesterday)
          .limit(1)
          .maybeSingle(),

        supabase
          .from("schedule_shift")
          .select("employee_id, role, start_time, end_time")
          .eq("workspace_id", session.workspace_id)
          .eq("department_id", session.department_id)
          .eq("shift_date", today)
          .in("status", ["published", "confirmed"])
          .order("start_time", { ascending: true }),

        supabase
          .from("session_task")
          .select("title, priority")
          .eq("workspace_id", session.workspace_id)
          .eq("department_session_id", session.department_session_id)
          .eq("status", "pending")
          .eq("priority", "critical")
          .limit(5),

        supabase
          .from("deviation")
          .select("title, severity")
          .eq("workspace_id", session.workspace_id)
          .eq("department_id", session.department_id)
          .eq("status", "open")
          .limit(5),
      ]);

      const deptName = (session.department as { name: string } | null)?.name ?? "Department";
      const shiftCount = shifts.data?.length ?? 0;
      const criticalTasks = tasks.data?.length ?? 0;
      const openDeviations = deviations.data?.length ?? 0;
      const handoffNotes = handoff.data?.handoff_notes ?? null;

      // Build brief summary for notification
      const summaryParts: string[] = [];
      summaryParts.push(`${shiftCount} on schedule`);
      if (criticalTasks > 0) summaryParts.push(`${criticalTasks} critical tasks`);
      if (openDeviations > 0) summaryParts.push(`${openDeviations} open deviations`);
      if (handoffNotes) summaryParts.push("handoff notes from yesterday");

      // Insert notification + emit telemetry in parallel
      await Promise.all([
        supabase.from("notification").insert({
          workspace_id: session.workspace_id,
          title: `Day Brief: ${deptName}`,
          body: summaryParts.join(" | "),
          icon_type: openDeviations > 0 || criticalTasks > 0 ? "alert" : "info",
          priority: criticalTasks > 0 ? "high" : "normal",
          target_type: "department",
          target_id: session.department_id,
          metadata: {
            type: "day_brief",
            department_id: session.department_id,
            session_id: session.department_session_id,
            shift_count: shiftCount,
            critical_tasks: criticalTasks,
            open_deviations: openDeviations,
            has_handoff: !!handoffNotes,
          },
        }),
        supabase.from("engine_event").insert({
          workspace_id: session.workspace_id,
          event_type: "ops.compile.day_brief",
          payload: {
            department_id: session.department_id,
            session_id: session.department_session_id,
            shift_count: shiftCount,
            critical_tasks: criticalTasks,
            open_deviations: openDeviations,
            source: "cron",
            origin: "system",
          },
        }),
      ]);

      compiled++;
    }

    return new Response(JSON.stringify({ compiled, total_sessions: sessions.length }), {
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
