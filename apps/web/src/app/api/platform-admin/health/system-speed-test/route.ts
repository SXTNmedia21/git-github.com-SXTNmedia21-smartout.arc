import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@smartout/supabase/admin";
import { getSuperAdminId } from "@/lib/platform-admin";

type SpeedQueryResult = {
  name: string;
  duration_ms: number;
  row_count: number;
  payload_bytes: number;
};

type SpeedBundleResult = {
  label: "core" | "extended";
  duration_ms: number;
  queries: SpeedQueryResult[];
  total_rows: number;
  total_payload_bytes: number;
};

export type SystemSpeedTestResponse = {
  tested_at: string;
  workspace_id: string;
  date_start: string;
  date_end: string;
  core: SpeedBundleResult;
  extended: SpeedBundleResult;
};

/**
 * Returns YYYY-MM-DD in local calendar terms.
 * Why: speed tests should align with schedule page date slicing.
 */
function toDateString(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

/**
 * Executes one query and captures duration + payload size.
 * Why: this powers A/B snapshots for admin health speed comparisons.
 */
async function timedQuery<T>(name: string, fn: () => Promise<T[]>): Promise<SpeedQueryResult> {
  const started = performance.now();
  const rows = await fn();
  const duration = Math.round((performance.now() - started) * 100) / 100;
  return {
    name,
    duration_ms: duration,
    row_count: rows.length,
    payload_bytes: new TextEncoder().encode(JSON.stringify(rows)).length,
  };
}

/**
 * Resolves a workspace for testing when no explicit workspace_id is provided.
 * Why: allows one-click speed tests from admin health page.
 */
async function resolveWorkspaceId(
  admin: ReturnType<typeof createAdminClient>,
  explicitWorkspaceId: string | null,
): Promise<string | null> {
  if (explicitWorkspaceId) return explicitWorkspaceId;

  const { data: workspace } = await admin
    .from("workspace")
    .select("workspace_id")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  return (workspace?.workspace_id as string | undefined) ?? null;
}

/**
 * GET system speed test for schedule-like data windows.
 * Why: supports before/after A/B snapshots in admin health.
 */
export async function GET(req: NextRequest) {
  const adminId = await getSuperAdminId();
  if (!adminId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const requestedWorkspaceId = req.nextUrl.searchParams.get("workspace_id");
  const workspaceId = await resolveWorkspaceId(admin, requestedWorkspaceId);
  if (!workspaceId) {
    return NextResponse.json({ error: "No workspace available for speed test" }, { status: 404 });
  }

  const now = new Date();
  const startDate = new Date(now);
  startDate.setDate(now.getDate() - 29);
  const dateStart = toDateString(startDate);
  const dateEnd = toDateString(now);

  const coreStarted = performance.now();
  const coreQueries = await Promise.all([
    timedQuery("employees", async () => {
      const { data, error } = await admin
        .from("profile")
        .select("profile_id")
        .eq("workspace_id", workspaceId);
      if (error) throw error;
      return (data ?? []) as Array<{ profile_id: string }>;
    }),
    timedQuery("shifts_30d", async () => {
      const { data, error } = await admin
        .from("schedule_shift")
        .select("schedule_shift_id, shift_date, employee_id, status, start_time, end_time")
        .eq("workspace_id", workspaceId)
        .gte("shift_date", dateStart)
        .lte("shift_date", dateEnd);
      if (error) throw error;
      return (data ?? []) as Array<Record<string, unknown>>;
    }),
    timedQuery("absences_30d", async () => {
      const { data, error } = await admin
        .from("schedule_absence")
        .select("schedule_absence_id, shift_date, employee_id, status")
        .eq("workspace_id", workspaceId)
        .gte("shift_date", dateStart)
        .lte("shift_date", dateEnd);
      if (error) throw error;
      return (data ?? []) as Array<Record<string, unknown>>;
    }),
  ]);
  const coreDuration = Math.round((performance.now() - coreStarted) * 100) / 100;

  const extendedStarted = performance.now();
  const extendedQueries = await Promise.all([
    timedQuery("day_messages_30d", async () => {
      const { data, error } = await admin
        .from("schedule_day_message")
        .select("schedule_day_message_id, shift_date")
        .eq("workspace_id", workspaceId)
        .gte("shift_date", dateStart)
        .lte("shift_date", dateEnd);
      if (error) throw error;
      return (data ?? []) as Array<Record<string, unknown>>;
    }),
    timedQuery("day_tasks_30d", async () => {
      const { data, error } = await admin
        .from("schedule_day_task")
        .select("schedule_day_task_id, shift_date")
        .eq("workspace_id", workspaceId)
        .gte("shift_date", dateStart)
        .lte("shift_date", dateEnd);
      if (error) throw error;
      return (data ?? []) as Array<Record<string, unknown>>;
    }),
    timedQuery("day_bookings_30d", async () => {
      const { data, error } = await admin
        .from("schedule_day_booking")
        .select("schedule_day_booking_id, shift_date")
        .eq("workspace_id", workspaceId)
        .gte("shift_date", dateStart)
        .lte("shift_date", dateEnd);
      if (error) throw error;
      return (data ?? []) as Array<Record<string, unknown>>;
    }),
    timedQuery("day_info_30d", async () => {
      const { data, error } = await admin
        .from("schedule_day_info")
        .select("id, date, category")
        .eq("workspace_id", workspaceId)
        .gte("date", dateStart)
        .lte("date", dateEnd);
      if (error) throw error;
      return (data ?? []) as Array<Record<string, unknown>>;
    }),
    timedQuery("open_shifts", async () => {
      const { data, error } = await admin
        .from("schedule_open_shift")
        .select("schedule_open_shift_id")
        .eq("workspace_id", workspaceId);
      if (error) throw error;
      return (data ?? []) as Array<Record<string, unknown>>;
    }),
    timedQuery("templates", async () => {
      const { data, error } = await admin
        .from("schedule_template")
        .select("schedule_template_id, include_assignments")
        .eq("workspace_id", workspaceId);
      if (error) throw error;
      return (data ?? []) as Array<Record<string, unknown>>;
    }),
  ]);
  const extendedDuration = Math.round((performance.now() - extendedStarted) * 100) / 100;

  const core: SpeedBundleResult = {
    label: "core",
    duration_ms: coreDuration,
    queries: coreQueries,
    total_rows: coreQueries.reduce((sum, query) => sum + query.row_count, 0),
    total_payload_bytes: coreQueries.reduce((sum, query) => sum + query.payload_bytes, 0),
  };

  const extended: SpeedBundleResult = {
    label: "extended",
    duration_ms: extendedDuration,
    queries: extendedQueries,
    total_rows: extendedQueries.reduce((sum, query) => sum + query.row_count, 0),
    total_payload_bytes: extendedQueries.reduce((sum, query) => sum + query.payload_bytes, 0),
  };

  const response: SystemSpeedTestResponse = {
    tested_at: new Date().toISOString(),
    workspace_id: workspaceId,
    date_start: dateStart,
    date_end: dateEnd,
    core,
    extended,
  };

  return NextResponse.json(response);
}
