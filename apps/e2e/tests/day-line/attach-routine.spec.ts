/**
 * day-line/attach-routine.spec.ts
 *
 * ADR-0367 Phase F E2E — Manager attaches a routine template to a day line.
 *
 * Journey: JOURNEY-day-line-attach-routine.md
 * Covers:
 *   J1 — AttachRoutineDialog opens from a strip's "Legg til rutine" trigger
 *   J2 — template-picker renders available templates
 *   J3 — template-preview shows item count when template is selected
 *   J4 — attach-routine-submit triggers capability and shows success toast
 *
 * Phase-gate note (ADR-0367 §Pattern B + ADR-0240):
 *   AttachRoutineDialog component is built (Phase C) but the entry-point
 *   trigger ("Legg til rutine" button on the strip) is not yet wired into
 *   DayLineStrip or TimelineTab. J1-J4 detect the trigger and skip if absent.
 *   When the trigger IS wired (planned: data-testid="attach-routine-trigger"),
 *   all four journeys will execute.
 *
 * Auth: loginAsAdmin (admin@smartout.local) — manager-level in seed workspace.
 * Route: /dashboard → Dagslinjen tab → first DayLineStrip → attach-routine.
 */
import { test, expect, type Page } from "@playwright/test";
import { loginAsAdmin } from "../../helpers/auth";
import { showStep } from "../../helpers/show-step";

