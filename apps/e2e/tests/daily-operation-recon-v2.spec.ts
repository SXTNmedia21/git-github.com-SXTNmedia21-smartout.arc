import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "../helpers/auth";
import { showStep } from "../helpers/show-step";

/**
 * Daily Operation Milestone 1 — recon-v2 E2E journeys.
 *
 * Exercises J1-J5 from docs/journeys/JOURNEY-daily-operation-recon-v2.md.
 * Each step calls showStep() to render a visible banner — makes a slow-mo
 * headed run watchable for a human.
 */

test.describe("Daily-operation recon-v2", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("J1 — List view rendrer med filter-chips + header-counters + CSV", async ({ page }) => {
    await showStep(page, "J1", "Navigerer til /dashboard/reconciliation");
    await page.goto("/dashboard/reconciliation");
    await page.waitForLoadState("networkidle");

    await showStep(page, "J1", "Sjekker at 'Avstemming' header rendres");
    await expect(page.getByText(/Avstemming/i).first()).toBeVisible({ timeout: 10000 });

    await showStep(page, "J1", "Verifiserer 3 header-counters (Venter / Klar / Låst)");
    await expect(page.getByText(/Venter oppgjør/i).first()).toBeVisible();
    await expect(page.getByText(/Klar til å låse/i).first()).toBeVisible();
    await expect(page.getByText(/^Låst$/i).first()).toBeVisible();

    await showStep(page, "J1", "Sjekker CSV-eksport-knapp er synlig");
    await expect(page.getByRole("button", { name: /Eksporter CSV/i })).toBeVisible();

    await showStep(page, "J1", "Verifiserer filter-chips (Alle + Venter oppgjør)");
    await expect(page.getByRole("button", { name: /^Alle$/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Venter oppgjør$/i })).toBeVisible();

    await showStep(page, "J1", "Klikker 'Venter oppgjør'-chip og verifiserer aria-pressed=true");
    const pendingChip = page.getByRole("button", { name: /^Venter oppgjør$/i });
    await pendingChip.click();
    await expect(pendingChip).toHaveAttribute("aria-pressed", "true");

    await showStep(page, "J1", "Nullstill-knapp skal nå være tilgjengelig");
    await expect(page.getByRole("button", { name: /Nullstill/i })).toBeVisible();

    await showStep(page, "J1", "✓ J1 Ferdig — List view rendrer korrekt", 1200);
  });

  test("J2+J3 — Detail view, preflight-gate, admin-override CTA", async ({ page }) => {
    await showStep(page, "J2+J3", "Navigerer til /dashboard/reconciliation");
    await page.goto("/dashboard/reconciliation");
    await page.waitForLoadState("networkidle");

    await showStep(page, "J2+J3", "Finner første rad via aria-label med dato-prefix");
    const firstRow = page.locator('button[aria-label*=". "]').first();
    const hasData = await firstRow.isVisible({ timeout: 5000 }).catch(() => false);

    if (!hasData) {
      await showStep(page, "J2+J3", "Ingen seeded data — verifiserer empty-state");
      await expect(
        page
          .getByText(/Ingen oppgjør registrert denne uka/i)
          .or(page.getByText(/Oppgjør genereres automatisk/i))
          .first(),
      ).toBeVisible();
      await showStep(page, "J2+J3", "✓ J2+J3 Skipped (no data) — empty-state OK", 1200);
      return;
    }

    await showStep(page, "J2+J3", "Klikker første rad for å åpne detail-view");
    await firstRow.click();
    await page.waitForLoadState("networkidle");

    await showStep(page, "J2+J3", "Verifiserer 'Admin-gjennomgang' label i detail-header");
    await expect(page.getByText(/Admin-gjennomgang/i)).toBeVisible({ timeout: 8000 });

    await showStep(
      page,
      "J2+J3",
      "Sjekker alle 6 tabs (Oversikt/Omsetning/Vakter/Avvik/Oppgaver/Revisjonslogg)",
    );
    await expect(page.getByRole("tab", { name: /Oversikt/i })).toBeVisible();
    await expect(page.getByRole("tab", { name: /Omsetning/i })).toBeVisible();
    await expect(page.getByRole("tab", { name: /Vakter/i })).toBeVisible();
    await expect(page.getByRole("tab", { name: /Avvik/i })).toBeVisible();
    await expect(page.getByRole("tab", { name: /Oppgaver/i })).toBeVisible();
    await expect(page.getByRole("tab", { name: /Revisjonslogg/i })).toBeVisible();

    await showStep(page, "J2+J3", "Approve-panel status-label synlig (Venter/Godkjent/Låst)");
    await expect(
      page
        .getByText(/Venter godkjenning/i)
        .or(page.getByText(/Godkjent/i))
        .or(page.getByText(/Dagen er låst/i))
        .first(),
    ).toBeVisible();

    const overrideBtn = page.getByRole("button", { name: /Overstyr og godkjenn/i });
    if (await overrideBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await showStep(page, "J3", "Preflight-blockers finnes — åpner AdminOverrideDialog");
      await overrideBtn.click();
      await expect(page.getByRole("heading", { name: /Overstyr preflight/i })).toBeVisible();

      await showStep(page, "J3", "Sjekker at Bekreft er disabled uten tilstrekkelig begrunnelse");
      const textarea = page.getByLabel(/Begrunnelse/i);
      await expect(textarea).toBeVisible();
      const confirmBtn = page.getByRole("button", { name: /Bekreft overstyring/i });
      await expect(confirmBtn).toBeDisabled();

      await showStep(page, "J3", "Fyller 37 tegn begrunnelse og verifiserer knapp blir enabled");
      await textarea.fill("Kompressor reparert av tekniker i dag");
      await expect(confirmBtn).toBeEnabled();

      await showStep(page, "J3", "Avbryter modal (unngår state-mutation i test)");
      await page.getByRole("button", { name: /Avbryt/i }).click();
      await expect(page.getByRole("heading", { name: /Overstyr preflight/i })).not.toBeVisible();
    } else {
      await showStep(page, "J3", "Ingen blockers — preflight-gate i klar-tilstand (grønn banner)");
    }

    await showStep(page, "J2+J3", "Tilbake-knapp til uke-oversikt skal være synlig");
    await expect(page.getByRole("button", { name: /Tilbake til uke-oversikt/i })).toBeVisible();

    await showStep(
      page,
      "J2+J3",
      "✓ J2+J3 Ferdig — detail + preflight + override verifisert",
      1200,
    );
  });

  test("J4 — CSV export downloads file with Norwegian locale headers", async ({ page }) => {
    await showStep(page, "J4", "Navigerer til /dashboard/reconciliation");
    await page.goto("/dashboard/reconciliation");
    await page.waitForLoadState("networkidle");

    await showStep(page, "J4", "Finner Eksporter CSV-knapp");
    const exportBtn = page.getByRole("button", { name: /Eksporter CSV/i });
    await expect(exportBtn).toBeVisible();

    const isDisabled = await exportBtn.isDisabled();
    if (isDisabled) {
      await showStep(page, "J4", "Knapp disabled — ingen data, eksport-flyt skippes", 1200);
      return;
    }

    await showStep(page, "J4", "Trykker Eksporter — venter på download-event");
    const [download] = await Promise.all([page.waitForEvent("download"), exportBtn.click()]);

    await showStep(page, "J4", `Fil mottatt: ${download.suggestedFilename()}`);
    expect(download.suggestedFilename()).toMatch(/avstemming-uke-\d+-\d{4}\.csv/);

    await showStep(page, "J4", "Leser CSV-innhold — verifiserer BOM + norske headers");
    const path = await download.path();
    expect(path).toBeTruthy();
    if (path) {
      const fs = await import("node:fs");
      const content = fs.readFileSync(path, "utf-8");
      expect(content).toMatch(/^\uFEFF/);
      expect(content).toContain("Dato");
      expect(content).toContain("Avdeling");
      expect(content).toContain("Omsetning");
      expect(content).toContain("Labor %");
    }

    await showStep(page, "J4", "✓ J4 Ferdig — CSV-eksport fungerer", 1200);
  });

  test("J5 — Revisjonslogg tab viser historikk (eller empty-state)", async ({ page }) => {
    await showStep(page, "J5", "Navigerer til /dashboard/reconciliation");
    await page.goto("/dashboard/reconciliation");
    await page.waitForLoadState("networkidle");

    await showStep(page, "J5", "Åpner første detail-rad");
    const firstRow = page.locator('button[aria-label*=". "]').first();
    const hasData = await firstRow.isVisible({ timeout: 5000 }).catch(() => false);

    if (!hasData) {
      await showStep(page, "J5", "Ingen data — J5 skipped", 1200);
      return;
    }

    await firstRow.click();
    await page.waitForLoadState("networkidle");

    await showStep(page, "J5", "Klikker Revisjonslogg-tab (tab 6)");
    const auditTab = page.getByRole("tab", { name: /Revisjonslogg/i });
    await auditTab.click();

    await showStep(page, "J5", "Verifiserer audit-list ELLER empty-state rendrer");
    await expect(
      page
        .getByText(/Ingen historikk registrert/i)
        .or(page.locator("[aria-label='Revisjonslogg']"))
        .first(),
    ).toBeVisible({ timeout: 5000 });

    await showStep(page, "J5", "✓ J5 Ferdig — Revisjonslogg fungerer", 1200);
  });
});
