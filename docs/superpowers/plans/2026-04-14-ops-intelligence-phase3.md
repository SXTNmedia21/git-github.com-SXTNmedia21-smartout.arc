---
title: "AI Operations Intelligence — Phase 3 Implementation Plan"
status: draft
updated: 2026-04-14
created: 2026-04-14
module: ai
tags: [ai, operations, intelligence, phase-3, predict, learn, k1b]
---

# AI Operations Intelligence — Phase 3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the PREDICT and LEARN intelligence functions — weekly cron-driven Edge Functions that analyze operational data to generate coverage/compliance predictions and extract long-term patterns, plus on-demand tools for managers to query predictions and patterns during conversations.

**Architecture:** Two weekly Edge Functions (`ops-predict`, `ops-learn`) triggered by pg_cron. PREDICT writes advisory signals to `engine_memory` with `memory_type: 'prediction'` (7-day TTL). LEARN writes durable patterns to `engine_memory` with `memory_type: 'learned_pattern'` (90-day TTL unless importance >= 0.8). Three on-demand tools (`predict_coverage`, `predict_compliance`, `query_patterns`) in the `operations_intelligence` capability. All outputs are advisory only — never mutate cascade state.

**Tech Stack:** TypeScript, Zod, Supabase Edge Functions (Deno), pg_cron, `@smartout/telemetry` emit(), `engine_memory` (K1b).

**Spec:** `docs/superpowers/specs/2026-04-14-ai-operations-intelligence-design.md` (Section 6 + Section 10 steps 3a-3c)
**ADR:** `docs/decisions/0088-ai-operations-intelligence-capability.md`

> **DEFERRED:** Phase 3 requires operational data from Phases 1+2. Do not implement until sessions, tasks, deviations, and shifts have real production data flowing through the COMPILE/TRIAGE/MONITOR/ACT pipeline. This plan is written now for architectural completeness and to be ready for execution when data exists.

---

## File Map

### New Files
| Path | Responsibility |
|------|---------------|
| `supabase/functions/ops-predict/index.ts` | Edge Function: weekly prediction analysis (coverage, bottleneck, compliance, overload) |
| `supabase/functions/ops-learn/index.ts` | Edge Function: weekly pattern extraction + retention cleanup |
| `supabase/migrations/YYYYMMDDHHMMSS_ops_predict_learn_cron.sql` | pg_cron registration for both weekly jobs |
| `packages/ai/src/capabilities/operations-intelligence/predict-tools.ts` | `predict_coverage` and `predict_compliance` on-demand tools |
| `packages/ai/src/capabilities/operations-intelligence/learn-tools.ts` | `query_patterns` on-demand tool |
| `packages/i18n/locales/nb/ops-intelligence.json` | Norwegian i18n keys for PREDICT + LEARN |
| `packages/i18n/locales/en/ops-intelligence.json` | English i18n keys for PREDICT + LEARN |

### Modified Files
| Path | Change |
|------|--------|
| `packages/ai/src/capabilities/operations-intelligence/index.ts` | Import + register predict and learn tools |
| `packages/telemetry/src/registry.ts` | Add `ops.predict.*` and `ops.learn.*` event interfaces, union members, and routing entries |

---

## Task 1: i18n Keys for PREDICT + LEARN

**Files:**
- Create: `packages/i18n/locales/nb/ops-intelligence.json`
- Create: `packages/i18n/locales/en/ops-intelligence.json`

- [ ] **Step 1: Create Norwegian i18n file**

Create `packages/i18n/locales/nb/ops-intelligence.json`:

```json
{
  "ops.predict.label": "Prediksjon",
  "ops.predict.coverage_gap": "Dekningshull oppdaget",
  "ops.predict.coverage_gap_description": "{department} har {gap} ubesatte plasser {date}",
  "ops.predict.task_bottleneck": "Oppgaveflaskehals",
  "ops.predict.task_bottleneck_description": "{department} har {taskCount} oppgaver for {staffCount} ansatte",
  "ops.predict.compliance_risk": "Samsvarsrisiko",
  "ops.predict.compliance_risk_description": "HACCP fullforingsrate {rate}% siste 7 dager — under {threshold}% terskel",
  "ops.predict.employee_overload": "Ansattoverbelastning",
  "ops.predict.employee_overload_description": "{name} har {count} oppgaver — {pct}% over gjennomsnitt",
  "ops.predict.all_clear": "Alt ser bra ut. Ingen prediksjoner a flagge.",
  "ops.predict.generated": "Prediksjoner generert",
  "ops.predict.expires": "Utloper {date}",
  "ops.predict.confidence": "Konfidens: {value}%",
  "ops.learn.pattern_label": "Lart monster",
  "ops.learn.task_duration": "Oppgavevarighet",
  "ops.learn.task_duration_description": "{task} tar i snitt {actual} min mot estimert {estimated} min",
  "ops.learn.staffing_pattern": "Bemanningsmoenster",
  "ops.learn.staffing_pattern_description": "Fullforingsrate {rate}% ved {level} ansatte i {department}",
  "ops.learn.deviation_correlation": "Avviksmoenster",
  "ops.learn.deviation_correlation_description": "{procedure} har feilet {count} ganger siste {days} dager",
  "ops.learn.extracted": "Moenstre ekstrahert",
  "ops.learn.retention_cleaned": "Utgatte moenstre fjernet"
}
```

- [ ] **Step 2: Create English i18n file**

Create `packages/i18n/locales/en/ops-intelligence.json`:

```json
{
  "ops.predict.label": "Prediction",
  "ops.predict.coverage_gap": "Coverage gap detected",
  "ops.predict.coverage_gap_description": "{department} has {gap} unfilled positions on {date}",
  "ops.predict.task_bottleneck": "Task bottleneck",
  "ops.predict.task_bottleneck_description": "{department} has {taskCount} tasks for {staffCount} staff",
  "ops.predict.compliance_risk": "Compliance risk",
  "ops.predict.compliance_risk_description": "HACCP completion rate {rate}% over last 7 days — below {threshold}% threshold",
  "ops.predict.employee_overload": "Employee overload",
  "ops.predict.employee_overload_description": "{name} has {count} tasks — {pct}% above average",
  "ops.predict.all_clear": "Everything looks good. No predictions to flag.",
  "ops.predict.generated": "Predictions generated",
  "ops.predict.expires": "Expires {date}",
  "ops.predict.confidence": "Confidence: {value}%",
  "ops.learn.pattern_label": "Learned pattern",
  "ops.learn.task_duration": "Task duration",
  "ops.learn.task_duration_description": "{task} takes {actual} min on average vs estimated {estimated} min",
  "ops.learn.staffing_pattern": "Staffing pattern",
  "ops.learn.staffing_pattern_description": "Completion rate {rate}% at {level} staff in {department}",
  "ops.learn.deviation_correlation": "Deviation pattern",
  "ops.learn.deviation_correlation_description": "{procedure} has failed {count} times in last {days} days",
  "ops.learn.extracted": "Patterns extracted",
  "ops.learn.retention_cleaned": "Expired patterns cleaned"
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/i18n/locales/nb/ops-intelligence.json \
  packages/i18n/locales/en/ops-intelligence.json
git commit -m "feat(i18n): add ops-intelligence namespace for PREDICT + LEARN strings

ADR-0088 Phase 3: prediction labels, coverage gap, task bottleneck,
compliance risk, employee overload, learned pattern descriptions, and
retention cleanup strings in nb + en.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Telemetry Registry — PREDICT + LEARN Events

**Files:**
- Modify: `packages/telemetry/src/registry.ts`

- [ ] **Step 1: Add PREDICT + LEARN event interfaces**

In `packages/telemetry/src/registry.ts`, add after the existing operations intelligence event interfaces (added in Phase 1, near the end of the event interface section, before the `SmartoutEvent` union type):

```typescript
// ─── Operations Intelligence PREDICT Events (ADR-0088 Phase 3) ────────

export interface OpsPredictGenerated extends BaseEvent {
  event: "ops.predict generated";
  properties: {
    entity: { entity_type: "department"; entity_id: string };
    data: {
      prediction_type: "coverage_gap" | "task_bottleneck" | "compliance_risk" | "employee_overload";
      confidence: number;
      department_id: string;
    };
  };
}

export interface OpsPredictCoverageQueried extends BaseEvent {
  event: "ops.predict coverage_queried";
  properties: {
    entity: { entity_type: "department"; entity_id: string };
    data: { department_id: string; date_range_days: number; gaps_found: number };
  };
}

