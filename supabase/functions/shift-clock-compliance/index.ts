/**
 * Server-side compliance checks for ShiftClock punch-in.
 * Validates: GPS distance, 11h rest period, weekly hours limit.
 * Client does NOT have authority to determine if a punch is legal.
 *
 * Returns machine-readable codes + data. Client renders localized messages.
 * JWT-only auth (verify_jwt = true by default — no config.toml entry needed).
 */
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const EARTH_RADIUS_M = 6_371_000;

/** Haversine formula — returns straight-line distance in meters between two GPS points. */
function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return Math.round(EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

type Warning = {
  code: string;
  severity: "warning" | "block";
  data: Record<string, unknown>;
};

type GpsPayload = {
  lat: number;
  lng: number;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const {
    profile_id,
    shift_id,
    team_id,
    department_id,
    gps,
  }: {
    profile_id: string;
    shift_id: string;
    team_id?: string;
    department_id?: string;
    gps?: GpsPayload;
  } = await req.json();

  const warnings: Warning[] = [];
  let blocked = false;
  let blockReason: string | null = null;

  // Service role is used here because this function validates compliance data
  // on behalf of an authenticated user — the JWT is validated by the gateway,
  // but querying cross-table labour records requires elevated DB access.
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // 1. Fetch the shift to get workspace context and planned duration
  const { data: shift } = await supabase
    .from("schedule_shift")
    .select("workspace_id, employee_id, shift_date, start_time, end_time, work_hours")
    .eq("schedule_shift_id", shift_id)
    .single();

  if (!shift) {
    return new Response(JSON.stringify({ error: "Shift not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // 2. Fetch ShiftClock config with cascading priority: team+dept > dept-only > workspace-only.
  //    Most specific config wins so individual teams can have tighter GPS requirements.
  const orParts = [
    team_id && department_id
      ? `and(team_id.eq.${team_id},department_id.eq.${department_id})`
      : null,
    department_id ? `and(team_id.is.null,department_id.eq.${department_id})` : null,
    `and(team_id.is.null,department_id.is.null)`,
  ]
    .filter(Boolean)
    .join(",");

  const { data: configs } = await supabase
    .from("shift_clock_config")
    .select("*")
    .eq("workspace_id", shift.workspace_id)
    .or(orParts)
    .order("team_id", { nullsFirst: false })
    .order("department_id", { nullsFirst: false })
    .limit(1);

  const config = configs?.[0];

  // 3. GPS fence check — block if the employee is outside the configured radius
  if (config?.gps_required && config.gps_reference_lat && config.gps_reference_lng) {
    if (!gps) {
      blocked = true;
      blockReason = "GPS_REQUIRED";
      warnings.push({ code: "GPS_REQUIRED", severity: "block", data: {} });
    } else {
      const distance = haversineDistance(
        gps.lat,
        gps.lng,
        Number(config.gps_reference_lat),
        Number(config.gps_reference_lng),
      );
      if (distance > config.gps_radius_meters) {
        blocked = true;
        blockReason = "GPS_TOO_FAR";
        warnings.push({
          code: "GPS_TOO_FAR",
          severity: "block",
          data: { distance, maxRadius: config.gps_radius_meters },
        });
      }
    }
  }

  // 4. Rest period check — §10-8 AML requires minimum 11 hours between shifts.
  //    Warning only (manager can override), not a hard block.
  //    time_entry lives in the timesheet schema.
  const { data: lastPunchOut } = await supabase
    .schema("timesheet")
    .from("time_entry")
    .select("punch_out")
    .eq("profile_id", profile_id)
    .eq("status", "completed")
    .not("punch_out", "is", null)
    .order("punch_out", { ascending: false })
    .limit(1)
    .single();

  if (lastPunchOut?.punch_out) {
    const restHours = (Date.now() - new Date(lastPunchOut.punch_out).getTime()) / (1000 * 60 * 60);
    if (restHours < 11) {
      warnings.push({
        code: "REST_PERIOD_SHORT",
        severity: "warning",
        data: { restHours: Math.round(restHours * 10) / 10, minimumHours: 11 },
      });
    }
  }

  // 5. Weekly hours check — §10-6 AML caps ordinary work at 40 hours per week.
  //    Calculates hours already clocked this calendar week (Mon–Sun) and adds
  //    the planned shift duration to project the total. Warning only.
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7)); // Monday
  weekStart.setHours(0, 0, 0, 0);

  const { data: weekEntries } = await supabase
    .schema("timesheet")
    .from("time_entry")
    .select("punch_in, punch_out")
    .eq("profile_id", profile_id)
    .gte("punch_in", weekStart.toISOString())
    .eq("status", "completed");

  const weekMinutes = (weekEntries ?? []).reduce((sum, entry) => {
    if (!entry.punch_out) return sum;
    return (
      sum + (new Date(entry.punch_out).getTime() - new Date(entry.punch_in).getTime()) / 60_000
    );
  }, 0);

  const shiftMinutes = (shift.work_hours ?? 0) * 60;
  if (weekMinutes + shiftMinutes > 40 * 60) {
    warnings.push({
      code: "WEEKLY_HOURS_EXCEEDED",
      severity: "warning",
      data: {
        currentWeekHours: Math.round(weekMinutes / 60),
        maxWeeklyHours: 40,
      },
    });
  }

  // Compute GPS distance for the response even if no fence is configured,
  // so the client can display it for informational purposes.
  const gpsDistance =
    gps && config?.gps_reference_lat && config?.gps_reference_lng
      ? haversineDistance(
          gps.lat,
          gps.lng,
          Number(config.gps_reference_lat),
          Number(config.gps_reference_lng),
        )
      : null;

  return new Response(
    JSON.stringify({
      allowed: !blocked,
      warnings,
      block_reason: blockReason,
      gps_distance: gpsDistance,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
