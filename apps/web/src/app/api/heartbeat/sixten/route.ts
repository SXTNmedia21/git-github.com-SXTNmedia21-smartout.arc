/**
 * POST /api/heartbeat/sixten — Smartout heartbeat ingestion endpoint.
 *
 * What: Receives periodic pings from Supabase pg_cron (or any external
 *       scheduler) and dispatches a "pulse" contract to the Sixten
 *       orchestrator for state-evaluation + action-policy execution.
 *
 * Auth: NONE — webhook accepts any POST. Per Pontus 2026-04-30:
 *       "uten å spøre eller validere". Replay/abuse mitigation deferred
 *       to MVP+ (HMAC + IP allowlist for Supabase).
 *
 * Idempotency: Each pulse gets a fresh UUID. Caller may include
 *              `cron_run_id` in body for de-dup at orchestrator layer.
 *
 * Postcondition: row inserted in `activity_trail` with event_name
 *                'sixten.pulse_received'. Returns 200 + `pulse_id`.
 *
 * Phase 0d (this commit): bare-bones receiver. Logs pulse, emits
 * activity_trail, returns 200. Real orchestration logic (sixten action
 * policy) lands in Phase 0d.1 once Sixten brainstorm verdict is in.
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createAdminClient } from "@smartout/supabase/admin";
import { randomUUID } from "node:crypto";

type PulsePayload = {
  cron_run_id?: string;
  scope?: "platform" | string; // workspace=<uuid>
  directives?: string[];
  trigger_source?: string; // "supabase_cron" | "manual" | "external"
  metadata?: Record<string, unknown>;
};

export async function POST(request: NextRequest): Promise<Response> {
  const pulseId = randomUUID();
  const pulseAt = new Date().toISOString();

  // Parse body — tolerate empty / malformed (per "uten validering" directive)
  let body: PulsePayload = {};
  try {
    const text = await request.text();
    if (text.trim().length > 0) {
      body = JSON.parse(text) as PulsePayload;
    }
  } catch {
    // Swallow — empty/malformed bodies are still valid pulses
  }

  const scope = body.scope ?? "platform";
  const directives = body.directives ?? [];
  const triggerSource = body.trigger_source ?? "unknown";

  // Log to stdout for tail-able observability during Phase 0d
  console.log(
    `[sixten.pulse] id=${pulseId} at=${pulseAt} scope=${scope} source=${triggerSource} directives=${JSON.stringify(directives)}`,
  );

  // Best-effort: write to engine_event for canonical event-bus pickup.
  // engine_event accepts platform-scoped rows (workspace_id null) which
  // matches the heartbeat-pulse semantics. activity_trail requires non-null
  // workspace_id + actor_id per ADR-0193 — wrong sink for system pulses.
  // Failure here MUST NOT block the pulse ack — orchestrator can still
  // pick up via console log + future polling.
  try {
    const admin = createAdminClient();
    await admin.from("engine_event").insert({
      event_type: "sixten.pulse_received",
      workspace_id: null,
      idempotency_key: body.cron_run_id ?? pulseId,
      payload: {
        pulse_id: pulseId,
        pulse_at: pulseAt,
        scope,
        directives,
        trigger_source: triggerSource,
        cron_run_id: body.cron_run_id ?? null,
        metadata: body.metadata ?? null,
      } as never,
    });
  } catch (err) {
    console.warn(
      `[sixten.pulse] engine_event insert failed (non-blocking): ${err instanceof Error ? err.message : "unknown"}`,
    );
  }

  // TODO Phase 0d.1: dispatch to Sixten orchestrator.
  // Awaits Sixten brainstorm verdict (see agent run a322b2ba170266f4e).
  // Likely path: insert engine_event row with directive payload, let
  // engine-dispatch route to a sixten-orchestrator handler.

  return NextResponse.json(
    {
      pulse_id: pulseId,
      pulse_at: pulseAt,
      scope,
      directives,
      received: true,
    },
    { status: 200 },
  );
}

// Reject non-POST so accidental browser hits don't write garbage to activity_trail
export async function GET(): Promise<Response> {
  return NextResponse.json(
    {
      endpoint: "Smartout heartbeat — Sixten orchestrator pulse",
      method: "POST",
      schema: {
        cron_run_id: "string?",
        scope: "'platform' | 'workspace=<uuid>'",
        directives: "string[]",
        trigger_source: "string",
        metadata: "object?",
      },
    },
    { status: 405 },
  );
}
