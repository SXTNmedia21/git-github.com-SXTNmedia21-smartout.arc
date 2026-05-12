/**
 * journey-stuck-detector — Dual-mode Journey Engine stuck detector.
 *
 * Two request modes:
 *
 * 1. **Event-driven mode (ADR-0175, M5.3)** — POST with JSON body
 *    `{ run_id, step_key, workspace_id, scheduled_for?, actor_id? }`. Checks
 *    `engine_state_step` for the given run + step; if still in a
 *    non-terminal status (`pending` or `active`) past `scheduled_for`,
 *    emits `journey.stuck` to the four ADR-0175 destinations:
 *    PostHog (deferred — fired via engine_event → dispatch), Logger,
 *    `activity_trail`, `engine_event`. Response: `{ mode: "event",
 *    emitted: true|false, reason? }`.
 *
 *    Callers (DEFERRED — ADR-0215, 2026-04-27): Phase 2 audit proved zero
 *    capability tools currently schedule `engine_delayed_trigger` rows.
 *    `grep -rn "engine_delayed_trigger\|journey-stuck-detector" packages/ai/src/capabilities/journey/`
 *    returns zero hits. This path is therefore INACTIVE — the event-driven
 *    handler code is correct, but no upstream caller exists. Real dual-write
 *    (L-0098 step A) is scheduled as Phase 3 sub-sortie #4 per ADR-0215.
 *    The scheduler WILL be the capability layer — NOT this function. This
 *    function is the detection + emit endpoint only.
 *
 * 2. **Legacy cron rescue mode (2026-04-06 Journey Harness POC)** — POST
 *    with NO body or an empty body. Hourly cron. Scans `engine_state`
 *    for `journey_03_check_shifts` rows stuck on step 2 > 24h, creates
 *    `guardian_signal` rows with domain `journey_health` (dedup 24h).
 *    This path predates ADR-0175 and uses `guardian_signal` — NOT the
 *    `journey.stuck` event. Preserved here until the capability layer
 *    migrates Journey 03 onto the event-driven path (L-0098 3-step
 *    cutover — dual-write → flip → delete; this is step A: dual-write).
 *
 * Auth (both modes): bearer token must equal either `WATCHDOG_CRON_SECRET`
 * (cron path) OR `SUPABASE_SERVICE_ROLE_KEY` (server-to-server path from
 * a trusted capability tool). Anon key is rejected.
 *
 * Why service-role: this function writes to `activity_trail`, `engine_event`,
 * and `guardian_signal` which are tenant-isolated by RLS. Telemetry inserts
 * by design bypass RLS — the same pattern used in create-invitation,
 * session-hook-executor, and fire-delayed-triggers.
 *
 * Config: registered in supabase/config.toml with `verify_jwt = false`
 * (bearer-token authenticated, not user JWT).
 *
 * See:
 * - ADR-0175 (journey telemetry contract — 5 events, 4 destinations)
 * - ADR-0176 (C4 authority seed — this function does not invoke any
 *   capability; it is the telemetry/detection layer)
 * - ADR-0215 (stuck-detector strategy — Phase 2 audit gap #5; event-driven
 *   path deferred to Phase 3 sub-sortie #4; this deferral is the decision)
 * - L-0098 (global scripts cutover: dual-write → flip → delete)
 * - L-0094 (phantom emit contracts recurring — this function's emit
 *   shape MUST match packages/telemetry/src/registry.ts "journey stuck")
 */

import { createClient } from "jsr:@supabase/supabase-js@2";
import { verifyInternalAuth } from "../_shared/internal-auth.ts";

// ─── Constants ───────────────────────────────────────────────

/**
 * Reserved sentinel profile.profile_id used as the `actor_id` fallback when
 * no tenant actor can be resolved. Seeded by migration
 * `20260422215500_system_actor_profile_seed.sql` — a real row in `public.profile`
 * so the FK `activity_trail.actor_id → profile.profile_id` is satisfied.
 *
 * Replaces the earlier literal `"system"` string (R5.3-5, 2026-04-21 Journey
 * Runner council verdict). Do not introduce new non-UUID actor_id values.
 *
 * Tests reference this export directly — do not inline the UUID elsewhere.
 */
export const SYSTEM_ACTOR_ID = "00000000-0000-0000-0000-000000000001";

// ─── CORS ────────────────────────────────────────────────────

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ─── Legacy cron constants (POC mode) ────────────────────────

