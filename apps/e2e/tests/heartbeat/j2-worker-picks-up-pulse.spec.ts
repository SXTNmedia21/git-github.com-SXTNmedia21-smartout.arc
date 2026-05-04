/**
 * J2 — Stage-engine worker picks up pulse and runs checks
 *
 * Evidence asserted:
 *   - `sixten.pulse_processing_claimed` sentinel row exists after orchestrator poll
 *   - Exactly 5 `sixten.check_result` rows exist for the pulse
 *   - Each check_result row has a valid `check_name` matching the known 5 checks
 *   - `status` field on each row is one of "ok", "warn", "breach"
 *
 * Requires stage-engine running with ENABLE_SIXTEN_ORCHESTRATOR=true.
 * Timeout is generous (30s) to account for the 60s poll interval if the
 * orchestrator just missed a cycle — tests may be slow in CI.
 */

import { test, expect } from "@playwright/test";
import {
  createAdminClient,
  sendPulse,
  pollEngineEvent,
  queryCheckResults,
  uniqueCronRunId,
} from "./_helpers";

// The five check names the orchestrator always runs, in order
const EXPECTED_CHECK_NAMES = [
  "emit_pulse_received",
  "engine_event_lag",
  "notification_outbox_stale",
  "ticket_SLA",
  "D6_orphan_deviations",
] as const;

const VALID_STATUSES = new Set(["ok", "warn", "breach"]);

test.describe("J2 — Stage-engine worker picks up pulse", () => {
  test.setTimeout(60_000); // polling up to 30s + buffer

  const db = createAdminClient();
  let pulseId = "";
  const cronRunId = uniqueCronRunId("j2-worker");

  test("orchestrator claims pulse and runs all 5 checks", async () => {
    // Send the pulse
    const { status, body } = await sendPulse({
      cron_run_id: cronRunId,
      scope: "platform",
      trigger_source: "e2e-j2",
    });

    expect(status).toBe(200);
    pulseId = body.pulse_id;

    // Wait for the sentinel claim row
    const sentinelKey = `pulse_processed_${pulseId}`;
    await pollEngineEvent(
      db,
      {
        event_type: "sixten.pulse_processing_claimed",
        idempotency_key: sentinelKey,
      },
      `sentinel for pulse ${pulseId}`,
    );

    // Verify all 5 check_result rows exist
    const checkResults = await queryCheckResults(db, pulseId);

    expect(checkResults.length).toBe(5);

    const foundCheckNames = checkResults.map((r) => {
      const p = r.payload as Record<string, unknown>;
      return p.check_name as string;
    });

    for (const expected of EXPECTED_CHECK_NAMES) {
      expect(foundCheckNames, `check "${expected}" should have a result row`).toContain(expected);
    }

    // Each result has a valid status
    for (const row of checkResults) {
      const p = row.payload as Record<string, unknown>;
      expect(
        VALID_STATUSES.has(p.status as string),
        `check "${p.check_name}" has invalid status "${p.status}"`,
      ).toBe(true);
    }

    // Each result carries the pulse_id back-reference
    for (const row of checkResults) {
      const p = row.payload as Record<string, unknown>;
      expect(p.pulse_id).toBe(pulseId);
    }
  });

  test.afterAll(async () => {
    // Clean up sentinel and check_result rows seeded by this test run
    if (!pulseId) return;
    await db.from("engine_event").delete().eq("idempotency_key", `pulse_processed_${pulseId}`);
    await db.from("engine_event").delete().eq("idempotency_key", cronRunId);
    // Note: sixten.check_result rows use idempotency_key = "<pulseId>_<check_name>"
    // We leave those in place — they are harmless and useful for audit.
  });
});
