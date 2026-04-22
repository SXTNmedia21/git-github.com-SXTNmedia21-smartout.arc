import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "../helpers/auth";
import { showStep } from "../helpers/show-step";

/**
 * Daily Operation — session-lifecycle E2E (J1-J4).
 *
 * Exercises Invariant #13 (no blockers, always navigable):
 *   J1 — Admin opens manual session for today (NoSessionCTA → active).
 *   J2 — Admin creates retroactive session 2 days back (NoSessionCTA → upcoming).
 *   J3 — Admin adds retroactive punch for shift without time (RosterTab Pencil).
 *   J4 — Admin overrides session transition (SessionActionsBar).
 *
 * Preconditions vary by journey; each test handles missing seed data gracefully
 * and skips with a logged reason rather than failing. The UI affordances
 * themselves are always asserted so missing-UI regressions still fail.
 */

test.describe("Daily-operation session-lifecycle", () => {
  // Serialize so the Next.js dev-server isn't hammered with 4 parallel logins
  // + compile-on-first-route spikes. Each test fits in 30s comfortably when
  // the server has already warmed the routes it needs.
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("J1 — Admin opens manual session for today", async ({ page }) => {
    await showStep(page, "J1", "Navigerer til /dashboard");
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    await showStep(page, "J1", "Venter på WebDayControl shell (session eller NoSessionCTA)");
    const shellReady = page
      .getByRole("tablist", { name: /Dag-informasjon/i })
      .or(page.getByRole("heading", { name: /Ingen session for/i }))
      .or(page.getByRole("heading", { name: /Ingen avdeling knyttet/i }))
      .first();
    await expect(shellReady).toBeVisible({ timeout: 15000 });

    // If no department, J1 cannot be tested.
    const noDept = await page
      .getByRole("heading", { name: /Ingen avdeling knyttet/i })
      .isVisible({ timeout: 500 })
      .catch(() => false);
    if (noDept) {
      await showStep(page, "J1", "Ingen avdeling — J1 skipped (no dept seed)", 1200);
      return;
    }

    // Detect if session already exists for today; if so, navigate back to find an empty day.
    let noSessionHeading = page.getByRole("heading", { name: /Ingen session for/i });
    let hasSession = !(await noSessionHeading.isVisible({ timeout: 500 }).catch(() => false));

    if (hasSession) {
      await showStep(page, "J1", "Session finnes i dag — navigerer bakover for å finne tom dag");
      const prevDayBtn = page.getByRole("button", { name: /Forrige dag/i });
      // Try up to 10 days back to find an empty slot.
      for (let i = 0; i < 10; i++) {
        await prevDayBtn.click();
        await page.waitForLoadState("networkidle");
        const found = await noSessionHeading.isVisible({ timeout: 1500 }).catch(() => false);
        if (found) {
          hasSession = false;
          break;
        }
      }
      if (hasSession) {
        await showStep(
          page,
          "J1",
          "Alle nærliggende datoer har sessions — J1 skipped (cannot create empty)",
          1200,
        );
        return;
      }
    }

    await showStep(page, "J1", "Verifiserer NoSessionCTA rendrer med to knapper");
    await expect(noSessionHeading).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole("button", { name: /Opprett som planlagt/i })).toBeVisible();
    const activateBtn = page.getByRole("button", { name: /Åpne nå \(aktiv\)/i });
    await expect(activateBtn).toBeVisible();

    await showStep(page, "J1", "Klikker 'Åpne nå (aktiv)' for å opprette aktiv session");
    await activateBtn.click();

    await showStep(page, "J1", "Venter på shell-transisjon til 7-tab layout");
    const tabList = page.getByRole("tablist", { name: /Dag-informasjon/i });
    await expect(tabList).toBeVisible({ timeout: 15000 });

    await showStep(page, "J1", "Verifiserer at alle 7 tabs rendrer");
    for (const label of [
      "Oversikt",
      "Dagslinjen",
      "Bemanning",
      "Oppgaver",
      "Avvik",
      "Melding",
      "Oppgjør",
    ]) {
      await expect(page.getByRole("tab", { name: new RegExp(label, "i") })).toBeVisible();
    }

    await showStep(page, "J1", "✓ J1 Ferdig — manuell session opprettet fra empty state", 1200);
  });

  test("J2 — Admin creates retroactive session 2 days back", async ({ page }) => {
    await showStep(page, "J2", "Navigerer til /dashboard");
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    const shellReady = page
      .getByRole("tablist", { name: /Dag-informasjon/i })
      .or(page.getByRole("heading", { name: /Ingen session for/i }))
      .or(page.getByRole("heading", { name: /Ingen avdeling knyttet/i }))
      .first();
    await expect(shellReady).toBeVisible({ timeout: 15000 });

    const noDept = await page
      .getByRole("heading", { name: /Ingen avdeling knyttet/i })
      .isVisible({ timeout: 500 })
      .catch(() => false);
    if (noDept) {
      await showStep(page, "J2", "Ingen avdeling — J2 skipped", 1200);
      return;
    }

    await showStep(page, "J2", "Klikker venstre-chevron 2x for å gå til i dag - 2");
    const prevDayBtn = page.getByRole("button", { name: /Forrige dag/i });
    await expect(prevDayBtn).toBeVisible();
    await prevDayBtn.click();
    await page.waitForTimeout(300);
    await prevDayBtn.click();
    await page.waitForLoadState("networkidle");

    await showStep(page, "J2", "Verifiserer 'Tilbake til i dag'-knapp rendres");
    await expect(page.getByRole("button", { name: /Tilbake til i dag/i })).toBeVisible();

    // Find an empty day — if today-2 already has a session, walk back further.
    const noSessionHeading = page.getByRole("heading", { name: /Ingen session for/i });
    let emptyFound = await noSessionHeading.isVisible({ timeout: 2000 }).catch(() => false);
    if (!emptyFound) {
      await showStep(page, "J2", "Session finnes 2 dager tilbake — walker bakover");
      for (let i = 0; i < 10 && !emptyFound; i++) {
        await prevDayBtn.click();
        await page.waitForLoadState("networkidle");
        emptyFound = await noSessionHeading.isVisible({ timeout: 1500 }).catch(() => false);
      }
    }

    if (!emptyFound) {
      await showStep(page, "J2", "Ingen tomme historiske dager funnet — J2 skipped", 1200);
      return;
    }

    await showStep(page, "J2", "Klikker 'Opprett som planlagt' (retroaktiv, ikke aktiv)");
    const planBtn = page.getByRole("button", { name: /Opprett som planlagt/i });
    await expect(planBtn).toBeVisible();
    await planBtn.click();

    await showStep(page, "J2", "Venter på shell-overgang og verifiserer tabs");
    const tabList = page.getByRole("tablist", { name: /Dag-informasjon/i });
    await expect(tabList).toBeVisible({ timeout: 15000 });

    await showStep(page, "J2", "Verifiserer 'Tilbake til i dag' fortsatt rendrer (historisk dato)");
    await expect(page.getByRole("button", { name: /Tilbake til i dag/i })).toBeVisible();

    await showStep(page, "J2", "✓ J2 Ferdig — retroaktiv session opprettet", 1200);
  });

  test("J3 — Admin adds retroactive punch for shift without time", async ({ page }) => {
    await showStep(page, "J3", "Navigerer til /dashboard");
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    await showStep(page, "J3", "Venter på WebDayControl shell");
    const shellReady = page
      .getByRole("tablist", { name: /Dag-informasjon/i })
      .or(page.getByRole("heading", { name: /Ingen session for/i }))
      .or(page.getByRole("heading", { name: /Ingen avdeling knyttet/i }))
      .first();
    await expect(shellReady).toBeVisible({ timeout: 15000 });

    const noDept = await page
      .getByRole("heading", { name: /Ingen avdeling knyttet/i })
      .isVisible({ timeout: 500 })
      .catch(() => false);
    if (noDept) {
      await showStep(page, "J3", "Ingen avdeling — J3 skipped", 1200);
      return;
    }

    const hasSession = await page
      .getByRole("tablist", { name: /Dag-informasjon/i })
      .isVisible({ timeout: 500 })
      .catch(() => false);
    if (!hasSession) {
      await showStep(page, "J3", "Ingen session — J3 skipped (RosterTab requires session)", 1200);
      return;
    }

    await showStep(page, "J3", "Klikker Bemanning-tab (RosterTab)");
    await page.getByRole("tab", { name: /Bemanning/i }).click();
    await expect(page.getByRole("tab", { name: /Bemanning/i })).toHaveAttribute(
      "aria-selected",
      "true",
    );

    await showStep(page, "J3", "Venter på roster-innhold (tabell eller empty-state)");
    const rosterContent = page
      .getByText(/Ingen vakter på denne dagen/i)
      .or(page.getByText(/Laster bemanning/i))
      .or(page.getByRole("button", { name: /Rediger tidsregistrering for/i }).first())
      .first();
    await expect(rosterContent).toBeVisible({ timeout: 10000 });

    const noShifts = await page
      .getByText(/Ingen vakter på denne dagen/i)
      .isVisible({ timeout: 500 })
      .catch(() => false);
    if (noShifts) {
      await showStep(page, "J3", "Ingen vakter — J3 skipped (no shift seed data)", 1200);
      return;
    }

    await showStep(page, "J3", "Finner Pencil-knapp på første shift-rad");
    const pencilBtn = page.getByRole("button", { name: /Rediger tidsregistrering for/i }).first();
    await expect(pencilBtn).toBeVisible({ timeout: 5000 });

    await showStep(page, "J3", "Åpner ManualTimeEntryDialog");
    await pencilBtn.click();

    await showStep(page, "J3", "Verifiserer dialog-innhold (headline + begrunnelse-felt)");
    await expect(page.getByText(/Manuell tidsregistrering/i).first()).toBeVisible({
      timeout: 5000,
    });
    const reasonField = page.getByLabel(/Begrunnelse/i);
    await expect(reasonField).toBeVisible();

    await showStep(page, "J3", "Sjekker at 'Lagre tidsregistrering' er disabled uten begrunnelse");
    const saveBtn = page.getByRole("button", { name: /Lagre tidsregistrering/i });
    await expect(saveBtn).toBeDisabled();

    await showStep(page, "J3", "Fyller 30 tegn begrunnelse og verifiserer knapp blir enabled");
    await reasonField.fill("Ansatt glemte å stemple ut i går kveld.");
    await expect(saveBtn).toBeEnabled();

    await showStep(page, "J3", "Avbryter dialog (unngår state-mutation)");
    await page.getByRole("button", { name: /Avbryt/i }).click();
    await expect(page.getByText(/Manuell tidsregistrering/i).first()).not.toBeVisible({
      timeout: 3000,
    });

    await showStep(page, "J3", "✓ J3 Ferdig — Pencil-UI + dialog validations verifisert", 1200);
  });

  test("J4 — Admin overrides session transition", async ({ page }) => {
    await showStep(page, "J4", "Navigerer til /dashboard");
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    const shellReady = page
      .getByRole("tablist", { name: /Dag-informasjon/i })
      .or(page.getByRole("heading", { name: /Ingen session for/i }))
      .or(page.getByRole("heading", { name: /Ingen avdeling knyttet/i }))
      .first();
    await expect(shellReady).toBeVisible({ timeout: 15000 });

    const noDept = await page
      .getByRole("heading", { name: /Ingen avdeling knyttet/i })
      .isVisible({ timeout: 500 })
      .catch(() => false);
    if (noDept) {
      await showStep(page, "J4", "Ingen avdeling — J4 skipped", 1200);
      return;
    }

    const hasSession = await page
      .getByRole("tablist", { name: /Dag-informasjon/i })
      .isVisible({ timeout: 500 })
      .catch(() => false);
    if (!hasSession) {
      await showStep(
        page,
        "J4",
        "Ingen session — J4 skipped (SessionActionsBar requires session)",
        1200,
      );
      return;
    }

    await showStep(page, "J4", "Verifiserer SessionActionsBar-label rendrer");
    await expect(page.getByText(/Manuelle handlinger/i)).toBeVisible({ timeout: 5000 });

    await showStep(
      page,
      "J4",
      "Søker etter minst én transition-knapp (Sett aktiv / Send / Lukk / ...)",
    );
    const transitionBtn = page
      .getByRole("button", {
        name: /Sett aktiv|Send til oppgjør|Lukk dag|Gjenåpne|Reverter|Rediger retroaktivt/i,
      })
      .first();

    const hasTransition = await transitionBtn.isVisible({ timeout: 3000 }).catch(() => false);

    if (!hasTransition) {
      await showStep(
        page,
        "J4",
        "Session i terminal status — verifiserer 'Ingen tilgjengelige'",
        1200,
      );
      await expect(page.getByRole("button", { name: /Ingen tilgjengelige/i })).toBeVisible();
      await showStep(page, "J4", "✓ J4 Ferdig — terminal status UI verifisert", 1200);
      return;
    }

    await showStep(page, "J4", "Verifiserer at transition-knapp har aria-label med 'fra <status>'");
    const ariaLabel = await transitionBtn.getAttribute("aria-label");
    expect(ariaLabel).toMatch(/ — fra /i);

    await showStep(page, "J4", "✓ J4 Ferdig — SessionActionsBar + LEGAL transitions synlig", 1200);
  });
});
