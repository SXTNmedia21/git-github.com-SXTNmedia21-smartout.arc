/**
 * ops-predict — Weekly prediction analysis Edge Function.
 * Runs weekly (Sunday 22:00 UTC) via pg_cron.
 * ADR-0088: AI Operations Intelligence Phase 3 — PREDICT function.
 *
 * Analyzes upcoming schedule and operational patterns to detect:
 * 1. Coverage gaps (insufficient staffing vs min_staff requirement)
 * 2. Task bottlenecks (too many tasks per staff member)
 * 3. Compliance risks (HACCP task completion rates < 90%)
 * 4. Employee overload (individual task counts > 150% of mean)
 *
 * All predictions are advisory (read-only) and persisted to engine_memory
 * with memory_type 'prediction' and 7-day TTL.
 */

import { createClient } from "jsr:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";

// ============================================================================
// TYPES
// ============================================================================

type PredictionType =
  | "coverage_gap"
  | "task_bottleneck"
  | "compliance_risk"
  | "employee_overload";

interface Prediction {
  type: PredictionType;
  department_id: string | null;
  employee_id: string | null;
  confidence: number;
  summary: string;
  details: Record<string, unknown>;
}

interface CoverageGapDetail {
  department_name: string;
  gap_days: number;
  min_staff: number;
  actual_scheduled: number;
  affected_dates: string[];
}

interface TaskBottleneckDetail {
  department_name: string;
  total_tasks: number;
  scheduled_staff: number;
  tasks_per_staff: number;
  threshold: number;
}

interface ComplianceRiskDetail {
  department_name: string;
  total_haccp_tasks: number;
  completed_count: number;
  completion_rate: number;
  threshold: number;
  at_risk_tasks: string[];
}

interface EmployeeOverloadDetail {
  employee_name: string;
  task_count: number;
  mean_task_count: number;
  percentage_above_mean: number;
  threshold_pct: number;
}

// ============================================================================
// DETECTOR 1: Coverage Gaps
// ============================================================================

async function detectCoverageGaps(
  supabase: ReturnType<typeof createClient>,
  workspaceId: string
): Promise<Prediction[]> {
  const predictions: Prediction[] = [];

  // Query departments with their operating hours (min_staff by day_of_week)
  const { data: departments, error: deptError } = await supabase
    .from("department")
    .select(
      `
      id,
      name,
      department_operating_hours (
        day_of_week,
        min_staff
      )
    `
    )
    .eq("workspace_id", workspaceId)
    .single();

  if (deptError || !departments) {
    console.error("Coverage gap detection: department query failed", deptError);
    return [];
  }

  // Get next 7 days schedule
  const today = new Date();
  const sevenDaysFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

  const { data: shifts, error: shiftsError } = await supabase
    .from("schedule_shift")
    .select("shift_date, count(*)")
    .eq("department_id", departments.id)
    .gte("shift_date", today.toISOString().split("T")[0])
    .lte("shift_date", sevenDaysFromNow.toISOString().split("T")[0]);

  if (shiftsError) {
    console.error("Coverage gap detection: shifts query failed", shiftsError);
    return [];
  }

  // Build operating hours map by day_of_week
  const minStaffByDow = new Map<number, number>();
  if (Array.isArray(departments.department_operating_hours)) {
    departments.department_operating_hours.forEach(
      (oh: { day_of_week: number; min_staff: number }) => {
        minStaffByDow.set(oh.day_of_week, oh.min_staff);
      }
    );
  }

  // Check each day in the next 7 days
  const gapDays: string[] = [];
  let totalMinStaff = 0;
  let totalScheduled = 0;

  for (let i = 0; i < 7; i++) {
    const checkDate = new Date(today.getTime() + i * 24 * 60 * 60 * 1000);
    const dow = checkDate.getDay();
    const minStaff = minStaffByDow.get(dow) ?? 0;

    // Count scheduled staff for this date
    const scheduled =
      (shifts as unknown as Record<string, unknown>[])?.filter(
        (s) =>
          (s as unknown as Record<string, unknown>)?.shift_date ===
          checkDate.toISOString().split("T")[0]
      ).length ?? 0;

    totalMinStaff += minStaff;
    totalScheduled += scheduled;

    if (scheduled < minStaff && minStaff > 0) {
      gapDays.push(checkDate.toISOString().split("T")[0]);
    }
  }

  if (gapDays.length > 0) {
    const confidence = Math.min(
      0.95,
      0.7 + (gapDays.length / 7) * 0.25
    );

    const detail: CoverageGapDetail = {
      department_name: departments.name,
      gap_days: gapDays.length,
      min_staff: totalMinStaff,
      actual_scheduled: totalScheduled,
      affected_dates: gapDays,
    };

    predictions.push({
      type: "coverage_gap",
      department_id: departments.id,
      employee_id: null,
      confidence,
      summary: `Coverage gap detected: ${gapDays.length} days below minimum staffing (${totalScheduled}/${totalMinStaff})`,
      details: detail,
    });
  }

  return predictions;
}

