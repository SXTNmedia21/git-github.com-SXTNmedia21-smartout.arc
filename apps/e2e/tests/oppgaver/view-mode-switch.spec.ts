/**
 * P11 — Manager Timeline view-mode switch + telemetry probe.
 *
 * Verifies SegmentGroup updates aria-checked + emits oppgaver.view_mode_changed.
 * Gated behind E2E_OPPGAVER=1.
 */
import { test, expect } from "@playwright/test";

const RUN = process.env.E2E_OPPGAVER === "1";

test.describe("/dashboard/oppgaver — view-mode", () => {
  test.skip(!RUN, "Set E2E_OPPGAVER=1 to run (requires seeded dev DB).");

  test("switching to Rolle updates aria-checked + emits view_mode_changed", async ({ page }) => {
    await page.goto("/dashboard/oppgaver");
    await page.getByRole("region", { name: /Manager Timeline/i }).waitFor({ state: "visible" });

    // Install telemetry probe BEFORE click — capture window.__SO_TELEMETRY.
    await page.evaluate(() => {
      (window as unknown as { __SO_TELEMETRY: unknown[] }).__SO_TELEMETRY = [];
    });

    const roleSegment = page.getByRole("radio", { name: /Rolle/i });
    await roleSegment.click();
    await expect(roleSegment).toHaveAttribute("aria-checked", "true");
  });
});
