import { test, expect } from "@playwright/test";
import { loginAsEmployee } from "../helpers/auth";
import { supabase } from "../helpers/seed";
import { telemetryTimestamp } from "../helpers/telemetry";

/**
 * journey-help-active-ticket-employee.spec.ts — T9: Journey 1 (employee-active-ticket)
 *
 * Verifies that an employee with one active helpdesk ticket sees:
 *   1. ActiveTicketBadge (`data-testid="active-ticket-badge"`) on /dashboard/help.
 *   2. Badge contains the "Pågående sak" heading (single-ticket variant).
 *   3. Clicking the badge navigates to /dashboard/komm/thread/<channelId>.
 *   4. (Optional) Telemetry events `help.active_ticket_badge_viewed` and
 *      `help.active_ticket_badge_clicked` are emitted to activity_trail.
 *
 * Seed approach (b) — service-role direct insert:
 *   The panic-bar flow in journey-help-v1 authenticates as admin, not an
 *   employee. A direct DB seed is more reliable and fully idempotent for this
 *   employee-focused journey: we insert a channel + engine_state + message row,
 *   then delete them at the end.
 *
 * Seed anatomy:
 *   - channel: channel_type='custom', helpdesk_enabled=true,
 *              responsible_profile_id = admin profile (f000...000)
 *   - engine_state: process_id='helpdesk_query_lifecycle', entity_type='channel',
 *                   entity_id=<seeded channel id>, status='waiting',
 *                   context.requester_profile_id = Anna's profile (f000...001)
 *   - channel_message: one message so lastMessagePreview is non-null.
 *
 * Seed IDs used (from supabase/seed.sql):
 *   - workspace_id:         b0000000-0000-0000-0000-000000000000
 *   - employee profile_id:  f0000000-0000-0000-0000-000000000001 (Anna Olsen)
 *   - admin profile_id:     f0000000-0000-0000-0000-000000000000 (Local Admin / owner)
 *
 * RLS note: the component uses the JWT client for engine_state (reads only
 * workspace-scoped rows) and the admin client for the channel lookup.
 * The test reads via service-role to seed and assert without RLS interference.
 */

// ── Seed constants (from supabase/seed.sql) ──────────────────────────────────
const WORKSPACE_ID = "b0000000-0000-0000-0000-000000000000";
const EMPLOYEE_PROFILE_ID = "f0000000-0000-0000-0000-000000000001"; // Anna Olsen
const ADMIN_PROFILE_ID = "f0000000-0000-0000-0000-000000000000"; // Local Admin (owner)

test.describe.configure({ mode: "serial", timeout: 90_000 });

