import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "../helpers/auth";
import { supabase } from "../helpers/seed";
import { telemetryTimestamp } from "../helpers/telemetry";

/**
 * journey-help-v1.spec.ts — G3 Trust Gate: panic-bar emit parity (ADR-0219)
 *
 * Verifies that clicking the PanicBar "Jeg trenger et menneske" button and
 * confirming in PanicConfirmDrawer:
 *   1. Shows the Botsson chat hero (Runtime A) with NO voice mic button.
 *   2. Creates an engine_state ticket (helpdesk_query_lifecycle, status=waiting,
 *      helpdesk_enabled=true on the owning channel).
 *   3. Emits BOTH `help.escalated_to_ticket` AND `helpdesk.query.opened`
 *      to BOTH activity_trail AND engine_event (ADR-0219 parity requirement,
 *      L-0094 dual-emit).
 *
 * DB access: service-role client (apps/e2e/helpers/seed.ts) — read-only after
 * the Server Action runs; no manual DB writes in this test.
 *
 * The Server Action under test is:
 *   apps/web/src/app/dashboard/help/_actions/open-helpdesk-ticket-action.ts
 * It re-implements openTicket logic directly (flagged for Task 17 audit) rather
 * than calling the capability tool. This test verifies emit parity holds
 * regardless of that deviation, per L-0094.
 *
 * engine_event stores event names in dot-notation (e.g. "help.escalated_to_ticket").
 * activity_trail preserves dot-notation too (registry routing writes the event
 * name as-is; space-form is used only for legacy telemetry events pre-ADR-0175).
 */

test.describe.configure({ mode: "serial", timeout: 60_000 });