const STALE_THRESHOLD_HOURS = 24;
const PROCESS_ID = "journey_03_check_shifts";

// ─── Types ───────────────────────────────────────────────────

type StuckStateRow = {
  id: string;
  entity_id: string | null;
  entity_type: string | null;
  workspace_id: string;
  current_step: number;
  updated_at: string;
};

type EventModePayload = {
  run_id: string;
  step_key: string;
  workspace_id: string;
  // ISO 8601 — when the delayed trigger was scheduled to fire. Used as
  // the "timeout elapsed at" instant. If omitted, we fall back to now().
  scheduled_for?: string;
  // Optional: actor who started the run. If omitted, falls back to the
  // engine_state.assignee_id or a system marker. Present on payloads
  // built by the capability layer (which has the caller's profile).
  actor_id?: string;
};

type JsonResponse = Record<string, unknown>;

// ─── Shared helpers ──────────────────────────────────────────

function json(status: number, body: JsonResponse): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function isTerminalStepStatus(status: string): boolean {
  return status === "completed" || status === "failed" || status === "skipped";
}

/**
 * Parse the request body once. Returns:
 *   - "cron"   — empty body → legacy cron rescue mode
 *   - EventModePayload — valid event-driven payload
 *   - null     — malformed payload (caller should 400)
 */
async function parseBody(
  req: Request,
): Promise<"cron" | EventModePayload | null> {
  const raw = await req.text();
  if (!raw || raw.trim().length === 0) return "cron";

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== "object") return null;

  const obj = parsed as Record<string, unknown>;

  // Empty JSON object → cron mode (callers sometimes send {}).
  if (Object.keys(obj).length === 0) return "cron";

  // Event mode requires run_id + step_key + workspace_id.
  const run_id = obj.run_id;
  const step_key = obj.step_key;
  const workspace_id = obj.workspace_id;

  if (
    typeof run_id !== "string" ||
    run_id.length === 0 ||
    typeof step_key !== "string" ||
    step_key.length === 0 ||
    typeof workspace_id !== "string" ||
    workspace_id.length === 0
  ) {
    return null;
  }

  return {
    run_id,
    step_key,
    workspace_id,
    scheduled_for:
      typeof obj.scheduled_for === "string" ? obj.scheduled_for : undefined,
    actor_id: typeof obj.actor_id === "string" ? obj.actor_id : undefined,
  };
}

// ─── Event-driven mode (ADR-0175, M5.3) ──────────────────────

/**
 * step_key encoding:
 *   - "step-<step_order>"   → numeric engine_state_step.step_order
 *   - "<uuid>"              → engine_state_step.id
 *   - free-form string      → falls back to step_order if parseable,
 *                             else treated as unknown (we will fail open
 *                             and NOT emit to avoid phantom stucks)
 *
 * This function is conservative — it only emits if the step is confirmed
 * in a non-terminal status. A missing or ambiguous step is a 404, NOT a
 * spurious stuck event. L-0094 says phantom emits are worse than missed
 * emits.
 */
async function resolveStep(
  supabase: ReturnType<typeof createClient>,
  run_id: string,
  step_key: string,
): Promise<
  | {
      kind: "found";
      id: string;
      status: string;
      step_order: number;
      state_id: string;
    }
  | { kind: "not_found" }
  | { kind: "error"; message: string }
> {
  // Try UUID first.
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(step_key)) {
    const { data, error } = await supabase
      .from("engine_state_step")
      .select("id, status, step_order, state_id")
      .eq("id", step_key)
      .eq("state_id", run_id)
      .maybeSingle();
    if (error) return { kind: "error", message: error.message };
    if (data) {
      return {
        kind: "found",
        id: data.id as string,
        status: data.status as string,
        step_order: data.step_order as number,
        state_id: data.state_id as string,
      };
    }
    return { kind: "not_found" };
  }

  // Then try "step-<N>" or bare number.
  const orderMatch = /^(?:step-)?(\d+)$/.exec(step_key);
  if (orderMatch) {
    const step_order = Number(orderMatch[1]);
    const { data, error } = await supabase
      .from("engine_state_step")
      .select("id, status, step_order, state_id")
      .eq("state_id", run_id)
      .eq("step_order", step_order)
      .maybeSingle();
    if (error) return { kind: "error", message: error.message };
    if (data) {
      return {
        kind: "found",
        id: data.id as string,
        status: data.status as string,
        step_order: data.step_order as number,
        state_id: data.state_id as string,
      };
    }
  }

  return { kind: "not_found" };
}

