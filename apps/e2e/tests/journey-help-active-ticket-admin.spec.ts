import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "../helpers/auth";
import { supabase } from "../helpers/seed";

/**
 * journey-help-active-ticket-admin.spec.ts — Journey 3: admin aggregate view
 *
 * Verifies that an admin who is `responsible_profile_id` on N≥2 open helpdesk
 * channels sees the ActiveTicketBadge aggregate variant on /dashboard/help:
 *   1. `[data-testid="active-ticket-badge"]` is visible.
 *   2. Badge text shows "3 åpne saker" (or any digit-form /\d+ åpne saker/).
 *   3. Top-1 preview text contains the most-recent channel name (subject).
 *   4. Secondary "Se alle" link is present and href starts with /dashboard/komm.
 *   5. Click on top-1 preview navigates to /dashboard/komm/thread/<channelId>.
 *
 * Seed strategy (service-role):
 *   - 3 channel rows (channel_type='desk', helpdesk_enabled=true,
 *     responsible_profile_id=adminProfileId).
 *   - 1 engine_state per channel (process_id='helpdesk_query_lifecycle',
 *     entity_type='channel', status='in_progress').
 *   - 1 channel_message per channel (preview text).
 *   - Distinct created_at offsets so most-recent ordering is deterministic.
 *
 * Subject is channel.name (per queries.ts §Step 4 — channelRow?.name).
 * The badge renders threads[0] as top-1 (ordered by engine_state.updated_at DESC).
 *
 * Cleanup: seeded rows deleted in afterAll.
 */

test.describe.configure({ mode: "serial", timeout: 90_000 });

