import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

// ─── Types ───────────────────────────────────────────────────────────────
type PatternType = "task_duration" | "staffing" | "deviation_correlation";

interface LearnedPattern {
  type: PatternType;
  importance: number; // 0.0-1.0
  summary: string;
  details: Record<string, unknown>;
  department_id?: string;
}

interface TaskDurationPattern {
  task_type: string;
  avg_estimated_minutes: number;
  avg_actual_minutes: number;
  drift_percentage: number;
  sample_count: number;
}

interface StaffingPattern {
  department_id: string;
  avg_completion_rate: number;
  completion_spread: number;
  sample_count: number;
}

interface DeviationPattern {
  procedure_id: string | null;
  title: string;
  count: number;
  critical_count: number;
}

interface CleanupResult {
  expired: number;
  retained: number;
}

// ─── Extract Task Duration Patterns ───────────────────────────────────────
async function extractTaskDurationPatterns(
  supabase: ReturnType<typeof createClient>,
  workspaceId: string,
): Promise<LearnedPattern[]> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data: tasks, error } = await supabase
    .from("session_task")
    .select("id, created_at, updated_at")
    .eq("workspace_id", workspaceId)
    .eq("status", "completed")
    .gte("completed_at", thirtyDaysAgo);

  if (error) {
    console.error("Failed to query session_task:", error);
    return [];
  }

  // Group by task type (inferred from id pattern or title)
  const patterns = new Map<string, TaskDurationPattern>();

  // Note: The actual implementation would need task_type in schema.
  // For now, we'll use a simplified grouping. In production, task_type should be added.
  for (const task of tasks || []) {
    const actualMinutes = Math.floor(
      (new Date(task.updated_at).getTime() - new Date(task.created_at).getTime()) / 60000,
    );
    const taskType = "general"; // Placeholder; use actual task_type from schema

    if (!patterns.has(taskType)) {
      patterns.set(taskType, {
        task_type: taskType,
        avg_estimated_minutes: 0,
        avg_actual_minutes: 0,
        drift_percentage: 0,
        sample_count: 0,
      });
    }

    const pattern = patterns.get(taskType)!;
    pattern.sample_count += 1;
    pattern.avg_actual_minutes = Math.floor(
      (pattern.avg_actual_minutes * (pattern.sample_count - 1) + actualMinutes) /
        pattern.sample_count,
    );
  }

  // Filter: min 5 samples, flag if drift > 30%
  const results: LearnedPattern[] = [];
  for (const pattern of patterns.values()) {
    if (pattern.sample_count < 5) continue;

    // Placeholder: estimated would come from schema
    const estimated = pattern.avg_actual_minutes;
    const drift = Math.abs(pattern.avg_actual_minutes - estimated) / Math.max(estimated, 1);

    if (drift > 0.3) {
      const importance = Math.min(0.4 + drift * 0.5, 0.9);
      results.push({
        type: "task_duration",
        importance,
        summary: `Task duration drift: ${pattern.task_type} (${(drift * 100).toFixed(1)}% variance)`,
        details: {
          task_type: pattern.task_type,
          avg_actual_minutes: pattern.avg_actual_minutes,
          estimated_minutes: estimated,
          drift_percentage: (drift * 100).toFixed(1),
          sample_count: pattern.sample_count,
        },
      });
    }
  }

  return results;
}

