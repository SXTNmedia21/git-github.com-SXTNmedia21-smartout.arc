/**
 * daily-session-replenish — Cron-triggered session creator.
 *
 * Runs daily at 02:00 UTC. For each workspace with an active season,
 * creates department_session rows for operational/hybrid departments
 * within a 7-day planning window. Idempotent via upsert on
 * (workspace_id, department_id, session_date).
 *
 * Auth: WATCHDOG_CRON_SECRET bearer token (cron-only pattern).
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

  // Auth: cron secret bearer token
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
    // Find all workspaces with active seasons
    const { data: activeSeasons, error: seasonError } = await supabase
      .from("season")
      .select("season_id, workspace_id, start_date, end_date")
      .eq("status", "active");

    if (seasonError) {
      return new Response(JSON.stringify({ error: seasonError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!activeSeasons || activeSeasons.length === 0) {
      return new Response(JSON.stringify({ message: "No active seasons", sessions_created: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let totalCreated = 0;

    for (const season of activeSeasons) {
      // Get operational/hybrid departments for this workspace
      const { data: departments } = await supabase
        .from("department")
        .select("department_id, department_type")
        .eq("workspace_id", season.workspace_id)
        .eq("is_active", true);

      const eligibleDepts = (departments ?? []).filter(
        (d: { department_type: string | null }) =>
          !d.department_type ||
          d.department_type === "operational" ||
          d.department_type === "hybrid",
      );

      if (eligibleDepts.length === 0) continue;

      // Calculate planning window: today through min(season.end_date, today + 7)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const windowEnd = new Date(today);
      windowEnd.setDate(windowEnd.getDate() + 7);
      const seasonEnd = season.end_date ? new Date(season.end_date) : null;
      const effectiveEnd = seasonEnd && seasonEnd < windowEnd ? seasonEnd : windowEnd;

      // Generate date range
      const dates: string[] = [];
      const cursor = new Date(today);
      while (cursor <= effectiveEnd) {
        dates.push(cursor.toISOString().split("T")[0]!);
        cursor.setDate(cursor.getDate() + 1);
      }

      // Get operating hours for all eligible departments
      const deptIds = eligibleDepts.map((d: { department_id: string }) => d.department_id);
      const { data: opHours } = await supabase
        .from("department_operating_hours")
        .select("department_id, day_of_week, open_time, close_time, is_closed")
        .in("department_id", deptIds)
        .is("location_id", null)
        .is("season_id", null);

      // Build hours lookup: dept_id → day_of_week → {open, close}
      const hoursMap = new Map<
        string,
        Map<number, { open: string | null; close: string | null }>
      >();
      for (const oh of opHours ?? []) {
        if (!hoursMap.has(oh.department_id)) {
          hoursMap.set(oh.department_id, new Map());
        }
        hoursMap.get(oh.department_id)!.set(oh.day_of_week, {
          open: oh.is_closed ? null : oh.open_time,
          close: oh.is_closed ? null : oh.close_time,
        });
      }

      // Upsert sessions for each dept x date
      const rows: Array<{
        workspace_id: string;
        department_id: string;
        session_date: string;
        season_id: string;
        status: string;
        planned_open: string | null;
        planned_close: string | null;
      }> = [];

      for (const date of dates) {
        const dayOfWeek = (new Date(date).getDay() + 6) % 7; // JS Sun=0 → ISO Mon=0
        for (const dept of eligibleDepts) {
          const deptHours = hoursMap.get(dept.department_id)?.get(dayOfWeek);
          rows.push({
            workspace_id: season.workspace_id,
            department_id: dept.department_id,
            session_date: date,
            season_id: season.season_id,
            status: "upcoming",
            planned_open: deptHours?.open ?? null,
            planned_close: deptHours?.close ?? null,
          });
        }
      }

      if (rows.length > 0) {
        const { error: upsertError } = await supabase.from("department_session").upsert(rows, {
          onConflict: "workspace_id,department_id,session_date",
          ignoreDuplicates: false,
        });

        if (!upsertError) {
          totalCreated += rows.length;
        }
      }
    }

    return new Response(
      JSON.stringify({
        message: "Session replenishment complete",
        sessions_upserted: totalCreated,
        seasons_processed: activeSeasons.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[daily-session-replenish] Unhandled error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