test.describe("journey:help — J3 admin aggregate (ActiveTicketBadge) @help @admin", () => {
  let adminProfileId: string;
  let adminWorkspaceId: string;

  // IDs of seeded rows — cleaned up in afterAll
  const seededChannelIds: string[] = [];
  const seededEngineStateIds: string[] = [];
  const seededMessageIds: string[] = [];

  // The most-recent channel (ticket #3) — used for URL assertion
  let mostRecentChannelId: string;
  // The most-recent channel name — used for preview text assertion
  let mostRecentSubject: string;

  test.beforeAll(async () => {
    // ── 1. Resolve seed admin profile ──────────────────────────────────────
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

    // ── 2. Seed 3 helpdesk channels + engine_state rows + preview messages ─
    //
    // created_at offsets:
    //   ticket #1 → oldest  (now - 20 min)
    //   ticket #2 → middle  (now - 10 min)
    //   ticket #3 → newest  (now - 1 min)  ← should appear as top-1 preview
    //
    // engine_state.updated_at mirrors the channel created_at so the DESC sort
    // (queries.ts §Step 1) deterministically surfaces ticket #3 first.

    const now = Date.now();
    const offsets = [20 * 60_000, 10 * 60_000, 1 * 60_000]; // ms in the past

    for (let i = 0; i < 3; i++) {
      const ticketIndex = i + 1;
      const createdAt = new Date(now - (offsets[i] ?? 60_000)).toISOString();
      const subject = `Admin agg test #${ticketIndex}`;

      // ── Channel ──────────────────────────────────────────────────────────
      const { data: channel, error: chErr } = await supabase
        .from("channel")
        .insert({
          workspace_id: adminWorkspaceId,
          channel_type: "desk",
          helpdesk_enabled: true,
          responsible_profile_id: adminProfileId,
          name: subject,
          is_active: true,
          created_at: createdAt,
          updated_at: createdAt,
        })
        .select("id")
        .single();

      if (chErr || !channel) {
        throw new Error(`beforeAll: channel insert #${ticketIndex} failed: ${chErr?.message}`);
      }
      seededChannelIds.push(channel.id);

      // ── engine_state ─────────────────────────────────────────────────────
      const { data: state, error: stateErr } = await supabase
        .from("engine_state")
        .insert({
          workspace_id: adminWorkspaceId,
          process_id: "helpdesk_query_lifecycle",
          entity_type: "channel",
          entity_id: channel.id,
          status: "in_progress",
          context: {
            desk_channel_id: channel.id,
            responsible_profile_id: adminProfileId,
          },
          started_at: createdAt,
          updated_at: createdAt,
        })
        .select("id")
        .single();

      if (stateErr || !state) {
        throw new Error(
          `beforeAll: engine_state insert #${ticketIndex} failed: ${stateErr?.message}`,
        );
      }
      seededEngineStateIds.push(state.id);

      // ── channel_message (preview) ────────────────────────────────────────
      const { data: msg, error: msgErr } = await supabase
        .from("channel_message")
        .insert({
          channel_id: channel.id,
          workspace_id: adminWorkspaceId,
          sender_id: adminProfileId,
          content: `Preview melding for ${subject}`,
          created_at: createdAt,
          updated_at: createdAt,
        })
        .select("id")
        .single();

      if (msgErr || !msg) {
        throw new Error(
          `beforeAll: channel_message insert #${ticketIndex} failed: ${msgErr?.message}`,
        );
      }
      seededMessageIds.push(msg.id);

      // Capture most-recent ticket (highest index = most-recent by design)
      if (i === 2) {
        mostRecentChannelId = channel.id;
        mostRecentSubject = subject;
      }
    }
  });

  test.afterAll(async () => {
    // Delete in reverse FK order: messages → engine_states → channels
    if (seededMessageIds.length > 0) {
      await supabase.from("channel_message").delete().in("id", seededMessageIds);
    }
    if (seededEngineStateIds.length > 0) {
      await supabase.from("engine_state").delete().in("id", seededEngineStateIds);
    }
    if (seededChannelIds.length > 0) {
      await supabase.from("channel").delete().in("id", seededChannelIds);
    }
  });

  // ── J3-A: aggregate badge visible with correct count ─────────────────────

  test("J3-A — badge visible and shows 3 åpne saker", async ({ page }) => {
    await loginAsAdmin(page, { skipOnboarding: true });
    await page.goto("/dashboard/help");
    await page.waitForLoadState("networkidle");

    const badge = page.locator('[data-testid="active-ticket-badge"]');
    await expect(badge).toBeVisible({ timeout: 15_000 });

    // Resilient: accept any "N åpne saker" form — seed adds 3 but pre-existing
    // tickets in the workspace could push the count higher. The spec mandates ≥3.
    const badgeText = await badge.textContent();
    expect(badgeText, "badge must contain digit + 'åpne saker'").toMatch(/\d+ åpne saker/);

    // Strict check: our 3 seeded tickets must all be reflected.
    // Extract the number and assert ≥ 3.
    const match = badgeText?.match(/(\d+) åpne saker/);
    const count = match ? parseInt(match[1] ?? "0", 10) : 0;
    expect(count, "expected at least 3 åpne saker (3 seeded tickets)").toBeGreaterThanOrEqual(3);
  });

  // ── J3-B: top-1 preview shows most-recent subject ────────────────────────

  test("J3-B — top-1 preview contains most-recent subject", async ({ page }) => {
    await loginAsAdmin(page, { skipOnboarding: true });
    await page.goto("/dashboard/help");
    await page.waitForLoadState("networkidle");

    const badge = page.locator('[data-testid="active-ticket-badge"]');
    await expect(badge).toBeVisible({ timeout: 15_000 });

    // Top-1 preview: channel.name rendered as the first <p> with font-medium
    // inside the first ActiveTicketBadgeLink (see ActiveTicketBadge.tsx §isAggregate).
    const previewText = await badge.textContent();
    expect(previewText, `badge must contain subject "${mostRecentSubject}"`).toContain(
      mostRecentSubject,
    );
  });

  // ── J3-C: secondary "Se alle" link is present ────────────────────────────

  test("J3-C — secondary Se alle link present and href starts with /dashboard/komm", async ({
    page,
  }) => {
    await loginAsAdmin(page, { skipOnboarding: true });
    await page.goto("/dashboard/help");
    await page.waitForLoadState("networkidle");

    const badge = page.locator('[data-testid="active-ticket-badge"]');
    await expect(badge).toBeVisible({ timeout: 15_000 });

    // "Se alle saker →" link — rendered as ActiveTicketBadgeLink with target="list"
    // (href="/dashboard/komm"). The text includes the arrow suffix "→".
    const seeAllLink = badge.getByRole("link", { name: /se alle/i });
    await expect(seeAllLink).toBeVisible({ timeout: 5_000 });

    const href = await seeAllLink.getAttribute("href");
    expect(href, "Se alle link href must start with /dashboard/komm").toMatch(/^\/dashboard\/komm/);
  });

  // ── J3-D: click top-1 preview navigates to thread URL ────────────────────

  test("J3-D — click top-1 preview navigates to /dashboard/komm/thread/<channelId>", async ({
    page,
  }) => {
    await loginAsAdmin(page, { skipOnboarding: true });
    await page.goto("/dashboard/help");
    await page.waitForLoadState("networkidle");

    const badge = page.locator('[data-testid="active-ticket-badge"]');
    await expect(badge).toBeVisible({ timeout: 15_000 });

    // Top-1 link: the first <a> inside the badge (before the "Se alle" link).
    // ActiveTicketBadge renders top-1 ActiveTicketBadgeLink first, then secondary.
    const links = badge.getByRole("link");
    const firstLink = links.first();
    await expect(firstLink).toBeVisible({ timeout: 5_000 });

    const href = await firstLink.getAttribute("href");
    expect(href, `top-1 link must be /dashboard/komm/thread/${mostRecentChannelId}`).toBe(
      `/dashboard/komm/thread/${mostRecentChannelId}`,
    );

    // Click and verify navigation
    await firstLink.click();
    await page.waitForURL(/\/dashboard\/komm\/thread\/[0-9a-f-]+/, { timeout: 15_000 });

    expect(page.url(), "URL must contain the most-recent channel ID").toContain(
      mostRecentChannelId,
    );
  });
});
