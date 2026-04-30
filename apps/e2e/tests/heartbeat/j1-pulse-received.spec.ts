/**
 * J1 — pg_cron operator schedules a pulse
 *
 * Evidence asserted:
 *   - HTTP 200 response with `received: true` and a non-empty `pulse_id`
 *   - One `engine_event` row with `event_type = "sixten.pulse_received"` and
 *     `idempotency_key` matching the sent `cron_run_id`
 *   - GET /api/heartbeat/sixten returns 405 (no side-effects)
 *
 * No browser context — API-only via `fetch`. DB assertions via service-role client.
 */

import { test, expect } from "@playwright/test";
import { createAdminClient, sendPulse, uniqueCronRunId, WEBHOOK_URL } from "./_helpers";

test.describe("J1 — pg_cron operator schedules a pulse", () => {
  const db = createAdminClient();

  test("POST returns 200 with pulse_id and received: true", async () => {
    const cronRunId = uniqueCronRunId("j1-happy");

    const { status, body } = await sendPulse({
      cron_run_id: cronRunId,
      scope: "platform",
      trigger_source: "e2e-j1",
      directives: ["health_check"],
      metadata: { test: true },
    });

    expect(status).toBe(200);
    expect(body.received).toBe(true);
    expect(typeof body.pulse_id).toBe("string");
    expect(body.pulse_id.length).toBeGreaterThan(0);
    expect(body.scope).toBe("platform");
  });

  test("POST inserts engine_event row with correct idempotency_key", async () => {
    const cronRunId = uniqueCronRunId("j1-db");

    const { status, body } = await sendPulse({
      cron_run_id: cronRunId,
      scope: "platform",
      trigger_source: "e2e-j1-db",
    });

    expect(status).toBe(200);

    // DB assertion — idempotency_key = cron_run_id when provided
    const { data, error } = await db
      .from("engine_event")
      .select("id, event_type, idempotency_key, payload")
      .eq("event_type", "sixten.pulse_received")
      .eq("idempotency_key", cronRunId)
      .limit(1);

    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect(data!.length).toBe(1);

    const row = data![0]!;
    expect(row.event_type).toBe("sixten.pulse_received");
    expect(row.idempotency_key).toBe(cronRunId);

    const payload = row.payload as Record<string, unknown>;
    expect(typeof payload.pulse_id).toBe("string");
    expect(payload.pulse_id).toBe(body.pulse_id);
    expect(payload.scope).toBe("platform");
    expect(payload.trigger_source).toBe("e2e-j1-db");

    // Cleanup
    await db.from("engine_event").delete().eq("idempotency_key", cronRunId);
  });

  test("POST with empty body still returns 200 with a pulse_id", async () => {
    const res = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "",
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.received).toBe(true);
    expect(typeof body.pulse_id).toBe("string");
  });

  test("POST with malformed JSON still returns 200", async () => {
    const res = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{ not valid json !!",
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.received).toBe(true);
  });

  test("GET returns 405 with schema documentation", async () => {
    const res = await fetch(WEBHOOK_URL, { method: "GET" });

    expect(res.status).toBe(405);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.endpoint).toBeDefined();
    expect(body.method).toBe("POST");
    expect(body.schema).toBeDefined();
  });
});
