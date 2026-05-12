import { test, expect } from "@playwright/test";
import { loginAsAdmin, resolveAdminWorkspaceId } from "../helpers/auth";
import {
  supabase,
  seedProfile,
  cleanupSeededAuthUsers,
  getSeededAuthUserIds,
} from "../helpers/seed";

test.describe("Nyheter journey 1 — priority bump on announcement", () => {
  let workspaceId: string;
  // IDs of channel_message rows + profiles created during the test — cleaned up in afterEach
  const seededIds = { messages: [] as string[], profiles: [] as string[] };

  test.beforeEach(async () => {
    const wsId = await resolveAdminWorkspaceId();
    if (!wsId) throw new Error("E2E_EMAIL admin user has no workspace profile");
    workspaceId = wsId;
    // Reset per-test collectors
    seededIds.messages = [];
    seededIds.profiles = [];

    // Seed one active profile so audience-resolver "Alle" count > 0 and
    // the Publiser button is enabled when default "Alle" segment is selected.
    const recipient = await seedProfile(workspaceId, {
      display_name: "Journey 1 Recipient",
      role: "employee",
    });
    seededIds.profiles.push(recipient.profile_id);
  });

  test.afterEach(async () => {
    // Targeted cleanup — delete profiles before auth users (FK order).
    if (seededIds.profiles.length > 0) {
      await supabase.from("profile").delete().in("profile_id", seededIds.profiles);
    }
    await cleanupSeededAuthUsers(getSeededAuthUserIds());
    // Only remove what this test published, not admin's real data
    if (seededIds.messages.length > 0) {
      await supabase.from("channel_message").delete().in("id", seededIds.messages);
    }
  });

  test("announcement insert produces priority=1 + mode=work notifications", async ({ page }) => {
    const testStartedAt = new Date(Date.now() - 2000).toISOString();

    await loginAsAdmin(page);
    await page.goto("/dashboard/komm/nyheter");

    await page.getByRole("button", { name: /ny kunngjøring/i }).click();
    // Labels in the compose sheet are not htmlFor-linked; use placeholder text to target inputs.
    await page.getByPlaceholder(/nye rutiner/i).fill("Testkunngjøring");
    await page.getByPlaceholder(/skriv kunngjøringens/i).fill("Body content for priority test");
    await page.getByRole("button", { name: /publiser/i }).click();

    // Wait up to 15 s for the new announcement to appear in the feed.
    await expect(page.getByText("Testkunngjøring")).toBeVisible({ timeout: 15000 });

    // Capture the message id we just published so afterEach can clean it up.
    // Scope to the last 30 s to avoid picking up pre-existing rows.
    const { data: recentMessages } = await supabase
      .from("channel_message")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("message_type", "announcement")
      .gte("created_at", testStartedAt)
      .order("created_at", { ascending: false })
      .limit(5);

    for (const msg of recentMessages ?? []) {
      seededIds.messages.push(msg.id);
    }

    // Service-role assertion on notification_outbox.
    // Scope to rows created after test started to avoid collisions with existing outbox entries.
    const { data } = await supabase
      .from("notification_outbox")
      .select("priority, mode, metadata")
      .eq("workspace_id", workspaceId)
      .gte("scheduled_for", testStartedAt)
      .order("scheduled_for", { ascending: false })
      .limit(10);

    const announcementRow = (data ?? []).find(
      (r) => (r.metadata as { event_key?: string })?.event_key === "announcement.published",
    );
    expect(announcementRow).toBeDefined();
    expect(announcementRow?.priority).toBe(1);
    expect(announcementRow?.mode).toBe("work");
  });
});
