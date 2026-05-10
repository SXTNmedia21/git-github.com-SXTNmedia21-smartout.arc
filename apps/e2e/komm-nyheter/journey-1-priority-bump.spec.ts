import { test, expect } from "@playwright/test";
import { loginAsAdmin, resolveAdminWorkspaceId } from "../helpers/auth";
import { supabase } from "../helpers/seed";

test.describe("Nyheter journey 1 — priority bump on announcement", () => {
  let workspaceId: string;
  // IDs of channel_message rows created during the test — cleaned up in afterEach
  const seededIds = { messages: [] as string[] };

  test.beforeEach(async () => {
    const wsId = await resolveAdminWorkspaceId();
    if (!wsId) throw new Error("E2E_EMAIL admin user has no workspace profile");
    workspaceId = wsId;
    // Reset per-test collector
    seededIds.messages = [];
  });

  test.afterEach(async () => {
    // Targeted cleanup — only remove what this test published, not admin's real data
    if (seededIds.messages.length > 0) {
      await supabase.from("channel_message").delete().in("id", seededIds.messages);
    }
  });

  test("announcement insert produces priority=1 + mode=work notifications", async ({ page }) => {
    const testStartedAt = new Date(Date.now() - 2000).toISOString();

    await loginAsAdmin(page);
    await page.goto("/dashboard/komm/nyheter");

    await page.getByRole("button", { name: /ny kunngjøring/i }).click();
    await page.getByLabel(/tittel/i).fill("Testkunngjøring");
    await page.getByLabel(/melding/i).fill("Body content for priority test");
    await page.getByRole("button", { name: /publiser/i }).click();

    await expect(page.getByText("Testkunngjøring")).toBeVisible();

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
