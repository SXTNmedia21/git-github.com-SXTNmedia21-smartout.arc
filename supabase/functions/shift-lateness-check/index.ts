/**
 * shift-lateness-check — Cron Edge Function
 *
 * Detects employees who haven't punched in after their shift start time
 * plus the configured lateness threshold. Creates guardian_signal entries
 * and notification_outbox rows for department managers.
 *
 * Auth: WATCHDOG_CRON_SECRET bearer token (no JWT).
 * Schedule: every 5 minutes via external cron (n8n or Supabase cron).
 */

import { createClient } from "jsr:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  // ── Auth ────────────────────────────────────────────────────
  const authHeader = req.headers.get("authorization");
  const cronSecret = Deno.env.get("WATCHDOG_CRON_SECRET");
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const today = new Date().toISOString().slice(0, 10);
  const now = new Date();
  let checked = 0;
  let lateCount = 0;
  let noShowCount = 0;

  // ── Get all workspace configs with lateness threshold ───────
  const { data: configs, error: configError } = await supabase
    .from("shift_clock_config")
    .select("workspace_id, late_threshold_minutes");

  if (configError) {
    return Response.json({ error: configError.message }, { status: 500 });
  }

  for (const config of configs ?? []) {
    const threshold = config.late_threshold_minutes ?? 10;
    const cutoff = new Date(now.getTime() - threshold * 60_000).toISOString();

    // Find published shifts that started before cutoff with no time_entry
    const { data: shifts } = await supabase
      .from("schedule_shift")
      .select("schedule_shift_id, employee_id, department_id, start_time, role")
      .eq("workspace_id", config.workspace_id)
      .eq("shift_date", today)
      .in("status", ["published"])
      .not("employee_id", "is", null)
      .lt("start_time", cutoff);

    if (!shifts?.length) continue;

    for (const shift of shifts) {
      checked++;

      // Check if time_entry exists for this shift
      const { count: entryCount } = await supabase
        .schema("timesheet")
        .from("time_entry")
        .select("time_entry_id", { count: "exact", head: true })
        .eq("shift_id", shift.schedule_shift_id);

      if ((entryCount ?? 0) > 0) continue; // Already punched in

      // Calculate how late
      const shiftStart = new Date(shift.start_time).getTime();
      const minutesLate = Math.round((now.getTime() - shiftStart) / 60_000);

      // Idempotency: check if we already created a signal today
      const signalType = minutesLate >= threshold * 3 ? "shift_no_show" : "shift_late";
      const { count: existingSignals } = await supabase
        .from("guardian_signal")
        .select("signal_id", { count: "exact", head: true })
        .eq("entity_type", "schedule_shift")
        .eq("entity_id", shift.schedule_shift_id)
        .eq("signal_type", signalType)
        .gte("created_at", `${today}T00:00:00`);

      if ((existingSignals ?? 0) > 0) continue; // Already flagged

      // Insert guardian signal
      await supabase.from("guardian_signal").insert({
        workspace_id: config.workspace_id,
        entity_type: "schedule_shift",
        entity_id: shift.schedule_shift_id,
        signal_type: signalType,
        severity: minutesLate >= threshold * 3 ? "critical" : "warning",
        title:
          minutesLate >= threshold * 3
            ? `Ikke møtt opp: vakt ${shift.schedule_shift_id}`
            : `Sen ankomst: ${minutesLate} min forsinket`,
        metadata: {
          minutes_late: minutesLate,
          threshold,
          employee_id: shift.employee_id,
          department_id: shift.department_id,
        },
      });

      // Get employee name for notification
      const { data: profile } = await supabase
        .from("profile")
        .select("display_name")
        .eq("profile_id", shift.employee_id!)
        .single();

      const employeeName = profile?.display_name ?? "Ansatt";
      const eventKey = minutesLate >= threshold * 3 ? "shift.no_show" : "shift.late";

      // Get department managers to notify
      const { data: managers } = await supabase
        .from("profile")
        .select("profile_id")
        .eq("workspace_id", config.workspace_id)
        .eq("department_id", shift.department_id!)
        .in("role", ["manager", "admin", "owner"])
        .eq("is_active", true);

      // Insert notification for each manager
      for (const manager of managers ?? []) {
        await supabase.from("notification_outbox").insert({
          workspace_id: config.workspace_id,
          recipient_id: manager.profile_id,
          mode: "work",
          priority: 2,
          title: eventKey === "shift.no_show" ? "Ikke møtt opp" : "Sen ankomst",
          body:
            eventKey === "shift.no_show"
              ? `${employeeName} har ikke møtt til ${shift.role}-vakt`
              : `${employeeName} har ikke stemplet inn — ${minutesLate} min forsinket`,
          action_url: "/dashboard/shift-clock",
          metadata: {
            event_key: eventKey,
            icon_type: "deviation",
            shift_id: shift.schedule_shift_id,
            employee_id: shift.employee_id,
            minutes_late: minutesLate,
          },
          allowed_channels: ["push", "in_app", "email"],
        });
      }

      if (minutesLate >= threshold * 3) {
        noShowCount++;
      } else {
        lateCount++;
      }
    }
  }

  return Response.json({ checked, late: lateCount, no_show: noShowCount });
});
