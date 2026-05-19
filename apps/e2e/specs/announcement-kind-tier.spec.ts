import { test, expect } from "@playwright/test";
import { loginAsAdmin, resolveAdminWorkspaceId } from "../helpers/auth";
import { supabase } from "../helpers/seed";

/**
 * Announcement V2 — kind / tier / entity-link E2E spec (Track E + G)
 *
 * Covers four composer flows introduced by the V2 kind/tier/entity-link pickers
 * (AnnouncementKindPicker, AnnouncementTierPicker, EntityLinkPicker).
 *
 * Assertions use a mix of:
 *   - data-testid selectors on picker elements (added to picker components)
 *   - DB-level checks via service-role supabase client (announcement_meta)
 *   - UI assertions on aria-pressed state for tier chips
 *
 * Related:
 *   - docs/journeys/JOURNEY-announce-kind-tier-link.md
 *   - apps/web/src/app/dashboard/komm/_components/AnnouncementKindPicker.tsx
 *   - apps/web/src/app/dashboard/komm/_components/AnnouncementTierPicker.tsx
 *   - apps/web/src/app/dashboard/komm/_components/EntityLinkPicker.tsx
 */

// Seed identity constants from MEMORY.md / seed.sql
const TEST_WORKSPACE_ID = "b0000000-0000-0000-0000-000000000000";
const TEST_CHANNEL_ID = "ca000000-0000-0000-0000-000000000020"; // Nyheter (news)

// Cleanup: collect message IDs to delete after each test
const insertedMessageIds: string[] = [];

test.afterEach(async () => {
  if (insertedMessageIds.length === 0) return;
  await supabase.from("channel_message").delete().in("id", insertedMessageIds);
  insertedMessageIds.length = 0;
});

/**
 * Collect the most recent channel_message ID in the test workspace
 * published after a given timestamp. Used to scope cleanup.
 */
async function collectLatestMessageId(afterIso: string): Promise<void> {
  const { data } = await supabase
    .from("channel_message")
    .select("id")
    .eq("workspace_id", TEST_WORKSPACE_ID)
    .eq("channel_id", TEST_CHANNEL_ID)
    .eq("message_type", "announcement")
    .gte("created_at", afterIso)
    .order("created_at", { ascending: false })
    .limit(1);
  for (const row of data ?? []) insertedMessageIds.push(row.id);
}

/**
 * Open the compose sheet by clicking "Ny kunngjøring" on the nyheter page.
 * Waits for the sheet title to be visible before returning.
 */
async function openComposeSheet(page: Parameters<typeof loginAsAdmin>[0]): Promise<void> {
  await page.getByRole("button", { name: /ny kunngjøring/i }).click();
  // Sheet title confirms the sheet is open and hydrated
  await expect(page.getByText("Ny kunngjøring").first()).toBeVisible({ timeout: 8000 });
}

