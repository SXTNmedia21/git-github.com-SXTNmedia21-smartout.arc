// packages/ai/src/capabilities/mission/tools.ts
//
// Read-only tools that surface the user's active mission progress and the
// workspace roadmap to Mr. Botsson.
//
// All tools are read-only — no gate_action call, no emit().
// Voice-safe: no PII, no write mutations.
//
// Key schema notes:
//   - engine_state.assignee_id links to profile.profile_id (no FK defined in
//     database.types.ts, but used consistently by engine-dispatch)
//   - engine_state.workspace_id is nullable — filter with .eq() not .is()
//   - engine_state_step has no direct workspace_id — access via state_id JOIN
//   - planning_event.event_date is a date string (YYYY-MM-DD), not a timestamp

import { z } from "zod";
import { defineTool } from "../../types.js";
import type { AgentToolContext } from "../types.js";

// ---------------------------------------------------------------------------
// get_active_missions
// ---------------------------------------------------------------------------

export const getActiveMissions = defineTool({
  name: "get_active_missions",
  description:
    "Get the current user's active missions (live engine_state rows) — what they are in the middle of, which step they are on, and any blockers. Call this when the user asks about their progress, what they should do next, or whether anything is blocking them.",
  capability: "mission",
  schema: z.object({}),
  execute: async (_, ctx: AgentToolContext) => {
    const supabase = ctx.supabaseAdmin;

    // Fetch active/pending/blocked states assigned to this profile in this workspace.
    // engine_state.assignee_id is the profile link; workspace_id scopes the result.
    const { data: states, error: statesError } = await supabase
      .from("engine_state")
      .select("id, process_id, status, current_step, started_at, last_error, updated_at")
      .eq("assignee_id", ctx.profileId)
      .eq("workspace_id", ctx.workspaceId)
      .in("status", ["active", "pending", "blocked"])
      .order("started_at", { ascending: false })
      .limit(10);

    if (statesError) return `Error loading missions: ${statesError.message}`;
    if (!states || states.length === 0) {
      return JSON.stringify({ missions: [], summary: "Ingen aktive misjoner." });
    }

    // Fetch the related engine_process rows for names/descriptions in one query.
    const processIds = [...new Set(states.map((s) => s.process_id))];
    const { data: processes, error: procError } = await supabase
      .from("engine_process")
      .select("id, name, description, max_steps")
      .in("id", processIds);

    if (procError) return `Error loading process definitions: ${procError.message}`;
    const processMap = new Map((processes ?? []).map((p) => [p.id, p]));

    // For each active state, fetch the earliest non-completed step — that is
    // the current blocker / next action. One query per state is acceptable at
    // n≤10; if load becomes an issue, a single subquery can replace this fan-out.
    const stateIds = states.map((s) => s.id);
    const { data: steps, error: stepError } = await supabase
      .from("engine_state_step")
      .select("state_id, id, step_order, action_type, status, action_payload")
      .in("state_id", stateIds)
      .neq("status", "completed")
      .order("step_order", { ascending: true });

    if (stepError) return `Error loading steps: ${stepError.message}`;

    // Group steps by state_id, keep only the first (lowest step_order).
    const firstPendingStep = new Map<
      string,
      { id: string; step_order: number; action_type: string; status: string }
    >();
    for (const step of steps ?? []) {
      if (!firstPendingStep.has(step.state_id)) {
        firstPendingStep.set(step.state_id, {
          id: step.id,
          step_order: step.step_order,
          action_type: step.action_type,
          status: step.status,
        });
      }
    }

    const missions = states.map((s) => {
      const proc = processMap.get(s.process_id);
      const pendingStep = firstPendingStep.get(s.id);

      return {
        mission_id: s.id,
        mission_name: proc?.name ?? s.process_id,
        mission_description: proc?.description ?? null,
        total_steps: proc?.max_steps ?? null,
        current_step: s.current_step,
        next_pending_step: pendingStep
          ? {
              step_order: pendingStep.step_order,
              action_type: pendingStep.action_type,
              status: pendingStep.status,
            }
          : null,
        status: s.status,
        blocked_reason: s.status === "blocked" ? (s.last_error ?? "ukjent årsak") : null,
        started_at: s.started_at,
        updated_at: s.updated_at,
      };
    });

    return JSON.stringify({ missions });
  },
});

// ---------------------------------------------------------------------------
// get_workspace_roadmap
// ---------------------------------------------------------------------------

export const getWorkspaceRoadmap = defineTool({
  name: "get_workspace_roadmap",
  description:
    "Get the workspace-level roadmap for the next 30 days: upcoming planning events, active planning cycle status, and open deviations the user is responsible for. Call this when the user asks what is coming up, what they should prepare for, or what is on the agenda.",
  capability: "mission",
  schema: z.object({}),
  execute: async (_, ctx: AgentToolContext) => {
    const supabase = ctx.supabaseAdmin;
    const now = new Date();
    const in30Days = new Date(now.getTime() + 30 * 86400000);

    // Fetch all three data sources in parallel for minimal latency.
    const [eventsResult, cycleResult, deviationsResult] = await Promise.all([
      // Upcoming planning events in the workspace for the next 30 days.
      supabase
        .from("planning_event")
        .select("planning_event_id, name, description, event_date, category, demand_multiplier")
        .eq("workspace_id", ctx.workspaceId)
        .gte("event_date", now.toISOString().slice(0, 10))
        .lte("event_date", in30Days.toISOString().slice(0, 10))
        .order("event_date", { ascending: true })
        .limit(20),

      // Active or draft planning cycle for the workspace.
      supabase
        .from("planning_cycle")
        .select("planning_cycle_id, name, status, start_date, end_date, total_revenue_target")
        .eq("workspace_id", ctx.workspaceId)
        .in("status", ["active", "draft"])
        .order("start_date", { ascending: false })
        .limit(1)
        .maybeSingle(),

      // Open deviations reported by or assigned to the current profile.
      supabase
        .from("deviation")
        .select("deviation_id, title, severity, status, domain, requires_action, created_at")
        .eq("workspace_id", ctx.workspaceId)
        .eq("reported_by", ctx.profileId)
        .in("status", ["open", "in_progress"])
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

    if (eventsResult.error) return `Error loading events: ${eventsResult.error.message}`;
    if (cycleResult.error) return `Error loading planning cycle: ${cycleResult.error.message}`;
    if (deviationsResult.error)
      return `Error loading deviations: ${deviationsResult.error.message}`;

    return JSON.stringify({
      planning_events: eventsResult.data ?? [],
      active_planning_cycle: cycleResult.data ?? null,
      open_deviations: deviationsResult.data ?? [],
    });
  },
});