export interface OpsPredictComplianceQueried extends BaseEvent {
  event: "ops.predict compliance_queried";
  properties: {
    entity: { entity_type: "workspace"; entity_id: string };
    data: { department_id: string | null; completion_rate: number; threshold: number };
  };
}

// ─── Operations Intelligence LEARN Events (ADR-0088 Phase 3) ──────────

export interface OpsLearnPatternExtracted extends BaseEvent {
  event: "ops.learn pattern_extracted";
  properties: {
    entity: { entity_type: "workspace"; entity_id: string };
    data: {
      pattern_type: "task_duration" | "staffing" | "deviation_correlation";
      data_range_days: number;
      confidence: number;
    };
  };
}

export interface OpsLearnRetentionCleaned extends BaseEvent {
  event: "ops.learn retention_cleaned";
  properties: {
    entity: { entity_type: "workspace"; entity_id: string };
    data: { expired_count: number; retained_count: number };
  };
}

export interface OpsLearnPatternsQueried extends BaseEvent {
  event: "ops.learn patterns_queried";
  properties: {
    entity: { entity_type: "workspace"; entity_id: string };
    data: { pattern_type: string | null; results_count: number };
  };
}
```

- [ ] **Step 2: Add to SmartoutEvent union type**

Find the `SmartoutEvent` union type and add the new interfaces (after the Phase 1 ops entries):

```typescript
export type SmartoutEvent =
  // ... existing event types ...
  // Phase 1 ops entries already present:
  // | OpsCompileDayBrief
  // | OpsCompilePreclose
  // | OpsCompileShiftBrief
  // | OpsTriageClassified
  // Phase 3:
  | OpsPredictGenerated
  | OpsPredictCoverageQueried
  | OpsPredictComplianceQueried
  | OpsLearnPatternExtracted
  | OpsLearnRetentionCleaned
  | OpsLearnPatternsQueried;
```

- [ ] **Step 3: Add EVENT_ROUTING entries**

Find the `EVENT_ROUTING` record and add entries (after the Phase 1 ops entries):

```typescript
  // ─── Operations Intelligence PREDICT + LEARN (ADR-0088 Phase 3) ───
  "ops.predict generated": {
    destinations: ["logger", "engine_event"],
    category: "ops_intelligence",
  },
  "ops.predict coverage_queried": {
    destinations: ["logger", "engine_event"],
    category: "ops_intelligence",
  },
  "ops.predict compliance_queried": {
    destinations: ["logger", "engine_event"],
    category: "ops_intelligence",
  },
  "ops.learn pattern_extracted": {
    destinations: ["logger", "engine_event"],
    category: "ops_intelligence",
  },
  "ops.learn retention_cleaned": {
    destinations: ["logger", "engine_event"],
    category: "ops_intelligence",
  },
  "ops.learn patterns_queried": {
    destinations: ["logger", "engine_event"],
    category: "ops_intelligence",
  },
```

- [ ] **Step 4: Verify typecheck**

Run: `pnpm turbo typecheck --filter=@smartout/telemetry`
Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add packages/telemetry/src/registry.ts
git commit -m "feat(telemetry): register ops.predict.* and ops.learn.* events

ADR-0088 Phase 3: adds PREDICT events (generated, coverage_queried,
compliance_queried) and LEARN events (pattern_extracted,
retention_cleaned, patterns_queried) to the telemetry registry with
logger + engine_event routing.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: `ops-predict` Edge Function

**Files:**
- Create: `supabase/functions/ops-predict/index.ts`

- [ ] **Step 1: Create the Edge Function**

Create `supabase/functions/ops-predict/index.ts`:

```typescript
/**
 * ops-predict — Weekly prediction analysis Edge Function.
 *
 * Runs weekly (Sunday 22:00 UTC / Monday 00:00 Oslo) via pg_cron.
 * Analyzes upcoming week's operational data across all active workspaces:
 * 1. Coverage gap detection (schedule vs min_staff)
 * 2. Task bottleneck detection (task density vs staff count)
 * 3. Compliance risk analysis (HACCP check completion rates)
 * 4. Employee overload detection (task count vs average)
 *
 * Predictions persist to engine_memory with memory_type 'prediction'
 * and expire after 7 days. Advisory only — never mutates cascade state.
 *
 * Auth: WATCHDOG_CRON_SECRET bearer token (cron-only pattern).
 * ADR-0088: AI Operations Intelligence Phase 3 — PREDICT function.
 */

import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

// ── Types ──────────────────────────────────────────────────────────────

type PredictionType =
  | "coverage_gap"
  | "task_bottleneck"
  | "compliance_risk"
  | "employee_overload";

type Prediction = {
  type: PredictionType;
  department_id: string | null;
  confidence: number;
  summary: string;
  details: Record<string, unknown>;
};

// ── Analysis Functions ─────────────────────────────────────────────────

/**
 * Coverage gap: compare upcoming 7-day schedule against min_staff
 * from department operating hours. Gaps = time slots where scheduled
 * staff count < min_staff threshold.
 */
async function detectCoverageGaps(
  supabase: ReturnType<typeof createClient>,
  workspaceId: string,
): Promise<Prediction[]> {
  const predictions: Prediction[] = [];
  const today = new Date();
  const weekAhead = new Date(today.getTime() + 7 * 86400000);
  const todayStr = today.toISOString().slice(0, 10);
  const weekAheadStr = weekAhead.toISOString().slice(0, 10);

  // Get departments with operating hours (min_staff)
  const { data: departments } = await supabase
    .from("department")
    .select("department_id, name")
    .eq("workspace_id", workspaceId)
    .eq("is_active", true);

  if (!departments?.length) return predictions;

  for (const dept of departments) {
    // Get min_staff from operating hours
    const { data: opHours } = await supabase
      .from("department_operating_hours")
      .select("day_of_week, min_staff")
      .eq("department_id", dept.department_id)
      .not("min_staff", "is", null);

    if (!opHours?.length) continue;

    const minStaffByDay = new Map<number, number>();
    for (const oh of opHours) {
      minStaffByDay.set(oh.day_of_week, oh.min_staff ?? 0);
    }

    // Count scheduled shifts per day in the upcoming week
    const { data: shifts } = await supabase
      .from("schedule_shift")
      .select("shift_date, employee_id")
      .eq("workspace_id", workspaceId)
      .eq("department_id", dept.department_id)
      .gte("shift_date", todayStr)
      .lte("shift_date", weekAheadStr)
      .in("status", ["published", "confirmed"]);

    // Group shifts by date
    const shiftsByDate = new Map<string, number>();
    for (const shift of shifts ?? []) {
      const date = shift.shift_date;
      shiftsByDate.set(date, (shiftsByDate.get(date) ?? 0) + 1);
    }

    // Check each day in the upcoming week
    const gapDays: { date: string; scheduled: number; required: number }[] = [];
    for (let i = 0; i < 7; i++) {
      const checkDate = new Date(today.getTime() + i * 86400000);
      const dayOfWeek = checkDate.getDay(); // 0 = Sunday
      const dateStr = checkDate.toISOString().slice(0, 10);
      const minStaff = minStaffByDay.get(dayOfWeek) ?? 0;
      const scheduled = shiftsByDate.get(dateStr) ?? 0;

      if (minStaff > 0 && scheduled < minStaff) {
        gapDays.push({ date: dateStr, scheduled, required: minStaff });
      }
    }

    if (gapDays.length > 0) {
      const totalGap = gapDays.reduce((sum, g) => sum + (g.required - g.scheduled), 0);
      predictions.push({
        type: "coverage_gap",
        department_id: dept.department_id,
        confidence: Math.min(0.95, 0.7 + (gapDays.length / 7) * 0.25),
        summary: `${dept.name} has ${gapDays.length} day(s) with coverage gaps in the next 7 days (${totalGap} total unfilled positions)`,
        details: { gap_days: gapDays, total_gap: totalGap },
      });
    }
  }

  return predictions;
}

/**
 * Task bottleneck: compare average task count per session against
 * staff count. High ratio = bottleneck risk.
 */
