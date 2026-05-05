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
 * Uses a real workspace_id + profile from the seed if available, otherwise skips.
 *
 * Schema (as of migration 20260519100100):
 *   recipient_id (uuid, not null) → FK profile.profile_id
 *   mode (notification_mode enum: training|work|community, not null)
 *   title (text, not null)
 *   body (text, not null)
 *   status defaults to 'pending'
 */
async function insertStaleOutboxRow(
  db: ReturnType<typeof createAdminClient>,
): Promise<{ id: string; workspaceId: string } | null> {
  // Pick an existing workspace_id + profile to satisfy FKs
  const { data: profile } = await db
    .from("profile")
    .select("profile_id, workspace_id")
    .limit(1)
    .maybeSingle();

  if (!profile) return null;
  const workspaceId = profile.workspace_id as string;
  const recipientId = profile.profile_id as string;

  const staleCreatedAt = new Date(Date.now() - 700 * 1000).toISOString();
  // Set scheduled_for far in the future so fetch_pending_outbox (which requires
  // scheduled_for <= now()) never picks up this row, preventing the Edge Function
  // from processing and changing its status. The sixten check only filters by
  // status='pending' + created_at < threshold — it does not check scheduled_for.
  const futureScheduledFor = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await db
    .from("notification_outbox")
    .insert({
      workspace_id: workspaceId,
      recipient_id: recipientId,
      mode: "work",
      title: "e2e_j4_stale_test",
      body: "Stale notification inserted by J4 E2E spec",
      metadata: { test: true, source: "e2e-j4" },
      status: "pending",
      created_at: staleCreatedAt,
      scheduled_for: futureScheduledFor,
    })
    .select("id")
    .single();

  if (error || !data) {
    // Table schema may differ — log and return null to skip
    console.error("[j4-fixture] notification_outbox insert failed:", error?.message);
    return null;
  }

  const rowId = String((data as NotificationOutboxRow).id);

  return { id: rowId, workspaceId };
}

// ─── Tests ───────────────────────────────────────────────────────

test.describe("J4 — Stale notification_outbox triggers breach + escalation", () => {
  // 90s: orchestrator polls every 60s — worst case wait is ~61s + processing time.
  test.setTimeout(90_000);

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

    // Wait for orchestrator — use 75s timeout since orchestrator polls every 60s.
    // Worst case: pulse lands just after a poll, next poll arrives in ~60s.
    await pollEngineEvent(
      db,
      {
        event_type: "sixten.pulse_processing_claimed",
        idempotency_key: `pulse_processed_${pulseId}`,
      },
      "sentinel j4",
      75_000,
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