async function handleEventMode(
  supabase: ReturnType<typeof createClient>,
  payload: EventModePayload,
): Promise<Response> {
  // 1. Load the run (engine_state row). Must exist, must be workspace-scoped.
  const { data: runRow, error: runErr } = await supabase
    .from("engine_state")
    .select("id, workspace_id, status, assignee_id, started_at, process_id")
    .eq("id", payload.run_id)
    .maybeSingle();

  if (runErr) {
    console.log(
      JSON.stringify({
        level: "error",
        action: "journey_stuck_detect",
        category: "journey",
        message: "engine_state lookup failed",
        run_id: payload.run_id,
        error: runErr.message,
      }),
    );
    return json(500, { mode: "event", error: runErr.message });
  }

  if (!runRow) {
    return json(404, {
      mode: "event",
      emitted: false,
      reason: "run_not_found",
    });
  }

  // Cross-check workspace_id — a caller must not emit stuck events on
  // runs outside their workspace.
  if ((runRow.workspace_id as string) !== payload.workspace_id) {
    return json(403, {
      mode: "event",
      emitted: false,
      reason: "workspace_mismatch",
    });
  }

  // Short-circuit: if the parent run is already complete/failed, the step
  // cannot be stuck. Noop.
  const runStatus = runRow.status as string;
  if (runStatus === "complete" || runStatus === "failed") {
    return json(200, {
      mode: "event",
      emitted: false,
      reason: "run_already_terminal",
      run_status: runStatus,
    });
  }

  // 2. Resolve the step.
  const step = await resolveStep(supabase, payload.run_id, payload.step_key);
  if (step.kind === "error") {
    return json(500, { mode: "event", error: step.message });
  }
  if (step.kind === "not_found") {
    return json(404, {
      mode: "event",
      emitted: false,
      reason: "step_not_found",
    });
  }

  // 3. If step is already terminal — noop (idempotency: arriving late).
  if (isTerminalStepStatus(step.status)) {
    return json(200, {
      mode: "event",
      emitted: false,
      reason: "step_already_terminal",
      step_status: step.status,
    });
  }

  // 4. Step is still non-terminal at scheduled_for — this is a stuck
  //    event. Compute timeout_ms from scheduled_for if provided, else
  //    from run.started_at → now().
  const now = Date.now();
  const scheduled =
    payload.scheduled_for && !Number.isNaN(Date.parse(payload.scheduled_for))
      ? Date.parse(payload.scheduled_for)
      : null;
  const runStartedAt = runRow.started_at
    ? Date.parse(runRow.started_at as string)
    : null;
  const timeout_ms =
    scheduled != null
      ? Math.max(0, now - scheduled)
      : runStartedAt != null
      ? Math.max(0, now - runStartedAt)
      : 0;

  const actor_id =
    payload.actor_id ??
    (typeof runRow.assignee_id === "string"
      ? runRow.assignee_id
      : SYSTEM_ACTOR_ID);

  // 5. Emit `journey.stuck` to the four ADR-0175 destinations.
  //    activity_trail uses space-form ("journey stuck") to match
  //    packages/telemetry/src/registry.ts EVENT_ROUTING key.
  //    engine_event uses dot-form ("journey.stuck") — the wire format
  //    produced by toDotNotation() in packages/telemetry.
  //    logger = structured console.log below.
  //    posthog = fired downstream by the engine_event → dispatch chain;
  //      edge functions do not hold the PostHog client directly (same
  //      pattern as create-invitation, session-hook-executor).

  const emitLabel = `Journey ${(runRow.process_id as string) ?? "run"} stuck at step ${step.step_order}`;

  const [activityRes, engineEventRes] = await Promise.all([
    supabase.from("activity_trail").insert({
      event: "journey stuck",
      action_verb: "stuck",
      category: "journey",
      entity_type: "journey_run",
      entity_id: payload.run_id,
      entity_label: emitLabel,
      actor_id,
      workspace_id: payload.workspace_id,
      data: {
        run_id: payload.run_id,
        step_key: payload.step_key,
        timeout_ms,
        actor_id,
        workspace_id: payload.workspace_id,
      },
      source: "edge-function",
    }),
    supabase.from("engine_event").insert({
      event_type: "journey.stuck",
      workspace_id: payload.workspace_id,
      payload: {
        run_id: payload.run_id,
        step_key: payload.step_key,
        timeout_ms,
        actor_id,
        workspace_id: payload.workspace_id,
        entity: {
          entity_type: "journey_run",
          entity_id: payload.run_id,
          entity_label: emitLabel,
        },
      },
    }),
  ]);

  const activityErr = activityRes.error?.message;
  const engineErr = engineEventRes.error?.message;

  // Structured logger destination (ADR-0175 #2).
  console.log(
    JSON.stringify({
      level: "info",
      action: "journey_stuck_emit",
      category: "journey",
      event: "journey.stuck",
      run_id: payload.run_id,
      step_key: payload.step_key,
      step_order: step.step_order,
      timeout_ms,
      actor_id,
      workspace_id: payload.workspace_id,
      activity_trail_ok: activityErr == null,
      engine_event_ok: engineErr == null,
      activity_trail_error: activityErr,
      engine_event_error: engineErr,
    }),
  );

  if (activityErr && engineErr) {
    return json(500, {
      mode: "event",
      emitted: false,
      reason: "both_destinations_failed",
      activity_trail_error: activityErr,
      engine_event_error: engineErr,
    });
  }

  return json(200, {
    mode: "event",
    emitted: true,
    run_id: payload.run_id,
    step_key: payload.step_key,
    timeout_ms,
    activity_trail_ok: activityErr == null,
    engine_event_ok: engineErr == null,
  });
}

