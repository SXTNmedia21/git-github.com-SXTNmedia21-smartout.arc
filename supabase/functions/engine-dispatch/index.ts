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
function evaluateCondition(condition: unknown, context: Record<string, unknown>): boolean {
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

  if ("all" in cond) {
    const conditions = cond.all as unknown[];
    return conditions.every((c) => evaluateCondition(c, context));
  }

  if ("any" in cond) {
    const conditions = cond.any as unknown[];
    return conditions.some((c) => evaluateCondition(c, context));
  }

  return false;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { event_type, payload, workspace_id, idempotency_key } = body;

    if (!event_type || !workspace_id) {
      return new Response(JSON.stringify({ error: "event_type and workspace_id required" }), {
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
    const { data: waitingStates } = await supabase
      .from("engine_state")
      .select("*")
      .eq("workspace_id", workspace_id)
      .eq("status", "waiting");

    let resumed = 0;
    if (waitingStates) {
      for (const state of waitingStates as EngineState[]) {
        const steps = state.steps_snapshot ?? [];
        const currentStep = steps.find((s) => s.step_order === state.current_step);

        if (
          currentStep?.action_type === "wait_for_event" &&
          (currentStep.action_payload as Record<string, unknown>)?.event === event_type
        ) {
          // Resume: advance to next step
          const nextStepOrder = state.current_step + 1;
          const nextStep = steps.find((s) => s.step_order === nextStepOrder);

          if (nextStep) {
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
 * Execute a single engine step. Updates state based on action_type.
 */
async function executeStep(
  supabase: ReturnType<typeof createClient>,
  state: EngineState,
  step: EngineStep,
): Promise<void> {
  // Check condition
  if (step.condition && !evaluateCondition(step.condition, state.context)) {
    // Condition not met — skip to next step
    const nextOrder = step.step_order + 1;
    const nextStep = (state.steps_snapshot ?? []).find((s) => s.step_order === nextOrder);

    if (nextStep) {
      await supabase
        .from("engine_state")
        .update({
          current_step: nextOrder,
          updated_at: new Date().toISOString(),
        })
        .eq("id", state.id);
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

    case "assign_task":
    case "send_notification":
    case "update_entity":
    case "create_deviation":
    case "validate_settlement":
    case "lock_checkout":
    case "schedule_control":
    case "start_process":
      // For now, log the step execution and advance
      // Future: each action_type will have its own handler
      {
        const stepResult = {
          ...((state.result ?? {}) as Record<string, unknown>),
          [step.step_order]: {
            status: "complete",
            action_type: step.action_type,
            completed_at: new Date().toISOString(),
          },
        };

        const nextOrder = step.step_order + 1;
        const nextStep = (state.steps_snapshot ?? []).find((s) => s.step_order === nextOrder);

        if (nextStep) {
          await supabase
            .from("engine_state")
            .update({
              current_step: nextOrder,
              result: stepResult,
              updated_at: new Date().toISOString(),
            })
            .eq("id", state.id);
          // Recurse into next step (non-waiting steps execute synchronously)
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
      break;

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
