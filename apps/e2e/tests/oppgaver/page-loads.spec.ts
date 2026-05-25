/**
 * P11 — Manager Timeline /dashboard/oppgaver smoke E2E.
 *
 * V1 acceptance: page mounts with TopBar + Toolbar + Chart shell for
 * manager/admin/owner. Employee profiles redirect to /dashboard/my-schedule
 * (enforced by ADMIN_ONLY_PATH_PREFIXES guard in dashboard/layout.tsx).
 *
 * Local-only by default — gated behind `process.env.E2E_OPPGAVER === "1"`
 * because the dev DB needs day_line + session_task seed rows for the chart
 * to render anything non-empty. CI runs this when seed lifecycle lands
 * (separate sortie).
 */
import { test, expect } from "@playwright/test";

const RUN = process.env.E2E_OPPGAVER === "1";

test.describe("/dashboard/oppgaver", () => {
  test.skip(!RUN, "Set E2E_OPPGAVER=1 to run (requires seeded dev DB).");

  test("manager profile loads page with TopBar + Toolbar + Chart", async ({ page }) => {
    await page.goto("/dashboard/oppgaver");
    await expect(page.getByRole("region", { name: /Manager Timeline/i })).toBeVisible();
    await expect(page.getByText("Dagslinjen")).toBeVisible();
    await expect(page.getByRole("radiogroup").first()).toBeVisible();
  });
});