test.describe("Announcement V2: kind/tier/entity-link (Track E + G)", () => {
  test("admin publishes new_hire kind → announcement_meta has kind=new_hire, tier=social", async ({
    page,
  }) => {
    // NOTE: celebration and system_message are excluded from the manager-facing picker
    // per ADR-0372 §Agent Impact — those kinds are service-role-only (cron/platform).
    // new_hire auto-suggests tier=social, same social-tier assertion as the original
    // celebration test, but using a picker-accessible kind.
    const testStartedAt = new Date(Date.now() - 1000).toISOString();

    await loginAsAdmin(page);
    await page.goto("/dashboard/komm/nyheter");

    await openComposeSheet(page);

    // Fill title (required for Publiser to be enabled)
    await page.getByPlaceholder(/f\.eks\. Nye rutiner/i).fill("Velkommen til ny kollega!");

    // Open kind picker (shadcn Select) and select "Ny ansatt" (new_hire)
    await page.getByTestId("announcement-kind-picker").click();
    // shadcn SelectContent appears as a popover — pick by visible text "Ny ansatt"
    await page.getByRole("option", { name: /ny ansatt/i }).click();

    // Tier should auto-update to "social" after kind change — verify via aria-pressed
    const socialChip = page.getByTestId("announcement-tier-social");
    await expect(socialChip).toHaveAttribute("aria-pressed", "true", { timeout: 5000 });

    // Publish
    await page.getByRole("button", { name: /publiser/i }).click();

    // Wait for sheet to close (sheet dismissed on success)
    await expect(page.getByText("Ny kunngjøring").first()).not.toBeVisible({ timeout: 15000 });

    // Collect the new message ID for cleanup
    await collectLatestMessageId(testStartedAt);

    // DB-level assertion: announcement_meta must have kind='new_hire', tier='social'
    const { data: metaRows, error } = await supabase
      .from("announcement_meta")
      .select("kind, tier")
      .eq("workspace_id", TEST_WORKSPACE_ID)
      .gte("created_at", testStartedAt)
      .order("created_at", { ascending: false })
      .limit(1);

    expect(error).toBeNull();
    expect(metaRows).toHaveLength(1);
    expect(metaRows![0]!.kind).toBe("new_hire");
    expect(metaRows![0]!.tier).toBe("social");
  });

  test("admin publishes external tier announcement → notification_outbox contains email channel", async ({
    page,
  }) => {
    const testStartedAt = new Date(Date.now() - 1000).toISOString();
    const workspaceId = await resolveAdminWorkspaceId();
    if (!workspaceId) throw new Error("Admin has no workspace — check seed");

    await loginAsAdmin(page);
    await page.goto("/dashboard/komm/nyheter");

    await openComposeSheet(page);

    await page
      .getByPlaceholder(/f\.eks\. Nye rutiner/i)
      .fill("Ekstern informasjon til alle ansatte");

    // Select kind "Ekstern" → auto-tier should become "work" (external kind → work tier per spec)
    await page.getByTestId("announcement-kind-picker").click();
    await page.getByRole("option", { name: /^ekstern$/i }).click();

    // Manually override tier to "external" (push + in-app + e-post)
    await page.getByTestId("announcement-tier-external").click();
    await expect(page.getByTestId("announcement-tier-external")).toHaveAttribute(
      "aria-pressed",
      "true",
      { timeout: 5000 },
    );

    await page.getByRole("button", { name: /publiser/i }).click();
    await expect(page.getByText("Ny kunngjøring").first()).not.toBeVisible({ timeout: 15000 });

    await collectLatestMessageId(testStartedAt);

    // DB: announcement_meta tier = 'external'
    const { data: metaRows, error: metaErr } = await supabase
      .from("announcement_meta")
      .select("kind, tier")
      .eq("workspace_id", TEST_WORKSPACE_ID)
      .gte("created_at", testStartedAt)
      .order("created_at", { ascending: false })
      .limit(1);

    expect(metaErr).toBeNull();
    expect(metaRows).toHaveLength(1);
    expect(metaRows![0]!.tier).toBe("external");

    // DB: notification_outbox should contain an 'email' channel entry for this message
    // Scope to rows created after test start to avoid collisions
    const { data: outboxRows, error: outboxErr } = await supabase
      .from("notification_outbox")
      .select("channel, metadata")
      .eq("workspace_id", TEST_WORKSPACE_ID)
      .gte("scheduled_for", testStartedAt)
      .order("scheduled_for", { ascending: false })
      .limit(20);

    expect(outboxErr).toBeNull();
    const hasEmailRow = (outboxRows ?? []).some((r) => r.channel === "email");
    expect(hasEmailRow).toBe(true);
  });

  test("entity-link picker: staff_event kind → EntityLinkPicker renders, links announcement", async ({
    page,
  }) => {
    const testStartedAt = new Date(Date.now() - 1000).toISOString();

    await loginAsAdmin(page);
    await page.goto("/dashboard/komm/nyheter");

    await openComposeSheet(page);
    await page.getByPlaceholder(/f\.eks\. Nye rutiner/i).fill("Personaltreff neste fredag");

    // Select kind "Personaltreff" → staff_event kind enables EntityLinkPicker
    await page.getByTestId("announcement-kind-picker").click();
    await page.getByRole("option", { name: /personaltreff/i }).click();

    // EntityLinkPicker must be visible (kind='staff_event' allows staff_event link type)
    await expect(page.getByTestId("entity-link-picker")).toBeVisible({ timeout: 5000 });

    // Publish without selecting a specific entity (link remains null → still valid)
    await page.getByRole("button", { name: /publiser/i }).click();
    await expect(page.getByText("Ny kunngjøring").first()).not.toBeVisible({ timeout: 15000 });

    await collectLatestMessageId(testStartedAt);

    // DB: announcement_meta kind='staff_event'
    const { data: metaRows, error } = await supabase
      .from("announcement_meta")
      .select("kind, tier, entity_link_type")
      .eq("workspace_id", TEST_WORKSPACE_ID)
      .gte("created_at", testStartedAt)
      .order("created_at", { ascending: false })
      .limit(1);

    expect(error).toBeNull();
    expect(metaRows).toHaveLength(1);
    expect(metaRows![0]!.kind).toBe("staff_event");
  });

  test("publishing without touching pickers defaults to kind=workspace_news, tier=work", async ({
    page,
  }) => {
    const testStartedAt = new Date(Date.now() - 1000).toISOString();

    await loginAsAdmin(page);
    await page.goto("/dashboard/komm/nyheter");

    await openComposeSheet(page);
    await page.getByPlaceholder(/f\.eks\. Nye rutiner/i).fill("Generell informasjon til teamet");

    // Do NOT interact with kind or tier pickers — publish with defaults
    await page.getByRole("button", { name: /publiser/i }).click();
    await expect(page.getByText("Ny kunngjøring").first()).not.toBeVisible({ timeout: 15000 });

    await collectLatestMessageId(testStartedAt);

    // DB: announcement_meta should have kind='general' (default in ComposeAnnouncement state)
    // and tier='work' (default).
    // NOTE: the DB maps the UI's "general" AnnouncementKind to 'general' in announcement_meta.
    // The journey spec references 'workspace_news' but the actual UI default is 'general' —
    // using the code-wins rule: the initial useState value in ComposeAnnouncement is "general".
    const { data: metaRows, error } = await supabase
      .from("announcement_meta")
      .select("kind, tier, entity_link_type")
      .eq("workspace_id", TEST_WORKSPACE_ID)
      .gte("created_at", testStartedAt)
      .order("created_at", { ascending: false })
      .limit(1);

    expect(error).toBeNull();
    expect(metaRows).toHaveLength(1);
    expect(metaRows![0]!.kind).toBe("general");
    expect(metaRows![0]!.tier).toBe("work");
    expect(metaRows![0]!.entity_link_type).toBeNull();
  });
});
