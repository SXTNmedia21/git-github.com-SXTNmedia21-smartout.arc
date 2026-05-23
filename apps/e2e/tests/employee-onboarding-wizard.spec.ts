import { test, expect } from "@playwright/test";
import { loginAsEmployee } from "../helpers/auth";

/**
 * Employee Onboarding Wizard — Web E2E
 *
 * Covers Journey 1 (Happy Path): 8-step WelcomeWizard flow.
 *   Step 1  HeroStep        — "Velkommen til Smartout!" + CTA "Kom i gang"
 *   Step 2  ContactStep     — Fornavn + Etternavn + Telefonnummer
 *   Step 3  AddressStep     — Fødselsdato + Gate/Vei + Postnr. + By
 *   Step 4  PersonalNumberStep — 11-sifret PNR (two-phase: input → confirm)
 *   Step 5  AvailabilityStep  — toggle unavailable weekdays (optional)
 *   Step 6  ConsentStep     — handbook + GDPR checkboxes
 *   Step 7  OptionalStep    — skip via "Hopp over"
 *   Step 8  DoneStep        — "Du er klar!" heading; completeWelcome() fires
 *
 * DEBT — Fixture gap (see HANDOFF-employee-onboarding-wizard.md §Debt):
 *   The test requires a fresh employee user with is_welcome_complete=false.
 *   The existing "anna@smartout.local" seed user has is_welcome_complete=true
 *   after the first real run, and the loginAsEmployee helper's skipOnboarding
 *   logic navigates past the wizard. There is currently no seed helper that
 *   creates a per-test auth user + resets is_welcome_complete to false before
 *   each run. Until that fixture exists this spec is marked test.skip.
 *
 *   Required fixture work (separate task):
 *   1. Add `seedWizardUser()` to helpers/seed.ts — creates a fresh
 *      auth.users row (email unique per run), inserts a profile row with
 *      is_welcome_complete = false, returns { email, password, profileId }.
 *   2. Add `resetWizardFlag(profileId)` helper — sets is_welcome_complete=false
 *      so a previously completed wizard user can re-trigger the flow.
 *   3. Replace test.skip() below with beforeEach() calls to the above helpers.
 *
 * Selector contracts (verified against component source 2026-05-23):
 *   ContactStep    — label ids: ww-first-name, ww-last-name, ww-phone
 *   AddressStep    — label ids: ww-dob, ww-address, ww-postal, ww-city
 *   PersonalNumber — label id: ww-pnr; confirm heading: "Bekreft personnummer"
 *   AvailabilityStep — weekday buttons by text (Mandag, Tirsdag …)
 *   ConsentStep    — checkbox labels contain "personalhåndboken" / "personopplysninger"
 *   OptionalStep   — skip button text: "Hopp over"
 *   DoneStep       — heading text: "Du er klar!"
 */

// ---------------------------------------------------------------------------
// Fixture helpers — placeholders until seedWizardUser() lands
// ---------------------------------------------------------------------------

/**
 * Resets is_welcome_complete to false for a profile row identified by user email.
 * Requires SUPABASE_SERVICE_ROLE_KEY (available in E2E env).
 * Returns false if the user/profile cannot be found — caller skips in that case.
 */
async function resetWelcomeFlag(email: string): Promise<boolean> {
  // Lazy import so the module loads without SUPABASE_SERVICE_ROLE_KEY at import time.
  // The guard in helpers/seed.ts throws synchronously on module load; importing here
  // defers that until the test body runs (when the env is expected to be set).
  let supabase: Awaited<typeof import("../helpers/seed")>["supabase"];
  try {
    ({ supabase } = await import("../helpers/seed"));
  } catch {
    return false; // Supabase env not configured — skip gracefully
  }

  // Look up auth.users
  const {
    data: { users },
    error: listErr,
  } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (listErr || !users) return false;

  const user = users.find((u) => u.email === email);
  if (!user) return false;

  // Update all profiles for this user
  const { error: updateErr } = await supabase
    .from("profile")
    .update({ is_welcome_complete: false })
    .eq("user_id", user.id);

  return !updateErr;
}

// ---------------------------------------------------------------------------
// Happy-path spec — SKIPPED until seedWizardUser fixture lands
// ---------------------------------------------------------------------------