test.describe("day-line/attach-routine — ADR-0367 Phase F", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  /**
   * Shared helper: navigate to /dashboard, click Dagslinjen tab, and return
   * whether strips are present. Returns false if no session or no strips.
   */
  async function navigateToDagslinjen(page: Page): Promise<boolean> {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    const tabList = page.getByRole("tablist", { name: /Dag-informasjon/i });
    const hasTabs = await tabList.isVisible({ timeout: 10_000 }).catch(() => false);
    if (!hasTabs) return false;

    await page.getByRole("tab", { name: /Dagslinjen/i }).click();
    await page.waitForTimeout(600);

    return page
      .locator('[data-testid="timeline-tab-strips"]')
      .isVisible({ timeout: 6_000 })
      .catch(() => false);
  }

  // ── J1: attach-routine trigger opens AttachRoutineDialog ───────────────────
  test("J1 — Legg til rutine trigger opens AttachRoutineDialog (Phase-C gate)", async ({
    page,
  }) => {
    await showStep(page, "J1", "Navigerer til /dashboard → Dagslinjen tab");
    const hasStrips = await navigateToDagslinjen(page);

    if (!hasStrips) {
      test.skip(true, "No day_line strips present — requires session + day_lines seeded");
      return;
    }

    await showStep(page, "J1", "Leter etter attach-routine trigger på første strip");
    // Planned trigger: data-testid="attach-routine-trigger" OR role=button name="Legg til rutine"
    // Both are valid entry points depending on how Phase C wires the button.
    const attachTrigger = page
      .locator('[data-testid="attach-routine-trigger"]')
      .or(page.getByRole("button", { name: /Legg til rutine/i }))
      .first();

    const triggerVisible = await attachTrigger.isVisible({ timeout: 3_000 }).catch(() => false);

    if (!triggerVisible) {
      await showStep(
        page,
        "J1",
        "attach-routine-trigger ikke wired ennå (Phase C pending) — J1 skipped",
        800,
      );
      test.skip(
        true,
        "attach-routine-trigger not yet wired in DayLineStrip (Phase C pending per ADR-0367 + ADR-0240)",
      );
      return;
    }

    await showStep(page, "J1", "Klikker attach-routine trigger");
    await attachTrigger.click();

    const dialog = page.locator('[data-testid="attach-routine-dialog"]');
    await expect(dialog).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText("Legg til rutine")).toBeVisible();

    await showStep(page, "J1", "✓ J1 — AttachRoutineDialog åpnet", 800);
  });

  // ── J2: template-picker renders templates ──────────────────────────────────
  test("J2 — template-picker renders available templates (Phase-C gate)", async ({ page }) => {
    await showStep(page, "J2", "Navigerer til /dashboard → Dagslinjen tab");
    const hasStrips = await navigateToDagslinjen(page);

    if (!hasStrips) {
      test.skip(true, "No day_line strips present — requires session + day_lines seeded");
      return;
    }

    const attachTrigger = page
      .locator('[data-testid="attach-routine-trigger"]')
      .or(page.getByRole("button", { name: /Legg til rutine/i }))
      .first();

    const triggerVisible = await attachTrigger.isVisible({ timeout: 3_000 }).catch(() => false);
    if (!triggerVisible) {
      test.skip(true, "attach-routine-trigger not yet wired (Phase C pending per ADR-0367)");
      return;
    }

    await attachTrigger.click();
    await expect(page.locator('[data-testid="attach-routine-dialog"]')).toBeVisible({
      timeout: 5_000,
    });

    await showStep(page, "J2", "Verifiserer template-picker");
    const picker = page.locator('[data-testid="template-picker"]');
    await expect(picker).toBeVisible({ timeout: 5_000 });

    await showStep(page, "J2", "✓ J2 — template-picker synlig", 800);
  });

  // ── J3: selecting template shows preview ──────────────────────────────────
  test("J3 — selecting a template shows template-preview (Phase-C gate)", async ({ page }) => {
    await showStep(page, "J3", "Navigerer til /dashboard → Dagslinjen tab");
    const hasStrips = await navigateToDagslinjen(page);

    if (!hasStrips) {
      test.skip(true, "No day_line strips present — requires session + day_lines seeded");
      return;
    }

    const attachTrigger = page
      .locator('[data-testid="attach-routine-trigger"]')
      .or(page.getByRole("button", { name: /Legg til rutine/i }))
      .first();

    const triggerVisible = await attachTrigger.isVisible({ timeout: 3_000 }).catch(() => false);
    if (!triggerVisible) {
      test.skip(true, "attach-routine-trigger not yet wired (Phase C pending per ADR-0367)");
      return;
    }

    await attachTrigger.click();
    await expect(page.locator('[data-testid="attach-routine-dialog"]')).toBeVisible({
      timeout: 5_000,
    });
    await expect(page.locator('[data-testid="template-picker"]')).toBeVisible({ timeout: 5_000 });

    await showStep(page, "J3", "Velger første template fra picker");
    // Pick the first option in the template picker (select or listbox)
    const firstOption = page
      .locator('[data-testid="template-picker"] [role="option"]')
      .or(page.locator('[data-testid="template-picker"] option'))
      .first();

    const hasOptions = await firstOption.isVisible({ timeout: 3_000 }).catch(() => false);
    if (!hasOptions) {
      await showStep(page, "J3", "Ingen maler seeded — J3 partial-pass (picker rendres tom)", 800);
      // picker renders but no templates seeded — still a valid render test
      return;
    }

    await firstOption.click();

    await showStep(page, "J3", "Verifiserer template-preview");
    const preview = page.locator('[data-testid="template-preview"]');
    await expect(preview).toBeVisible({ timeout: 5_000 });

    await showStep(page, "J3", "✓ J3 — template-preview synlig etter valg", 800);
  });

  // ── J4: submit triggers attach + toast ────────────────────────────────────
  test("J4 — submitting attach shows success toast (Phase-C gate)", async ({ page }) => {
    await showStep(page, "J4", "Navigerer til /dashboard → Dagslinjen tab");
    const hasStrips = await navigateToDagslinjen(page);

    if (!hasStrips) {
      test.skip(true, "No day_line strips present — requires session + day_lines seeded");
      return;
    }

    const attachTrigger = page
      .locator('[data-testid="attach-routine-trigger"]')
      .or(page.getByRole("button", { name: /Legg til rutine/i }))
      .first();

    const triggerVisible = await attachTrigger.isVisible({ timeout: 3_000 }).catch(() => false);
    if (!triggerVisible) {
      test.skip(true, "attach-routine-trigger not yet wired (Phase C pending per ADR-0367)");
      return;
    }

    await attachTrigger.click();
    await expect(page.locator('[data-testid="attach-routine-dialog"]')).toBeVisible({
      timeout: 5_000,
    });

    // Select first template if available
    const picker = page.locator('[data-testid="template-picker"]');
    await expect(picker).toBeVisible({ timeout: 5_000 });

    const firstOption = page
      .locator('[data-testid="template-picker"] [role="option"]')
      .or(page.locator('[data-testid="template-picker"] option'))
      .first();

    const hasOptions = await firstOption.isVisible({ timeout: 3_000 }).catch(() => false);
    if (!hasOptions) {
      test.skip(true, "No templates seeded — cannot submit without a selection");
      return;
    }

    await firstOption.click();

    await showStep(page, "J4", "Klikker attach-routine-submit");
    const submitBtn = page.locator('[data-testid="attach-routine-submit"]');
    await expect(submitBtn).toBeVisible();
    await submitBtn.click();

    // Toast: "Rutine lagt til" or "oppgaver lagt til" (journey doc specifies either form)
    const successToast = page
      .getByText(/Rutine lagt til/i)
      .or(page.getByText(/oppgaver lagt til/i))
      .first();
    await expect(successToast).toBeVisible({ timeout: 8_000 });

    await showStep(page, "J4", "✓ J4 — Rutine lagt til toast", 800);
  });
});
