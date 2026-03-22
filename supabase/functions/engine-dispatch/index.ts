import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EngineStep {
  id: string;
  process_id: string;
  step_order: number;
  step_group: number | null;
  action_type: string;
  action_payload: Record<string, unknown>;
  condition: unknown;
  assignee_rule: string | null;
}

interface EngineState {
  id: string;
  trigger_id: string | null;
  process_id: string;
  workspace_id: string;
  current_step: number;
  status: string;
  entity_type: string | null;
  entity_id: string | null;
  assignee_id: string | null;
  context: Record<string, unknown>;
  steps_snapshot: EngineStep[] | null;
  result: Record<string, unknown> | null;
  depth: number;
  retry_count: number;
  last_error: string | null;
}

/**
 * Minimal condition evaluator — mirrors packages/ai/src/engine/condition-evaluator.ts
 */
function evaluateCondition(
  condition: unknown,
  context: Record<string, unknown>,
  stateContext?: Record<string, unknown>,
): boolean {
  if (condition === null || condition === undefined) return true;

  const cond = condition as Record<string, unknown>;

  if ("match" in cond) {
    const match = cond.match as Record<string, unknown>;
    return Object.entries(match).every(([key, value]) => context[key] === value);
  }

  if ("step_status" in cond) {
    const { step, is } = cond.step_status as { step: number; is: string };
    const results = context.step_results as Record<string, { status: string }> | undefined;
    return results?.[step]?.status === is;
  }

  if ("match_state" in cond) {
    const matchState = cond.match_state as Record<string, string>;
    if (!stateContext) return false;
    return Object.entries(matchState).every(
      ([payloadKey, stateKey]) => context[payloadKey] === stateContext[stateKey],
    );
  }

  if ("all" in cond) {
    const conditions = cond.all as unknown[];
    return conditions.every((c) => evaluateCondition(c, context, stateContext));
  }

  if ("any" in cond) {
    const conditions = cond.any as unknown[];
    return conditions.some((c) => evaluateCondition(c, context, stateContext));
  }

  return false;
}

/**
 * Resolve steps for a running engine_state.
 * Checks engine_state_step (dynamic/generated steps) first,
 * falls back to steps_snapshot (frozen copy from process definition).
 */
async function getStepsForState(
  supabase: ReturnType<typeof createClient>,
  state: EngineState,
): Promise<EngineStep[]> {
  const { data: dynamicSteps } = await supabase
    .from("engine_state_step")
    .select("step_order, action_type, action_payload, condition, assignee_rule")
    .eq("state_id", state.id)
    .order("step_order");

  if (dynamicSteps && dynamicSteps.length > 0) {
    return dynamicSteps.map((s: Record<string, unknown>) => ({
      id: state.id,
      process_id: state.process_id,
      step_order: s.step_order as number,
      step_group: null,
      action_type: s.action_type as string,
      action_payload: (s.action_payload ?? {}) as Record<string, unknown>,
      condition: s.condition as unknown,
      assignee_rule: s.assignee_rule as string | null,
    }));
  }

  return (state.steps_snapshot ?? []) as EngineStep[];
}

/**
 * Advance to the next step after completing the current one.
 * Records step result, moves current_step forward, and recurses into the next step.
 * If no next step exists, marks the process as complete.
 */
