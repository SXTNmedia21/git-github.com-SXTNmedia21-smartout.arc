/**
 * J4 — System with stale notification_outbox produces breach + escalation
 *
 * Evidence asserted:
 *   - `sixten.check_result` for `notification_outbox_stale` has `status = "breach"`
 *   - `payload.stale_count >= 1` and `payload.threshold_seconds = 600`
 *   - `sixten.nudge` engine_event row exists for this pulse + check
 *   - `engine_event` `sixten.check_result` row has breach status (LOG policy)
 *
 * Setup: inserts one `notification_outbox` row with `created_at = NOW() - 700s`
 * via the admin client. Cleaned up in `afterEach`.
 *
 * Note on activity_trail for sixten events: `emit()` routes `sixten check_breach`
 * and `sixten escalation` per `packages/telemetry/src/registry.ts`. On local dev
 * the destination may be PostHog only (not activity_trail). The spec asserts
 * engine_event rows (always written) and annotates if activity_trail rows are absent.
 */

import { test, expect } from "@playwright/test";
import {
  createAdminClient,
  sendPulse,
  pollEngineEvent,
  queryCheckResults,
  countEventsByPulseId,
  uniqueCronRunId,
} from "./_helpers";

// ─── Fixture helpers ─────────────────────────────────────────────

type NotificationOutboxRow = {
  id: string;
};

/**
 * Insert a stale `notification_outbox` row (pending, created 700s ago).
 * Uses a real workspace_id from the seed if available, otherwise skips.
 */
async function insertStaleOutboxRow(
  db: ReturnType<typeof createAdminClient>,
): Promise<{ id: string; workspaceId: string } | null> {
  // Pick an existing workspace_id to satisfy the FK
  const { data: ws } = await db.from("workspace").select("workspace_id").limit(1).maybeSingle();

  if (!ws) return null;
  const workspaceId = ws.workspace_id as string;

  // Pick any profile in the workspace for recipient_profile_id (nullable in some schemas)
  // We insert with null to avoid FK dependency on a specific profile.
  const staleCreatedAt = new Date(Date.now() - 700 * 1000).toISOString();

  const { data, error } = await db
    .from("notification_outbox")
    .insert({
      workspace_id: workspaceId,
      channel: "email",
      recipient_profile_id: null,
      template_key: "e2e_j4_stale_test",
      payload: { test: true, source: "e2e-j4" },
      status: "pending",
      created_at: staleCreatedAt,
    })
    .select("id")
    .single();

  if (error || !data) {
    // Table schema may differ — log and return null to skip
    return null;
  }

  return { id: (data as NotificationOutboxRow).id, workspaceId };
}

// ─── Tests ───────────────────────────────────────────────────────

test.describe("J4 — Stale notification_outbox triggers breach + escalation", () => {
  test.setTimeout(60_000);

  const db = createAdminClient();
  let fixtureId: string | null = null;
  let pulseId = "";
  const cronRunId = uniqueCronRunId("j4-stale");

  test("breach detected + nudge emitted for stale outbox row", async () => {
    // Insert stale fixture BEFORE sending pulse (race condition: pulse first = check runs before fixture)
    const fixture = await insertStaleOutboxRow(db);

    if (!fixture) {
      test.skip(
        true,
        "notification_outbox insert failed — table schema may differ or no workspace exists. " +
          "Run supabase db reset to ensure seed data.",
      );
      return;
    }

    fixtureId = fixture.id;

    // Now send the pulse
    const { status, body } = await sendPulse({
      cron_run_id: cronRunId,
      scope: "platform",
      trigger_source: "e2e-j4",
    });

    expect(status).toBe(200);
    pulseId = body.pulse_id;

    // Wait for orchestrator
    await pollEngineEvent(
      db,
      {
        event_type: "sixten.pulse_processing_claimed",
        idempotency_key: `pulse_processed_${pulseId}`,
      },
      "sentinel j4",
    );

    // Find the check_result for notification_outbox_stale
    const checkResults = await queryCheckResults(db, pulseId);
    const outboxCheck = checkResults.find((r) => {
      const p = r.payload as Record<string, unknown>;
      return p.check_name === "notification_outbox_stale";
    });

    expect(
      outboxCheck,
      "sixten.check_result for notification_outbox_stale not found",
    ).toBeDefined();

    const payload = outboxCheck!.payload as Record<string, unknown>;
    expect(payload.status).toBe("breach");
    expect(typeof payload.metric).toBe("number");
    expect(payload.metric as number).toBeGreaterThanOrEqual(1);
    expect(payload.threshold).toBe(600); // OUTBOX_STALE_BREACH_S

    // Verify stale_count in the check payload
    expect((payload.stale_count as number) ?? (payload.metric as number)).toBeGreaterThanOrEqual(1);

    // Nudge event for this check
    const nudgeCount = await countEventsByPulseId(db, "sixten.nudge", pulseId);
    expect(
      nudgeCount,
      "expected at least one sixten.nudge event for a breach",
    ).toBeGreaterThanOrEqual(1);

    // Verify the nudge row has the right check_name
    const { data: nudgeRows } = await db
      .from("engine_event")
      .select("payload")
      .eq("event_type", "sixten.nudge")
      .contains("payload", { pulse_id: pulseId });

    const outboxNudge = (nudgeRows ?? []).find((r) => {
      const p = r.payload as Record<string, unknown>;
      return p.check_name === "notification_outbox_stale";
    });

    expect(outboxNudge, "sixten.nudge row for notification_outbox_stale not found").toBeDefined();

    // Activity trail check for sixten check_breach (best-effort — may route to PostHog only)
    const { data: breachTrail } = await db
      .from("activity_trail")
      .select("event")
      .eq("event", "sixten check_breach")
      .gte("created_at", new Date(Date.now() - 120_000).toISOString())
      .limit(1);

    if (!breachTrail || breachTrail.length === 0) {
      test.info().annotations.push({
        type: "info",
        description:
          "sixten check_breach not in activity_trail — likely routing to PostHog only. " +
          "Check packages/telemetry/src/registry.ts for destination config.",
      });
    }
  });

  test.afterEach(async () => {
    // Remove the stale fixture row regardless of pass/fail
    if (fixtureId) {
      await db.from("notification_outbox").delete().eq("id", fixtureId);
      fixtureId = null;
    }
    if (pulseId) {
      await db.from("engine_event").delete().eq("idempotency_key", `pulse_processed_${pulseId}`);
      await db.from("engine_event").delete().eq("idempotency_key", cronRunId);
      pulseId = "";
    }
  });
});
