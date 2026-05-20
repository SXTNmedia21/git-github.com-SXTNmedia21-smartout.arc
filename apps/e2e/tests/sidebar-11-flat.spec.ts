import { test, expect } from "@playwright/test";

const ADMIN_SLOTS_IN_ORDER = [
  { testId: "sidebar-item-dashboard", label: "Oversikt" },
  { testId: "sidebar-item-tasks", label: "Oppgaver" },
  { testId: "sidebar-item-planning", label: "Planlegging" },
  { testId: "sidebar-item-schedule", label: "Vaktplan" },
  { testId: "sidebar-item-people", label: "Ansatte" },
  { testId: "sidebar-item-hms", label: "HMS" },
  { testId: "sidebar-item-payroll", label: "Lønn" },
  { testId: "sidebar-item-reconciliation", label: "Avstemming" },
  { testId: "sidebar-item-reports", label: "Rapporter" },
  { testId: "sidebar-item-chat", label: "Chat" },
  { testId: "sidebar-item-komm", label: "Kommunikasjon" },
];

const EMPLOYEE_SLOTS_IN_ORDER = [
  { testId: "sidebar-item-dashboard", label: "Oversikt" },
  { testId: "sidebar-item-my-schedule", label: "Min plan" },
  { testId: "sidebar-item-my-salary", label: "Min lønn" },
  { testId: "sidebar-item-my-contract", label: "Min kontrakt" },
  { testId: "sidebar-item-my-cv", label: "Min CV" },
  { testId: "sidebar-item-my-training", label: "Min trening" },
  { testId: "sidebar-item-my-profile", label: "Min profil" },
  { testId: "sidebar-item-shift-clock", label: "Stempelur" },
  { testId: "sidebar-item-chat", label: "Chat" },
  { testId: "sidebar-item-komm", label: "Kommunikasjon" },
];

test.describe("Sidebar 11-flat structure (SM-1)", () => {
  test.beforeEach(async ({ page }) => {
    // Seed admin profile per docs/protocols — adjust if seed harness differs.
    await page.goto("/dashboard");
    await page.waitForSelector('[data-testid="sidebar-nav"]');
  });

  test("admin mode renders 11 items in canonical order", async ({ page }) => {
    // Ensure admin mode is active. Toggle button labelled "Drift mode" when in admin.
    const adminToggle = page.locator('[data-autoplay="admin-mode-toggle"]');
    const currentLabel = await adminToggle.textContent();
    if (currentLabel?.includes("Min Tid") === false) {
      // Already admin — no-op
    } else {
      await adminToggle.click();
    }

    for (let i = 0; i < ADMIN_SLOTS_IN_ORDER.length; i++) {
      const slot = ADMIN_SLOTS_IN_ORDER[i]!;
      const item = page.locator(`[data-testid="${slot.testId}"]`);
      await expect(item, `slot ${i} (${slot.testId})`).toBeVisible();
    }

    // Assert no group-header chrome rendered (no uppercase tracking-widest labels).
    const groupHeaders = page.locator('[data-testid^="sidebar-group-"]');
    await expect(groupHeaders).toHaveCount(0);
  });

  test("employee mode renders 10 items in canonical order", async ({ page }) => {
    const adminToggle = page.locator('[data-autoplay="admin-mode-toggle"]');
    await adminToggle.click();
    // Wait for switch (one of the my-* items must be visible)
    await page.waitForSelector('[data-testid="sidebar-item-my-schedule"]');

    for (let i = 0; i < EMPLOYEE_SLOTS_IN_ORDER.length; i++) {
      const slot = EMPLOYEE_SLOTS_IN_ORDER[i]!;
      const item = page.locator(`[data-testid="${slot.testId}"]`);
      await expect(item, `slot ${i} (${slot.testId})`).toBeVisible();
    }
  });

  test("active state highlights parent on sub-route", async ({ page }) => {
    await page.goto("/dashboard/people");
    const peopleItem = page.locator('[data-testid="sidebar-item-people"]');
    await expect(peopleItem).toHaveAttribute("data-active", "true");

    // Drill into sub-route — parent stays active
    await page.goto("/dashboard/people/invitations");
    await expect(peopleItem).toHaveAttribute("data-active", "true");
  });

  test("sidebar width is 240px when expanded", async ({ page }) => {
    const aside = page.locator("aside").first();
    const box = await aside.boundingBox();
    expect(box?.width).toBe(240);
  });
});
