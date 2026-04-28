import { createClient } from "jsr:@supabase/supabase-js@2";
import { handleSyncIntegration } from "./handlers/sync-integration.ts";
import { handleScanOverdueInvoices } from "./handlers/scan-overdue-invoices.ts";

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

        // Create engine state.
        // ADR-0099: stamp originating_channel for every new engine_state. Trigger-dispatched
        // runs default to 'system'; callers can override via payload.originating_channel.
        // ADR-0161 / double-spawn fix: engine-event.ts now promotes entity_type, entity_id,
        // and assignee_id to the top of the payload so trigger-spawned states are fully
        // populated without a separate direct-insert at the call site. Additional helpdesk
        // context fields (summary, desk_channel_id, requester_profile_id, pii_redacted) are
        // propagated from properties into the state context so downstream capability tools
        // and UI queries have the same data shape as before.
        const payloadObj = (payload ?? {}) as Record<string, unknown>;

        // Build context: strip the dispatcher-level keys that are not domain
        // data (entity_type, entity_id, assignee_id, actor_id, correlation_id)
        // to avoid polluting JSONB context with protocol fields. Keep domain
        // properties (summary, desk_channel_id, requester_profile_id,
        // pii_redacted, originating_channel, channel_id, origin_type, etc.).
        const {
          entity_type: _et,
          entity_id: _ei,
          assignee_id: _ai,
          actor_id: _actor,
          correlation_id: _corr,
          ...domainPayload
        } = payloadObj;

        const stateContext: Record<string, unknown> = {
          ...domainPayload,
          originating_channel:
            (payloadObj.originating_channel as string | undefined) ?? "system",
        };
        const { data: state, error: stateErr } = await supabase
          .from("engine_state")
          .insert({
            trigger_id: trigger.id,
            process_id: processId,
            workspace_id,
            status: "active",
            current_step: 1,
            entity_type: (payloadObj.entity_type as string | undefined) ?? null,
            entity_id: (payloadObj.entity_id as string | undefined) ?? null,
            assignee_id: (payloadObj.assignee_id as string | undefined) ?? null,
            context: stateContext,
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
  // Added 2026-04-17 to match allowlist — both tables use domain PK columns.
  // Refs: ultrareview rp6ofqyfv bug_013, migrations 20260421100200 + 20260415120300.
  change_proposal: "change_proposal_id",
  observer_request: "observer_request_id",
  // Helpdesk + channel infrastructure (L-0085, added 2026-04-20).
  // Enables Phase 2 capability tools to mutate channel / channel_message /
  // engine_state via update_entity dispatcher steps. All three use the
  // default "id" primary key column (see migrations 20260422300000 +
  // 20260304100000). Keeping the allowlist below in sync is required —
  // see the update_entity handler for the companion guard.
  channel: "id",
  channel_message: "id",
  engine_state: "id",
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

  // ADR-0099: unified authority gate. Call public.gate_action before every mutation step.
  // Non-mutation step types (wait_for_event, generate_steps, cascade_*, check_readiness, ops_*)
  // are pure flow control and bypass the gate.
  const GATED_MUTATION_TYPES = new Set([
    "assign_task",
    "send_notification",
    "update_entity",
    "update_context",
    "create_deviation",
    "validate_settlement",
    "lock_checkout",
    "start_process",
  ]);
  // Gate outcome visible to the switch below. Kept at function scope so
  // HACCP Phase 2c handlers (create_deviation / validate_settlement /
  // lock_checkout) can propagate gate_evaluation_id into engine_event
  // payloads per L-0134 (handler must honour gate return fields, not
  // only the allow boolean).
  let gateEvaluation:
    | {
        allow: boolean;
        reason: string | null;
        gate_evaluation_id: string;
        downgrade_to: string | null;
        four_eyes_required: boolean;
      }
    | null = null;
  if (GATED_MUTATION_TYPES.has(step.action_type)) {
    const originatingChannel =
      ((state.context as Record<string, unknown> | null)?.originating_channel as
        | string
        | undefined) ?? "system";
    /* @authority-gate-ungated — runtime dispatcher: capability == state.process_id,
       which is a DB-driven engine_process identifier (not a code literal). Each
       process_id must be seeded via the engine_process migration that introduces it. */
    const { data: gateResult, error: gateError } = await supabase.rpc("gate_action", {
      p_workspace_id: state.workspace_id,
      p_capability: state.process_id,
      p_channel: originatingChannel,
      p_actor_profile_id: state.assignee_id ?? null,
      p_action_type: step.action_type,
      p_engine_process_id: state.process_id,
      p_engine_state_id: state.id,
    });
    if (gateError) {
      await supabase
        .from("engine_state")
        .update({
          status: "blocked",
          last_error: `gate_action RPC failed: ${gateError.message}`,
          updated_at: new Date().toISOString(),
        })
        .eq("id", state.id);
      return;
    }
    const gate = gateResult as {
      allow: boolean;
      reason: string | null;
      gate_evaluation_id: string;
      downgrade_to?: string | null;
      four_eyes_required?: boolean;
    } | null;
    if (gate && !gate.allow) {
      await supabase
        .from("engine_state")
        .update({
          status: "blocked",
          last_error: `gate_denied:${gate.reason ?? "unknown"} (eval=${gate.gate_evaluation_id})`,
          updated_at: new Date().toISOString(),
        })
        .eq("id", state.id);
      return;
    }
    if (gate) {
      gateEvaluation = {
        allow: gate.allow,
        reason: gate.reason,
        gate_evaluation_id: gate.gate_evaluation_id,
        downgrade_to: gate.downgrade_to ?? null,
        four_eyes_required: gate.four_eyes_required ?? false,
      };
    }
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
        const ctxOrigin = (state.context as Record<string, unknown>).origin as string | undefined;
        await supabase.from("session_task").insert({
          workspace_id: state.workspace_id,
          department_session_id: state.entity_id,
          title: (ap.task as string) ?? "Task",
          description: (ap.description as string) ?? null,
          status: "available",
          assigned_to: state.assignee_id ?? null,
          is_compliance_required: false,
          metadata: ctxOrigin === "system" ? { origin: "system" } : {},
        });
      }
      await advanceToNextStep(supabase, state, step);
      break;
    }

    case "send_notification": {
      const { template, recipient_id, workspace_id, payload } = step.action_payload as {
        template: string;
        recipient_id?: string;
        workspace_id?: string;
        payload?: Record<string, unknown>;
      };

      const targetRecipient = recipient_id ?? state.assignee_id;
      const targetWorkspace = workspace_id ?? state.workspace_id;

      if (targetRecipient && targetWorkspace) {
        await supabase.from("notification_outbox").insert({
          workspace_id: targetWorkspace,
          recipient_id: targetRecipient,
          mode: "work",
          priority: 0,
          title: template,
          body: "",
          action_url: null,
          metadata: {
            event_key: `engine.${template}`,
            state_id: state.id,
            ...payload,
          },
          allowed_channels: ["push", "in_app"],
        });
      }

      await advanceToNextStep(supabase, state, step);
      break;
    }

    case "update_entity": {
      const ap = step.action_payload as Record<string, unknown>;
      const entity = ap.entity as string;
      const setValues = ap.set as Record<string, unknown>;
      // Allowlist of tables that can be updated. Must stay in sync with
      // ENTITY_PK above — L-0085 captured the silent-noop trap when the
      // two diverge. Helpdesk entries (channel, channel_message, engine_state)
      // added 2026-04-20 for Phase 2 capability tools (ADR-0165).
      const allowed = [
        "daily_reconciliation",
        "department_session",
        "profile",
        "protocol_assignment",
        "change_proposal",
        "observer_request",
        "channel",
        "channel_message",
        "engine_state",
      ];
      if (allowed.includes(entity) && state.entity_id) {
        const pkColumn = ENTITY_PK[entity] ?? "id";
        const { error: updateError } = await supabase
          .from(entity)
          .update({
            ...setValues,
            updated_at: new Date().toISOString(),
          })
          .eq(pkColumn, state.entity_id);

        // Silent no-op is the worst failure mode — block the engine run on
        // update error so the domain row and engine_state don't diverge.
        // Mirrors the gate_action error-handling pattern earlier in this file.
        // Refs: ultrareview rp6ofqyfv bug_013.
        if (updateError) {
          await supabase
            .from("engine_state")
            .update({
              status: "blocked",
              last_error: updateError.message,
            })
            .eq("id", state.id);
          return;
        }
      }
      await advanceToNextStep(supabase, state, step);
      break;
    }

    // ──────────────────────────────────────────────────────────
    // update_context — Helpdesk SLA Phase 2 (ADR-0227)
    // ──────────────────────────────────────────────────────────
    // Sibling of update_entity. Patches engine_state.context for the
    // CURRENT state (state.id), not the linked domain entity
    // (state.entity_id). Needed by helpdesk_query_lifecycle step 4
    // to write context.sla_breached_at after a wait_for_event resume,
    // because the breach signal targets the engine_state row itself.
    //
    // Contract:
    //   action_payload.set: Record<string, unknown>  (top-level keys only)
    //
    // Behavior:
    //   - Shallow merge with existing context. Phase 1 helpdesk tools
    //     write desk_channel_id + summary + requester_profile_id at
    //     spawn — must be preserved.
    //   - Strips immutable keys (id, workspace_id) with a warn log.
    //   - Rejects nested-path keys ("foo.bar") — silent merge would
    //     create a top-level key with a dot, not patch a sub-object.
    //
    // Manual sanity check (until DB-driven dispatcher tests exist):
    //   1. Insert engine_process row with one update_context step:
    //        action_payload = { "set": { "sla_breached_at": "2026-04-28T00:00:00Z" } }
    //   2. Insert engine_state row with context = { "desk_channel_id": "abc" }
    //   3. POST event matching the trigger.
    //   4. SELECT context FROM engine_state WHERE id = ... returns
    //        { "desk_channel_id": "abc", "sla_breached_at": "2026-04-28T00:00:00Z" }
    //
    // Failure modes follow the update_entity precedent: status="blocked"
    // + last_error + early return. ops can resume after fixing the row.
    // ──────────────────────────────────────────────────────────
    case "update_context": {
      const ap = step.action_payload as Record<string, unknown>;
      const rawPatch = ap?.set as Record<string, unknown> | undefined;

      if (!rawPatch || typeof rawPatch !== "object" || Array.isArray(rawPatch)) {
        await supabase
          .from("engine_state")
          .update({
            status: "blocked",
            last_error: "update_context: missing or non-object `set`",
            updated_at: new Date().toISOString(),
          })
          .eq("id", state.id);
        return;
      }

      // Reject nested-path keys. The shallow merge would create a
      // top-level key literally named "foo.bar" — silent data corruption.
      const nestedKeys = Object.keys(rawPatch).filter(
        (k) => k.includes(".") || k.startsWith("$"),
      );
      if (nestedKeys.length > 0) {
        await supabase
          .from("engine_state")
          .update({
            status: "blocked",
            last_error: `update_context: nested-path keys not allowed: ${nestedKeys.join(", ")}`,
            updated_at: new Date().toISOString(),
          })
          .eq("id", state.id);
        return;
      }

      // Strip immutable keys. id + workspace_id are tenant/identity
      // anchors — never patchable from a step. Log so misconfigured
      // blueprints surface in dispatcher logs.
      const IMMUTABLE_KEYS = ["id", "workspace_id"];
      const stripped: string[] = [];
      const patch: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(rawPatch)) {
        if (IMMUTABLE_KEYS.includes(k)) {
          stripped.push(k);
          continue;
        }
        patch[k] = v;
      }
      if (stripped.length > 0) {
        console.warn(
          JSON.stringify({
            action: "update_context",
            warning: "stripped_immutable_keys",
            state_id: state.id,
            stripped,
          }),
        );
      }

      const current = (state.context as Record<string, unknown> | null) ?? {};
      const merged = { ...current, ...patch };
      const nowIso = new Date().toISOString();

      const { error: updateErr } = await supabase
        .from("engine_state")
        .update({ context: merged, updated_at: nowIso })
        .eq("id", state.id);

      if (updateErr) {
        await supabase
          .from("engine_state")
          .update({
            status: "blocked",
            last_error: `update_context failed: ${updateErr.message}`,
            updated_at: new Date().toISOString(),
          })
          .eq("id", state.id);
        return;
      }

      // ADR-0163: never log patch values — context can carry PII
      // (requester_profile_id, summaries). Keys only.
      console.log(
        JSON.stringify({
          action: "update_context",
          state_id: state.id,
          patch_keys: Object.keys(patch),
          ts: nowIso,
        }),
      );

      await advanceToNextStep(supabase, state, step);
      break;
    }

    case "create_deviation": {
      // HACCP Phase 2c — B5. Previously a silent-best-effort insert with
      // no error handling and no telemetry. Now:
      //   1. Returns early with `conditioned_skip` event when condition
      //      evaluates false (not a failure — an intended no-op).
      //   2. Blocks engine_state on insert error (mirrors update_entity
      //      L-0085 silent-noop guard).
      //   3. Emits `ops.deviation_created` into engine_event with the
      //      gate_evaluation_id so the audit trail links capability →
      //      authority check → domain artefact (L-0134).
      //   4. Honours the allowlisted `deviation_domain` /
      //      `deviation_severity` enums from database.types.ts — invalid
      //      values fall back to safe defaults (system / medium) rather
      //      than surfacing a Postgres enum_violation.
      const ap = step.action_payload as Record<string, unknown>;
      const condition = ap.condition as string | undefined;
      const ctx = state.context as Record<string, unknown>;

      if (condition && !ctx[condition]) {
        // Condition not met — emit a trail row so downstream observers
        // know the step was reached AND intentionally skipped, not lost.
        await supabase.from("engine_event").insert({
          workspace_id: state.workspace_id,
          event_type: "ops.deviation_conditioned_skip",
          payload: {
            state_id: state.id,
            process_id: state.process_id,
            step_order: step.step_order,
            condition,
            gate_evaluation_id: gateEvaluation?.gate_evaluation_id ?? null,
          },
        });
        await advanceToNextStep(supabase, state, step);
        break;
      }

      const VALID_DOMAINS = new Set(["safety", "customer", "procedure", "system", "material"]);
      const VALID_SEVERITIES = new Set(["low", "medium", "high", "critical"]);
      const rawDomain = (ap.domain as string) ?? "system";
      const rawSeverity = (ap.severity as string) ?? "medium";
      const domain = VALID_DOMAINS.has(rawDomain) ? rawDomain : "system";
      const severity = VALID_SEVERITIES.has(rawSeverity) ? rawSeverity : "medium";

      // Context-derived fields: link deviation to the session / shift /
      // reconciliation that triggered the process when available.
      const sessionId =
        (ctx.session_id as string | undefined) ??
        (state.entity_type === "department_session" ? (state.entity_id ?? null) : null);
      const shiftId =
        (ctx.shift_id as string | undefined) ??
        (state.entity_type === "schedule_shift" ? (state.entity_id ?? null) : null);
      const reconciliationId =
        (ctx.reconciliation_id as string | undefined) ??
        (state.entity_type === "daily_reconciliation" ? (state.entity_id ?? null) : null);

      const { data: deviationRow, error: insertError } = await supabase
        .from("deviation")
        .insert({
          workspace_id: state.workspace_id,
          title: (ap.description as string) ?? (ap.title as string) ?? "Auto-detected deviation",
          description: (ap.description as string) ?? null,
          domain,
          severity,
          subcategory: (ap.subcategory as string) ?? null,
          session_id: sessionId,
          linked_shift_id: shiftId,
          reconciliation_id: reconciliationId,
          reported_by: state.assignee_id ?? null,
          status: "open",
          blocks_day_approval: severity === "critical" || severity === "high",
          requires_action: true,
        })
        .select("deviation_id")
        .single();

      if (insertError || !deviationRow) {
        await supabase
          .from("engine_state")
          .update({
            status: "blocked",
            last_error: `create_deviation insert failed: ${insertError?.message ?? "unknown"}`,
            updated_at: new Date().toISOString(),
          })
          .eq("id", state.id);
        return;
      }

      await supabase.from("engine_event").insert({
        workspace_id: state.workspace_id,
        event_type: "ops.deviation_created",
        payload: {
          deviation_id: deviationRow.deviation_id,
          state_id: state.id,
          process_id: state.process_id,
          step_order: step.step_order,
          domain,
          severity,
          session_id: sessionId,
          linked_shift_id: shiftId,
          reconciliation_id: reconciliationId,
          gate_evaluation_id: gateEvaluation?.gate_evaluation_id ?? null,
          four_eyes_required: gateEvaluation?.four_eyes_required ?? false,
          downgrade_to: gateEvaluation?.downgrade_to ?? null,
        },
      });

      await advanceToNextStep(supabase, state, step);
      break;
    }

    case "validate_settlement": {
      // HACCP Phase 2c — B5. Previously silently swallowed edge function
      // errors (console.error only, state advanced as if success). That
      // shape is Invariant 11 phantom — gate passed, "work started"
      // semantically but no artefact could be verified.
      //
      // Now:
      //   1. Requires a resolvable reconciliation_id. Derived from
      //      state.entity_id (if entity_type=daily_reconciliation) or
      //      state.context.reconciliation_id. Missing → block.
      //   2. Invokes validate-settlement; any thrown error or non-null
      //      response error field blocks engine_state with the message.
      //   3. Emits `ops.settlement_validated` with gate_evaluation_id +
      //      edge-function outcome so audit trail contains the full
      //      chain (gate → RPC → domain mutation).
      const ap = step.action_payload as Record<string, unknown>;
      const ctx = state.context as Record<string, unknown>;
      const reconciliationId =
        (ap.reconciliation_id as string | undefined) ??
        (ctx.reconciliation_id as string | undefined) ??
        (state.entity_type === "daily_reconciliation" ? (state.entity_id ?? undefined) : undefined);

      if (!reconciliationId) {
        await supabase
          .from("engine_state")
          .update({
            status: "blocked",
            last_error:
              "validate_settlement: reconciliation_id missing from action_payload, context, or entity_id",
            updated_at: new Date().toISOString(),
          })
          .eq("id", state.id);
        return;
      }

      let edgeResult: Record<string, unknown> | null = null;
      let edgeError: string | null = null;
      try {
        const { data, error } = await supabase.functions.invoke("validate-settlement", {
          body: { reconciliation_id: reconciliationId, workspace_id: state.workspace_id },
        });
        if (error) {
          edgeError = error.message ?? String(error);
        } else {
          edgeResult = (data as Record<string, unknown> | null) ?? null;
        }
      } catch (err) {
        edgeError = err instanceof Error ? err.message : String(err);
      }

      if (edgeError) {
        await supabase
          .from("engine_state")
          .update({
            status: "blocked",
            last_error: `validate_settlement failed: ${edgeError}`,
            updated_at: new Date().toISOString(),
          })
          .eq("id", state.id);
        return;
      }

      await supabase.from("engine_event").insert({
        workspace_id: state.workspace_id,
        event_type: "ops.settlement_validated",
        payload: {
          reconciliation_id: reconciliationId,
          state_id: state.id,
          process_id: state.process_id,
          step_order: step.step_order,
          within_threshold: edgeResult?.within_threshold ?? null,
          difference: edgeResult?.difference ?? null,
          difference_percent: edgeResult?.difference_percent ?? null,
          deviation_id: edgeResult?.deviation_id ?? null,
          validation_id: edgeResult?.validation_id ?? null,
          gate_evaluation_id: gateEvaluation?.gate_evaluation_id ?? null,
          four_eyes_required: gateEvaluation?.four_eyes_required ?? false,
          downgrade_to: gateEvaluation?.downgrade_to ?? null,
        },
      });

      await advanceToNextStep(supabase, state, step);
      break;
    }

    case "lock_checkout": {
      // HACCP Phase 2c — B5. Previously a pure stub: gate was called
      // (the step is in GATED_MUTATION_TYPES) but NO mutation was
      // performed — classic Invariant 11 phantom (ADR-0196 / L-0124).
      //
      // Now the step actually locks the target daily_reconciliation:
      // flips status to `locked`, stamps locked_at + locked_by, emits
      // an engine_event with the gate_evaluation_id linkage.
      //
      // Target resolution:
      //   1. action_payload.reconciliation_id (explicit override)
      //   2. context.reconciliation_id
      //   3. entity_id when entity_type=daily_reconciliation
      //
      // Missing target → blocks the state (same discipline as
      // validate_settlement). Silent no-op is the L-0085 trap.
      //
      // Idempotency: the update is safe to re-run (SET status='locked')
      // but we skip the emit when the row was already locked to avoid
      // duplicate trail rows on retry loops.
      const ap = step.action_payload as Record<string, unknown>;
      const ctx = state.context as Record<string, unknown>;
      const reconciliationId =
        (ap.reconciliation_id as string | undefined) ??
        (ctx.reconciliation_id as string | undefined) ??
        (state.entity_type === "daily_reconciliation" ? (state.entity_id ?? undefined) : undefined);

      if (!reconciliationId) {
        await supabase
          .from("engine_state")
          .update({
            status: "blocked",
            last_error:
              "lock_checkout: reconciliation_id missing from action_payload, context, or entity_id",
            updated_at: new Date().toISOString(),
          })
          .eq("id", state.id);
        return;
      }

      const { data: priorRow, error: fetchError } = await supabase
        .from("daily_reconciliation")
        .select("reconciliation_id, status, workspace_id")
        .eq("reconciliation_id", reconciliationId)
        .maybeSingle();

      if (fetchError) {
        await supabase
          .from("engine_state")
          .update({
            status: "blocked",
            last_error: `lock_checkout fetch failed: ${fetchError.message}`,
            updated_at: new Date().toISOString(),
          })
          .eq("id", state.id);
        return;
      }

      if (!priorRow) {
        await supabase
          .from("engine_state")
          .update({
            status: "blocked",
            last_error: `lock_checkout: daily_reconciliation ${reconciliationId} not found`,
            updated_at: new Date().toISOString(),
          })
          .eq("id", state.id);
        return;
      }

      // Workspace cross-check — refuse to lock a row belonging to a
      // different workspace than the state. This is a belt-and-braces
      // guard; RLS should already prevent this but the dispatcher runs
      // as service role.
      if (priorRow.workspace_id !== state.workspace_id) {
        await supabase
          .from("engine_state")
          .update({
            status: "blocked",
            last_error: `lock_checkout: workspace mismatch (state=${state.workspace_id}, recon=${priorRow.workspace_id})`,
            updated_at: new Date().toISOString(),
          })
          .eq("id", state.id);
        return;
      }

      const wasAlreadyLocked = priorRow.status === "locked";

      if (!wasAlreadyLocked) {
        const nowIso = new Date().toISOString();
        const { error: updateError } = await supabase
          .from("daily_reconciliation")
          .update({
            status: "locked",
            locked_at: nowIso,
            locked_by: state.assignee_id ?? null,
            updated_at: nowIso,
          })
          .eq("reconciliation_id", reconciliationId);

        if (updateError) {
          await supabase
            .from("engine_state")
            .update({
              status: "blocked",
              last_error: `lock_checkout update failed: ${updateError.message}`,
              updated_at: new Date().toISOString(),
            })
            .eq("id", state.id);
          return;
        }
      }

      await supabase.from("engine_event").insert({
        workspace_id: state.workspace_id,
        event_type: "ops.checkout_locked",
        payload: {
          reconciliation_id: reconciliationId,
          state_id: state.id,
          process_id: state.process_id,
          step_order: step.step_order,
          locked_by: state.assignee_id ?? null,
          was_already_locked: wasAlreadyLocked,
          prior_status: priorRow.status,
          gate_evaluation_id: gateEvaluation?.gate_evaluation_id ?? null,
          four_eyes_required: gateEvaluation?.four_eyes_required ?? false,
          downgrade_to: gateEvaluation?.downgrade_to ?? null,
        },
      });

      await advanceToNextStep(supabase, state, step);
      break;
    }

    case "schedule_control": {
      const ctx = state.context as Record<string, unknown>;
      const ctxData = (ctx.data as Record<string, unknown>) ?? {};
      const dates = (ctxData.dates as string[]) ?? (ctx.dates as string[]) ?? [];
      const deptIds =
        (ctxData.department_ids as string[]) ?? (ctx.department_ids as string[]) ?? [];

      const ap = step.action_payload as Record<string, unknown>;
      const hookTypes = (ap.hooks as string[]) ?? [];

      // Timing config: offset in minutes relative to the anchor time
      const hookOffsets: Record<string, { anchor: "open" | "close"; offset: number }> = {
        pre_open: { anchor: "open", offset: -30 },
        open: { anchor: "open", offset: 0 },
        pre_close: { anchor: "close", offset: -30 },
        close: { anchor: "close", offset: 0 },
      };

      // Look up department_sessions for each date × department
      const { data: sessions } = await supabase
        .from("department_session")
        .select("id, workspace_id, department_id, session_date, planned_open, planned_close")
        .eq("workspace_id", state.workspace_id)
        .in("department_id", deptIds)
        .in("session_date", dates);

      const hookRows: Array<{
        workspace_id: string;
        department_id: string;
        hook_type: string;
        trigger_offset_min: number;
        is_active: boolean;
      }> = [];

      for (const session of sessions ?? []) {
        for (const hookType of hookTypes) {
          const config = hookOffsets[hookType];
          if (!config) continue;

          hookRows.push({
            workspace_id: session.workspace_id,
            department_id: session.department_id,
            hook_type: hookType,
            trigger_offset_min: config.offset,
            is_active: true,
          });
        }
      }

      if (hookRows.length > 0) {
        // Delete existing hooks for these departments to make re-runs idempotent,
        // then insert fresh rows. No unique constraint exists on (workspace_id, department_id, hook_type).
        await supabase
          .from("session_hook")
          .delete()
          .eq("workspace_id", state.workspace_id)
          .in("department_id", deptIds)
          .in("hook_type", hookTypes);

        await supabase.from("session_hook").insert(hookRows);
      }

      console.log(
        `[engine-dispatch] schedule_control: created ${hookRows.length} hooks for ${(sessions ?? []).length} sessions`,
      );

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

      // Season activation: resolve departments + planning window from season data
      const seasonId = (ctxData.season_id as string) ?? (ctx.season_id as string) ?? null;
      let dates = (ctxData.dates as string[]) ?? (ctx.dates as string[]) ?? [];
      let deptIds = (ctxData.department_ids as string[]) ?? (ctx.department_ids as string[]) ?? [];

      if (seasonId && deptIds.length === 0) {
        // Season activation path: resolve all operational departments in workspace
        const { data: allDepts } = await supabase
          .from("department")
          .select("department_id, department_type")
          .eq("workspace_id", state.workspace_id)
          .eq("is_active", true);
        deptIds = (allDepts ?? [])
          .filter(
            (d: { department_type: string | null }) =>
              !d.department_type ||
              d.department_type === "operational" ||
              d.department_type === "hybrid",
          )
          .map((d: { department_id: string }) => d.department_id);

        // Resolve planning window: today through min(season.end_date, today + 7 days)
        if (dates.length === 0) {
          const today = new Date();
          const seasonEnd = (ctxData.end_date as string) ?? (ctx.end_date as string) ?? null;
          const windowEnd = new Date(today);
          windowEnd.setDate(windowEnd.getDate() + 7);
          const effectiveEnd =
            seasonEnd && new Date(seasonEnd) < windowEnd ? new Date(seasonEnd) : windowEnd;
          dates = [];
          const cursor = new Date(today);
          while (cursor <= effectiveEnd) {
            dates.push(cursor.toISOString().split("T")[0]!);
            cursor.setDate(cursor.getDate() + 1);
          }
        }
      }

      // Fallback: if still no dates, use today
      if (dates.length === 0) {
        dates = [new Date().toISOString().split("T")[0]!];
      }

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
          .select(
            "tariff_override_id, tariff_category, seniority_start_date, has_fagbrev, employment_contract:employment_contract_id(hourly_rate)",
          )
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

        // Weekend supplement: Sat 15:00 - Sun 24:00 (Riksavtalen)
        if (dayOfWeek === 0 || (dayOfWeek === 6 && hour >= 15)) {
          const rate = allRates.find((r) => r.rate_type === "helgetillegg");
          if (rate)
            supplements.push({ type: "helgetillegg", amount: rate.amount, unit: rate.unit });
        }

        // 3-step fallback: contract -> tariff base rate -> 0 with warning
        const contractRate = (payroll?.employment_contract as { hourly_rate: number | null } | null)
          ?.hourly_rate;
        const tariffBaseRate = allRates.find((r) => r.rate_type === "riksavtalen")?.amount ?? null;
        const baseRate = contractRate ?? tariffBaseRate ?? 0;
        if (baseRate === 0) {
          console.warn(
            `[cascade_cost_snapshot] baseRate=0 for profile ${shift.profile_id} — no contract hourly_rate or tariff base rate found`,
          );
        }
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

    case "cascade_budget_propagation": {
      const ctx = state.context as Record<string, unknown>;
      const ctxData = (ctx.data as Record<string, unknown>) ?? {};
      const seasonId = (ctxData.season_id as string) ?? (ctx.entity_id as string);

      if (!seasonId || !state.workspace_id) {
        await advanceToNextStep(supabase, state, step);
        break;
      }

      // Load season date range
      const { data: season } = await supabase
        .from("season")
        .select("start_date, end_date")
        .eq("season_id", seasonId)
        .single();

      // Load budget parameters
      const { data: budget } = await supabase
        .from("season_budget")
        .select("total_target_revenue, target_labor_percentage, avg_hourly_wage")
        .eq("season_id", seasonId)
        .single();

      // Load day factors for this workspace
      const { data: dayFactors } = await supabase
        .from("day_factor")
        .select("weekday, factor")
        .eq("workspace_id", state.workspace_id);

      if (!season || !budget || !dayFactors?.length) {
        await advanceToNextStep(supabase, state, step);
        break;
      }

      // Inline propagation logic (mirrors propagateBudgetTargets pure function)
      const factorMap = new Map<number, number>();
      for (const df of dayFactors) {
        factorMap.set(df.weekday as number, df.factor as number);
      }

      // Enumerate dates
      const dates: string[] = [];
      const current = new Date(season.start_date + "T12:00:00Z");
      const end = new Date(season.end_date + "T12:00:00Z");
      while (current <= end) {
        dates.push(current.toISOString().split("T")[0]);
        current.setUTCDate(current.getUTCDate() + 1);
      }

      // Assign factors and compute sum
      const daysWithFactors = dates.map((date) => {
        const jsDay = new Date(date + "T12:00:00Z").getUTCDay();
        const weekday = jsDay === 0 ? 6 : jsDay - 1; // 0=Mon...6=Sun
        return { date, factor: factorMap.get(weekday) ?? 1.0 };
      });
      const factorSum = daysWithFactors.reduce((sum, d) => sum + d.factor, 0);
      const totalRevenue = budget.total_target_revenue as number;
      const laborPct = budget.target_labor_percentage as number;
      const avgWage = budget.avg_hourly_wage as number;

      // Upsert daily targets into workspace_budget
      for (const { date, factor } of daysWithFactors) {
        const targetRevenue =
          factorSum > 0 ? totalRevenue * (factor / factorSum) : totalRevenue / dates.length;
        const targetLaborCost = targetRevenue * laborPct;
        const targetStaffHours = avgWage > 0 ? targetLaborCost / avgWage : 0;

        await supabase.from("workspace_budget").upsert(
          {
            workspace_id: state.workspace_id,
            location_id: null,
            department_id: null,
            period_type: "daily",
            period_date: date,
            hour_slot: null,
            revenue_target: targetRevenue,
            labor_cost_target: targetLaborCost,
            labor_hours_target: targetStaffHours,
          },
          {
            onConflict: "workspace_id,location_id,department_id,period_type,period_date,hour_slot",
          },
        );
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
      const ctxOrigin = (state.context as Record<string, unknown>).origin as string | undefined;

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
          metadata: ctxOrigin === "system" ? { origin: "system" } : {},
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

    case "ingest_workspace_knowledge": {
      // Fire-and-forget call to ingest Edge Function — non-blocking for engine flow
      const ingestUrl = Deno.env.get("SUPABASE_URL")!;
      const ingestKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

      try {
        const ingestRes = await fetch(`${ingestUrl}/functions/v1/ingest-workspace-knowledge`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${ingestKey}`,
          },
          body: JSON.stringify({
            workspace_id: state.workspace_id,
            force: (step.action_payload as Record<string, unknown>)?.force ?? false,
          }),
        });

        const ingestResult = await ingestRes.json();
        console.log(`[ingest_workspace_knowledge] workspace=${state.workspace_id}:`, ingestResult);
      } catch (err) {
        console.error(`[ingest_workspace_knowledge] Failed:`, err);
        // Non-fatal — don't block engine flow if ingestion fails
      }

      await advanceToNextStep(supabase, state, step);
      break;
    }

    case "cascade_reconciliation_close": {
      const ctx = state.context as Record<string, unknown>;
      const payload = (ctx.data as Record<string, unknown>) ?? {};
      const reconciliationId = payload.reconciliation_id as string;
      const departmentId = payload.department_id as string;
      const reconDate = payload.reconciliation_date as string;

      if (!reconciliationId || !departmentId || !reconDate) {
        console.error("[cascade_reconciliation_close] missing context fields");
        await advanceToNextStep(supabase, state, step);
        break;
      }

      // Get shift IDs for this date + department
      const { data: dayShifts } = await supabase
        .from("schedule_shift")
        .select("schedule_shift_id")
        .eq("workspace_id", state.workspace_id)
        .eq("shift_date", reconDate)
        .eq("department_id", departmentId);

      const shiftIds = (dayShifts ?? []).map((s) => s.schedule_shift_id);

      // Fetch cost snapshots + planned shift hours
      let totalLaborCost = 0;
      let totalSnapshotHours = 0;
      let totalPlannedHours = 0;

      if (shiftIds.length > 0) {
        const [{ data: costSnapshots }, { data: plannedShifts }] = await Promise.all([
          supabase
            .from("shift_cost_snapshot")
            .select("total_cost, base_hours")
            .eq("workspace_id", state.workspace_id)
            .in("schedule_shift_id", shiftIds)
            .eq("basis", "planned"),
          supabase.from("schedule_shift").select("work_hours").in("schedule_shift_id", shiftIds),
        ]);

        totalLaborCost = (costSnapshots ?? []).reduce(
          (sum, s) => sum + Number(s.total_cost ?? 0),
          0,
        );
        totalSnapshotHours = (costSnapshots ?? []).reduce(
          (sum, s) => sum + Number(s.base_hours ?? 0),
          0,
        );
        totalPlannedHours = (plannedShifts ?? []).reduce(
          (sum, s) => sum + Number(s.work_hours ?? 0),
          0,
        );
      }

      // Fetch revenue for KPI calculation
      const { data: recon } = await supabase
        .from("daily_reconciliation")
        .select("revenue_total")
        .eq("reconciliation_id", reconciliationId)
        .single();

      const revenueTotal = Number(recon?.revenue_total ?? 0);
      const revenuePerHour = totalSnapshotHours > 0 ? revenueTotal / totalSnapshotHours : null;
      const laborPercentage = revenueTotal > 0 ? (totalLaborCost / revenueTotal) * 100 : null;

      await supabase
        .from("daily_reconciliation")
        .update({
          total_labor_cost: totalLaborCost,
          total_actual_hours: totalSnapshotHours,
          total_planned_hours: totalPlannedHours,
          revenue_per_worked_hour: revenuePerHour,
          labor_percentage: laborPercentage,
        })
        .eq("reconciliation_id", reconciliationId);

      await advanceToNextStep(supabase, state, step);
      break;
    }

    case "ops_escalate": {
      // ADR-0088 Phase 2 ACT: escalate an operational alert through the chain.
      const ap = step.action_payload as Record<string, unknown>;
      const alertRule = (ap.alert_rule as string) ?? "escalation";
      const severity = (ap.severity as string) ?? "warning";
      const message = (ap.message as string) ?? `Escalation: ${alertRule}`;
      const deptId = (ap.department_id as string) ?? null;

      await supabase.from("notification").insert({
        workspace_id: state.workspace_id,
        title: `[ESCALATION] ${alertRule.replace(/_/g, " ")}`,
        body: message,
        icon_type: severity === "critical" ? "alert" : "warning",
        priority: severity === "critical" ? "critical" : "high",
        target_type: deptId ? "department" : "workspace",
        target_id: deptId ?? state.workspace_id,
        metadata: {
          type: "ops_escalation",
          alert_rule: alertRule,
          session_id: (ap.session_id as string) ?? state.entity_id,
          origin: "system",
        },
      });

      await supabase.from("engine_event").insert({
        workspace_id: state.workspace_id,
        event_type: "ops.act.escalated",
        payload: {
          alert_rule: alertRule,
          department_id: deptId,
          session_id: (ap.session_id as string) ?? state.entity_id,
          severity,
          origin: "system",
        },
      });

      await advanceToNextStep(supabase, state, step);
      break;
    }

    case "ops_redistribute_tasks": {
      // ADR-0088 Phase 2 ACT: redistribute tasks from a no-show employee
      const ap = step.action_payload as Record<string, unknown>;
      const absentId = ap.absent_employee_id as string;
      const sessionId = (ap.session_id as string) ?? state.entity_id;
      const deptId = ap.department_id as string;
      const today = new Date().toISOString().slice(0, 10);

      if (absentId && sessionId) {
        const { data: orphanedTasks } = await supabase
          .from("session_task")
          .select("id, title, priority")
          .eq("department_session_id", sessionId)
          .eq("assigned_to", absentId)
          .in("status", ["pending", "available"]);

        if (orphanedTasks && orphanedTasks.length > 0) {
          const taskIds = orphanedTasks.map((t: { id: string }) => t.id);
          await supabase
            .from("session_task")
            .update({
              assigned_to: null,
              status: "available",
              metadata: { origin: "system", redistributed_from: absentId },
              updated_at: new Date().toISOString(),
            })
            .in("id", taskIds);
        }

        if (deptId) {
          const { data: onShift } = await supabase
            .from("schedule_shift")
            .select("employee_id")
            .eq("workspace_id", state.workspace_id)
            .eq("department_id", deptId)
            .eq("shift_date", today)
            .in("status", ["published", "confirmed"])
            .neq("employee_id", absentId);

          for (const shift of onShift ?? []) {
            if (!shift.employee_id) continue;
            await supabase.from("notification_outbox").insert({
              workspace_id: state.workspace_id,
              recipient_id: shift.employee_id,
              mode: "work",
              priority: 1,
              title: "Tasks redistributed",
              body: `${orphanedTasks?.length ?? 0} tasks need pickup due to absent colleague`,
              action_url: null,
              metadata: {
                event_key: "ops.act.tasks_redistributed",
                session_id: sessionId,
                origin: "system",
              },
              allowed_channels: ["push", "in_app"],
            });
          }
        }

        await supabase.from("engine_event").insert({
          workspace_id: state.workspace_id,
          event_type: "ops.act.tasks_redistributed",
          payload: {
            absent_employee_id: absentId,
            department_id: deptId,
            session_id: sessionId,
            tasks_redistributed: orphanedTasks?.length ?? 0,
            origin: "system",
          },
        });
      }

      await advanceToNextStep(supabase, state, step);
      break;
    }

    case "ops_freeze_session": {
      // ADR-0088 Phase 2 ACT: freeze session task statuses and prepare handoff.
      const ap = step.action_payload as Record<string, unknown>;
      const sessionId = (ap.session_id as string) ?? state.entity_id;

      if (sessionId) {
        const { data: activeTasks } = await supabase
          .from("session_task")
          .select("id, status")
          .eq("department_session_id", sessionId)
          .in("status", ["pending", "in_progress", "available"]);

        if (activeTasks && activeTasks.length > 0) {
          const taskIds = activeTasks.map((t: { id: string }) => t.id);
          await supabase
            .from("session_task")
            .update({
              status: "skipped",
              metadata: { origin: "system", frozen_at: new Date().toISOString() },
              updated_at: new Date().toISOString(),
            })
            .in("id", taskIds);
        }

        const { count: totalCount } = await supabase
          .from("session_task")
          .select("id", { count: "exact", head: true })
          .eq("department_session_id", sessionId);

        const { count: completedCount } = await supabase
          .from("session_task")
          .select("id", { count: "exact", head: true })
          .eq("department_session_id", sessionId)
          .eq("status", "completed");

        await supabase
          .from("department_session")
          .update({
            tasks_total: totalCount ?? 0,
            tasks_completed: completedCount ?? 0,
            updated_at: new Date().toISOString(),
          })
          .eq("department_session_id", sessionId);

        await supabase.from("engine_event").insert({
          workspace_id: state.workspace_id,
          event_type: "ops.act.session_frozen",
          payload: {
            session_id: sessionId,
            tasks_total: totalCount ?? 0,
            tasks_completed: completedCount ?? 0,
            tasks_frozen: activeTasks?.length ?? 0,
            origin: "system",
          },
        });
      }

      await advanceToNextStep(supabase, state, step);
      break;
    }

    // ──────────────────────────────────────────────────────────
    // call_rpc — invoke a Postgres RPC and merge its result into
    // engine_state.context. Used by shift_lifecycle_v1 to call
    // derive_shift_hours / snapshot_shift_cost per ADR-0095 +
    // ADR-0110.
    //
    // Payload schema:
    //   {
    //     rpc_name: string,
    //     args_from_context: string[],   // context keys to read
    //     args_param_names: string[],    // matching RPC arg names
    //     output_key: string             // legacy: where to stash scalar
    //                                     result when RPC returns UUID
    //   }
    //
    // Result handling (ADR-0110, Council R2 BREAK 2 fix):
    //   - If the RPC returns a JSON object, the whole object is merged
    //     into engine_state.context. This lets RPCs surface ancillary
    //     context (session_date, department_id, …) alongside the
    //     primary key without requiring a second read step. Fixes the
    //     silent shift.settled handoff failure where session_date +
    //     department_id were missing from the downstream emit payload.
    //   - If the RPC returns a scalar (UUID or primitive), the value
    //     is stored under output_key — backward-compatible with the
    //     pre-ADR-0110 contract.
    //
    // ADR-0099 note: call_rpc is a gated mutation type. Once
    // gate_action() is landed, add "call_rpc" to GATED_MUTATION_TYPES
    // and check engine_authority_config before invoking. For now the
    // seeded shift_lifecycle_v1 process runs with
    // allowed_channels=['system'] so the gate is trivially satisfied.
    // ──────────────────────────────────────────────────────────
    case "call_rpc": {
      const ap = step.action_payload as Record<string, unknown>;
      const rpcName = ap.rpc_name as string | undefined;
      const argsFromContext = (ap.args_from_context as string[] | undefined) ?? [];
      const argsParamNames = (ap.args_param_names as string[] | undefined) ?? argsFromContext;
      const outputKey = (ap.output_key as string | undefined) ?? `${rpcName}_result`;

      if (!rpcName) {
        await supabase
          .from("engine_state")
          .update({
            status: "failed",
            last_error: "call_rpc: rpc_name missing in action_payload",
            updated_at: new Date().toISOString(),
          })
          .eq("id", state.id);
        break;
      }

      // Special case: entity_id comes from state (not context body).
      // The shift_lifecycle_v1 process uses args_from_context=['entity_id']
      // to pass the shift_id.
      const ctx = state.context as Record<string, unknown>;
      const rpcArgs: Record<string, unknown> = {};
      for (let i = 0; i < argsFromContext.length; i++) {
        const ctxKey = argsFromContext[i];
        const paramName = argsParamNames[i] ?? ctxKey;
        rpcArgs[paramName] =
          ctxKey === "entity_id" ? state.entity_id : (ctx[ctxKey] ?? null);
      }

      try {
        // @ts-expect-error supabase-js rpc typing is narrow; our RPCs
        // are plpgsql and return scalar UUIDs or jsonb objects.
        const { data: rpcResult, error: rpcErr } = await supabase.rpc(rpcName, rpcArgs);
        if (rpcErr) {
          console.error(`[engine-dispatch] call_rpc ${rpcName} failed:`, rpcErr);
          await supabase
            .from("engine_state")
            .update({
              status: "failed",
              last_error: `call_rpc ${rpcName}: ${rpcErr.message}`,
              updated_at: new Date().toISOString(),
            })
            .eq("id", state.id);
          break;
        }

        // ADR-0110: if the RPC returned a JSON object, merge the whole
        // object into context (so session_date / department_id reach
        // shift.settled downstream). Otherwise fall back to the legacy
        // scalar-under-output_key behaviour.
        const isPlainObject =
          rpcResult !== null &&
          typeof rpcResult === "object" &&
          !Array.isArray(rpcResult);
        const nextContext = isPlainObject
          ? { ...ctx, ...(rpcResult as Record<string, unknown>) }
          : { ...ctx, [outputKey]: rpcResult };
        await supabase
          .from("engine_state")
          .update({
            context: nextContext,
            updated_at: new Date().toISOString(),
          })
          .eq("id", state.id);

        // Telemetry: emit a synthetic engine event so observers see
        // the RPC invocation.
        await supabase.from("engine_event").insert({
          workspace_id: state.workspace_id,
          event_type: "engine.call_rpc",
          payload: {
            state_id: state.id,
            rpc_name: rpcName,
            output_key: outputKey,
            result: rpcResult,
            origin: "system",
          },
        });

        await advanceToNextStep(
          supabase,
          { ...state, context: nextContext },
          step,
        );
      } catch (err) {
        console.error(`[engine-dispatch] call_rpc ${rpcName} threw:`, err);
        await supabase
          .from("engine_state")
          .update({
            status: "failed",
            last_error: `call_rpc ${rpcName}: ${String(err)}`,
            updated_at: new Date().toISOString(),
          })
          .eq("id", state.id);
      }
      break;
    }

    // ──────────────────────────────────────────────────────────
    // emit_event — write a new row to engine_event. Used by
    // shift_lifecycle_v1 to emit shift.settled (ADR-0100) and by
    // department_session_lifecycle to emit pending_signoff.
    //
    // Payload schema:
    //   {
    //     event_type: string,
    //     payload_from_context: string[],   // context keys to copy
    //     include_entity: boolean           // also copy entity_type/id
    //   }
    // ──────────────────────────────────────────────────────────
    case "emit_event": {
      const ap = step.action_payload as Record<string, unknown>;
      const eventType = ap.event_type as string | undefined;
      const keys = (ap.payload_from_context as string[] | undefined) ?? [];
      const includeEntity = ap.include_entity === true;

      if (!eventType) {
        await supabase
          .from("engine_state")
          .update({
            status: "failed",
            last_error: "emit_event: event_type missing",
            updated_at: new Date().toISOString(),
          })
          .eq("id", state.id);
        break;
      }

      const ctx = state.context as Record<string, unknown>;
      const emitPayload: Record<string, unknown> = {
        origin: "system",
      };
      for (const k of keys) {
        if (ctx[k] !== undefined) emitPayload[k] = ctx[k];
      }
      if (includeEntity) {
        emitPayload.entity_type = state.entity_type;
        emitPayload.entity_id = state.entity_id;
      }

      await supabase.from("engine_event").insert({
        workspace_id: state.workspace_id,
        event_type: eventType,
        payload: emitPayload,
      });

      await advanceToNextStep(supabase, state, step);
      break;
    }

    // ──────────────────────────────────────────────────────────
    // queue_shift_approval — Decision-layer handoff (ADR-0095).
    // Ensures a pending shift_approval row exists for this shift
    // linked to the day's daily_reconciliation. Idempotent:
    // re-runs find the existing row and do not duplicate.
    //
    // Assumes state.entity_type === 'schedule_shift' and
    // state.entity_id is the shift id. For unattached shifts (no
    // session/recon yet) the step creates a placeholder recon row.
    // ──────────────────────────────────────────────────────────
    case "queue_shift_approval": {
      if (state.entity_type !== "schedule_shift" || !state.entity_id) {
        console.warn(
          `[engine-dispatch] queue_shift_approval: skipped — entity_type=${state.entity_type} entity_id=${state.entity_id}`,
        );
        await advanceToNextStep(supabase, state, step);
        break;
      }

      const { data: shift } = await supabase
        .from("schedule_shift")
        .select("schedule_shift_id, workspace_id, shift_date, position_id, employee_id")
        .eq("schedule_shift_id", state.entity_id)
        .maybeSingle();

      if (!shift) {
        console.warn(`[engine-dispatch] queue_shift_approval: shift ${state.entity_id} not found`);
        await advanceToNextStep(supabase, state, step);
        break;
      }

      // Resolve department via position (schedule_shift has no
      // department_id directly). If unknown, the recon lookup is
      // skipped and we exit gracefully — a later re-run will retry.
      let departmentId: string | null = null;
      if (shift.position_id) {
        const { data: pos } = await supabase
          .from("position")
          .select("department_id")
          .eq("position_id", shift.position_id)
          .maybeSingle();
        departmentId = (pos?.department_id as string | undefined) ?? null;
      }

      // Find the matching daily_reconciliation (workspace + dept + date).
      let reconciliationId: string | null = null;
      if (departmentId) {
        const { data: recon } = await supabase
          .from("daily_reconciliation")
          .select("reconciliation_id")
          .eq("workspace_id", shift.workspace_id)
          .eq("department_id", departmentId)
          .eq("reconciliation_date", shift.shift_date)
          .maybeSingle();
        reconciliationId = (recon?.reconciliation_id as string | undefined) ?? null;

        if (!reconciliationId) {
          // Create a placeholder reconciliation. Status starts as
          // 'open'; daily_close will transition it later.
          const { data: newRecon } = await supabase
            .from("daily_reconciliation")
            .insert({
              workspace_id: shift.workspace_id,
              department_id: departmentId,
              reconciliation_date: shift.shift_date,
              status: "open",
            })
            .select("reconciliation_id")
            .single();
          reconciliationId = (newRecon?.reconciliation_id as string | undefined) ?? null;
        }
      }

      if (!reconciliationId) {
        console.warn(
          `[engine-dispatch] queue_shift_approval: no reconciliation resolvable for shift ${shift.schedule_shift_id}`,
        );
        await advanceToNextStep(supabase, state, step);
        break;
      }

      // Idempotent upsert of shift_approval.
      const { data: existing } = await supabase
        .from("shift_approval")
        .select("approval_id")
        .eq("shift_id", shift.schedule_shift_id)
        .eq("reconciliation_id", reconciliationId)
        .maybeSingle();

      if (!existing) {
        await supabase.from("shift_approval").insert({
          reconciliation_id: reconciliationId,
          shift_id: shift.schedule_shift_id,
          workspace_id: shift.workspace_id,
          planned_hours: 0, // will be backfilled by reporting queries
          status: "pending",
        });
      }

      await advanceToNextStep(supabase, state, step);
      break;
    }

    // ──────────────────────────────────────────────────────────
    // dispatch_invoice — Billing Fase 2 Spor A (B2).
    //
    // Expects state.context to carry invoice_dispatch_id (child mode).
    // Fan-out (reading effective_dispatch_rules + creating invoice_dispatch
    // rows + spawning child states) is done on the Node side by the
    // Server Action enqueueDispatchesForInvoice — see
    // packages/billing/src/actions/dispatch/. This keeps Deno code narrow
    // and reuses the canonical adapter contract on the web/mobile side.
    //
    // Retry: on retryable failure, inserts an engine_delayed_trigger
    // pointing at the 'invoice dispatch retry_requested' trigger with
    // backoff per action_payload.retry.backoff_seconds. The subsequent
    // fire re-enters engine-dispatch and spawns a fresh engine_state for
    // the SAME invoice_dispatch_id — attempts column on the row records
    // the total, independent of engine_state.retry_count.
    //
    // Ref: ADR-0126 (engine-orchestrated), ADR-0128 (dual-write bridge).
    // ──────────────────────────────────────────────────────────
    case "dispatch_invoice": {
      const ctx = state.context as Record<string, unknown>;
      const invoiceDispatchId =
        (ctx.invoice_dispatch_id as string | undefined) ??
        ((step.action_payload as Record<string, unknown>).invoice_dispatch_id as
          | string
          | undefined);

      if (!invoiceDispatchId) {
        await supabase
          .from("engine_state")
          .update({
            status: "failed",
            last_error:
              "dispatch_invoice: invoice_dispatch_id missing from context. Fan-out must run enqueueDispatchesForInvoice first.",
            updated_at: new Date().toISOString(),
          })
          .eq("id", state.id);
        break;
      }

      await handleDispatchInvoice(supabase, state, step, invoiceDispatchId);
      break;
    }

    // ──────────────────────────────────────────────────────────
    // sync_integration — Billing Fase 2 Spor B (B4/B6).
    //
    // Runs outbound sync to a billing_integration row (customer, invoice,
    // contract, product, plan). Handler is in handlers/sync-integration.ts
    // — kept separate because B4 shipped it ahead of the switch wiring.
    //
    // Expects state.context to carry integration_id + entity_type +
    // entity_id_synced. Fan-out pre-populates these when the parent process
    // (e.g. 'integration_sync') spawns a child state per integration row.
    //
    // ADR-0126: engine-orchestrated sync state (no parallel motor).
    // ADR-0129: is_placeholder gates audit semantics — PlaceholderAdapter
    //           reports 'mocked', real adapters report 'succeeded'.
    // ──────────────────────────────────────────────────────────
    case "sync_integration": {
      await handleSyncIntegration(supabase, state, step);
      break;
    }

    // ──────────────────────────────────────────────────────────
    // scan_overdue_invoices — Billing Fase 3A Spor C (B4).
    //
    // Daily dunning scan. Walks action_payload.stages and escalates any
    // overdue invoice that crossed the boundary. Uses
    // dunning_escalation_log UNIQUE(invoice_id, to_stage) for
    // idempotency so the daily cron can re-fire harmlessly. Handler is
    // in handlers/scan-overdue-invoices.ts — the same split pattern as
    // sync_integration (Fase 2 B4).
    //
    // Trigger source: pg_cron 'smartout-dunning-daily' emits a
    // 'dunning_daily_tick' engine_event at 07:00 UTC; the platform-
    // scoped engine_trigger spawns this state.
    //
    // Ref: ADR-0143 (dunning via engine_process), ADR-0127
    //      (workspace opt-out via suppress rule), spec §4.2.
    // ──────────────────────────────────────────────────────────
    case "scan_overdue_invoices": {
      await handleScanOverdueInvoices(supabase, state, step);
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

// ══════════════════════════════════════════════════════════════════
// Billing Fase 2 Spor A — dispatch_invoice action handler
// ══════════════════════════════════════════════════════════════════
//
// Lives outside executeStep so the switch stays readable. Deno can't
// import @smartout/billing — the adapter logic below is a minimal
// inline mirror of the Node-side adapters. If we ever need to share
// implementation, the path is to extract a shared `_shared/` module
// with no package-manager dependencies.

// Minimal invoice + template shape the inline adapters rely on. Kept
// narrow so drift between Node and Deno surfaces as a type error on
// the Server Action side (which reads the canonical billing types).
interface MinimalInvoice {
  invoice_id: string;
  invoice_number: number | null;
  company_id: string;
  status: string;
  invoice_type: string;
  period_from: string;
  period_to: string;
  issued_at: string | null;
  due_at: string | null;
  amount_excl_vat: number | string;
  vat_amount: number | string;
  amount_incl_vat: number | string;
  currency: string;
}

interface MinimalTemplate {
  subject_template: string | null;
  body_template: string;
}

type InlineDispatchResult =
  | { status: "delivered"; external_reference: string }
  | {
      status: "failed";
      error_code: string;
      error_message: string;
      retryable: boolean;
    };

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

function escapeHtml(input: string): string {
  return input.replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch] ?? ch);
}

function renderTemplate(
  template: string,
  context: Record<string, unknown>,
  options: { escape?: boolean } = {},
): string {
  const escape = options.escape ?? true;
  return template.replace(/\{\{\s*([^}\s]+)\s*\}\}/g, (_, path: string) => {
    const parts = path.split(".");
    let cursor: unknown = context;
    for (const part of parts) {
      if (cursor === null || cursor === undefined || typeof cursor !== "object") {
        return "";
      }
      cursor = (cursor as Record<string, unknown>)[part];
    }
    if (cursor === null || cursor === undefined) return "";
    const raw = String(cursor);
    return escape ? escapeHtml(raw) : raw;
  });
}

function buildTemplateContext(invoice: MinimalInvoice): Record<string, unknown> {
  return {
    invoice: {
      number: invoice.invoice_number,
      invoice_id: invoice.invoice_id,
      amount_incl_vat: invoice.amount_incl_vat,
      amount_excl_vat: invoice.amount_excl_vat,
      vat_amount: invoice.vat_amount,
      period_from: invoice.period_from,
      period_to: invoice.period_to,
      due_at: invoice.due_at,
      status: invoice.status,
    },
  };
}

const DEFAULT_EMAIL_CUSTOMER_SUBJECT = "Faktura {{invoice.number}} fra Smartout";
const DEFAULT_EMAIL_CUSTOMER_BODY = `
<div style="font-family: system-ui, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
  <h2 style="color: #1a1a1a;">Faktura {{invoice.number}}</h2>
  <p style="color: #444; line-height: 1.5;">Hei! Her er fakturaen din fra Smartout.</p>
  <p style="color: #666; font-size: 14px;">
    Periode: {{invoice.period_from}} – {{invoice.period_to}}. Forfall: {{invoice.due_at}}.
  </p>
</div>`;

const DEFAULT_EMAIL_INTERNAL_SUBJECT = "[Smartout audit] Faktura {{invoice.number}}";
const DEFAULT_EMAIL_INTERNAL_BODY = `
<div style="font-family: system-ui, sans-serif; max-width: 520px; margin: 0 auto; padding: 20px;">
  <h3>Faktura {{invoice.number}}</h3>
  <p>Invoice ID: {{invoice.invoice_id}} | Status: {{invoice.status}}</p>
  <p>Periode: {{invoice.period_from}} – {{invoice.period_to}} | Beløp: {{invoice.amount_incl_vat}} NOK</p>
</div>`;

async function sendViaSendGrid(params: {
  to: string;
  subject: string;
  html: string;
  invoiceDispatchId: string;
}): Promise<InlineDispatchResult> {
  const apiKey = Deno.env.get("SENDGRID_API_KEY");
  if (!apiKey) {
    return {
      status: "failed",
      error_code: "sendgrid_not_configured",
      error_message: "SENDGRID_API_KEY is not set.",
      retryable: false,
    };
  }
  const sender = Deno.env.get("SENDGRID_SENDER_EMAIL") ?? "hello@smartout.no";

  let response: Response;
  try {
    response = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: params.to }] }],
        from: { email: sender, name: "Smartout" },
        subject: params.subject,
        content: [{ type: "text/html", value: params.html }],
        custom_args: { invoice_dispatch_id: params.invoiceDispatchId },
      }),
    });
  } catch (error) {
    return {
      status: "failed",
      error_code: "network_error",
      error_message: error instanceof Error ? error.message : String(error),
      retryable: true,
    };
  }

  if (response.status >= 200 && response.status < 300) {
    const messageId =
      response.headers.get("x-message-id") ??
      response.headers.get("X-Message-Id") ??
      `sendgrid-${params.invoiceDispatchId}`;
    return { status: "delivered", external_reference: messageId };
  }

  let detail = "";
  try {
    detail = await response.text();
  } catch {
    detail = "";
  }
  return {
    status: "failed",
    error_code: `sendgrid_${response.status}`,
    error_message: detail.slice(0, 500) || `SendGrid HTTP ${response.status}`,
    retryable: response.status === 429 || response.status >= 500,
  };
}

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function sendViaHttpApi(params: {
  invoice: MinimalInvoice;
  target: Record<string, unknown>;
  invoiceDispatchId: string;
}): Promise<InlineDispatchResult> {
  const endpoint = params.target.endpoint;
  if (typeof endpoint !== "string" || !endpoint.startsWith("https://")) {
    return {
      status: "failed",
      error_code: "invalid_target",
      error_message: "http_api target.endpoint must be an https:// URL.",
      retryable: false,
    };
  }
  const envName =
    typeof params.target.signing_key_env === "string"
      ? (params.target.signing_key_env as string)
      : "HTTP_DISPATCH_SIGNING_KEY";
  const secret = Deno.env.get(envName);
  if (!secret) {
    return {
      status: "failed",
      error_code: "signing_key_missing",
      error_message: `Signing key env ${envName} not configured.`,
      retryable: false,
    };
  }

  const payload = {
    version: 1,
    invoice_dispatch_id: params.invoiceDispatchId,
    invoice: {
      invoice_id: params.invoice.invoice_id,
      invoice_number: params.invoice.invoice_number,
      company_id: params.invoice.company_id,
      status: params.invoice.status,
      invoice_type: params.invoice.invoice_type,
      period_from: params.invoice.period_from,
      period_to: params.invoice.period_to,
      issued_at: params.invoice.issued_at,
      due_at: params.invoice.due_at,
      amount_excl_vat: params.invoice.amount_excl_vat,
      vat_amount: params.invoice.vat_amount,
      amount_incl_vat: params.invoice.amount_incl_vat,
      currency: params.invoice.currency,
    },
  };
  const body = JSON.stringify(payload);
  const signature = await hmacSha256Hex(secret, body);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Smartout-Signature": `sha256=${signature}`,
        "X-Smartout-Invoice-Dispatch-Id": params.invoiceDispatchId,
      },
      body,
      signal: controller.signal,
    });
  } catch (error) {
    clearTimeout(timer);
    const name = error instanceof Error ? error.name : "";
    return {
      status: "failed",
      error_code: name === "AbortError" ? "timeout" : "network_error",
      error_message: error instanceof Error ? error.message : String(error),
      retryable: true,
    };
  } finally {
    clearTimeout(timer);
  }

  if (response.status >= 200 && response.status < 300) {
    let externalId = params.invoiceDispatchId;
    try {
      const json = (await response.json()) as Record<string, unknown>;
      if (typeof json.id === "string") externalId = json.id;
    } catch {
      // non-JSON body is fine
    }
    return { status: "delivered", external_reference: externalId };
  }

  let detail = "";
  try {
    detail = await response.text();
  } catch {
    detail = "";
  }
  return {
    status: "failed",
    error_code: `http_${response.status}`,
    error_message: detail.slice(0, 500) || `Remote HTTP ${response.status}`,
    retryable: response.status === 429 || response.status >= 500,
  };
}

async function runAdapter(
  channel: string,
  target: Record<string, unknown>,
  template: MinimalTemplate | null,
  invoice: MinimalInvoice,
  invoiceDispatchId: string,
): Promise<InlineDispatchResult> {
  const context = buildTemplateContext(invoice);

  switch (channel) {
    case "email_customer":
    case "email_internal": {
      const to = target.email;
      if (typeof to !== "string" || !to.includes("@")) {
        return {
          status: "failed",
          error_code: "invalid_target",
          error_message: `${channel} target.email must be a valid email string.`,
          retryable: false,
        };
      }
      const defaults =
        channel === "email_customer"
          ? { subject: DEFAULT_EMAIL_CUSTOMER_SUBJECT, body: DEFAULT_EMAIL_CUSTOMER_BODY }
          : { subject: DEFAULT_EMAIL_INTERNAL_SUBJECT, body: DEFAULT_EMAIL_INTERNAL_BODY };
      const subject = renderTemplate(
        template?.subject_template ?? defaults.subject,
        context,
        { escape: false },
      );
      const html = renderTemplate(template?.body_template ?? defaults.body, context, {
        escape: true,
      });
      return sendViaSendGrid({
        to,
        subject,
        html,
        invoiceDispatchId,
      });
    }
    case "http_api":
      return sendViaHttpApi({ invoice, target, invoiceDispatchId });
    case "peppol_ehf":
      return {
        status: "failed",
        error_code: "unsupported_channel",
        error_message:
          "peppol_ehf adapter is not implemented in Fase 2 (ADR-0129 — Fase 3 carry-over).",
        retryable: false,
      };
    default:
      return {
        status: "failed",
        error_code: "unknown_channel",
        error_message: `No adapter registered for channel '${channel}'.`,
        retryable: false,
      };
  }
}

async function emitViaBridge(event: {
  event: string;
  actor_id: string | null;
  workspace_id: string | null;
  properties: Record<string, unknown>;
}): Promise<void> {
  const url = Deno.env.get("INTERNAL_EMIT_URL");
  const secret = Deno.env.get("WATCHDOG_CRON_SECRET");
  if (!url || !secret) {
    console.error(
      `[dispatch_invoice] emit bridge not configured — skipping '${event.event}'`,
    );
    return;
  }
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(event),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(
        `[dispatch_invoice] emit bridge returned ${res.status} for '${event.event}': ${body}`,
      );
    }
  } catch (error) {
    console.error(
      `[dispatch_invoice] emit bridge failed for '${event.event}':`,
      error instanceof Error ? error.message : String(error),
    );
  }
}

async function handleDispatchInvoice(
  supabase: ReturnType<typeof createClient>,
  state: EngineState,
  step: EngineStep,
  invoiceDispatchId: string,
): Promise<void> {
  // 1. Load the invoice_dispatch row + associated invoice + optional template.
  const { data: dispatch, error: dispatchErr } = await supabase
    .from("invoice_dispatch")
    .select("*")
    .eq("invoice_dispatch_id", invoiceDispatchId)
    .maybeSingle();

  if (dispatchErr || !dispatch) {
    await supabase
      .from("engine_state")
      .update({
        status: "failed",
        last_error: `dispatch_invoice: invoice_dispatch ${invoiceDispatchId} not found: ${dispatchErr?.message ?? "missing"}`,
        updated_at: new Date().toISOString(),
      })
      .eq("id", state.id);
    return;
  }

  // If the dispatch has already been delivered, this is a late re-run from
  // the engine retry loop — complete the state without touching anything.
  if (dispatch.status === "delivered") {
    await supabase
      .from("engine_state")
      .update({
        status: "complete",
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", state.id);
    return;
  }

  const { data: invoice, error: invoiceErr } = await supabase
    .from("invoice")
    .select(
      "invoice_id, invoice_number, company_id, status, invoice_type, period_from, period_to, issued_at, due_at, amount_excl_vat, vat_amount, amount_incl_vat, currency",
    )
    .eq("invoice_id", dispatch.invoice_id)
    .single();

  if (invoiceErr || !invoice) {
    await supabase
      .from("engine_state")
      .update({
        status: "failed",
        last_error: `dispatch_invoice: invoice ${dispatch.invoice_id} not found`,
        updated_at: new Date().toISOString(),
      })
      .eq("id", state.id);
    return;
  }

  let template: MinimalTemplate | null = null;
  // Resolve template via dispatch_rule → template_id (snapshot not stored
  // on invoice_dispatch; rules are stable enough for Fase 2).
  if (dispatch.dispatch_rule_id) {
    const { data: rule } = await supabase
      .from("billing_dispatch_rule")
      .select("template_id")
      .eq("dispatch_rule_id", dispatch.dispatch_rule_id)
      .maybeSingle();
    if (rule?.template_id) {
      const { data: tmpl } = await supabase
        .from("billing_dispatch_template")
        .select("subject_template, body_template")
        .eq("template_id", rule.template_id)
        .maybeSingle();
      if (tmpl) template = tmpl;
    }
  }

  // 2. Mark in_flight + bump attempts BEFORE calling the adapter so a
  //    double-invocation collision is visible in the row.
  const attempt = (dispatch.attempts as number) + 1;
  await supabase
    .from("invoice_dispatch")
    .update({
      status: "in_flight",
      attempts: attempt,
      engine_state_id: state.id,
      last_attempt_at: new Date().toISOString(),
    })
    .eq("invoice_dispatch_id", invoiceDispatchId);

  // 3. Run the adapter.
  const result = await runAdapter(
    dispatch.channel,
    (dispatch.target ?? {}) as Record<string, unknown>,
    template,
    invoice as MinimalInvoice,
    invoiceDispatchId,
  );

  // 4. Persist result to invoice_dispatch.
  if (result.status === "delivered") {
    await supabase
      .from("invoice_dispatch")
      .update({
        status: "delivered",
        delivered_at: new Date().toISOString(),
        external_reference: result.external_reference,
        error_code: null,
        error_message: null,
      })
      .eq("invoice_dispatch_id", invoiceDispatchId);

    // 5. ADR-0128 dual-write block REMOVED in Fase 3A B6 — invoice.delivery_*
    //    columns were DROPped. invoice_dispatch is now the sole source of truth.

    // 6. Emit 'invoice dispatched' via HTTP bridge (Deno → Node).
    await emitViaBridge({
      event: "invoice dispatched",
      actor_id: null,
      workspace_id: state.workspace_id,
      properties: {
        entity_type: "invoice_dispatch",
        entity_id: invoiceDispatchId,
        data: {
          invoice_id: dispatch.invoice_id,
          channel: dispatch.channel,
          external_reference: result.external_reference,
        },
      },
    });

    await supabase
      .from("engine_state")
      .update({
        status: "complete",
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", state.id);
    return;
  }

  // Failure path — check retry policy.
  const retryConfig = ((step.action_payload as Record<string, unknown>).retry ??
    {}) as {
    max_attempts?: number;
    backoff_seconds?: number[];
  };
  const maxAttempts = retryConfig.max_attempts ?? 5;
  const backoff = retryConfig.backoff_seconds ?? [60, 300, 900, 3600, 21600];

  const isFinal = !result.retryable || attempt >= maxAttempts;

  await supabase
    .from("invoice_dispatch")
    .update({
      status: isFinal ? "failed" : "pending",
      error_code: result.error_code,
      error_message: result.error_message,
    })
    .eq("invoice_dispatch_id", invoiceDispatchId);

  if (isFinal) {
    await emitViaBridge({
      event: "invoice dispatch failed",
      actor_id: null,
      workspace_id: state.workspace_id,
      properties: {
        entity_type: "invoice_dispatch",
        entity_id: invoiceDispatchId,
        data: {
          invoice_id: dispatch.invoice_id,
          channel: dispatch.channel,
          error_code: result.error_code,
          error_message: result.error_message,
          attempts: attempt,
        },
      },
    });

    await supabase
      .from("engine_state")
      .update({
        status: "failed",
        last_error: `${result.error_code}: ${result.error_message}`,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", state.id);
    return;
  }

  // Retryable — schedule a delayed re-fire via engine_delayed_trigger.
  const backoffSeconds = backoff[Math.min(attempt - 1, backoff.length - 1)];

  // Find the retry trigger row (seeded in B1 migration 20260511200008).
  const { data: retryTrigger } = await supabase
    .from("engine_trigger")
    .select("id")
    .eq("event_type", "invoice dispatch retry_requested")
    .eq("process_id", "invoice_dispatch_delivery")
    .is("workspace_id", null)
    .maybeSingle();

  // Record the retry event so engine_delayed_trigger has something to
  // reference (engine_delayed_trigger.event_id FK is required).
  const { data: retryEvent } = await supabase
    .from("engine_event")
    .insert({
      event_type: "invoice dispatch retry_requested",
      workspace_id: state.workspace_id,
      payload: {
        entity_type: "invoice_dispatch",
        entity_id: invoiceDispatchId,
        invoice_dispatch_id: invoiceDispatchId,
        invoice_id: dispatch.invoice_id,
        attempt,
      },
    })
    .select("id")
    .single();

  if (retryTrigger && retryEvent) {
    await supabase.from("engine_delayed_trigger").insert({
      trigger_id: retryTrigger.id,
      event_id: retryEvent.id,
      workspace_id: state.workspace_id,
      fire_at: new Date(Date.now() + backoffSeconds * 1000).toISOString(),
    });
  }

  // Low-volume debug-only emit — helps reconstruct retry cycles.
  await emitViaBridge({
    event: "invoice dispatch retried",
    actor_id: null,
    workspace_id: state.workspace_id,
    properties: {
      entity_type: "invoice_dispatch",
      entity_id: invoiceDispatchId,
      data: {
        invoice_id: dispatch.invoice_id,
        channel: dispatch.channel,
        attempt,
      },
    },
  });

  // Mark this engine_state complete — a fresh state will spin up when the
  // delayed trigger fires. attempts lives on invoice_dispatch.
  await supabase
    .from("engine_state")
    .update({
      status: "complete",
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", state.id);
}
