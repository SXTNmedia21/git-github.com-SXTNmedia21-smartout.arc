/**
 * session-hook-executor — Cron-triggered hook materializer.
 *
 * Runs every 5 minutes. For each active/upcoming session today:
 * 1. Gets session_hook rows for the department
 * 2. Calculates fire time: anchor_time + trigger_offset_min
 * 3. Checks idempotency: skips if session_task rows already exist for this hook + session
 * 4. Gets procedure_step rows for the hook's linked procedure
 * 5. Inserts session_task for each step
 *
 * Auth: WATCHDOG_CRON_SECRET bearer token (cron-only pattern).
 */

import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/** Maps hook_type to the session field that anchors it. */
const ANCHOR_FIELD: Record<string, "planned_open" | "planned_close"> = {
  pre_open: "planned_open",
  open: "planned_open",
  scheduled: "planned_open",
  pre_close: "planned_close",
  close: "planned_close",
};

function combineDateAndTime(dateStr: string, timeStr: string): Date {
  return new Date(`${dateStr}T${timeStr}`);
}

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
  const now = new Date();
  const today = now.toISOString().split("T")[0]!;

  // Get today's sessions that are upcoming or active
  const { data: sessions } = await supabase
    .from("department_session")
    .select(
      "department_session_id, workspace_id, department_id, session_date, status, planned_open, planned_close",
    )
    .eq("session_date", today)
    .in("status", ["upcoming", "active"]);

  if (!sessions || sessions.length === 0) {
    return new Response(JSON.stringify({ message: "No active sessions today", tasks_created: 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let totalTasksCreated = 0;

  // Group sessions by department for efficient hook lookup
  const deptIds = [...new Set(sessions.map((s) => s.department_id))];

  // Get all active hooks for these departments
  const { data: hooks } = await supabase
    .from("session_hook")
    .select(
      "id, department_id, hook_type, trigger_offset_min, linked_procedure_id, linked_routine_id",
    )
    .in("department_id", deptIds)
    .eq("is_active", true);

  if (!hooks || hooks.length === 0) {
    return new Response(JSON.stringify({ message: "No active hooks", tasks_created: 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Get existing session_task rows for idempotency check
  const sessionIds = sessions.map((s) => s.department_session_id);
  const hookIds = hooks.map((h) => h.id);
  const { data: existingTasks } = await supabase
    .from("session_task")
    .select("session_hook_id, department_session_id")
    .in("department_session_id", sessionIds)
    .in("session_hook_id", hookIds);

  const existingSet = new Set(
    (existingTasks ?? []).map((t) => `${t.session_hook_id}:${t.department_session_id}`),
  );

  // Get procedure steps for all linked procedures
  const procedureIds = [
    ...new Set(hooks.map((h) => h.linked_procedure_id).filter((id): id is string => id !== null)),
  ];

  const { data: steps } =
    procedureIds.length > 0
      ? await supabase
          .from("procedure_step")
          .select("step_id, procedure_id, title, description, step_order, is_required")
          .in("procedure_id", procedureIds)
          .order("step_order", { ascending: true })
      : { data: [] };

  // Group steps by procedure_id
  const stepsByProcedure = new Map<
    string,
    Array<{
      step_id: string;
      title: string;
      description: string;
      step_order: number;
      is_required: boolean;
    }>
  >();
  for (const step of steps ?? []) {
    if (!stepsByProcedure.has(step.procedure_id)) {
      stepsByProcedure.set(step.procedure_id, []);
    }
    stepsByProcedure.get(step.procedure_id)!.push(step);
  }

  // Process each session x hook combination
  for (const session of sessions) {
    const sessionHooks = hooks.filter((h) => h.department_id === session.department_id);

    for (const hook of sessionHooks) {
      // Idempotency: skip if tasks already created for this hook + session
      const key = `${hook.id}:${session.department_session_id}`;
      if (existingSet.has(key)) continue;

      // Calculate fire time
      const anchorField = ANCHOR_FIELD[hook.hook_type] ?? "planned_open";
      const anchorTime = session[anchorField];
      if (!anchorTime) continue;

      const fireTime = combineDateAndTime(session.session_date, anchorTime);
      fireTime.setMinutes(fireTime.getMinutes() + (hook.trigger_offset_min ?? 0));

      // Only fire if current time is past fire time
      if (now < fireTime) continue;

      // Materialize procedure steps into session_task rows
      if (hook.linked_procedure_id) {
        const procedureSteps = stepsByProcedure.get(hook.linked_procedure_id) ?? [];

        const taskRows = procedureSteps.map((step) => ({
          workspace_id: session.workspace_id,
          department_session_id: session.department_session_id,
          session_hook_id: hook.id,
          title: step.title,
          description: step.description,
          status: "pending",
          is_compliance_required: step.is_required,
        }));

        if (taskRows.length > 0) {
          const { error } = await supabase.from("session_task").insert(taskRows);
          if (!error) {
            totalTasksCreated += taskRows.length;
            existingSet.add(key);
            // Emit engine event for notifications + escalation (ADR-0069)
            await supabase.from("engine_event").insert({
              workspace_id: session.workspace_id,
              event_type: "session.hook_fired",
              payload: {
                department_session_id: session.department_session_id,
                department_id: session.department_id,
                session_hook_id: hook.id,
                hook_type: hook.hook_type,
                tasks_created: taskRows.length,
              },
            });
          }
        }
      } else if (hook.linked_routine_id) {
        // Routine hooks create a single task referencing the routine
        const { error } = await supabase.from("session_task").insert({
          workspace_id: session.workspace_id,
          department_session_id: session.department_session_id,
          session_hook_id: hook.id,
          title: `Rutine: ${hook.hook_type}`,
          description: `Automatisk opprettet fra rutine ${hook.linked_routine_id}`,
          status: "pending",
        });
        if (!error) {
          totalTasksCreated += 1;
          existingSet.add(key);
          // Emit engine event for notifications + escalation (ADR-0069)
          await supabase.from("engine_event").insert({
            workspace_id: session.workspace_id,
            event_type: "session.hook_fired",
            payload: {
              department_session_id: session.department_session_id,
              department_id: session.department_id,
              session_hook_id: hook.id,
              hook_type: hook.hook_type,
              tasks_created: 1,
            },
          });
        }
      }
    }
  }

  return new Response(
    JSON.stringify({
      message: "Hook execution complete",
      tasks_created: totalTasksCreated,
      sessions_processed: sessions.length,
      hooks_checked: hooks.length,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
  } catch (err) {
    console.error("[session-hook-executor] Unhandled error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
