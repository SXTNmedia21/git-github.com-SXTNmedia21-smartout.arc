import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "../helpers/auth";
import { supabase, seedWorkspace } from "../helpers/seed";
import { cleanupTestData } from "../helpers/cleanup";

test.describe("Nyheter journey 1 — priority bump on announcement", () => {
  let workspaceId: string;

  test.beforeEach(async () => {
    const ws = await seedWorkspace({ name: "Strøm Mat & Bar", slug: "strom-mat-og-bar" });
    workspaceId = ws.workspace_id;
  });

  test.afterEach(async () => {
    await cleanupTestData(workspaceId);
  });

  test("announcement insert produces priority=1 + mode=work notifications", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/dashboard/komm/nyheter");

    await page.getByRole("button", { name: /ny kunngjøring/i }).click();
    await page.getByLabel(/tittel/i).fill("Testkunngjøring");
    await page.getByLabel(/melding/i).fill("Body content for priority test");
    await page.getByRole("button", { name: /publiser/i }).click();

    await expect(page.getByText("Testkunngjøring")).toBeVisible();

    // Verify notification_outbox row priority=1, mode=work
    // (supabase is the service-role client exported from helpers/seed.ts)
    const { data } = await supabase
      .from("notification_outbox")
      .select("priority, mode, metadata")
      .eq("workspace_id", workspaceId)
      .order("scheduled_for", { ascending: false })
      .limit(5);

    const announcementRow = (data ?? []).find(
      (r) => (r.metadata as { event_key?: string })?.event_key === "announcement.published",
    );
    expect(announcementRow).toBeDefined();
    expect(announcementRow?.priority).toBe(1);
    expect(announcementRow?.mode).toBe("work");
  });
});