// ============================================================================
// DETECTOR 2: Task Bottlenecks
// ============================================================================

async function detectTaskBottlenecks(
  supabase: ReturnType<typeof createClient>,
  workspaceId: string
): Promise<Prediction[]> {
  const predictions: Prediction[] = [];
  const TASK_PER_STAFF_THRESHOLD = 8;

  // Query department_session for last 7 days with task counts
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const { data: sessions, error: sessionsError } = await supabase
    .from("department_session")
    .select(
      `
      id,
      department_id,
      tasks_total,
      department (
        id,
        name
      ),
      schedule_shift (
        id,
        count
      )
    `
    )
    .eq("workspace_id", workspaceId)
    .gte("session_start", sevenDaysAgo.toISOString());

  if (sessionsError || !sessions) {
    console.error(
      "Task bottleneck detection: sessions query failed",
      sessionsError
    );
    return [];
  }

  // Group sessions by department
  const byDept = new Map<string, { totalTasks: number; staffCount: number; deptName: string }>();

  for (const session of sessions as unknown as Record<string, unknown>[]) {
    const deptId = (session as Record<string, unknown>)?.department_id as string;
    const tasksTotal = (session as Record<string, unknown>)?.tasks_total as number;
    const deptName = ((session as Record<string, unknown>)?.department as Record<string, unknown>)?.name as string;
    const shiftCount = Array.isArray((session as Record<string, unknown>)?.schedule_shift)
      ? ((session as Record<string, unknown>)?.schedule_shift as unknown[]).length
      : 0;

    if (deptId) {
      const existing = byDept.get(deptId) ?? {
        totalTasks: 0,
        staffCount: 0,
        deptName,
      };
      existing.totalTasks += tasksTotal ?? 0;
      existing.staffCount += shiftCount;
      byDept.set(deptId, existing);
    }
  }

  // Detect bottlenecks
  for (const [deptId, data] of byDept) {
    if (data.staffCount > 0) {
      const tasksPerStaff = data.totalTasks / data.staffCount;

      if (tasksPerStaff > TASK_PER_STAFF_THRESHOLD) {
        const confidence = Math.min(
          0.9,
          0.5 + (tasksPerStaff - 8) * 0.05
        );

        const detail: TaskBottleneckDetail = {
          department_name: data.deptName,
          total_tasks: data.totalTasks,
          scheduled_staff: data.staffCount,
          tasks_per_staff: tasksPerStaff,
          threshold: TASK_PER_STAFF_THRESHOLD,
        };

        predictions.push({
          type: "task_bottleneck",
          department_id: deptId,
          employee_id: null,
          confidence,
          summary: `Task bottleneck: ${tasksPerStaff.toFixed(1)} tasks/staff (threshold: ${TASK_PER_STAFF_THRESHOLD})`,
          details: detail,
        });
      }
    }
  }

  return predictions;
}

// ============================================================================
// DETECTOR 3: Compliance Risk (HACCP)
// ============================================================================