async function advanceToNextStep(
  supabase: ReturnType<typeof createClient>,
  state: EngineState,
  step: EngineStep,
): Promise<void> {
  // Mark current step as completed in engine_state_step
  await supabase
    .from("engine_state_step")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
    })
    .eq("state_id", state.id)
    .eq("step_order", step.step_order);

  const stepResult = {
    ...((state.result ?? {}) as Record<string, unknown>),
    [step.step_order]: {
      status: "complete",
      action_type: step.action_type,
      completed_at: new Date().toISOString(),
    },
  };
  const nextOrder = step.step_order + 1;
  const allSteps = await getStepsForState(supabase, state);
  const nextStep = allSteps.find((s) => s.step_order === nextOrder);

  if (nextStep) {
    // Mark next step as active
    await supabase
      .from("engine_state_step")
      .update({ status: "active", updated_at: new Date().toISOString() })
      .eq("state_id", state.id)
      .eq("step_order", nextStep.step_order);

    await supabase
      .from("engine_state")
      .update({
        current_step: nextOrder,
        result: stepResult,
        updated_at: new Date().toISOString(),
      })
      .eq("id", state.id);
    await executeStep(
      supabase,
      { ...state, current_step: nextOrder, result: stepResult },
      nextStep,
    );
  } else {
    await supabase
      .from("engine_state")
      .update({
        status: "complete",
        result: stepResult,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", state.id);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { event_type, payload, workspace_id, idempotency_key } = body;

    if (!event_type) {
      return new Response(JSON.stringify({ error: "event_type required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1. Record the event (with idempotency check)
    if (idempotency_key) {
      const { data: existing } = await supabase
        .from("engine_event")
        .select("id")
        .eq("idempotency_key", idempotency_key)
        .maybeSingle();

      if (existing) {
        return new Response(
          JSON.stringify({
            message: "Event already processed",
            event_id: existing.id,
            duplicate: true,
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
    }

    const { data: event, error: eventErr } = await supabase
      .from("engine_event")
      .insert({
        event_type,
        payload: payload ?? {},
        workspace_id,
        idempotency_key: idempotency_key ?? null,
      })
      .select()
      .single();

    if (eventErr || !event) {
      return new Response(JSON.stringify({ error: "Failed to record event" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Match against active triggers
    const { data: triggers, error: trigErr } = await supabase
      .from("engine_trigger")
      .select("*")
      .eq("event_type", event_type)
      .eq("is_active", true);

    if (trigErr || !triggers) {
      return new Response(
        JSON.stringify({
          event_id: event.id,
          triggers_matched: 0,
          error: trigErr?.message,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Filter triggers by condition + workspace
    const matchedTriggers = triggers.filter((t: Record<string, unknown>) => {
      // Workspace filter: global triggers match all, workspace-specific match only their workspace
      if (t.workspace_id && t.workspace_id !== workspace_id) return false;
      // Condition filter
      return evaluateCondition(t.condition as unknown, (payload ?? {}) as Record<string, unknown>);
    });

    const results: Array<{
      trigger_id: string;
      action: string;
      state_id?: string;
      delayed_trigger_id?: string;
    }> = [];

    for (const trigger of matchedTriggers) {
      const delaySeconds = (trigger.delay_seconds as number) ?? 0;

      if (delaySeconds > 0) {
        // 3a. Delayed trigger — insert into timer queue
        const fireAt = new Date(Date.now() + delaySeconds * 1000).toISOString();
        const { data: delayed } = await supabase
          .from("engine_delayed_trigger")
          .insert({
            trigger_id: trigger.id,
            event_id: event.id,
            workspace_id,
            fire_at: fireAt,
          })
          .select("id")
          .single();

        results.push({
          trigger_id: trigger.id as string,
          action: "delayed",
          delayed_trigger_id: delayed?.id,
        });
      } else {
        // 3b. Immediate — create engine_state + start execution
        const processId = trigger.process_id as string;

        // Fetch process steps
        const { data: steps } = await supabase
          .from("engine_step")
          .select("*")
          .eq("process_id", processId)
          .order("step_order");

        // Create engine state
        const { data: state, error: stateErr } = await supabase
          .from("engine_state")
          .insert({
            trigger_id: trigger.id,
            process_id: processId,
            workspace_id,
            status: "active",
            current_step: 1,
            entity_type:
              ((payload as Record<string, unknown>)?.entity_type as string | undefined) ?? null,
            entity_id:
              ((payload as Record<string, unknown>)?.entity_id as string | undefined) ?? null,
            context: payload ?? {},
            steps_snapshot: steps ?? [],
            result: {},
          })
          .select()
          .single();

        if (stateErr) {
          results.push({
            trigger_id: trigger.id as string,
            action: "error",
          });
          continue;
        }

        // Create engine_state_step rows for static step tracking
        // Skip if process uses generate_steps (those create steps dynamically)
        const hasGenerateSteps = (steps ?? []).some(
          (s: Record<string, unknown>) => s.action_type === "generate_steps",
        );

        if (state && steps && steps.length > 0 && !hasGenerateSteps) {
          const stateSteps = steps.map((s: Record<string, unknown>) => ({
            state_id: state.id,
            step_order: s.step_order as number,
            status: (s.step_order as number) === 1 ? "active" : "pending",
            action_type: s.action_type as string,
            action_payload: s.action_payload ?? {},
            condition: s.condition ?? null,
            assignee_rule: s.assignee_rule ?? null,
          }));
          await supabase.from("engine_state_step").insert(stateSteps);
        }

        // Execute first step(s)
        if (state && steps && steps.length > 0) {
          const firstStep = steps[0] as EngineStep;
          await executeStep(supabase, state as EngineState, firstStep);
        }

        results.push({
          trigger_id: trigger.id as string,
          action: "started",
          state_id: state?.id,
        });
      }
    }

    // 4. Check for waiting states that match this event
    let waitingQuery = supabase.from("engine_state").select("*").eq("status", "waiting");

    if (workspace_id) {
      waitingQuery = waitingQuery.eq("workspace_id", workspace_id);
    }

    const { data: waitingStates } = await waitingQuery;

    let resumed = 0;
    if (waitingStates) {
      for (const state of waitingStates as EngineState[]) {
        const steps = await getStepsForState(supabase, state);
        const currentStep = steps.find((s) => s.step_order === state.current_step);
        if (!currentStep) continue;

        // Build state context for match_state evaluation
        const stateCtx: Record<string, unknown> = {
          entity_id: state.entity_id,
          entity_type: state.entity_type,
          ...state.context,
        };

        const conditionMatch = evaluateCondition(
          currentStep.condition,
          (payload ?? {}) as Record<string, unknown>,
          stateCtx,
        );

        const incomingEntityId = (payload as Record<string, unknown>)?.entity_id ?? null;
        const entityMatch =
          state.entity_id === null ||
          incomingEntityId === null ||
          state.entity_id === incomingEntityId;

        const hasMatchState =
          currentStep.condition != null &&
          "match_state" in (currentStep.condition as Record<string, unknown>);

        if (
          currentStep?.action_type === "wait_for_event" &&
          (currentStep.action_payload as Record<string, unknown>)?.event === event_type &&
          conditionMatch &&
          (entityMatch || hasMatchState)
        ) {
          // Mark current wait_for_event step as completed in engine_state_step
          await supabase
            .from("engine_state_step")
            .update({
              status: "completed",
              completed_at: new Date().toISOString(),
            })
            .eq("state_id", state.id)
            .eq("step_order", state.current_step);

          // Resume: advance to next step
          const nextStepOrder = state.current_step + 1;
          const nextStep = steps.find((s) => s.step_order === nextStepOrder);

          if (nextStep) {
            // Mark next step as active
            await supabase
              .from("engine_state_step")
              .update({ status: "active", updated_at: new Date().toISOString() })
              .eq("state_id", state.id)
              .eq("step_order", nextStep.step_order);

            await supabase
              .from("engine_state")
              .update({
                status: "active",
                current_step: nextStepOrder,
                updated_at: new Date().toISOString(),
              })
              .eq("id", state.id);

            await executeStep(supabase, { ...state, current_step: nextStepOrder }, nextStep);
          } else {
            // No more steps — complete
            await supabase
              .from("engine_state")
              .update({
                status: "complete",
                completed_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              })
              .eq("id", state.id);
          }
          resumed++;
        }
      }
    }

    return new Response(
      JSON.stringify({
        event_id: event.id,
        triggers_matched: matchedTriggers.length,
        results,
        waiting_resumed: resumed,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

/**
 * Entity PK column mapping — each table has its own primary key column name.
 */
const ENTITY_PK: Record<string, string> = {
  daily_reconciliation: "id",
  department_session: "department_session_id",
  profile: "profile_id",
  protocol_assignment: "assignment_id",
};

/**
 * Resolve planned open/close for a department session by checking
 * department_hours_override (date-specific) then department_operating_hours (weekly).
 */
async function resolveSessionHours(
  supabase: ReturnType<typeof createClient>,
  workspaceId: string,
  departmentId: string,
  date: string,
): Promise<{ open: string | null; close: string | null }> {
  // 1. Check date-specific override
  const { data: override } = await supabase
    .from("department_hours_override")
    .select("open_time, close_time, is_closed")
    .eq("workspace_id", workspaceId)
    .eq("department_id", departmentId)
    .eq("override_date", date)
    .limit(1)
    .maybeSingle();

  if (override) {
    if (override.is_closed) return { open: null, close: null };
    return { open: override.open_time, close: override.close_time };
  }

  // 2. Fall back to weekly hours — JS getDay() 0=Sun, convert to 0=Mon
  const jsDay = new Date(date + "T12:00:00Z").getUTCDay();
  const dayOfWeek = jsDay === 0 ? 6 : jsDay - 1;

  const { data: weekly } = await supabase
    .from("department_operating_hours")
    .select("open_time, close_time, is_closed")
    .eq("workspace_id", workspaceId)
    .eq("department_id", departmentId)
    .eq("day_of_week", dayOfWeek)
    .is("location_id", null)
    .order("season_id", { ascending: true, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  if (weekly) {
    if (weekly.is_closed) return { open: null, close: null };
    return { open: weekly.open_time, close: weekly.close_time };
  }

  return { open: null, close: null };
}

/**
 * Execute a single engine step. Updates state based on action_type.
 */
async function executeStep(
  supabase: ReturnType<typeof createClient>,
  state: EngineState,
  step: EngineStep,
): Promise<void> {
  // Check condition — but NOT for wait_for_event steps.
  // wait_for_event conditions are evaluated during resumption (event matching), not initial execution.
  if (
    step.action_type !== "wait_for_event" &&
    step.condition &&
    !evaluateCondition(step.condition, state.context)
  ) {
    // Condition not met — skip to next step
    const allSteps = await getStepsForState(supabase, state);
    const nextOrder = step.step_order + 1;
    const nextStep = allSteps.find((s) => s.step_order === nextOrder);

    if (nextStep) {
      await supabase
        .from("engine_state")
        .update({
          current_step: nextOrder,
          updated_at: new Date().toISOString(),
        })
        .eq("id", state.id);
      await executeStep(supabase, { ...state, current_step: nextOrder }, nextStep);
    } else {
      await supabase
        .from("engine_state")
        .update({
          status: "complete",
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", state.id);
    }
    return;
  }

  switch (step.action_type) {
    case "wait_for_event":
      // Set state to waiting — will be resumed when matching event arrives
      await supabase
        .from("engine_state")
        .update({
          status: "waiting",
          updated_at: new Date().toISOString(),
        })
        .eq("id", state.id);
      break;

    case "assign_task": {
      const ap = step.action_payload as Record<string, unknown>;
      // Create session_task if department_session context exists
      if (state.entity_type === "department_session" && state.entity_id) {
        await supabase.from("session_task").insert({
          workspace_id: state.workspace_id,
          department_session_id: state.entity_id,
          title: (ap.task as string) ?? "Task",
          description: (ap.description as string) ?? null,
          status: "available",
          assigned_to: state.assignee_id ?? null,
          is_compliance_required: false,
        });
      }
      await advanceToNextStep(supabase, state, step);
      break;
    }

    case "send_notification": {
      // TODO(notifications): notification_queue table does not exist yet.
      // When Module 12 (Notifications) is built, replace this console.log
      // with INSERT into notification_queue (template, recipient, workspace_id, payload).
      console.log(
        `[engine-dispatch] send_notification: template=${(step.action_payload as Record<string, unknown>).template}, ` +
          `assignee=${state.assignee_id}, state=${state.id}`,
      );
      await advanceToNextStep(supabase, state, step);
      break;
    }

    case "update_entity": {
      const ap = step.action_payload as Record<string, unknown>;
      const entity = ap.entity as string;
      const setValues = ap.set as Record<string, unknown>;
      // Allowlist of tables that can be updated
      const allowed = [
        "daily_reconciliation",
        "department_session",
        "profile",
        "protocol_assignment",
      ];
      if (allowed.includes(entity) && state.entity_id) {
        const pkColumn = ENTITY_PK[entity] ?? "id";
        await supabase
          .from(entity)
          .update({
            ...setValues,
            updated_at: new Date().toISOString(),
          })
          .eq(pkColumn, state.entity_id);
      }
      await advanceToNextStep(supabase, state, step);
      break;
    }

    case "create_deviation": {
      const ap = step.action_payload as Record<string, unknown>;
      const condition = ap.condition as string | undefined;
      const ctx = state.context as Record<string, unknown>;
      // Only create if condition met (or no condition)
      if (!condition || ctx[condition]) {
        await supabase.from("deviation").insert({
          workspace_id: state.workspace_id,
          title: (ap.description as string) ?? "Auto-detected deviation",
          domain: (ap.domain as string) ?? "system",
          severity: (ap.severity as string) ?? "medium",
          subcategory: (ap.subcategory as string) ?? null,
          session_id: state.entity_id ?? null,
          status: "open",
        });
      }
      await advanceToNextStep(supabase, state, step);
      break;
    }

    case "validate_settlement": {
      // Call validate-settlement Edge Function
      if (state.entity_id) {
        try {
          await supabase.functions.invoke("validate-settlement", {
            body: { reconciliation_id: state.entity_id, workspace_id: state.workspace_id },
          });
        } catch (err) {
          console.error(`[engine-dispatch] validate_settlement failed: ${String(err)}`);
        }
      }
      await advanceToNextStep(supabase, state, step);
      break;
    }

    case "lock_checkout": {
      // UI-driven gatekeeper — engine records the gate is active, UI checks engine_state
      await advanceToNextStep(supabase, state, step);
      break;
    }

    case "schedule_control": {
      // Reserved for future schedule automation
      await advanceToNextStep(supabase, state, step);
      break;
    }

    case "start_process": {
      const ap = step.action_payload as Record<string, unknown>;
      const subProcessId = ap.process_id as string;
      if (subProcessId) {
        const { data: subSteps } = await supabase
          .from("engine_step")
          .select("*")
          .eq("process_id", subProcessId)
          .order("step_order");

        await supabase.from("engine_state").insert({
          process_id: subProcessId,
          workspace_id: state.workspace_id,
          status: "active",
          current_step: 1,
          entity_type: state.entity_type,
          entity_id: state.entity_id,
          context: state.context,
          steps_snapshot: subSteps ?? [],
          depth: state.depth + 1,
          parent_state_id: state.id,
        });
      }
      await advanceToNextStep(supabase, state, step);
      break;
    }

    case "upsert_session": {
      const ctx = state.context as Record<string, unknown>;
      // Context comes from telemetry payload where dates/department_ids
      // are nested under ctx.data (from event.properties.data)
      const ctxData = (ctx.data as Record<string, unknown>) ?? {};
      const dates = (ctxData.dates as string[]) ??
        (ctx.dates as string[]) ?? [new Date().toISOString().split("T")[0]];
      const deptIds =
        (ctxData.department_ids as string[]) ?? (ctx.department_ids as string[]) ?? [];

      // Filter: only operational/hybrid departments create sessions (not administrative)
      const { data: deptRows } = await supabase
        .from("department")
        .select("department_id, department_type")
        .in("department_id", deptIds);
      const eligibleDeptIds = (deptRows ?? [])
        .filter(
          (d: { department_type: string | null }) =>
            !d.department_type ||
            d.department_type === "operational" ||
            d.department_type === "hybrid",
        )
        .map((d: { department_id: string }) => d.department_id);

      for (const date of dates) {
        for (const deptId of eligibleDeptIds) {
          // Resolve planned hours: override > weekly > null
          const hours = await resolveSessionHours(supabase, state.workspace_id, deptId, date);

          await supabase.from("department_session").upsert(
            {
              workspace_id: state.workspace_id,
              department_id: deptId,
              session_date: date,
              status: "upcoming",
              planned_open: hours.open,
              planned_close: hours.close,
            },
            { onConflict: "workspace_id,department_id,session_date" },
          );
        }
      }
      await advanceToNextStep(supabase, state, step);
      break;
    }

    case "cascade_cost_snapshot": {
      const ctx = state.context as Record<string, unknown>;
      const ctxData = (ctx.data as Record<string, unknown>) ?? {};
      const shiftIds = (ctxData.shift_ids as string[]) ?? [];
      const basisRaw = (ctxData.basis as string) ?? "planned";
      const basis = basisRaw === "actual" ? "actual" : "planned";
      const sourceEvent = (ctxData.source_event as string) ?? null;

      if (shiftIds.length === 0) {
        await advanceToNextStep(supabase, state, step);
        break;
      }

      // Load shifts from DB (authoritative data, not from payload)
      const { data: shifts } = await supabase
        .from("schedule_shift")
        .select(
          "schedule_shift_id, profile_id, department_id, shift_date, start_time, end_time, actual_start, actual_end",
        )
        .in("schedule_shift_id", shiftIds);

      for (const shift of shifts ?? []) {
        if (!shift.profile_id) continue;

        // Load payroll profile for tariff context
        const { data: payroll } = await supabase
          .from("employee_payroll_profile")
          .select("tariff_override_id, tariff_category, seniority_start_date, has_fagbrev")
          .eq("profile_id", shift.profile_id)
          .order("valid_from", { ascending: false })
          .limit(1)
          .single();

        // Load tariff rates (workspace-level + platform baseline)
        const { data: wsRates } = await supabase
          .from("tariff_rate_table")
          .select("id, rate_type, amount, unit, effective_from, effective_until")
          .eq("workspace_id", state.workspace_id);

        const { data: platformRates } = await supabase
          .from("tariff_rate_table")
          .select("id, rate_type, amount, unit, effective_from, effective_until")
          .is("workspace_id", null);

        // Determine effective times based on basis
        const effectiveStart =
          basis === "actual" && shift.actual_start
            ? shift.actual_start
            : `${shift.shift_date}T${shift.start_time}:00Z`;
        const effectiveEnd =
          basis === "actual" && shift.actual_end
            ? shift.actual_end
            : `${shift.shift_date}T${shift.end_time}:00Z`;

        // Compute base hours
        const startMs = new Date(effectiveStart).getTime();
        const endMs = new Date(effectiveEnd).getTime();
        let baseHours = (endMs - startMs) / (1000 * 60 * 60);
        if (baseHours < 0) baseHours += 24; // overnight shift

        // Resolve supplements from tariff rates (workspace overrides platform)
        const allRates = [...(wsRates ?? []), ...(platformRates ?? [])];
        const supplements: Array<{ type: string; amount: number; unit: string }> = [];
        const shiftDate = new Date(effectiveStart);
        const hour = shiftDate.getUTCHours();
        const dayOfWeek = shiftDate.getUTCDay(); // 0=Sun

        // Evening supplement: 21:00-06:00
        if (hour >= 21 || hour < 6) {
          const rate = allRates.find((r) => r.rate_type === "kveldstillegg");
          if (rate)
            supplements.push({ type: "kveldstillegg", amount: rate.amount, unit: rate.unit });
        }

        // Weekend supplement: Sat-Sun
        if (dayOfWeek === 0 || dayOfWeek === 6) {
          const rate = allRates.find((r) => r.rate_type === "helgetillegg");
          if (rate)
            supplements.push({ type: "helgetillegg", amount: rate.amount, unit: rate.unit });
        }

        // Base rate from employment contract hourly_rate (simplified)
        const baseRate = 0; // TODO: load from employment_contract when available
        const supplementCost = supplements.reduce((sum, s) => {
          if (s.unit === "kr/t") return sum + s.amount * baseHours;
          if (s.unit === "percent") return sum + (baseRate * baseHours * s.amount) / 100;
          return sum;
        }, 0);
        const totalCost = baseHours * baseRate + supplementCost;

        await supabase.from("shift_cost_snapshot").insert({
          workspace_id: state.workspace_id,
          schedule_shift_id: shift.schedule_shift_id,
          profile_id: shift.profile_id,
          base_hours: baseHours,
          base_rate: baseRate,
          base_cost: baseHours * baseRate,
          supplements: supplements,
          total_cost: totalCost,
          basis,
          source_event: sourceEvent,
          effective_start: effectiveStart,
          effective_end: effectiveEnd,
        });
      }

      await advanceToNextStep(supabase, state, step);
      break;
    }

    case "create_session_task": {
      const ap = step.action_payload as Record<string, unknown>;
      const sessionId = (state.context as Record<string, unknown>).department_session_id as
        | string
        | undefined;
      const hookId = (state.context as Record<string, unknown>).session_hook_id as
        | string
        | undefined;

      if (sessionId) {
        await supabase.from("session_task").insert({
          workspace_id: state.workspace_id,
          department_session_id: sessionId,
          session_hook_id: hookId ?? null,
          title: (ap.title as string) ?? "Task",
          description: (ap.description as string) ?? null,
          status: "available",
          assigned_to: state.assignee_id ?? null,
          is_compliance_required: (ap.compliance_required as boolean) ?? false,
        });
      }
      await advanceToNextStep(supabase, state, step);
      break;
    }

    case "generate_steps": {
      // Dynamic step generation for training protocols
      const source = (step.action_payload as Record<string, unknown>).source as string;
      if (source === "protocol_assignment") {
        const assignmentId = (state.context as Record<string, unknown>)
          .protocol_assignment_id as string;

        const { data: assignment } = await supabase
          .from("protocol_assignment")
          .select(
            `
            protocol:protocol_id (
              procedure(procedure_id, name, procedure_step(step_id, step_order)),
              knowledge_test(knowledge_test_id, title),
              confirmation(confirmation_id, title)
            )
          `,
          )
          .eq("assignment_id", assignmentId)
          .single();

        const protocol = (assignment as Record<string, unknown>)?.protocol as Record<
          string,
          unknown
        >;
        const generated: Array<{
          state_id: string;
          step_order: number;
          status: string;
          action_type: string;
          action_payload: Record<string, unknown>;
        }> = [];
        let order = 1;

        // Create present_content steps for each procedure step
        const procedures = (protocol?.procedure ?? []) as Array<Record<string, unknown>>;
        for (const proc of procedures) {
          const procSteps = (proc.procedure_step ?? []) as Array<Record<string, unknown>>;
          for (const ps of procSteps) {
            generated.push({
              state_id: state.id,
              step_order: order++,
              status: "pending",
              action_type: "present_content",
              action_payload: {
                procedure_id: proc.procedure_id as string,
                procedure_step_id: ps.step_id as string,
              },
            });
          }
        }

        // Create administer_test steps for each knowledge test
        const tests = (protocol?.knowledge_test ?? []) as Array<Record<string, unknown>>;
        for (const test of tests) {
          generated.push({
            state_id: state.id,
            step_order: order++,
            status: "pending",
            action_type: "administer_test",
            action_payload: { knowledge_test_id: test.knowledge_test_id as string },
          });
        }

        // Create collect_signature steps for each confirmation
        const confirmations = (protocol?.confirmation ?? []) as Array<Record<string, unknown>>;
        for (const conf of confirmations) {
          generated.push({
            state_id: state.id,
            step_order: order++,
            status: "pending",
            action_type: "collect_signature",
            action_payload: { confirmation_id: conf.confirmation_id as string },
          });
        }

        // Final step: check readiness
        generated.push({
          state_id: state.id,
          step_order: order++,
          status: "pending",
          action_type: "check_readiness",
          action_payload: {},
        });

        if (generated.length > 0) {
          await supabase.from("engine_state_step").insert(generated);
          await supabase
            .from("engine_state")
            .update({
              current_step: 1,
              updated_at: new Date().toISOString(),
            })
            .eq("id", state.id);
          // Execute first generated step
          const first = generated[0];
          await executeStep(
            supabase,
            { ...state, current_step: 1 },
            {
              id: state.id,
              process_id: state.process_id,
              step_order: 1,
              step_group: null,
              action_type: first.action_type,
              action_payload: first.action_payload,
              condition: null,
              assignee_rule: null,
            },
          );
        }
      }
      break;
    }

    case "present_content":
    case "administer_test":
    case "collect_signature": {
      // Employee-driven steps — set step to active, state to waiting.
      // Employee UI drives completion by updating engine_state_step status.
      await supabase
        .from("engine_state_step")
        .update({
          status: "active",
          updated_at: new Date().toISOString(),
        })
        .eq("state_id", state.id)
        .eq("step_order", step.step_order);

      await supabase
        .from("engine_state")
        .update({
          status: "waiting",
          updated_at: new Date().toISOString(),
        })
        .eq("id", state.id);
      break;
    }

    case "check_readiness": {
      // Mark protocol assignment as completed
      const assignmentId = (state.context as Record<string, unknown>)
        .protocol_assignment_id as string;
      if (assignmentId) {
        await supabase
          .from("protocol_assignment")
          .update({
            status: "completed",
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("assignment_id", assignmentId);
      }
      await advanceToNextStep(supabase, state, step);
      break;
    }

    default:
      // Unknown action type — fail
      await supabase
        .from("engine_state")
        .update({
          status: "failed",
          last_error: `Unknown action type: ${step.action_type}`,
          updated_at: new Date().toISOString(),
        })
        .eq("id", state.id);
  }
}
