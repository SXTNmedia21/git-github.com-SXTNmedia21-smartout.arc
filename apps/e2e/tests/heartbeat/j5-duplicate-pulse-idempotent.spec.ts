/**
 * J5 — Duplicate pulse with same cron_run_id is idempotent
 *
 * Evidence asserted:
 *   - Exactly ONE `sixten.pulse_received` row for the given `cron_run_id`
 *     (second POST returns 200 but the engine_event insert is rejected by
 *     the unique constraint on `idempotency_key`)
 *   - Exactly ONE `sixten.pulse_processing_claimed` sentinel (pulse_id_1 only)
 *   - `sixten.check_result` rows exist for pulse_id_1 but NOT pulse_id_2
 *   - Both HTTP responses are 200 (fail-open for scheduler compatibility)
 *
 * Design note on pulse_id_2: the second POST generates a fresh `pulse_id_2`
 * internally, but the `engine_event` insert fails (unique constraint on
 * `cron_run_id` as `idempotency_key`). The orchestrator never sees `pulse_id_2`
 * because it queries engine_event rows — the row doesn't exist. The returned
 * `pulse_id_2` from the HTTP body is therefore "dangling" — it is a valid UUID
 * but has no backing DB row.
 */

import { test, expect } from "@playwright/test";
import {
  createAdminClient,
  sendPulse,
  pollEngineEvent,
  queryCheckResults,
  countEventsByPulseId,
  WEBHOOK_URL,
} from "./_helpers";

// Fixed key — same across both POSTs within this test
const DEDUP_CRON_RUN_ID = `e2e-j5-dedup-${Date.now()}`;

test.describe("J5 — Duplicate pulse with same cron_run_id is idempotent", () => {
  test.setTimeout(60_000);

  const db = createAdminClient();
  let pulseId1 = "";
  let pulseId2 = "";

  test("second POST with same cron_run_id produces no duplicate processing", async () => {
    // Send pulse 1
    const res1 = await sendPulse({
      cron_run_id: DEDUP_CRON_RUN_ID,
      scope: "platform",
      trigger_source: "e2e-j5-first",
    });

    expect(res1.status).toBe(200);
    expect(res1.body.received).toBe(true);
    pulseId1 = res1.body.pulse_id;

    // Send pulse 2 — same cron_run_id, different session
    const res2 = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        cron_run_id: DEDUP_CRON_RUN_ID,
        scope: "platform",
        trigger_source: "e2e-j5-duplicate",
      }),
    });

    // Both HTTP responses must be 200 (fail-open)
    expect(res2.status).toBe(200);
    const body2 = (await res2.json()) as Record<string, unknown>;
    expect(body2.received).toBe(true);
    pulseId2 = body2.pulse_id as string;

    // pulseId1 and pulseId2 will be different UUIDs (generated fresh per request)
    expect(pulseId2).not.toBe(pulseId1);

    // Exactly ONE engine_event row for this cron_run_id
    const { data: receivedRows } = await db
      .from("engine_event")
      .select("id, idempotency_key, payload")
      .eq("event_type", "sixten.pulse_received")
      .eq("idempotency_key", DEDUP_CRON_RUN_ID);

    expect(
      receivedRows?.length ?? 0,
      `expected exactly 1 pulse_received row for cron_run_id=${DEDUP_CRON_RUN_ID}`,
    ).toBe(1);

    const onlyRow = receivedRows![0]!;
    const rowPayload = onlyRow.payload as Record<string, unknown>;
    // The row must belong to pulse_id_1 (the first insert)
    expect(rowPayload.pulse_id).toBe(pulseId1);

    // Wait for orchestrator to process pulse_id_1
    await pollEngineEvent(
      db,
      {
        event_type: "sixten.pulse_processing_claimed",
        idempotency_key: `pulse_processed_${pulseId1}`,
      },
      "sentinel for pulse_id_1",
    );

    // pulse_id_1 has 5 check_result rows
    const results1 = await queryCheckResults(db, pulseId1);
    expect(results1.length).toBe(5);

    // pulse_id_2 has 0 check_result rows (it was never in engine_event)
    const count2 = await countEventsByPulseId(db, "sixten.check_result", pulseId2);
    expect(
      count2,
      `pulse_id_2 (${pulseId2}) should have 0 check_result rows — it had no backing engine_event row`,
    ).toBe(0);

    // No sentinel for pulse_id_2
    const { data: sentinel2 } = await db
      .from("engine_event")
      .select("id")
      .eq("event_type", "sixten.pulse_processing_claimed")
      .eq("idempotency_key", `pulse_processed_${pulseId2}`)
      .limit(1);

    expect(
      sentinel2?.length ?? 0,
      "pulse_id_2 should not have been claimed by the orchestrator",
    ).toBe(0);
  });

  test.afterAll(async () => {
    // Clean up: remove the one pulse_received row + sentinel for pulse_id_1
    await db.from("engine_event").delete().eq("idempotency_key", DEDUP_CRON_RUN_ID);
    if (pulseId1) {
      await db.from("engine_event").delete().eq("idempotency_key", `pulse_processed_${pulseId1}`);
    }
    // pulse_id_2 rows don't exist — nothing to delete
  });
});