async function detectComplianceRisk(
  supabase: ReturnType<typeof createClient>,
  workspaceId: string
): Promise<Prediction[]> {
  const predictions: Prediction[] = [];
  const COMPLIANCE_THRESHOLD = 0.9; // 90%

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  // Query HACCP-related tasks (task_type contains hygiene, temperature, etc.)
  const { data: haccpTasks, error: tasksError } = await supabase
    .from("session_task")
    .select(
      `
      id,
      task_type,
      is_completed,
      session_hook (
        department_session (
          department_id,
          department (
            id,
            name
          )
        )
      )
    `
    )
    .eq("workspace_id", workspaceId)
    .gte("created_at", sevenDaysAgo.toISOString())
    .or("task_type.ilike.%hygiene%,task_type.ilike.%temperature%,task_type.ilike.%haccp%");

  if (tasksError || !haccpTasks) {
    console.error(
      "Compliance risk detection: HACCP tasks query failed",
      tasksError
    );
    return [];
  }

  // Group by department
  const byDept = new Map<string, { total: number; completed: number; deptName: string }>();

  for (const task of haccpTasks as unknown as Record<string, unknown>[]) {
    const isCompleted = (task as Record<string, unknown>)?.is_completed as boolean;
    const deptId = ((((task as Record<string, unknown>)?.session_hook as Record<string, unknown>)?.department_session as Record<string, unknown>)?.department_id) as string;
    const deptName = ((((task as Record<string, unknown>)?.session_hook as Record<string, unknown>)?.department_session as Record<string, unknown>)?.department as Record<string, unknown>)?.name as string;

    if (deptId) {
      const existing = byDept.get(deptId) ?? { total: 0, completed: 0, deptName };
      existing.total += 1;
      if (isCompleted) existing.completed += 1;
      byDept.set(deptId, existing);
    }
  }

  // Detect compliance risks
  for (const [deptId, data] of byDept) {
    const completionRate = data.total > 0 ? data.completed / data.total : 0;

    if (completionRate < COMPLIANCE_THRESHOLD) {
      const confidence = Math.min(
        0.95,
        0.6 + ((COMPLIANCE_THRESHOLD - completionRate) / COMPLIANCE_THRESHOLD) * 0.35
      );

      const detail: ComplianceRiskDetail = {
        department_name: data.deptName,
        total_haccp_tasks: data.total,
        completed_count: data.completed,
        completion_rate: completionRate,
        threshold: COMPLIANCE_THRESHOLD,
        at_risk_tasks: ["Temperature control", "Hygiene protocols", "HACCP checklists"],
      };

      predictions.push({
        type: "compliance_risk",
        department_id: deptId,
        employee_id: null,
        confidence,
        summary: `Compliance risk: HACCP task completion ${(completionRate * 100).toFixed(1)}% (threshold: ${COMPLIANCE_THRESHOLD * 100}%)`,
        details: detail,
      });
    }
  }

  return predictions;
}

// ============================================================================
// DETECTOR 4: Employee Overload
// ============================================================================

async function detectEmployeeOverload(
  supabase: ReturnType<typeof createClient>,
  workspaceId: string
): Promise<Prediction[]> {
  const predictions: Prediction[] = [];
  const OVERLOAD_MULTIPLIER = 1.5; // 150% of mean

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  // Query session_task assignments by employee (last 7 days)
  const { data: taskAssignments, error: tasksError } = await supabase
    .from("session_task")
    .select(
      `
      id,
      assigned_to,
      profile (
        id,
        full_name
      )
    `
    )
    .eq("workspace_id", workspaceId)
    .gte("created_at", sevenDaysAgo.toISOString())
    .not("assigned_to", "is", null);

  if (tasksError || !taskAssignments) {
    console.error("Employee overload detection: tasks query failed", tasksError);
    return [];
  }

  // Count tasks per employee
  const taskCounts = new Map<string, { count: number; name: string }>();

  for (const task of taskAssignments as unknown as Record<string, unknown>[]) {
    const assignedTo = (task as Record<string, unknown>)?.assigned_to as string;
    const fullName = ((task as Record<string, unknown>)?.profile as Record<string, unknown>)?.full_name as string;

    if (assignedTo) {
      const existing = taskCounts.get(assignedTo) ?? { count: 0, name: fullName ?? "Unknown" };
      existing.count += 1;
      taskCounts.set(assignedTo, existing);
    }
  }

  // Calculate mean
  const counts = Array.from(taskCounts.values()).map((v) => v.count);
  const mean = counts.length > 0 ? counts.reduce((a, b) => a + b, 0) / counts.length : 0;

  // Detect overloaded employees
  for (const [empId, data] of taskCounts) {
    if (data.count > mean * OVERLOAD_MULTIPLIER && mean > 0) {
      const pctAbove = ((data.count - mean) / mean) * 100;
      const confidence = Math.min(0.85, 0.5 + (pctAbove / 200) * 0.35);

      const detail: EmployeeOverloadDetail = {
        employee_name: data.name,
        task_count: data.count,
        mean_task_count: mean,
        percentage_above_mean: pctAbove,
        threshold_pct: (OVERLOAD_MULTIPLIER - 1) * 100,
      };

      predictions.push({
        type: "employee_overload",
        department_id: null,
        employee_id: empId,
        confidence,
        summary: `Employee overload: ${data.name} has ${data.count} tasks (${pctAbove.toFixed(1)}% above mean)`,
        details: detail,
      });
    }
  }

  return predictions;
}

// ============================================================================
// PERSISTENCE: Write predictions to engine_memory
// ============================================================================