test.describe("Employee Onboarding Wizard", () => {
  /**
   * SKIPPED: Fixture gap — no per-test fresh-user seed + is_welcome_complete reset.
   *
   * When the fixture is ready:
   *   1. Replace test.skip() with a beforeEach() that calls seedWizardUser().
   *   2. Use the returned { email, password } to call loginAsEmployee(page, email, password,
   *      { skipOnboarding: false }).
   *   3. Remove this comment.
   */
  test.skip("completes 8 steps and reaches DoneStep", async ({ page }) => {
    // ── PRECONDITION ─────────────────────────────────────────────────────
    // Login as anna seed-user with skipOnboarding=false so the wizard renders.
    // This only works if anna's is_welcome_complete is false before the run.
    const resetOk = await resetWelcomeFlag("anna@smartout.local");
    if (!resetOk) {
      // Graceful skip rather than hard failure so CI doesn't block on DB unavailability
      test.skip();
      return;
    }

    await loginAsEmployee(page, "anna@smartout.local", "password123");
    // Navigate to dashboard — layout mounts WelcomeWizardGate when is_welcome_complete=false
    await page.goto("/dashboard");
    await page.waitForLoadState("domcontentloaded");

    // ── STEP 1: HeroStep ──────────────────────────────────────────────────
    await expect(page.getByText(/Velkommen til Smartout!/i)).toBeVisible({ timeout: 10_000 });
    await page.getByRole("button", { name: /Kom i gang/i }).click();

    // ── STEP 2: ContactStep ───────────────────────────────────────────────
    await expect(page.getByText(/Hvem er du\?/i)).toBeVisible({ timeout: 8_000 });
    await page.locator("#ww-first-name").fill("Ola");
    await page.locator("#ww-last-name").fill("Nordmann");
    await page.locator("#ww-phone").fill("+4791234567");
    await page.getByRole("button", { name: "Neste" }).click();

    // ── STEP 3: AddressStep ───────────────────────────────────────────────
    await expect(page.getByText(/Adresse og fødselsdato/i)).toBeVisible({ timeout: 8_000 });
    // Fødselsdato — input[type=date] — fill with YYYY-MM-DD
    await page.locator("#ww-dob").fill("1990-06-15");
    await page.locator("#ww-address").fill("Storgata 1");
    // Postnr. strips non-digits and caps at 4 chars
    await page.locator("#ww-postal").fill("0150");
    await page.locator("#ww-city").fill("Oslo");
    await page.getByRole("button", { name: "Neste" }).click();

    // ── STEP 4: PersonalNumberStep — Phase 1 (input) ─────────────────────
    await expect(page.getByText(/Personnummer/i).first()).toBeVisible({ timeout: 8_000 });
    await page.locator("#ww-pnr").fill("12345678901");
    await page.getByRole("button", { name: "Neste" }).click();

    // ── STEP 4: PersonalNumberStep — Phase 2 (confirm) ───────────────────
    // Component renders <div role="dialog" aria-labelledby="pii-confirm-h2">
    await expect(page.getByRole("heading", { name: /Bekreft personnummer/i })).toBeVisible({
      timeout: 8_000,
    });
    await page.getByRole("button", { name: /Bekreft og lagre/i }).click();

    // ── STEP 5: AvailabilityStep ──────────────────────────────────────────
    await expect(page.getByText(/Når er du tilgjengelig\?/i)).toBeVisible({ timeout: 8_000 });
    // Toggle one day unavailable (Lørdag) — step is optional, no selection required
    await page.getByRole("button", { name: "Lørdag" }).click();
    await page.getByRole("button", { name: "Neste" }).click();

    // ── STEP 6: ConsentStep ───────────────────────────────────────────────
    await expect(page.getByText(/Samtykke/i)).toBeVisible({ timeout: 8_000 });
    // Handbook checkbox — label wraps the Checkbox + text containing "personalhåndboken"
    await page
      .getByText(/personalhåndboken/i)
      .locator("..")
      .locator("button")
      .click();
    // GDPR checkbox — label contains "personopplysninger"
    await page
      .getByText(/personopplysninger/i)
      .locator("..")
      .locator("button")
      .click();
    // Tariff checkbox is conditional (tariffBound=false in seed) — skip
    await page.getByRole("button", { name: "Neste" }).click();

    // ── STEP 7: OptionalStep ──────────────────────────────────────────────
    await expect(page.getByText(/Valgfri informasjon/i)).toBeVisible({ timeout: 8_000 });
    // Skip — no fields required
    await page.getByRole("button", { name: /Hopp over/i }).click();

    // ── STEP 8: DoneStep ──────────────────────────────────────────────────
    // completeWelcome() fires on mount; heading "Du er klar!" appears
    await expect(page.getByRole("heading", { name: /Du er klar!/i })).toBeVisible({
      timeout: 10_000,
    });
    // After ~2.5s DoneStep calls window.location.reload() — wizard unmounts.
    // Assert the CTA is present while still on DoneStep (before reload).
    await expect(page.getByRole("button", { name: /Til Smartout/i })).toBeVisible({
      timeout: 5_000,
    });
  });
});

// ---------------------------------------------------------------------------
// Smoke — static component render (no login required)
// ---------------------------------------------------------------------------

test.describe("Employee Onboarding Wizard — static smoke", () => {
  test("wizard is blocked behind auth — /dashboard redirects unauthenticated users @smoke", async ({
    page,
  }) => {
    await page.context().clearCookies();
    await page.goto("/dashboard");
    await page.waitForURL("**/login", { timeout: 10_000 });
    expect(page.url()).toContain("/login");
  });
});