// ─── Legacy cron rescue mode (2026-04-06 POC) ────────────────

async function handleCronMode(
  supabase: ReturnType<typeof createClient>,
): Promise<Response> {
  // 1. Find all engine_state rows stuck on step 2 of journey_03_check_shifts
  const cutoff = new Date(
    Date.now() - STALE_THRESHOLD_HOURS * 60 * 60 * 1000,
  ).toISOString();

  const { data: stuckStates, error: queryError } = await supabase
    .from("engine_state")
    .select("id, entity_id, entity_type, workspace_id, current_step, updated_at")
    .eq("process_id", PROCESS_ID)
    .eq("current_step", 2)
    .eq("status", "waiting")
    .lt("updated_at", cutoff);

  if (queryError) {
    return json(500, { mode: "cron", error: queryError.message });
  }

  const states = (stuckStates ?? []) as StuckStateRow[];

  if (states.length === 0) {
    return json(200, { mode: "cron", checked: 0, signals_created: 0 });
  }

  // 2. For each stuck state, idempotency-check then insert the signal.
  const idempotencyCutoff = new Date(
    Date.now() - STALE_THRESHOLD_HOURS * 60 * 60 * 1000,
  ).toISOString();

  let created = 0;
  for (const state of states) {
    if (!state.entity_id || !state.workspace_id) continue;

    const { data: existing } = await supabase
      .from("guardian_signal")
      .select("id")
      .eq("entity_id", state.entity_id)
      .eq("domain", "journey_health")
      .gt("created_at", idempotencyCutoff)
      .limit(1);

    if (existing && existing.length > 0) continue;

    const { error: insertError } = await supabase.from("guardian_signal").insert({
      workspace_id: state.workspace_id,
      domain: "journey_health",
      entity_type: "profile",
      entity_id: state.entity_id,
      signal_type: "journey_stalled",
      severity: "info",
      title: "Journey 03 stalled",
      description: `Employee opened the shifts list but never tapped a specific shift within ${STALE_THRESHOLD_HOURS}h. Send a rescue prompt to guide them to the next step.`,
      status: "active",
    });

    if (!insertError) created++;
  }

  return json(200, {
    mode: "cron",
    checked: states.length,
    signals_created: created,
  });
}

// ─── Entrypoint ──────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  const authCheck = verifyInternalAuth(req);
  if (!authCheck.ok) return authCheck.response;

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  // SERVICE_ROLE is intentional — telemetry writes (activity_trail,
  // engine_event, guardian_signal) bypass RLS by design. See ADR-0175
  // destination contract + create-invitation precedent.
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return json(500, {
      error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
    });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const body = await parseBody(req);
  if (body === null) {
    return json(400, { error: "Malformed payload" });
  }

  if (body === "cron") {
    return await handleCronMode(supabase);
  }

  return await handleEventMode(supabase, body);
});