async function persistPredictions(
  supabase: ReturnType<typeof createClient>,
  workspaceId: string,
  predictions: Prediction[]
): Promise<{ persisted: number; error?: string }> {
  if (predictions.length === 0) {
    return { persisted: 0 };
  }

  // Find admin profile for this workspace (owner or first admin)
  const { data: adminProfile, error: adminError } = await supabase
    .from("profile")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("role", "admin")
    .single();

  if (adminError || !adminProfile) {
    console.error("Persistence: failed to find admin profile", adminError);
    return { persisted: 0, error: "Admin profile not found" };
  }

  // TTL: 7 days from now
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  // Prepare rows for engine_memory
  const rows = predictions.map((pred) => ({
    workspace_id: workspaceId,
    memory_type: "prediction",
    entity_type: "department",
    entity_id: pred.department_id ?? pred.employee_id,
    content: {
      type: pred.type,
      confidence: pred.confidence,
      summary: pred.summary,
      details: pred.details,
    },
    source_profile_id: adminProfile.id,
    expires_at: expiresAt.toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }));

  // Batch insert
  const { error: insertError, data } = await supabase
    .from("engine_memory")
    .insert(rows);

  if (insertError) {
    console.error("Persistence: engine_memory insert failed", insertError);
    return { persisted: 0, error: insertError.message };
  }

  return { persisted: rows.length };
}

// ============================================================================
// TELEMETRY EMISSION
// ============================================================================

async function emitTelemetry(
  supabase: ReturnType<typeof createClient>,
  workspaceId: string,
  predictions: Prediction[]
): Promise<void> {
  if (predictions.length === 0) {
    return;
  }

  // Group predictions by type
  const byType = new Map<PredictionType, number>();
  for (const pred of predictions) {
    byType.set(pred.type, (byType.get(pred.type) ?? 0) + 1);
  }

  // Emit single event per prediction type
  for (const [type, count] of byType) {
    const avgConfidence =
      predictions
        .filter((p) => p.type === type)
        .reduce((sum, p) => sum + p.confidence, 0) / count;

    await supabase.from("activity_trail").insert({
      workspace_id: workspaceId,
      action: "ops_predict_analysis",
      entity_type: "prediction",
      metadata: {
        prediction_type: type,
        count,
        avg_confidence: avgConfidence,
        timestamp: new Date().toISOString(),
      },
    });
  }
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

Deno.serve(async (req: Request) => {
  const cors = getCorsHeaders(req);
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  // Auth guard: WATCHDOG_CRON_SECRET bearer token (standard cron pattern)
  const authHeader = req.headers.get("authorization");
  const cronSecret = Deno.env.get("WATCHDOG_CRON_SECRET");

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { "Content-Type": "application/json", ...cors } }
    );
  }

  try {
    // Initialize Supabase client (service role for admin operations)
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase credentials");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    // Get all active workspaces
    const { data: workspaces, error: workspacesError } = await supabase
      .from("workspace")
      .select("id")
      .eq("is_active", true);

    if (workspacesError || !workspaces) {
      throw new Error(`Failed to fetch workspaces: ${workspacesError?.message}`);
    }

    let totalPredictions = 0;

    // Process each workspace
    for (const workspace of workspaces) {
      const workspaceId = workspace.id;

      console.log(`Processing predictions for workspace: ${workspaceId}`);

      // Run all 4 detectors in parallel
      const [gaps, bottlenecks, compliance, overload] = await Promise.all([
        detectCoverageGaps(supabase, workspaceId),
        detectTaskBottlenecks(supabase, workspaceId),
        detectComplianceRisk(supabase, workspaceId),
        detectEmployeeOverload(supabase, workspaceId),
      ]);

      const allPredictions = [
        ...gaps,
        ...bottlenecks,
        ...compliance,
        ...overload,
      ];

      if (allPredictions.length > 0) {
        // Persist predictions
        const { persisted, error } = await persistPredictions(
          supabase,
          workspaceId,
          allPredictions
        );

        if (error) {
          console.error(
            `Workspace ${workspaceId}: persistence error: ${error}`
          );
        } else {
          console.log(
            `Workspace ${workspaceId}: persisted ${persisted} predictions`
          );
          totalPredictions += persisted;

          // Emit telemetry
          await emitTelemetry(supabase, workspaceId, allPredictions);
        }
      }
    }

    console.log(`Prediction analysis complete: ${totalPredictions} predictions persisted`);

    return new Response(
      JSON.stringify({
        success: true,
        total_predictions: totalPredictions,
        workspaces_processed: workspaces.length,
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...cors } }
    );
  } catch (error) {
    console.error("Prediction analysis error:", error);

    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { "Content-Type": "application/json", ...cors } }
    );
  }
});