// ─── Extract Staffing Patterns ───────────────────────────────────────
async function extractStaffingPatterns(
  supabase: ReturnType<typeof createClient>,
  workspaceId: string,
): Promise<LearnedPattern[]> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data: sessions, error } = await supabase
    .from("department_session")
    .select("department_id, tasks_total, tasks_completed")
    .eq("workspace_id", workspaceId)
    .gte("created_at", thirtyDaysAgo);

  if (error) {
    console.error("Failed to query department_session:", error);
    return [];
  }

  // Group by department
  const patterns = new Map<string, { completionRates: number[]; departmentId: string }>();

  for (const session of sessions || []) {
    if (!session.department_id || !session.tasks_total) continue;

    const completionRate = session.tasks_completed / session.tasks_total;
    const dept = session.department_id;

    if (!patterns.has(dept)) {
      patterns.set(dept, { completionRates: [], departmentId: dept });
    }

    patterns.get(dept)!.completionRates.push(completionRate);
  }

  // Filter: min 7 data points, flag if spread > 15%
  const results: LearnedPattern[] = [];
  for (const { departmentId, completionRates } of patterns.values()) {
    if (completionRates.length < 7) continue;

    const min = Math.min(...completionRates);
    const max = Math.max(...completionRates);
    const spread = max - min;

    if (spread > 0.15) {
      const avg = completionRates.reduce((a, b) => a + b, 0) / completionRates.length;
      const importance = Math.min(0.4 + (spread / 100) * 0.45, 0.85);
      results.push({
        type: "staffing",
        importance,
        summary: `Staffing efficiency variance: ${(spread * 100).toFixed(1)}% spread in task completion`,
        details: {
          department_id: departmentId,
          avg_completion_rate: (avg * 100).toFixed(1),
          completion_spread: (spread * 100).toFixed(1),
          sample_count: completionRates.length,
        },
        department_id: departmentId,
      });
    }
  }

  return results;
}

// ─── Extract Deviation Correlations ───────────────────────────────────────
async function extractDeviationCorrelations(
  supabase: ReturnType<typeof createClient>,
  workspaceId: string,
): Promise<LearnedPattern[]> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data: deviations, error } = await supabase
    .from("deviation")
    .select("title, severity, created_at")
    .eq("workspace_id", workspaceId)
    .gte("created_at", thirtyDaysAgo);

  if (error) {
    console.error("Failed to query deviation:", error);
    return [];
  }

  // Group by title (correlation key)
  const patterns = new Map<string, { count: number; criticalCount: number }>();

  for (const dev of deviations || []) {
    const key = dev.title || "untitled";
    if (!patterns.has(key)) {
      patterns.set(key, { count: 0, criticalCount: 0 });
    }

    const pattern = patterns.get(key)!;
    pattern.count += 1;
    if (dev.severity === "critical") {
      pattern.criticalCount += 1;
    }
  }

  // Flag if count >= 3
  const results: LearnedPattern[] = [];
  for (const [title, { count, criticalCount }] of patterns.entries()) {
    if (count >= 3) {
      const importance = Math.min(0.5 + (count / 20) * 0.3 + (criticalCount > 0 ? 0.15 : 0), 0.95);
      results.push({
        type: "deviation_correlation",
        importance,
        summary: `Deviation pattern: "${title}" occurred ${count} times (${criticalCount} critical)`,
        details: {
          title,
          count,
          critical_count: criticalCount,
        },
      });
    }
  }

  return results;
}

// ─── Persist Patterns to engine_memory ───────────────────────────────────────
async function persistPatterns(
  supabase: ReturnType<typeof createClient>,
  workspaceId: string,
  patterns: LearnedPattern[],
): Promise<number> {
  if (patterns.length === 0) return 0;

  // Find admin profile for this workspace
  const { data: adminProfile, error: adminError } = await supabase
    .from("profile")
    .select("profile_id")
    .eq("workspace_id", workspaceId)
    .eq("role", "admin")
    .single();

  if (adminError || !adminProfile) {
    console.warn(`No admin profile found for workspace ${workspaceId}`);
    return 0;
  }

  const adminProfileId = adminProfile.profile_id;
  const now = new Date();
  const nineDaysFromNow = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

  const inserts = patterns.map((pattern) => ({
    profile_id: adminProfileId,
    workspace_id: workspaceId,
    memory_type: "learned_pattern",
    content: JSON.stringify(pattern),
    expires_at: pattern.importance >= 0.8 ? null : nineDaysFromNow.toISOString(),
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
  }));

  const { error: insertError, data: inserted } = await supabase
    .from("engine_memory")
    .insert(inserts)
    .select("id");

  if (insertError) {
    console.error("Failed to persist patterns:", insertError);
    return 0;
  }

  return inserted?.length ?? 0;
}

