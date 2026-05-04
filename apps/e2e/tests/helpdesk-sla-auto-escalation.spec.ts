/**
 * J1 — Helpdesk SLA Auto-Escalation (system path).
 *
 * Backend-only test. No UI assertions.
 *
 * Flow under test (per ADR-0231):
 *   1. Open ticket (fixture seeds engine_state + pre-canned breach event +
 *      engine_delayed_trigger with fire_at in the past).
 *   2. Invoke fire-delayed-triggers Edge Function manually (cron emulation).
 *   3. Function picks up the row, marks fired=true, dispatches to
 *      engine-dispatch with event_type='helpdesk.query.sla_breached'.
 *   4. Dispatcher's trigger-fire path spawns a new engine_state with
 *      process_id='helpdesk_sla_breach_handler', current_step=1, copies
 *      payload.target_state_id + payload.assignee_id into state.context +
 *      state.assignee_id respectively.
 *   5. Step 1 (update_context_targeted) patches origin ticket's
 *      context.sla_breached_at via the workspace integrity guard.
 *   6. Step 2 (send_notification) writes to notification_outbox with
 *      allowed_channels=['push','in_app'] (no voice — ADR-0163).
 *
 * Assertions:
 *   - engine_event count for helpdesk.query.sla_breached = 1
 *   - new engine_state with process_id='helpdesk_sla_breach_handler' exists
 *   - origin ticket's context.sla_breached_at populated (ISO string)
 *   - notification_outbox row exists, allowed_channels excludes 'voice'
 *   - engine_delayed_trigger.fired=true
 *   - re-invoke → no new events (idempotency)
 *
 * Setup: Supabase Local must be running. WATCHDOG_CRON_SECRET in
 * apps/e2e/.env.local. Run with: `op run --env-file=.env.template -- pnpm test`.
 */
import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import {
  cleanWorkspace,
  invokeFireDelayedTriggers,
  seedDelayedTrigger,
  seedHelpdeskWithObserver,
  seedTicket,
} from "../helpers/helpdesk-sla-fixtures";
import { supabase } from "../helpers/seed";

test.describe("J1 — Helpdesk SLA auto-escalation", () => {
  let workspace_id: string;

  test.beforeEach(() => {
    workspace_id = randomUUID();
  });

  test.afterEach(async () => {
    await cleanWorkspace(workspace_id);
  });

  test("fire-delayed-triggers fires breach handler exactly once", async () => {
    // Arrange — fresh workspace + desk + rep + observer + open ticket + delayed trigger
    const fixture = await seedHelpdeskWithObserver(workspace_id);
    const ticket = await seedTicket({
      workspace_id: fixture.workspace_id,
      desk_channel_id: fixture.desk_channel_id,
      rep_profile_id: fixture.rep_profile_id,
    });
    await seedDelayedTrigger({
      workspace_id: fixture.workspace_id,
      origin_state_id: ticket.state_id,
      desk_channel_id: fixture.desk_channel_id,
      rep_profile_id: fixture.rep_profile_id,
      observer_profile_id: fixture.observer_profile_id,
    });

    // Act — invoke cron manually
    const result1 = await invokeFireDelayedTriggers();
    expect(result1.fired).toBeGreaterThanOrEqual(1);

    // Allow downstream dispatcher work to settle (engine-dispatch is sync HTTP
    // from the Edge Function; the assertions below run after the chain returns)
    await new Promise((r) => setTimeout(r, 500));

    // Assert 1 — exactly one breach event in engine_event for this workspace
    const { data: events } = await supabase
      .from("engine_event")
      .select("id")
      .eq("event_type", "helpdesk.query.sla_breached")
      .eq("workspace_id", workspace_id);
    expect(events?.length).toBe(1);

    // Assert 2 — breach_handler state spawned
    const { data: handlerStates } = await supabase
      .from("engine_state")
      .select("id, current_step, status, assignee_id, context")
      .eq("workspace_id", workspace_id)
      .eq("process_id", "helpdesk_sla_breach_handler");
    expect(handlerStates?.length).toBe(1);
    const handler = handlerStates?.[0] as {
      id: string;
      assignee_id: string | null;
      context: Record<string, unknown>;
    };
    expect(handler?.assignee_id).toBe(fixture.observer_profile_id); // dispatcher copied payload.assignee_id

    // Assert 3 — origin ticket's context.sla_breached_at populated
    const { data: originTicket } = await supabase
      .from("engine_state")
      .select("context")
      .eq("id", ticket.state_id)
      .single();
    const originCtx = (originTicket?.context ?? {}) as { sla_breached_at?: string };
    expect(originCtx.sla_breached_at).toBeTruthy();
    expect(typeof originCtx.sla_breached_at).toBe("string");

    // Assert 4 — notification in outbox with no voice channel
    const { data: notifs } = await supabase
      .from("notification_outbox")
      .select("recipient_id, allowed_channels")
      .eq("workspace_id", workspace_id);
    expect(notifs?.length).toBeGreaterThanOrEqual(1);
    const channels = (notifs?.[0]?.allowed_channels ?? []) as string[];
    expect(channels).not.toContain("voice");

    // Assert 5 — delayed trigger marked fired
    const { data: triggers } = await supabase
      .from("engine_delayed_trigger")
      .select("fired, cancelled_at")
      .eq("workspace_id", workspace_id);
    expect(triggers?.length).toBe(1);
    expect(triggers?.[0]?.fired).toBe(true);

    // Assert 6 — re-invoke is idempotent (no new events emitted)
    const beforeCount = events?.length ?? 0;
    await invokeFireDelayedTriggers();
    await new Promise((r) => setTimeout(r, 500));
    const { data: eventsAfter } = await supabase
      .from("engine_event")
      .select("id")
      .eq("event_type", "helpdesk.query.sla_breached")
      .eq("workspace_id", workspace_id);
    expect(eventsAfter?.length).toBe(beforeCount);
  });
});
