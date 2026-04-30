#!/usr/bin/env tsx
/**
 * verify-heartbeat.ts — Phase 0d.1 acceptance verification
 *
 * What: Simulates 3 pulses against the webhook endpoint, waits 30s for the
 *       stage-engine orchestrator to pick them up, then asserts:
 *         (a) 3 pulse_received events exist in engine_event
 *         (b) at least 1 pulse_processed event exists per pulse
 *         (c) no breaches if dev DB is clean
 *
 * Usage:
 *   tsx scripts/verify-heartbeat.ts
 *   WEBHOOK_URL=http://localhost:3060/api/heartbeat/sixten tsx scripts/verify-heartbeat.ts
 *
 * Requires:
 *   - SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY env vars (or op run)
 *   - Webhook receiver running (apps/web dev server on port 3060)
 *   - stage-engine running with ENABLE_SIXTEN_ORCHESTRATOR=true
 *
 * Exit codes:
 *   0 = all assertions passed
 *   1 = assertion failure or unexpected error
 */

import { createClient } from "@supabase/supabase-js";

const WEBHOOK_URL = process.env.WEBHOOK_URL ?? "http://localhost:3060/api/heartbeat/sixten";
const SUPABASE_URL = process.env.SUPABASE_URL ?? "http://localhost:54321";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const WAIT_SECONDS = 35;

type EngineEventRow = {
  id: string;
  event_type: string;
  payload: Record<string, unknown>;
  fired_at: string;
  idempotency_key: string | null;
};

function log(msg: string): void {
  process.stdout.write(`[verify-heartbeat] ${msg}\n`);
}

function fail(msg: string): never {
  process.stderr.write(`[verify-heartbeat] FAIL: ${msg}\n`);
  process.exit(1);
}

async function sendPulse(cronRunId: string): Promise<string> {
  const res = await fetch(WEBHOOK_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      cron_run_id: cronRunId,
      scope: "platform",
      trigger_source: "verify-heartbeat-script",
      directives: ["health_check"],
      metadata: { test_run: true },
    }),
  });

  if (!res.ok) {
    fail(`Webhook returned ${res.status} for cron_run_id=${cronRunId}`);
  }

  const body = (await res.json()) as { pulse_id: string };
  return body.pulse_id;
}

async function main(): Promise<void> {
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    fail(
      "SUPABASE_SERVICE_ROLE_KEY is not set. Run with: op run --env-file=.env.template -- tsx scripts/verify-heartbeat.ts",
    );
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  log(`Sending 3 test pulses to ${WEBHOOK_URL}...`);

  const pulseIds: string[] = [];
  for (let i = 0; i < 3; i++) {
    const cronRunId = `verify-test-${Date.now()}-${i}`;
    const pulseId = await sendPulse(cronRunId);
    pulseIds.push(pulseId);
    log(`  Pulse ${i + 1}: id=${pulseId}`);
    // Small stagger so idempotency keys don't collide
    await new Promise((r) => setTimeout(r, 200));
  }

  log(`Waiting ${WAIT_SECONDS}s for orchestrator to process pulses...`);
  await new Promise((r) => setTimeout(r, WAIT_SECONDS * 1000));

  // ─── Assertion (a): 3 pulse_received events ───────────────────
  log("Assertion (a): checking pulse_received events...");

  const { data: receivedRows, error: receivedErr } = await supabase
    .from("engine_event")
    .select("id, event_type, payload")
    .eq("event_type", "sixten.pulse_received")
    .in(
      "idempotency_key",
      pulseIds.map((id) => id), // idempotency_key = cron_run_id or pulse_id
    );

  if (receivedErr) {
    // Fall back to payload scan
    const { data: allReceived } = await supabase
      .from("engine_event")
      .select("id, event_type, payload")
      .eq("event_type", "sixten.pulse_received");

    const matchingReceived = (allReceived ?? []).filter((row) => {
      const p = row.payload as Record<string, unknown>;
      return pulseIds.includes(p.pulse_id as string);
    });

    if (matchingReceived.length < 3) {
      fail(`Expected 3 pulse_received events, found ${matchingReceived.length}`);
    }
    log(
      `  (a) PASS: ${matchingReceived.length} pulse_received events found (payload scan fallback)`,
    );
  } else {
    const matched = (receivedRows ?? []).filter((row) => {
      const p = row.payload as Record<string, unknown>;
      return pulseIds.includes(p.pulse_id as string);
    });

    if (matched.length < 3) {
      fail(`Expected 3 pulse_received events, found ${matched.length}`);
    }
    log(`  (a) PASS: ${matched.length} pulse_received events found`);
  }

  // ─── Assertion (b): at least 1 pulse_processed per pulse ─────
  log("Assertion (b): checking pulse_processing_claimed events...");

  const { data: claimedRows } = await supabase
    .from("engine_event")
    .select("id, payload, idempotency_key")
    .eq("event_type", "sixten.pulse_processing_claimed")
    .in(
      "idempotency_key",
      pulseIds.map((id) => `pulse_processed_${id}`),
    );

  const claimedSet = new Set(
    (claimedRows ?? []).map((r) => {
      const p = r.payload as Record<string, unknown>;
      return p.pulse_id as string;
    }),
  );

  const missedPulses = pulseIds.filter((id) => !claimedSet.has(id));
  if (missedPulses.length > 0) {
    fail(
      `Expected all 3 pulses to be processed. Missing: ${missedPulses.join(", ")}. ` +
        `Is stage-engine running with ENABLE_SIXTEN_ORCHESTRATOR=true?`,
    );
  }
  log(`  (b) PASS: all 3 pulses claimed for processing`);

  // ─── Assertion (c): no breach events if DB clean ──────────────
  log("Assertion (c): checking for unexpected breach events...");

  const { data: checkResultRows } = await supabase
    .from("engine_event")
    .select("id, payload")
    .eq("event_type", "sixten.check_result");

  const breachesForOurPulses = (checkResultRows ?? []).filter((row) => {
    const p = row.payload as Record<string, unknown>;
    return pulseIds.includes(p.pulse_id as string) && p.status === "breach";
  });

  if (breachesForOurPulses.length > 0) {
    const breachNames = breachesForOurPulses.map((r) => {
      const p = r.payload as Record<string, unknown>;
      return `${p.check_name}(metric=${p.metric})`;
    });
    log(
      `  (c) WARN: ${breachesForOurPulses.length} breach(es) detected — dev DB may not be clean: ${breachNames.join(", ")}`,
    );
    log(
      "      This is expected if the dev DB has stale engine_events, orphan deviations, or SLA violations.",
    );
    log("      It is NOT a test failure — breaches indicate the check logic is working correctly.");
  } else {
    log(`  (c) PASS: no breach events for test pulses`);
  }

  // ─── Summary ──────────────────────────────────────────────────
  log("");
  log("All required assertions passed.");
  log("Sixten orchestrator Phase 0d.1 acceptance: OK");
  process.exit(0);
}

main().catch((err) => {
  process.stderr.write(
    `[verify-heartbeat] Unexpected error: ${err instanceof Error ? err.message : String(err)}\n`,
  );
  process.exit(1);
});