test.describe("journey:help-v1 — G3 panic-bar emit parity @help", () => {
  // Resolve admin profile_id once — used to filter telemetry rows.
  let adminProfileId: string;
  let adminWorkspaceId: string;

  test.beforeAll(async () => {
    // Resolve seed admin identity via service-role (mirrors admin-login.ts pattern).
    const email = process.env.E2E_EMAIL ?? "admin@smartout.local";

    const { data: users, error: userErr } = await supabase.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });
    if (userErr) throw new Error(`beforeAll: listUsers failed: ${userErr.message}`);

    const user = users.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (!user) throw new Error(`beforeAll: seed user ${email} not found — run supabase db reset`);

    const { data: profile, error: profErr } = await supabase
      .from("profile")
      .select("profile_id, workspace_id")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();
    if (profErr || !profile) {
      throw new Error(
        `beforeAll: active profile for ${email} not found: ${profErr?.message ?? "no row"}`,
      );
    }

    adminProfileId = (profile as { profile_id: string }).profile_id;
    adminWorkspaceId = (profile as { workspace_id: string }).workspace_id;
  });

  // ── G2: Botsson chat hero present, NO voice mic in hero ───────────────────

  test("G2 smoke — chat hero visible, no voice mic button in hero section", async ({ page }) => {
    await loginAsAdmin(page, { skipOnboarding: true });
    await page.goto("/dashboard/help");
    await page.waitForLoadState("domcontentloaded");

    // Tier 1: BotssonChatHero — aria-label from component source.
    const chatHero = page.getByRole("region", { name: /spør botsson om hjelp/i });
    await expect(chatHero).toBeVisible({ timeout: 10_000 });

    // Runtime A only: the chat hero must NOT contain a voice microphone button.
    // Any mic/voice button in the hero would indicate Runtime B surface leak.
    // Assertion: no <button aria-label=~mic|voice|tale> within the hero section.
    const voiceMicInHero = chatHero.locator(
      'button[aria-label*="mic" i], button[aria-label*="voice" i], button[aria-label*="tale" i], button[aria-label*="snakk" i]',
    );
    await expect(voiceMicInHero).toHaveCount(0);
  });

  // ── G3: Panic bar → confirm → ticket created + dual emit parity ───────────

  test("G3 — panic bar creates ticket and emits both events to both destinations", async ({
    page,
  }) => {
    test.setTimeout(60_000);

    // ── Pre-condition: a helpdesk channel must exist in the workspace.
    // We look it up via service-role — same lookup the Server Action does.
    const { data: deskChannel, error: deskErr } = await supabase
      .from("channel")
      .select("id, name, responsible_profile_id")
      .eq("workspace_id", adminWorkspaceId)
      .eq("helpdesk_enabled", true)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();

    if (deskErr) throw new Error(`helpdesk channel lookup failed: ${deskErr.message}`);
    if (!deskChannel) {
      test.skip(!deskChannel, "No helpdesk-enabled channel in workspace — skip G3.");
      return;
    }

    if (!deskChannel.responsible_profile_id) {
      test.skip(
        !deskChannel.responsible_profile_id,
        "Helpdesk channel has no responsible_profile_id — skip G3 (Server Action would reject).",
      );
      return;
    }

    // Timestamp marker: only look at rows created AFTER this point.
    const since = telemetryTimestamp();

    await loginAsAdmin(page, { skipOnboarding: true });
    await page.goto("/dashboard/help");
    await page.waitForLoadState("domcontentloaded");

    // ── Tier 0: PanicBar must be sticky at top ────────────────────────────
    const panicBar = page.getByRole("navigation", { name: /nødhjelp-meny/i });
    await expect(panicBar).toBeVisible({ timeout: 10_000 });

    // ── Click "Jeg trenger et menneske" (category: human) ─────────────────
    // The button shows full label from sm breakpoint; test runs at desktop width.
    const humanButton = panicBar.getByRole("button", { name: /jeg trenger et menneske/i });
    await expect(humanButton).toBeVisible({ timeout: 5_000 });
    await humanButton.click();

    // ── PanicConfirmDrawer opens (Sheet from bottom) ───────────────────────
    // SheetTitle contains the label text; SheetDescription contains the description.
    const sheetTitle = page.getByRole("heading", { name: /jeg trenger et menneske/i });
    await expect(sheetTitle).toBeVisible({ timeout: 5_000 });

    // "Send melding" is the confirm button inside the sheet footer.
    const sendButton = page.getByRole("button", { name: /send melding/i });
    await expect(sendButton).toBeVisible({ timeout: 3_000 });

    // ── Confirm — fires openHelpdeskTicketAction ───────────────────────────
    await sendButton.click();

    // ── Toast: success state ───────────────────────────────────────────────
    // sonner toast "Meldingen er sendt!" appears on ok:true.
    await expect(page.getByText(/meldingen er sendt/i)).toBeVisible({ timeout: 15_000 });

    // Allow Server Action DB writes + telemetry emit to complete.
    await page.waitForTimeout(2_000);

    // ── DB assertion 1: engine_state ticket created ────────────────────────
    // The Server Action inserts engine_state with:
    //   process_id = 'helpdesk_query_lifecycle'
    //   workspace_id = adminWorkspaceId
    //   status = 'waiting'
    //   context.desk_channel_id = deskChannel.id
    //   context.requester_profile_id = adminProfileId
    //
    // We also verify the owning channel has helpdesk_enabled=true (G3 invariant).
    const { data: ticketRows, error: ticketErr } = await supabase
      .from("engine_state")
      .select("id, status, entity_id, context, assignee_id")
      .eq("workspace_id", adminWorkspaceId)
      .eq("process_id", "helpdesk_query_lifecycle")
      .eq("status", "waiting")
      .gte("started_at", since);

    expect(ticketErr, `engine_state SELECT failed: ${ticketErr?.message}`).toBeNull();
    expect(ticketRows, "expected at least one helpdesk ticket after panic confirm").toBeTruthy();
    expect(ticketRows!.length).toBeGreaterThanOrEqual(1);

    const ticket = ticketRows![0] as {
      id: string;
      status: string;
      entity_id: string;
      context: Record<string, unknown> | null;
      assignee_id: string | null;
    };

    // context.desk_channel_id must match the helpdesk channel the Server Action resolved.
    expect(ticket.context?.desk_channel_id).toBe(deskChannel.id);
    // context.requester_profile_id must be the authenticated user's profile.
    expect(ticket.context?.requester_profile_id).toBe(adminProfileId);
    // panic_category must be 'human' (we clicked "Jeg trenger et menneske").
    expect(ticket.context?.panic_category).toBe("human");

    // The channel linked as entity_id must have helpdesk_enabled=true (public)
    // OR be a query_thread spawned from a private-mode desk. We verify the
    // desk channel itself has helpdesk_enabled=true (G3 invariant).
    const { data: deskCheck } = await supabase
      .from("channel")
      .select("helpdesk_enabled")
      .eq("id", deskChannel.id)
      .single();

    expect(deskCheck?.helpdesk_enabled, "helpdesk channel must have helpdesk_enabled=true").toBe(
      true,
    );

    // ── DB assertion 2: activity_trail — BOTH event names present ─────────
    // activity_trail stores event names in the `event` column.
    // Both `help.escalated_to_ticket` and `helpdesk.query.opened` must appear.
    const { data: trailRows, error: trailErr } = await supabase
      .from("activity_trail")
      .select("id, event, actor_id, workspace_id, created_at")
      .eq("workspace_id", adminWorkspaceId)
      .in("event", ["help.escalated_to_ticket", "helpdesk.query.opened"])
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(10);

    expect(trailErr, `activity_trail SELECT failed: ${trailErr?.message}`).toBeNull();
    expect(trailRows, "activity_trail must contain rows for both help events").toBeTruthy();

    const trailEventNames = trailRows!.map((r: { event: string }) => r.event);

    expect(
      trailEventNames,
      `activity_trail missing 'help.escalated_to_ticket' — got: [${trailEventNames.join(", ")}]`,
    ).toContain("help.escalated_to_ticket");

    expect(
      trailEventNames,
      `activity_trail missing 'helpdesk.query.opened' — got: [${trailEventNames.join(", ")}]`,
    ).toContain("helpdesk.query.opened");

    // actor_id on at least one trail row must match the authenticated profile.
    const actorMatches = trailRows!.filter(
      (r: { actor_id: string }) => r.actor_id === adminProfileId,
    );
    expect(
      actorMatches.length,
      "at least one activity_trail row must have actor_id = admin profile",
    ).toBeGreaterThanOrEqual(1);

    // ── DB assertion 3: engine_event — BOTH event names present ───────────
    // engine_event stores event names in the `event_type` column (dot-notation).
    // Both events route to engine_event per registry.ts routing table.
    const { data: engineEvents, error: engineEventErr } = await supabase
      .from("engine_event")
      .select("id, event_type, payload, workspace_id, fired_at")
      .eq("workspace_id", adminWorkspaceId)
      .in("event_type", ["help.escalated_to_ticket", "helpdesk.query.opened"])
      .gte("fired_at", since)
      .order("fired_at", { ascending: false })
      .limit(10);

    expect(engineEventErr, `engine_event SELECT failed: ${engineEventErr?.message}`).toBeNull();
    expect(engineEvents, "engine_event must contain rows for both help events").toBeTruthy();

    const engineEventNames = engineEvents!.map((r: { event_type: string }) => r.event_type);

    expect(
      engineEventNames,
      `engine_event missing 'help.escalated_to_ticket' — got: [${engineEventNames.join(", ")}]. ` +
        `ADR-0219 §Telemetry + L-0094 parity: Server Action must emit BOTH events regardless of code path.`,
    ).toContain("help.escalated_to_ticket");

    expect(
      engineEventNames,
      `engine_event missing 'helpdesk.query.opened' — got: [${engineEventNames.join(", ")}]. ` +
        `ADR-0219 §Telemetry + L-0094 parity: Server Action must emit BOTH events regardless of code path.`,
    ).toContain("helpdesk.query.opened");
  });
});