async function detectTaskBottlenecks(
  supabase: ReturnType<typeof createClient>,
  workspaceId: string,
): Promise<Prediction[]> {
  const predictions: Prediction[] = [];
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);

  // Get recent sessions with task and shift counts
  const { data: sessions } = await supabase
    .from("department_session")
    .select(
      "department_session_id, department_id, tasks_total, session_date, department:department_id(name)",
    )
    .eq("workspace_id", workspaceId)
    .gte("session_date", sevenDaysAgo)
    .not("tasks_total", "is", null);

  if (!sessions?.length) return predictions;

  // Group by department and compute average task density
  const deptStats = new Map<
    string,
    { name: string; totalTasks: number; sessionCount: number; department_id: string }
  >();

  for (const session of sessions) {
    const deptId = session.department_id;
    const deptName = (session.department as { name: string } | null)?.name ?? "Department";
    const existing = deptStats.get(deptId) ?? {
      name: deptName,
      totalTasks: 0,
      sessionCount: 0,
      department_id: deptId,
    };
    existing.totalTasks += session.tasks_total ?? 0;
    existing.sessionCount++;
    deptStats.set(deptId, existing);
  }

  for (const [deptId, stats] of deptStats) {
    const avgTasks = stats.totalTasks / stats.sessionCount;

    // Get average staff count for those sessions
    const { data: shifts } = await supabase
      .from("schedule_shift")
      .select("shift_date")
      .eq("workspace_id", workspaceId)
      .eq("department_id", deptId)
      .gte("shift_date", sevenDaysAgo)
      .in("status", ["published", "confirmed", "completed"]);

    const shiftCount = shifts?.length ?? 0;
    const avgStaff = shiftCount / Math.max(stats.sessionCount, 1);

    // Bottleneck: more than 8 tasks per staff member per session
    const taskPerStaff = avgStaff > 0 ? avgTasks / avgStaff : avgTasks;
    if (taskPerStaff > 8) {
      predictions.push({
        type: "task_bottleneck",
        department_id: deptId,
        confidence: Math.min(0.9, 0.5 + (taskPerStaff - 8) * 0.05),
        summary: `${stats.name} averages ${taskPerStaff.toFixed(1)} tasks per staff member — potential bottleneck`,
        details: {
          avg_tasks: avgTasks,
          avg_staff: avgStaff,
          task_per_staff: taskPerStaff,
          sessions_analyzed: stats.sessionCount,
        },
      });
    }
  }

  return predictions;
}

/**
 * Compliance risk: analyze HACCP-related task completion rates.
 * Uses session_task where task_type includes HACCP patterns.
 */
async function detectComplianceRisk(
  supabase: ReturnType<typeof createClient>,
  workspaceId: string,
): Promise<Prediction[]> {
  const predictions: Prediction[] = [];
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();

  // Get HACCP-related tasks from the last 7 days
  const { data: haccpTasks } = await supabase
    .from("session_task")
    .select("id, status, department_session_id, task_type")
    .eq("workspace_id", workspaceId)
    .gte("created_at", sevenDaysAgo)
    .or("task_type.ilike.%haccp%,task_type.ilike.%temperature%,task_type.ilike.%hygiene%");

  if (!haccpTasks?.length) return predictions;

  const total = haccpTasks.length;
  const completed = haccpTasks.filter((t) => t.status === "completed").length;
  const completionRate = total > 0 ? (completed / total) * 100 : 100;

  // Flag if below 90% compliance threshold
  if (completionRate < 90) {
    // Group by department session to find which departments are problematic
    const sessionIds = [...new Set(haccpTasks.map((t) => t.department_session_id))];
    const { data: sessions } = await supabase
      .from("department_session")
      .select("department_id, department:department_id(name)")
      .in("department_session_id", sessionIds.slice(0, 50));

    const deptNames = (sessions ?? [])
      .map((s) => (s.department as { name: string } | null)?.name)
      .filter(Boolean);
    const uniqueDepts = [...new Set(deptNames)];

    predictions.push({
      type: "compliance_risk",
      department_id: null,
      confidence: Math.min(0.95, 0.6 + ((90 - completionRate) / 90) * 0.35),
      summary: `HACCP completion rate is ${completionRate.toFixed(1)}% (below 90% threshold) across ${uniqueDepts.length} department(s)`,
      details: {
        completion_rate: completionRate,
        total_tasks: total,
        completed_tasks: completed,
        threshold: 90,
        affected_departments: uniqueDepts,
      },
    });
  }

  return predictions;
}

/**
 * Employee overload: detect employees whose task count is significantly
 * above the workspace average (> 150% of mean).
 */
async function detectEmployeeOverload(
  supabase: ReturnType<typeof createClient>,
  workspaceId: string,
): Promise<Prediction[]> {
  const predictions: Prediction[] = [];
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();

  // Get task counts per employee in the last 7 days
  const { data: tasks } = await supabase
    .from("session_task")
    .select("assigned_to")
    .eq("workspace_id", workspaceId)
    .gte("created_at", sevenDaysAgo)
    .not("assigned_to", "is", null);

  if (!tasks?.length) return predictions;

  // Count tasks per employee
  const taskCounts = new Map<string, number>();
  for (const task of tasks) {
    const assignee = task.assigned_to as string;
    taskCounts.set(assignee, (taskCounts.get(assignee) ?? 0) + 1);
  }

  const counts = [...taskCounts.values()];
  const mean = counts.reduce((sum, c) => sum + c, 0) / counts.length;
  const overloadThreshold = mean * 1.5;

  // Find overloaded employees
  for (const [profileId, count] of taskCounts) {
    if (count > overloadThreshold && mean > 0) {
      const pctAbove = ((count - mean) / mean) * 100;

      // Fetch employee name
      const { data: profile } = await supabase
        .from("profile")
        .select("full_name, department_id")
        .eq("profile_id", profileId)
        .single();

      predictions.push({
        type: "employee_overload",
        department_id: profile?.department_id ?? null,
        confidence: Math.min(0.85, 0.5 + (pctAbove / 200) * 0.35),
        summary: `${profile?.full_name ?? "Unknown"} has ${count} tasks (${pctAbove.toFixed(0)}% above average of ${mean.toFixed(0)})`,
        details: {
          profile_id: profileId,
          task_count: count,
          workspace_average: mean,
          pct_above_average: pctAbove,
        },
      });
    }
  }

  return predictions;
}

// ── Persistence ────────────────────────────────────────────────────────

/**
 * Persist predictions to engine_memory with memory_type 'prediction'.
 * Each prediction expires after 7 days. Uses a system profile_id
 * (first admin found) as the memory author.
 */
async function persistPredictions(
  supabase: ReturnType<typeof createClient>,
  workspaceId: string,
  predictions: Prediction[],
): Promise<number> {
  if (predictions.length === 0) return 0;

  // Find a system-level profile to own the memory entries
  const { data: adminProfile } = await supabase
    .from("profile")
    .select("profile_id")
    .eq("workspace_id", workspaceId)
    .eq("role", "admin")
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  const authorId = adminProfile?.profile_id;
  if (!authorId) return 0;

  const expiresAt = new Date(Date.now() + 7 * 86400000).toISOString();

  const rows = predictions.map((p) => ({
    workspace_id: workspaceId,
    profile_id: authorId,
    memory_type: "prediction",
    scope: "workspace",
    importance: p.confidence,
    content: JSON.stringify({
      prediction_type: p.type,
      summary: p.summary,
      details: p.details,
      department_id: p.department_id,
      generated_at: new Date().toISOString(),
    }),
    expires_at: expiresAt,
  }));

  const { data, error } = await supabase.from("engine_memory").insert(rows).select("id");
  if (error) {
    console.error("[ops-predict] Failed to persist predictions:", error.message);
    return 0;
  }

  return data?.length ?? 0;
}

