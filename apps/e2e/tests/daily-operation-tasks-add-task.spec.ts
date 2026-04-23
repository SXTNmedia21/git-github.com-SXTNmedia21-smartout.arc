import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "../helpers/auth";
import { showStep } from "../helpers/show-step";

/**
 * J-CLOSURE-2 — Admin legger til oppgave manuelt (AddTaskDialog).
 *
 * Covers:
 *   - Oppgaver-tab renders CTA when no hooks / tasks exist
 *   - AddTaskDialog opens, fields present
 *   - Validation: submit blocked when reason < 8 chars or title empty
 *   - Happy path: filled form reaches enabled "Lagre oppgave" state
 *
 * Tests avoid actual mutation (Avbryt is clicked) to keep the DB clean.
 * Graceful skip when workspace has no dept or session.
 */
test.describe("J-CLOSURE-2 — Admin legger til oppgave manuelt", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("J-C2-a — AddTaskDialog åpnes fra Oppgaver-tab", async ({ page }) => {
    await showStep(page, "J-C2-a", "Navigerer til /dashboard");
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    await showStep(page, "J-C2-a", "Venter på WebDayControl shell");
    const shellReady = page
      .getByRole("tablist", { name: /Dag-informasjon/i })
      .or(page.getByRole("heading", { name: /Ingen avdeling knyttet/i }))
      .first();
    await expect(shellReady).toBeVisible({ timeout: 15000 });

    const noDept = await page
      .getByRole("heading", { name: /Ingen avdeling knyttet/i })
      .isVisible({ timeout: 500 })
      .catch(() => false);
    if (noDept) {
      await showStep(page, "J-C2-a", "Ingen avdeling — skipped", 1200);
      return;
    }

    const hasSession = await page
      .getByRole("tablist", { name: /Dag-informasjon/i })
      .isVisible({ timeout: 500 })
      .catch(() => false);
    if (!hasSession) {
      await showStep(
        page,
        "J-C2-a",
        "Ingen session — skipped (AddTaskDialog requires session)",
        1200,
      );
      return;
    }

    await showStep(page, "J-C2-a", "Klikker Oppgaver-tab");
    await page.getByRole("tab", { name: /Oppgaver/i }).click();
    await expect(page.getByRole("tab", { name: /Oppgaver/i })).toHaveAttribute(
      "aria-selected",
      "true",
    );

    await showStep(page, "J-C2-a", "Venter på tasks-innhold (sekunder for hydration)");
    await page.waitForTimeout(1500);

    await showStep(page, "J-C2-a", "Klikker 'Legg til oppgave'-knapp");
    const addBtn = page.getByRole("button", { name: /Legg til oppgave/i }).first();
    await expect(addBtn).toBeVisible({ timeout: 10000 });
    await addBtn.click();

    await showStep(page, "J-C2-a", "Verifiserer AddTaskDialog er åpen");
    await expect(page.getByRole("heading", { name: /Legg til oppgave/i }).first()).toBeVisible({
      timeout: 5000,
    });
    await expect(page.locator("#new-task-title")).toBeVisible();
    await expect(page.locator("#new-task-reason")).toBeVisible();
    await expect(page.getByRole("button", { name: /Lagre oppgave/i })).toBeVisible();

    await showStep(page, "J-C2-a", "✓ AddTaskDialog åpner korrekt");
    await page.getByRole("button", { name: /Avbryt/i }).click();
  });

  test("J-C2-b — Validering: Lagre oppgave blokkert uten tittel og uten begrunnelse", async ({
    page,
  }) => {
    await showStep(page, "J-C2-b", "Navigerer til /dashboard → Oppgaver-tab");
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    const noDept = await page
      .getByRole("heading", { name: /Ingen avdeling knyttet/i })
      .isVisible({ timeout: 500 })
      .catch(() => false);
    if (noDept) {
      await showStep(page, "J-C2-b", "Ingen avdeling — skipped", 1200);
      return;
    }

    const hasSession = await page
      .getByRole("tablist", { name: /Dag-informasjon/i })
      .isVisible({ timeout: 500 })
      .catch(() => false);
    if (!hasSession) {
      await showStep(page, "J-C2-b", "Ingen session — skipped", 1200);
      return;
    }

    await page.getByRole("tab", { name: /Oppgaver/i }).click();
    await page.waitForTimeout(1500);

    const addBtn = page.getByRole("button", { name: /Legg til oppgave/i }).first();
    await expect(addBtn).toBeVisible({ timeout: 10000 });
    await addBtn.click();

    const saveBtn = page.getByRole("button", { name: /Lagre oppgave/i });
    await expect(saveBtn).toBeVisible({ timeout: 5000 });

    await showStep(page, "J-C2-b", "Verifiserer Lagre oppgave disabled med tom skjema");
    await expect(saveBtn).toBeDisabled();

    await showStep(page, "J-C2-b", "Fyller tittel men IKKE begrunnelse → fortsatt disabled");
    await page.locator("#new-task-title").fill("Kontroll av kjeøkken");
    await expect(saveBtn).toBeDisabled();

    await showStep(page, "J-C2-b", "Fyller begrunnelse < 8 tegn → fortsatt disabled");
    await page.locator("#new-task-reason").fill("kort");
    await expect(saveBtn).toBeDisabled();
    await expect(page.getByText(/tegn igjen før du kan lagre/i)).toBeVisible();

    await showStep(page, "J-C2-b", "Fyller gyldig begrunnelse (8+ tegn) → enabled");
    await page.locator("#new-task-reason").fill("Ekstra kontroll etter kundeklage kl. 18.");
    await expect(saveBtn).toBeEnabled();
    await expect(page.getByText(/Klar til å lagre/i)).toBeVisible();

    await showStep(page, "J-C2-b", "✓ Validering fungerer — avbryter");
    await page.getByRole("button", { name: /Avbryt/i }).click();
  });
});