// ─── Cleanup Expired Patterns ───────────────────────────────────────────
async function cleanupExpired(
  supabase: ReturnType<typeof createClient>,
): Promise<CleanupResult> {
  const now = new Date().toISOString();

  // Delete expired learned patterns
  const { data: expiredPatterns, error: selectError } = await supabase
    .from("engine_memory")
    .select("id")
    .eq("memory_type", "learned_pattern")
    .lt("expires_at", now);

  if (selectError) {
    console.error("Failed to select expired patterns:", selectError);
    return { expired: 0, retained: 0 };
  }

  const expiredCount = expiredPatterns?.length ?? 0;

  if (expiredCount > 0) {
    const { error: deleteError } = await supabase
      .from("engine_memory")
      .delete()
      .eq("memory_type", "learned_pattern")
      .lt("expires_at", now);

    if (deleteError) {
      console.error("Failed to delete expired patterns:", deleteError);
    }
  }

  // Also cleanup expired predictions
  const { data: expiredPredictions } = await supabase
    .from("engine_memory")
    .select("id")
    .eq("memory_type", "prediction")
    .lt("expires_at", now);

  const predictionCount = expiredPredictions?.length ?? 0;

  if (predictionCount > 0) {
    await supabase
      .from("engine_memory")
      .delete()
      .eq("memory_type", "prediction")
      .lt("expires_at", now);
  }

  // Count retained (non-expired)
  const { data: retained } = await supabase
    .from("engine_memory")
    .select("id", { count: "exact" })
    .eq("memory_type", "learned_pattern")
    .is("expires_at", null);

  const retainedCount = retained?.length ?? 0;

  return {
    expired: expiredCount + predictionCount,
    retained: retainedCount,
  };
}

// ─── Main Handler ────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Auth: cron secret (fail closed with !cronSecret ||)
  const authHeader = req.headers.get("authorization");
  const cronSecret = Deno.env.get("WATCHDOG_CRON_SECRET");

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return new Response("Missing Supabase credentials", { status: 500, headers: corsHeaders });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

  try {
    // Step 1: Cleanup expired patterns first
    const cleanup = await cleanupExpired(supabase);

    console.log(
      JSON.stringify({
        level: "info",
        action: "ops_learn_retention_cleaned",
        category: "ops",
        expired: cleanup.expired,
        retained: cleanup.retained,
      }),
    );

    // Step 2: Query active workspaces
    const { data: workspaces, error: wsError } = await supabase
      .from("workspace")
      .select("workspace_id")
      .eq("is_active", true);

    if (wsError) {
      throw new Error(`Failed to query workspaces: ${wsError.message}`);
    }

    if (!workspaces || workspaces.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No active workspaces", patterns_persisted: 0 }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    // Step 3: Extract and persist patterns for each workspace
    let totalPatternsExtracted = 0;
    let totalPatternsPersisted = 0;

    for (const workspace of workspaces) {
      const workspaceId = workspace.workspace_id;

      // Run 3 extractors in parallel
      const [taskPatterns, staffingPatterns, deviationPatterns] = await Promise.all([
        extractTaskDurationPatterns(supabase, workspaceId),
        extractStaffingPatterns(supabase, workspaceId),
        extractDeviationCorrelations(supabase, workspaceId),
      ]);

      const allPatterns = [...taskPatterns, ...staffingPatterns, ...deviationPatterns];
      totalPatternsExtracted += allPatterns.length;

      if (allPatterns.length > 0) {
        const persisted = await persistPatterns(supabase, workspaceId, allPatterns);
        totalPatternsPersisted += persisted;

        // Emit telemetry per pattern type
        for (const pattern of allPatterns) {
          console.log(
            JSON.stringify({
              level: "info",
              action: "ops_learn_pattern_extracted",
              category: "ops",
              pattern_type: pattern.type,
              workspace_id: workspaceId,
              importance: pattern.importance,
              summary: pattern.summary,
            }),
          );
        }
      }
    }

    const response = {
      success: true,
      message: "Pattern extraction complete",
      workspaces_processed: workspaces.length,
      patterns_extracted: totalPatternsExtracted,
      patterns_persisted: totalPatternsPersisted,
      cleanup: cleanup,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "error",
        action: "ops_learn_failed",
        category: "ops",
        error: String(error),
      }),
    );

    return new Response(
      JSON.stringify({
        success: false,
        error: String(error),
      }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  }
});