// ── Handler ────────────────────────────────────────────────────────────

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
    // Find all active workspaces
    const { data: workspaces, error: wsError } = await supabase
      .from("workspace")
      .select("workspace_id")
      .eq("is_active", true);

    if (wsError) throw wsError;
    if (!workspaces?.length) {
      return new Response(JSON.stringify({ predictions: 0, message: "No active workspaces" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let totalPredictions = 0;
    const errors: string[] = [];

    for (const ws of workspaces) {
      try {
        // Run all detection functions in parallel
        const [coverageGaps, bottlenecks, complianceRisks, overloads] = await Promise.all([
          detectCoverageGaps(supabase, ws.workspace_id),
          detectTaskBottlenecks(supabase, ws.workspace_id),
          detectComplianceRisk(supabase, ws.workspace_id),
          detectEmployeeOverload(supabase, ws.workspace_id),
        ]);

        const allPredictions = [
          ...coverageGaps,
          ...bottlenecks,
          ...complianceRisks,
          ...overloads,
        ];

        // Persist to engine_memory
        const persisted = await persistPredictions(supabase, ws.workspace_id, allPredictions);
        totalPredictions += persisted;

        // Emit telemetry per prediction
        for (const prediction of allPredictions) {
          await supabase.from("engine_event").insert({
            workspace_id: ws.workspace_id,
            event_type: "ops.predict.generated",
            payload: {
              prediction_type: prediction.type,
              confidence: prediction.confidence,
              department_id: prediction.department_id,
              source: "cron",
              origin: "system",
            },
          });
        }
      } catch (e) {
        errors.push(`workspace ${ws.workspace_id}: ${String(e)}`);
      }
    }

    return new Response(
      JSON.stringify({
        status: errors.length > 0 ? "partial" : "ok",
        predictions: totalPredictions,
        workspaces_processed: workspaces.length,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/ops-predict/index.ts
git commit -m "feat(edge): add ops-predict weekly prediction Edge Function

ADR-0088 Phase 3 PREDICT: weekly cron analysis of coverage gaps,
task bottlenecks, HACCP compliance risk, and employee overload.
Persists advisory predictions to engine_memory (memory_type
'prediction', 7-day TTL). Never mutates cascade state.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: `ops-learn` Edge Function

**Files:**
- Create: `supabase/functions/ops-learn/index.ts`

- [ ] **Step 1: Create the Edge Function**

Create `supabase/functions/ops-learn/index.ts`:

```typescript
/**
 * ops-learn — Weekly pattern extraction and retention cleanup Edge Function.
 *
 * Runs weekly (Monday 01:00 UTC / 03:00 Oslo) via pg_cron.
 * Two responsibilities:
 * 1. Extract patterns from the last 30 days of operational data:
 *    - Task duration patterns (actual vs estimated completion times)
 *    - Staffing patterns (task completion rates by staffing level)
 *    - Deviation correlation (repeated procedure failures)
 * 2. Retention cleanup: expire engine_memory entries with
 *    memory_type 'learned_pattern' older than 90 days unless
 *    importance >= 0.8
 *
 * Patterns persist to engine_memory (K1b) with memory_type 'learned_pattern',
 * importance 0.0-1.0.
 *
 * Auth: WATCHDOG_CRON_SECRET bearer token (cron-only pattern).
 * ADR-0088: AI Operations Intelligence Phase 3 — LEARN function.
 */

import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

// ── Types ──────────────────────────────────────────────────────────────

type PatternType = "task_duration" | "staffing" | "deviation_correlation";

type LearnedPattern = {
  type: PatternType;
  importance: number;
  summary: string;
  details: Record<string, unknown>;
  department_id: string | null;
};

// ── Pattern Extraction Functions ───────────────────────────────────────

/**
 * Task duration patterns: compare actual completion time (completed_at - created_at)
 * against estimated duration on session_task. Surface tasks where actual consistently
 * differs from estimated by > 30%.
 */
async function extractTaskDurationPatterns(
  supabase: ReturnType<typeof createClient>,
  workspaceId: string,
): Promise<LearnedPattern[]> {
  const patterns: LearnedPattern[] = [];
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();

  // Get completed tasks with both created_at and updated_at (proxy for completion)
  const { data: tasks } = await supabase
    .from("session_task")
    .select("title, task_type, created_at, updated_at, status, estimated_duration_minutes")
    .eq("workspace_id", workspaceId)
    .eq("status", "completed")
    .gte("created_at", thirtyDaysAgo)
    .not("estimated_duration_minutes", "is", null);

  if (!tasks?.length) return patterns;

  // Group by task_type and compute average actual vs estimated
  const taskTypeStats = new Map<
    string,
    { totalActual: number; totalEstimated: number; count: number; sampleTitle: string }
  >();

  for (const task of tasks) {
    const estimated = task.estimated_duration_minutes as number;
    if (estimated <= 0) continue;

    const createdAt = new Date(task.created_at).getTime();
    const updatedAt = new Date(task.updated_at).getTime();
    const actualMinutes = (updatedAt - createdAt) / 60000;

    // Skip unreasonable values (> 24 hours or negative)
    if (actualMinutes <= 0 || actualMinutes > 1440) continue;

    const key = task.task_type ?? task.title;
    const existing = taskTypeStats.get(key) ?? {
      totalActual: 0,
      totalEstimated: 0,
      count: 0,
      sampleTitle: task.title,
    };
    existing.totalActual += actualMinutes;
    existing.totalEstimated += estimated;
    existing.count++;
    taskTypeStats.set(key, existing);
  }

  for (const [taskType, stats] of taskTypeStats) {
    if (stats.count < 5) continue; // Need sufficient data

    const avgActual = stats.totalActual / stats.count;
    const avgEstimated = stats.totalEstimated / stats.count;
    const driftPct = Math.abs(avgActual - avgEstimated) / avgEstimated;

    // Only surface if drift > 30%
    if (driftPct > 0.3) {
      patterns.push({
        type: "task_duration",
        department_id: null,
        importance: Math.min(0.9, 0.4 + driftPct * 0.5),
        summary: `"${stats.sampleTitle}" (${taskType}) takes ${avgActual.toFixed(0)} min on average vs ${avgEstimated.toFixed(0)} min estimated (${(driftPct * 100).toFixed(0)}% drift over ${stats.count} completions)`,
        details: {
          task_type: taskType,
          avg_actual_minutes: avgActual,
          avg_estimated_minutes: avgEstimated,
          drift_pct: driftPct,
          sample_count: stats.count,
        },
      });
    }
  }

  return patterns;
}

/**
 * Staffing patterns: correlate task completion rates with the number
 * of staff on shift per department session. Surfaces departments where
 * staffing level strongly correlates with completion quality.
 */
async function extractStaffingPatterns(
  supabase: ReturnType<typeof createClient>,
  workspaceId: string,
): Promise<LearnedPattern[]> {
  const patterns: LearnedPattern[] = [];
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

  // Get recent sessions with task completion data
  const { data: sessions } = await supabase
    .from("department_session")
    .select(
      "department_session_id, department_id, session_date, tasks_total, tasks_completed, department:department_id(name)",
    )
    .eq("workspace_id", workspaceId)
    .gte("session_date", thirtyDaysAgo)
    .not("tasks_total", "is", null)
    .gt("tasks_total", 0);

  if (!sessions?.length) return patterns;

  // For each session, count how many staff were on shift
  const sessionData: {
    department_id: string;
    dept_name: string;
    staff_count: number;
    completion_rate: number;
  }[] = [];

  for (const session of sessions) {
    const { data: shifts } = await supabase
      .from("schedule_shift")
      .select("employee_id")
      .eq("workspace_id", workspaceId)
      .eq("department_id", session.department_id)
      .eq("shift_date", session.session_date)
      .in("status", ["published", "confirmed", "completed"]);

    const staffCount = shifts?.length ?? 0;
    const completionRate =
      (session.tasks_total ?? 0) > 0
        ? ((session.tasks_completed ?? 0) / (session.tasks_total ?? 1)) * 100
        : 100;

    const deptName = (session.department as { name: string } | null)?.name ?? "Department";

    sessionData.push({
      department_id: session.department_id,
      dept_name: deptName,
      staff_count: staffCount,
      completion_rate: completionRate,
    });
  }

  // Group by department and find staffing-completion correlation
  const deptGroups = new Map<
    string,
    { name: string; dataPoints: { staff: number; rate: number }[] }
  >();

  for (const sd of sessionData) {
    const existing = deptGroups.get(sd.department_id) ?? { name: sd.dept_name, dataPoints: [] };
    existing.dataPoints.push({ staff: sd.staff_count, rate: sd.completion_rate });
    deptGroups.set(sd.department_id, existing);
  }

  for (const [deptId, group] of deptGroups) {
    if (group.dataPoints.length < 7) continue; // Need enough data

    // Compute average completion rate per staffing level
    const byLevel = new Map<number, { totalRate: number; count: number }>();
    for (const dp of group.dataPoints) {
      const existing = byLevel.get(dp.staff) ?? { totalRate: 0, count: 0 };
      existing.totalRate += dp.rate;
      existing.count++;
      byLevel.set(dp.staff, existing);
    }

    const levels = [...byLevel.entries()]
      .map(([level, stats]) => ({
        staff_level: level,
        avg_completion_rate: stats.totalRate / stats.count,
        sessions_count: stats.count,
      }))
      .sort((a, b) => a.staff_level - b.staff_level);

    // Only surface if there is notable variance (> 15% spread between min/max)
    if (levels.length >= 2) {
      const rates = levels.map((l) => l.avg_completion_rate);
      const spread = Math.max(...rates) - Math.min(...rates);

      if (spread > 15) {
        const bestLevel = levels.reduce((a, b) =>
          a.avg_completion_rate > b.avg_completion_rate ? a : b,
        );

        patterns.push({
          type: "staffing",
          department_id: deptId,
          importance: Math.min(0.85, 0.4 + (spread / 100) * 0.45),
          summary: `${group.name}: best completion rate (${bestLevel.avg_completion_rate.toFixed(0)}%) at ${bestLevel.staff_level} staff. Spread: ${spread.toFixed(0)}% across staffing levels.`,
          details: {
            department_name: group.name,
            levels,
            spread,
            data_points: group.dataPoints.length,
          },
        });
      }
    }
  }

  return patterns;
}

/**
 * Deviation correlation: find procedures/tasks that repeatedly generate
 * deviations. A procedure that fails 3+ times in 30 days warrants review.
 */
async function extractDeviationCorrelations(
  supabase: ReturnType<typeof createClient>,
  workspaceId: string,
): Promise<LearnedPattern[]> {
  const patterns: LearnedPattern[] = [];
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();

  // Get deviations from the last 30 days
  const { data: deviations } = await supabase
    .from("deviation")
    .select("title, department_id, severity, linked_procedure_id, created_at")
    .eq("workspace_id", workspaceId)
    .gte("created_at", thirtyDaysAgo);

  if (!deviations?.length) return patterns;

  // Group by linked_procedure_id (or title if no procedure link)
  const groups = new Map<
    string,
    {
      key: string;
      count: number;
      severities: string[];
      department_id: string | null;
      dates: string[];
    }
  >();

  for (const dev of deviations) {
    const key = dev.linked_procedure_id ?? dev.title;
    const existing = groups.get(key) ?? {
      key,
      count: 0,
      severities: [],
      department_id: dev.department_id,
      dates: [],
    };
    existing.count++;
    existing.severities.push(dev.severity);
    existing.dates.push(dev.created_at);
    groups.set(key, existing);
  }

  for (const [key, group] of groups) {
    if (group.count < 3) continue; // Threshold: 3+ occurrences

    const criticalCount = group.severities.filter((s) => s === "critical").length;

    patterns.push({
      type: "deviation_correlation",
      department_id: group.department_id,
      importance: Math.min(0.95, 0.5 + (group.count / 20) * 0.3 + (criticalCount > 0 ? 0.15 : 0)),
      summary: `"${key}" has generated ${group.count} deviations in 30 days${criticalCount > 0 ? ` (${criticalCount} critical)` : ""} — consider procedure review`,
      details: {
        procedure_or_title: key,
        deviation_count: group.count,
        critical_count: criticalCount,
        date_range_days: 30,
        first_occurrence: group.dates.sort()[0],
        last_occurrence: group.dates.sort().pop(),
      },
    });
  }

  return patterns;
}

// ── Persistence ────────────────────────────────────────────────────────

/**
 * Persist learned patterns to engine_memory with memory_type 'learned_pattern'.
 * Entries expire after 90 days unless importance >= 0.8.
 */
async function persistPatterns(
  supabase: ReturnType<typeof createClient>,
  workspaceId: string,
  learnedPatterns: LearnedPattern[],
): Promise<number> {
  if (learnedPatterns.length === 0) return 0;

  // Find system profile to own entries
  const { data: adminProfile } = await supabase
    .from("profile")
    .select("profile_id")
    .eq("workspace_id", workspaceId)
    .eq("role", "admin")
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  const authorId = adminProfile?.profile_id;
  if (!authorId) return 0;

  const ninetyDaysFromNow = new Date(Date.now() + 90 * 86400000).toISOString();

  const rows = learnedPatterns.map((p) => ({
    workspace_id: workspaceId,
    profile_id: authorId,
    memory_type: "learned_pattern",
    scope: "workspace",
    importance: p.importance,
    content: JSON.stringify({
      pattern_type: p.type,
      summary: p.summary,
      details: p.details,
      department_id: p.department_id,
      extracted_at: new Date().toISOString(),
    }),
    // High-importance patterns (>= 0.8) have no expiry (retained permanently)
    expires_at: p.importance >= 0.8 ? null : ninetyDaysFromNow,
  }));

  const { data, error } = await supabase.from("engine_memory").insert(rows).select("id");
  if (error) {
    console.error("[ops-learn] Failed to persist patterns:", error.message);
    return 0;
  }

  return data?.length ?? 0;
}

/**
 * Retention cleanup: delete engine_memory entries where:
 * - memory_type = 'learned_pattern'
 * - expires_at < now()
 * This respects the importance-based retention: entries with importance >= 0.8
 * were written with expires_at = null, so they are never cleaned up.
 */
async function cleanupExpired(
  supabase: ReturnType<typeof createClient>,
): Promise<{ expired: number; retained: number }> {
  const now = new Date().toISOString();

  // Count retained (for reporting)
  const { count: retainedCount } = await supabase
    .from("engine_memory")
    .select("id", { count: "exact", head: true })
    .eq("memory_type", "learned_pattern")
    .is("expires_at", null);

  // Delete expired entries
  const { data: deleted, error } = await supabase
    .from("engine_memory")
    .delete()
    .eq("memory_type", "learned_pattern")
    .lt("expires_at", now)
    .select("id");

  if (error) {
    console.error("[ops-learn] Retention cleanup error:", error.message);
    return { expired: 0, retained: retainedCount ?? 0 };
  }

  // Also clean up expired predictions while we are here
  const { data: deletedPredictions } = await supabase
    .from("engine_memory")
    .delete()
    .eq("memory_type", "prediction")
    .lt("expires_at", now)
    .select("id");

  const totalExpired = (deleted?.length ?? 0) + (deletedPredictions?.length ?? 0);

  return { expired: totalExpired, retained: retainedCount ?? 0 };
}

// ── Handler ────────────────────────────────────────────────────────────

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
    // Step 1: Retention cleanup (runs first, across all workspaces)
    const retention = await cleanupExpired(supabase);

    // Emit retention telemetry
    await supabase.from("engine_event").insert({
      workspace_id: null,
      event_type: "ops.learn.retention_cleaned",
      payload: {
        expired_count: retention.expired,
        retained_count: retention.retained,
        source: "cron",
        origin: "system",
      },
    });

    // Step 2: Extract patterns per workspace
    const { data: workspaces, error: wsError } = await supabase
      .from("workspace")
      .select("workspace_id")
      .eq("is_active", true);

    if (wsError) throw wsError;

    let totalPatterns = 0;
    const errors: string[] = [];

    for (const ws of workspaces ?? []) {
      try {
        // Run all extraction functions in parallel
        const [taskDurations, staffingPatterns, deviationCorrelations] = await Promise.all([
          extractTaskDurationPatterns(supabase, ws.workspace_id),
          extractStaffingPatterns(supabase, ws.workspace_id),
          extractDeviationCorrelations(supabase, ws.workspace_id),
        ]);

        const allPatterns = [...taskDurations, ...staffingPatterns, ...deviationCorrelations];

        // Persist to K1b
        const persisted = await persistPatterns(supabase, ws.workspace_id, allPatterns);
        totalPatterns += persisted;

        // Emit telemetry per pattern
        for (const pattern of allPatterns) {
          await supabase.from("engine_event").insert({
            workspace_id: ws.workspace_id,
            event_type: "ops.learn.pattern_extracted",
            payload: {
              pattern_type: pattern.type,
              data_range_days: 30,
              confidence: pattern.importance,
              source: "cron",
              origin: "system",
            },
          });
        }
      } catch (e) {
        errors.push(`workspace ${ws.workspace_id}: ${String(e)}`);
      }
    }

    return new Response(
      JSON.stringify({
        status: errors.length > 0 ? "partial" : "ok",
        patterns_extracted: totalPatterns,
        retention: retention,
        workspaces_processed: workspaces?.length ?? 0,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/ops-learn/index.ts
git commit -m "feat(edge): add ops-learn weekly pattern extraction Edge Function

ADR-0088 Phase 3 LEARN: weekly cron extracts task duration, staffing,
and deviation correlation patterns from 30-day operational data.
Persists to engine_memory (K1b) with memory_type 'learned_pattern',
importance 0.0-1.0. Retention cleanup: expire after 90 days unless
importance >= 0.8. Also cleans expired predictions.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: pg_cron Registration for PREDICT + LEARN

**Files:**
- Create: `supabase/migrations/YYYYMMDDHHMMSS_ops_predict_learn_cron.sql`

- [ ] **Step 1: Write the cron migration**

Create `supabase/migrations/20260414231000_ops_predict_learn_cron.sql`:

```sql
-- ============================================
-- 20260414231000_ops_predict_learn_cron.sql
-- Registers pg_cron jobs for weekly PREDICT and LEARN Edge Functions.
-- ADR-0088: AI Operations Intelligence Phase 3.
--
-- Schedule:
--   ops-predict: Sunday 22:00 UTC (Monday 00:00 Oslo)
--   ops-learn:   Monday 01:00 UTC (Monday 03:00 Oslo)
--
-- LEARN runs 3 hours after PREDICT so that fresh predictions
-- exist before pattern extraction runs.
-- ============================================

-- ops-predict: weekly prediction analysis
DO $cmd$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'ops-predict',
      '0 22 * * 0',
      $sql$SELECT net.http_post(
        url := current_setting('app.supabase_url', true) || '/functions/v1/ops-predict',
        headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.watchdog_cron_secret', true))
      )$sql$
    );
  END IF;
END $cmd$;

-- ops-learn: weekly pattern extraction + retention cleanup
DO $cmd$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'ops-learn',
      '0 1 * * 1',
      $sql$SELECT net.http_post(
        url := current_setting('app.supabase_url', true) || '/functions/v1/ops-learn',
        headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.watchdog_cron_secret', true))
      )$sql$
    );
  END IF;
END $cmd$;
```

- [ ] **Step 2: Apply migration locally**

Run: `npx supabase db reset` or `npx supabase migration up`
Expected: Migration applies without errors.

- [ ] **Step 3: Verify cron jobs registered**

After reset, run SQL:
```sql
SELECT jobname, schedule FROM cron.job WHERE jobname LIKE 'ops-%';
```
Expected:
| jobname | schedule |
|---------|----------|
| ops-day-brief | 0 5 * * * |
| ops-predict | 0 22 * * 0 |
| ops-learn | 0 1 * * 1 |

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260414231000_ops_predict_learn_cron.sql
git commit -m "feat(db): register pg_cron jobs for ops-predict and ops-learn

ADR-0088 Phase 3: weekly PREDICT runs Sunday 22:00 UTC, weekly LEARN
runs Monday 01:00 UTC. LEARN scheduled after PREDICT so fresh
predictions exist before pattern extraction.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: On-Demand Tool — `predict_coverage`

**Files:**
- Create: `packages/ai/src/capabilities/operations-intelligence/predict-tools.ts`

- [ ] **Step 1: Create the predict tools file**

Create `packages/ai/src/capabilities/operations-intelligence/predict-tools.ts`:

```typescript
// packages/ai/src/capabilities/operations-intelligence/predict-tools.ts
// ADR-0088 Phase 3: On-demand PREDICT tools for manager conversations.
// These query existing predictions from engine_memory and/or run
// lightweight analysis on demand. Advisory only — never mutate cascade.

import { z } from "zod";
import { defineTool } from "../../types.js";
import type { AgentToolContext } from "../types.js";

/**
 * predict_coverage — Analyze upcoming schedule for coverage gaps.
 * Compares scheduled shifts against min_staff from department_operating_hours
 * for the next N days. Returns gap details per day.
 */
export const predictCoverage = defineTool({
  name: "predict_coverage",
  description:
    "Analyze upcoming schedule for coverage gaps — compares scheduled shifts against minimum staff requirements per department",
  schema: z.object({
    department_id: z
      .string()
      .uuid()
      .describe("Department to analyze. Required."),
    days_ahead: z
      .number()
      .int()
      .min(1)
      .max(14)
      .optional()
      .default(7)
      .describe("Number of days to look ahead (1-14, default 7)"),
  }),
  execute: async (params, ctx: AgentToolContext) => {
    const supabase = ctx.supabaseAdmin;
    const daysAhead = params.days_ahead ?? 7;
    const today = new Date();

    // 1. Get min_staff from operating hours
    const { data: opHours } = await supabase
      .from("department_operating_hours")
      .select("day_of_week, min_staff")
      .eq("department_id", params.department_id)
      .not("min_staff", "is", null);

    if (!opHours?.length) {
      return JSON.stringify({
        status: "no_data",
        message: "No minimum staff requirements configured for this department.",
      });
    }

    const minStaffByDay = new Map<number, number>();
    for (const oh of opHours) {
      minStaffByDay.set(oh.day_of_week, oh.min_staff ?? 0);
    }

    // 2. Get scheduled shifts for the upcoming period
    const startDate = today.toISOString().slice(0, 10);
    const endDate = new Date(today.getTime() + daysAhead * 86400000).toISOString().slice(0, 10);

    const { data: shifts } = await supabase
      .from("schedule_shift")
      .select("shift_date, employee_id")
      .eq("workspace_id", ctx.workspaceId)
      .eq("department_id", params.department_id)
      .gte("shift_date", startDate)
      .lte("shift_date", endDate)
      .in("status", ["published", "confirmed"]);

    // 3. Group shifts by date
    const shiftsByDate = new Map<string, number>();
    for (const shift of shifts ?? []) {
      shiftsByDate.set(shift.shift_date, (shiftsByDate.get(shift.shift_date) ?? 0) + 1);
    }

    // 4. Check each day
    const analysis: {
      date: string;
      day_of_week: number;
      scheduled: number;
      required: number;
      gap: number;
      status: "ok" | "gap" | "no_requirement";
    }[] = [];

    for (let i = 0; i < daysAhead; i++) {
      const checkDate = new Date(today.getTime() + i * 86400000);
      const dayOfWeek = checkDate.getDay();
      const dateStr = checkDate.toISOString().slice(0, 10);
      const minStaff = minStaffByDay.get(dayOfWeek);
      const scheduled = shiftsByDate.get(dateStr) ?? 0;

      if (minStaff === undefined) {
        analysis.push({
          date: dateStr,
          day_of_week: dayOfWeek,
          scheduled,
          required: 0,
          gap: 0,
          status: "no_requirement",
        });
      } else {
        const gap = Math.max(0, minStaff - scheduled);
        analysis.push({
          date: dateStr,
          day_of_week: dayOfWeek,
          scheduled,
          required: minStaff,
          gap,
          status: gap > 0 ? "gap" : "ok",
        });
      }
    }

    const totalGaps = analysis.filter((a) => a.status === "gap").length;
    const totalUnfilled = analysis.reduce((sum, a) => sum + a.gap, 0);

    // 5. Also check for cached predictions from the weekly cron
    const { data: cachedPredictions } = await supabase
      .from("engine_memory")
      .select("content, importance, created_at, expires_at")
      .eq("workspace_id", ctx.workspaceId)
      .eq("memory_type", "prediction")
      .gte("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(5);

    const relevantPredictions = (cachedPredictions ?? [])
      .map((p) => {
        try {
          const parsed = JSON.parse(p.content);
          return parsed.prediction_type === "coverage_gap" &&
            parsed.department_id === params.department_id
            ? { ...parsed, importance: p.importance, cached_at: p.created_at }
            : null;
        } catch {
          return null;
        }
      })
      .filter(Boolean);

    const result = {
      department_id: params.department_id,
      days_analyzed: daysAhead,
      days_with_gaps: totalGaps,
      total_unfilled_positions: totalUnfilled,
      daily_analysis: analysis,
      cached_predictions: relevantPredictions,
    };

    // 6. Emit telemetry
    await supabase.from("engine_event").insert({
      workspace_id: ctx.workspaceId,
      event_type: "ops.predict.coverage_queried",
      payload: {
        department_id: params.department_id,
        date_range_days: daysAhead,
        gaps_found: totalGaps,
        source: "agent_tool",
        actor_id: ctx.profileId,
        origin: "system",
      },
    });

    return JSON.stringify(result);
  },
});

/**
 * predict_compliance — Analyze HACCP check completion rates.
 * Queries session_task for HACCP-related tasks and computes completion
 * percentage over the requested period. Flags risk if below threshold.
 */
export const predictCompliance = defineTool({
  name: "predict_compliance",
  description:
    "Analyze HACCP compliance by checking completion rates of temperature, hygiene, and HACCP tasks over a time period",
  schema: z.object({
    department_id: z
      .string()
      .uuid()
      .optional()
      .describe("Department to scope analysis. If omitted, analyzes entire workspace."),
    days_back: z
      .number()
      .int()
      .min(1)
      .max(30)
      .optional()
      .default(7)
      .describe("Number of days to look back (1-30, default 7)"),
    threshold: z
      .number()
      .min(0)
      .max(100)
      .optional()
      .default(90)
      .describe("Compliance threshold percentage (default 90%)"),
  }),
  execute: async (params, ctx: AgentToolContext) => {
    const supabase = ctx.supabaseAdmin;
    const daysBack = params.days_back ?? 7;
    const threshold = params.threshold ?? 90;
    const since = new Date(Date.now() - daysBack * 86400000).toISOString();

    // Build query for HACCP-related tasks
    let query = supabase
      .from("session_task")
      .select(
        "id, title, task_type, status, created_at, department_session_id",
      )
      .eq("workspace_id", ctx.workspaceId)
      .gte("created_at", since)
      .or("task_type.ilike.%haccp%,task_type.ilike.%temperature%,task_type.ilike.%hygiene%");

    // Scope to department if provided
    if (params.department_id) {
      // Need to join through department_session to filter by department
      const { data: sessionIds } = await supabase
        .from("department_session")
        .select("department_session_id")
        .eq("workspace_id", ctx.workspaceId)
        .eq("department_id", params.department_id)
        .gte("session_date", new Date(Date.now() - daysBack * 86400000).toISOString().slice(0, 10));

      if (sessionIds?.length) {
        query = query.in(
          "department_session_id",
          sessionIds.map((s) => s.department_session_id),
        );
      }
    }

    const { data: tasks } = await query;

    if (!tasks?.length) {
      return JSON.stringify({
        status: "no_data",
        message: "No HACCP-related tasks found in the specified period.",
        days_back: daysBack,
        department_id: params.department_id ?? null,
      });
    }

    const total = tasks.length;
    const completed = tasks.filter((t) => t.status === "completed").length;
    const overdue = tasks.filter((t) => t.status === "overdue").length;
    const pending = tasks.filter((t) => t.status === "pending").length;
    const completionRate = (completed / total) * 100;

    // Group by task type for breakdown
    const byType = new Map<string, { total: number; completed: number }>();
    for (const task of tasks) {
      const taskType = task.task_type ?? "untyped";
      const existing = byType.get(taskType) ?? { total: 0, completed: 0 };
      existing.total++;
      if (task.status === "completed") existing.completed++;
      byType.set(taskType, existing);
    }

    const breakdown = [...byType.entries()].map(([taskType, stats]) => ({
      task_type: taskType,
      total: stats.total,
      completed: stats.completed,
      rate: ((stats.completed / stats.total) * 100).toFixed(1),
    }));

    // Check for cached compliance predictions
    const { data: cachedPredictions } = await supabase
      .from("engine_memory")
      .select("content, importance")
      .eq("workspace_id", ctx.workspaceId)
      .eq("memory_type", "prediction")
      .gte("expires_at", new Date().toISOString())
      .limit(10);

    const compliancePredictions = (cachedPredictions ?? [])
      .map((p) => {
        try {
          const parsed = JSON.parse(p.content);
          return parsed.prediction_type === "compliance_risk" ? parsed : null;
        } catch {
          return null;
        }
      })
      .filter(Boolean);

    const result = {
      department_id: params.department_id ?? null,
      days_analyzed: daysBack,
      threshold,
      compliance_rate: completionRate,
      is_compliant: completionRate >= threshold,
      risk_level:
        completionRate >= threshold
          ? "low"
          : completionRate >= threshold * 0.8
            ? "medium"
            : "high",
      summary: {
        total_checks: total,
        completed: completed,
        overdue: overdue,
        pending: pending,
      },
      breakdown,
      cached_predictions: compliancePredictions,
    };

    // Emit telemetry
    await supabase.from("engine_event").insert({
      workspace_id: ctx.workspaceId,
      event_type: "ops.predict.compliance_queried",
      payload: {
        department_id: params.department_id ?? null,
        completion_rate: completionRate,
        threshold,
        source: "agent_tool",
        actor_id: ctx.profileId,
        origin: "system",
      },
    });

    return JSON.stringify(result);
  },
});
```

- [ ] **Step 2: Verify typecheck**

Run: `pnpm turbo typecheck --filter=@smartout/ai`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add packages/ai/src/capabilities/operations-intelligence/predict-tools.ts
git commit -m "feat(ai): add predict_coverage and predict_compliance on-demand tools

ADR-0088 Phase 3 PREDICT: predict_coverage analyzes schedule vs
min_staff for coverage gaps. predict_compliance analyzes HACCP task
completion rates against threshold. Both read-only and advisory.
Emit ops.predict.coverage_queried and ops.predict.compliance_queried.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: On-Demand Tool — `query_patterns`

**Files:**
- Create: `packages/ai/src/capabilities/operations-intelligence/learn-tools.ts`

- [ ] **Step 1: Create the learn tools file**

Create `packages/ai/src/capabilities/operations-intelligence/learn-tools.ts`:

```typescript
// packages/ai/src/capabilities/operations-intelligence/learn-tools.ts
// ADR-0088 Phase 3: On-demand LEARN tool for manager conversations.
// Queries learned patterns from K1b (engine_memory with memory_type 'learned_pattern').

import { z } from "zod";
import { defineTool } from "../../types.js";
import type { AgentToolContext } from "../types.js";

/**
 * query_patterns — Query learned patterns from K1b.
 * Returns patterns extracted by the weekly ops-learn Edge Function,
 * filtered by type, department, and minimum importance.
 */
export const queryPatterns = defineTool({
  name: "query_patterns",
  description:
    "Query learned operational patterns from K1b — task durations, staffing correlations, and deviation patterns extracted from historical data",
  schema: z.object({
    pattern_type: z
      .enum(["task_duration", "staffing", "deviation_correlation"])
      .optional()
      .describe("Filter by pattern type. If omitted, returns all types."),
    department_id: z
      .string()
      .uuid()
      .optional()
      .describe("Filter patterns by department. If omitted, returns workspace-wide patterns."),
    min_importance: z
      .number()
      .min(0)
      .max(1)
      .optional()
      .default(0.3)
      .describe("Minimum importance threshold (0.0-1.0, default 0.3)"),
    limit: z
      .number()
      .int()
      .min(1)
      .max(50)
      .optional()
      .default(20)
      .describe("Maximum patterns to return (1-50, default 20)"),
  }),
  execute: async (params, ctx: AgentToolContext) => {
    const supabase = ctx.supabaseAdmin;
    const minImportance = params.min_importance ?? 0.3;
    const resultLimit = params.limit ?? 20;

    // Query learned patterns from engine_memory
    let query = supabase
      .from("engine_memory")
      .select("id, content, importance, created_at, updated_at, expires_at")
      .eq("workspace_id", ctx.workspaceId)
      .eq("memory_type", "learned_pattern")
      .gte("importance", minImportance)
      .order("importance", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(resultLimit);

    // Filter out expired entries
    const now = new Date().toISOString();
    query = query.or(`expires_at.is.null,expires_at.gte.${now}`);

    const { data: memories, error } = await query;

    if (error) {
      return JSON.stringify({ error: `Failed to query patterns: ${error.message}` });
    }

    if (!memories?.length) {
      return JSON.stringify({
        status: "no_patterns",
        message: "No learned patterns found. Patterns are extracted weekly by the ops-learn process. Ensure Phases 1+2 have been generating operational data.",
        filters: {
          pattern_type: params.pattern_type ?? "all",
          department_id: params.department_id ?? "all",
          min_importance: minImportance,
        },
      });
    }

    // Parse and filter results
    const parsedPatterns = memories
      .map((m) => {
        try {
          const parsed = JSON.parse(m.content);

          // Filter by pattern_type if specified
          if (params.pattern_type && parsed.pattern_type !== params.pattern_type) {
            return null;
          }

          // Filter by department_id if specified
          if (params.department_id && parsed.department_id !== params.department_id) {
            return null;
          }

          return {
            id: m.id,
            pattern_type: parsed.pattern_type,
            summary: parsed.summary,
            details: parsed.details,
            department_id: parsed.department_id,
            importance: m.importance,
            extracted_at: parsed.extracted_at,
            expires_at: m.expires_at,
            is_permanent: m.expires_at === null,
          };
        } catch {
          return null;
        }
      })
      .filter(Boolean);

    // Group by pattern type for structured response
    const grouped = new Map<string, typeof parsedPatterns>();
    for (const pattern of parsedPatterns) {
      if (!pattern) continue;
      const key = pattern.pattern_type;
      const existing = grouped.get(key) ?? [];
      existing.push(pattern);
      grouped.set(key, existing);
    }

    const result = {
      total_patterns: parsedPatterns.length,
      filters: {
        pattern_type: params.pattern_type ?? "all",
        department_id: params.department_id ?? "all",
        min_importance: minImportance,
      },
      by_type: Object.fromEntries(
        [...grouped.entries()].map(([type, patterns]) => [
          type,
          {
            count: patterns.length,
            patterns: patterns,
          },
        ]),
      ),
    };

    // Emit telemetry
    await supabase.from("engine_event").insert({
      workspace_id: ctx.workspaceId,
      event_type: "ops.learn.patterns_queried",
      payload: {
        pattern_type: params.pattern_type ?? null,
        results_count: parsedPatterns.length,
        source: "agent_tool",
        actor_id: ctx.profileId,
        origin: "system",
      },
    });

    return JSON.stringify(result);
  },
});
```

- [ ] **Step 2: Verify typecheck**

Run: `pnpm turbo typecheck --filter=@smartout/ai`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add packages/ai/src/capabilities/operations-intelligence/learn-tools.ts
git commit -m "feat(ai): add query_patterns on-demand tool for K1b learned patterns

ADR-0088 Phase 3 LEARN: queries engine_memory for learned_pattern
entries with filtering by type, department, and importance. Respects
retention policy (skips expired entries). Emits
ops.learn.patterns_queried telemetry.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Register Phase 3 Tools in Capability

**Files:**
- Modify: `packages/ai/src/capabilities/operations-intelligence/index.ts`

- [ ] **Step 1: Import and register the new tools**

In `packages/ai/src/capabilities/operations-intelligence/index.ts`, add imports for the Phase 3 tools and update the tool arrays:

```typescript
// packages/ai/src/capabilities/operations-intelligence/index.ts
// ADR-0088: Operations Intelligence — manager/system-scoped capability.

import type { SmartoutTool } from "../../types.js";
import type { AgentToolContext, CapabilityDefinition } from "../types.js";
import { triageEvent } from "./tools.js";
// Phase 2 imports (added in Phase 2 plan):
// import { queryMonitorAlerts, getSessionIntelligence, executeEscalation } from "./monitor-tools.js";
// Phase 3 imports:
import { predictCoverage, predictCompliance } from "./predict-tools.js";
import { queryPatterns } from "./learn-tools.js";

const allTools = [
  triageEvent,
  // Phase 2: queryMonitorAlerts, getSessionIntelligence, executeEscalation,
  predictCoverage,
  predictCompliance,
  queryPatterns,
] as unknown as ReadonlyArray<SmartoutTool<AgentToolContext>>;

const readOnlyTools = [
  // Phase 2: queryMonitorAlerts, getSessionIntelligence,
  predictCoverage,
  predictCompliance,
  queryPatterns,
] as unknown as ReadonlyArray<SmartoutTool<AgentToolContext>>;

const suggestTools = [
  triageEvent,
  // Phase 2: queryMonitorAlerts, getSessionIntelligence,
  predictCoverage,
  predictCompliance,
  queryPatterns,
] as unknown as ReadonlyArray<SmartoutTool<AgentToolContext>>;

export const operationsIntelligenceCapability: CapabilityDefinition = {
  name: "operations_intelligence",
  description:
    "Operational intelligence: event triage, anomaly monitoring, session analysis, coverage predictions, compliance analysis, and learned pattern queries. Manager and system scope.",
  tools: allTools,
  readOnlyTools,
  suggestTools,
};
```

Note: The Phase 2 tools (`queryMonitorAlerts`, `getSessionIntelligence`, `executeEscalation`) are shown commented out above. If Phase 2 has already been implemented when Phase 3 is executed, uncomment those imports and add them to the arrays alongside the Phase 3 tools. If Phase 2 is not yet implemented, leave them commented out.

- [ ] **Step 2: Verify typecheck**

Run: `pnpm turbo typecheck --filter=@smartout/ai`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add packages/ai/src/capabilities/operations-intelligence/index.ts
git commit -m "feat(ai): register predict and learn tools in operations_intelligence capability

ADR-0088 Phase 3: adds predict_coverage, predict_compliance, and
query_patterns to the capability tool arrays (all, readOnly, suggest).
Updates capability description to reflect PREDICT + LEARN functions.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: Final Typecheck + Verification

- [ ] **Step 1: Full monorepo typecheck**

Run: `pnpm turbo typecheck`
Expected: 0 errors across all packages.

- [ ] **Step 2: Verify capability tool count**

Check that `operations_intelligence` capability has the expected number of tools.

Phase 1 only (triage_event): 1 tool
Phase 1+3 (no Phase 2): 4 tools (triage_event + predict_coverage + predict_compliance + query_patterns)
Phase 1+2+3 (all phases): 7 tools (triage_event + query_monitor_alerts + get_session_intelligence + execute_escalation + predict_coverage + predict_compliance + query_patterns)

- [ ] **Step 3: Verify migration applies**

Run: `npx supabase db reset`
Expected: All migrations apply without errors.

- [ ] **Step 4: Verify cron jobs registered**

After reset, run SQL:
```sql
SELECT jobname, schedule FROM cron.job WHERE jobname LIKE 'ops-%' ORDER BY jobname;
```
Expected:
| jobname | schedule |
|---------|----------|
| ops-day-brief | 0 5 * * * |
| ops-learn | 0 1 * * 1 |
| ops-predict | 0 22 * * 0 |

- [ ] **Step 5: Verify engine_memory memory_type CHECK allows 'prediction' and 'learned_pattern'**

Run SQL:
```sql
SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'engine_memory_memory_type_check';
```
Expected: constraint includes `'learned_pattern'` and `'prediction'` (added in Phase 1 migration).

- [ ] **Step 6: Verify i18n files are valid JSON**

Run:
```bash
node -e "JSON.parse(require('fs').readFileSync('packages/i18n/locales/nb/ops-intelligence.json','utf8'))"
node -e "JSON.parse(require('fs').readFileSync('packages/i18n/locales/en/ops-intelligence.json','utf8'))"
```
Expected: no errors (both files parse as valid JSON).

---

## Summary

| Task | What | Files |
|------|------|-------|
| 1 | i18n keys for PREDICT + LEARN (nb + en) | 2 new |
| 2 | Telemetry registry — PREDICT + LEARN events | 1 modified |
| 3 | `ops-predict` Edge Function (weekly cron) | 1 new |
| 4 | `ops-learn` Edge Function (weekly cron + retention cleanup) | 1 new |
| 5 | pg_cron registration for both weekly jobs | 1 new |
| 6 | `predict_coverage` + `predict_compliance` on-demand tools | 1 new |
| 7 | `query_patterns` on-demand tool | 1 new |
| 8 | Register Phase 3 tools in capability index | 1 modified |
| 9 | Final verification (typecheck, cron, i18n) | 0 files (verification only) |

**Total: 9 tasks, ~9 files created/modified, 8 commits.**

## Key Design Decisions

1. **PREDICT is advisory only** — predictions persist to `engine_memory` for dashboard consumption but never write to cascade tables (D1-D6) or trigger automated actions.
2. **LEARN retention policy** — importance >= 0.8 patterns are retained permanently (no `expires_at`), all others expire after 90 days. The weekly cron handles cleanup.
3. **Confidence as importance** — prediction confidence maps directly to `engine_memory.importance` (0.0-1.0 scale), enabling the existing memory retrieval system to surface high-confidence predictions first.
4. **On-demand tools complement cron** — `predict_coverage` and `predict_compliance` tools run lightweight analysis live (not just querying cached cron results) so managers get fresh data mid-week.
5. **`ops-learn` also cleans predictions** — the retention cleanup step removes expired prediction entries alongside expired patterns, keeping engine_memory clean.
6. **Cron scheduling order** — PREDICT runs Sunday 22:00 UTC, LEARN runs Monday 01:00 UTC. This ensures fresh predictions exist when pattern extraction analyzes the data landscape.

## Prerequisites

- Phase 1 must be complete (policy_type enum, memory_type CHECK, operations_intelligence capability scaffold, engine_authority_config seed)
- Phase 2 should be substantially complete (operational data flowing through MONITOR + ACT to generate deviations, task completions, and staffing records that PREDICT and LEARN analyze)
- Production workspaces must have at least 2-4 weeks of session/task/shift/deviation data before Phase 3 outputs are meaningful