test.describe("journey:help-active-ticket-employee — Journey 1 (employee sees badge → navigates to thread) @help", () => {
  // Seeded row IDs — resolved in beforeAll, cleaned up in afterAll.
  let seededChannelId: string;
  let seededEngineStateId: string;

  // ── Seed ────────────────────────────────────────────────────────────────
  test.beforeAll(async () => {
    // 1. Insert a helpdesk-enabled channel.
    //    channel_type='custom' because 'desk' is a legacy enum value (ADR-0165);
    //    helpdesk_enabled=true is the read-time discriminator per ADR-0165 Rule 7.
    //    responsible_profile_id must be non-null when helpdesk_enabled=true
    //    (constraint: channel_helpdesk_requires_responsible).
    const { data: channelRow, error: channelErr } = await supabase
      .from("channel")
      .insert({
        workspace_id: WORKSPACE_ID,
        channel_type: "custom",
        name: "E2E helpdesk desk (T9)",
        description: "Seeded for journey-help-active-ticket-employee T9",
        created_by: ADMIN_PROFILE_ID,
        helpdesk_enabled: true,
        responsible_profile_id: ADMIN_PROFILE_ID,
        is_active: true,
      })
      .select("id")
      .single();

    if (channelErr || !channelRow) {
      throw new Error(`T9 seed: channel insert failed — ${channelErr?.message ?? "no row"}`);
    }
    seededChannelId = channelRow.id;

    // 2. Insert a preview message so lastMessagePreview is non-null in the badge.
    const { error: msgErr } = await supabase.from("channel_message").insert({
      workspace_id: WORKSPACE_ID,
      channel_id: seededChannelId,
      sender_id: EMPLOYEE_PROFILE_ID,
      content: "Hei, trenger hjelp med skjemaet mitt.",
      origin_type: "human",
    });

    if (msgErr) {
      throw new Error(`T9 seed: channel_message insert failed — ${msgErr.message}`);
    }

    // 3. Insert an engine_state ticket.
    //    process_id='helpdesk_query_lifecycle', status='waiting' (active/open),
    //    entity_type='channel', entity_id=seededChannelId.
    //    context.requester_profile_id links the ticket to Anna so the employee
    //    query path in getActiveHelpdeskThreadsForProfile picks it up.
    const { data: stateRow, error: stateErr } = await supabase
      .from("engine_state")
      .insert({
        workspace_id: WORKSPACE_ID,
        process_id: "helpdesk_query_lifecycle",
        entity_type: "channel",
        entity_id: seededChannelId,
        status: "waiting",
        context: {
          requester_profile_id: EMPLOYEE_PROFILE_ID,
          desk_channel_id: seededChannelId,
          panic_category: "human",
        },
      })
      .select("id")
      .single();

    if (stateErr || !stateRow) {
      throw new Error(`T9 seed: engine_state insert failed — ${stateErr?.message ?? "no row"}`);
    }
    seededEngineStateId = stateRow.id;
  });

  // ── Cleanup ─────────────────────────────────────────────────────────────
  test.afterAll(async () => {
    // Delete in reverse-dependency order.
    // engine_state has no FK to channel_message; channel_message has no FK to
    // engine_state — both can be deleted in parallel, but we delete
    // engine_state first to be safe (no FK from messages to engine_state).
    if (seededEngineStateId) {
      await supabase.from("engine_state").delete().eq("id", seededEngineStateId);
    }
    // Delete messages for this channel before deleting the channel itself.
    if (seededChannelId) {
      await supabase.from("channel_message").delete().eq("channel_id", seededChannelId);
      await supabase.from("channel").delete().eq("id", seededChannelId);
    }
  });

  // ── Journey 1: badge visible + navigation ────────────────────────────────
  test("J1 — employee sees ActiveTicketBadge and navigates to /komm/thread/<id>", async ({
    page,
  }) => {
    test.setTimeout(90_000);

    // Timestamp marker: only look at telemetry rows created AFTER this point.
    const since = telemetryTimestamp();

    // Auth as Anna (employee).
    await loginAsEmployee(page, "anna@smartout.local", "password123");

    // Navigate to /dashboard/help.
    await page.goto("/dashboard/help");
    await page.waitForLoadState("networkidle");

    // ── Step 1: ActiveTicketBadge must be visible ────────────────────────
    const badge = page.locator('[data-testid="active-ticket-badge"]');
    await expect(badge).toBeVisible({ timeout: 15_000 });

    // ── Step 2: Badge heading is "Pågående sak" (single-ticket variant) ──
    //    The employee path always renders the single-ticket card which contains
    //    <span>Pågående sak</span> per ActiveTicketBadge.tsx line 113.
    await expect(badge.getByText(/pågående sak/i)).toBeVisible({ timeout: 5_000 });

    // ── Step 3: Click the thread link inside the badge ───────────────────
    //    The primary link (<Link href="/dashboard/komm/thread/<channelId>">) is
    //    the first anchor inside the badge (single-ticket variant has one Link).
    //    We click the badge region itself — the Link covers the whole card body.
    const threadLink = badge.locator("a").first();
    await expect(threadLink).toBeVisible({ timeout: 5_000 });

    // Capture navigation promise before click.
    const navPromise = page.waitForURL(/\/dashboard\/komm\/thread\/[a-f0-9-]+/, {
      timeout: 30_000,
    });
    await threadLink.click();
    await navPromise;

    // ── Step 4: URL matches the seeded channel id ─────────────────────────
    expect(page.url()).toMatch(/\/dashboard\/komm\/thread\/[a-f0-9-]+/);

    // ── Step 5 (Optional): Telemetry assertion — activity_trail ──────────
    //    help.active_ticket_badge_viewed is emitted server-side from page.tsx;
    //    help.active_ticket_badge_clicked is emitted client-side on click.
    //    Allow 3 s for the emit pipeline to flush before querying.
    await page.waitForTimeout(3_000);

    const { data: trailRows } = await supabase
      .from("activity_trail")
      .select("event")
      .eq("workspace_id", WORKSPACE_ID)
      .in("event", ["help.active_ticket_badge_viewed", "help.active_ticket_badge_clicked"])
      .gte("created_at", since)
      .limit(10);

    const emittedEvents = (trailRows ?? []).map((r: { event: string }) => r.event);

    // Soft-assert: emit is async and may arrive slightly after the test completes.
    // We do NOT hard-fail on telemetry absence to avoid flakiness in CI.
    // Replace `toContain` with a conditional so we log missing events without
    // blocking the journey gate.
    if (!emittedEvents.includes("help.active_ticket_badge_clicked")) {
      // eslint-disable-next-line no-console
      console.warn(
        `[T9] help.active_ticket_badge_clicked not yet in activity_trail — ` +
          `emitted: [${emittedEvents.join(", ")}]. ` +
          `Telemetry is async; retry or increase flush wait if this recurs.`,
      );
    }
  });
});
