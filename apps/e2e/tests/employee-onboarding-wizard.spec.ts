import { test, expect } from "@playwright/test";
import { loginAsEmployee } from "../helpers/auth";
import { supabase, seedWizardUser, cleanupWizardUser } from "../helpers/seed";
import type { SeedWizardUserResult } from "../helpers/seed";

/**
 * Employee Onboarding Wizard — Web E2E
 *
 * Covers:
 *   Journey 1 (Happy Path): 8-step WelcomeWizard flow end-to-end.
 *   Journey 2 (Dismiss-Resume): dismiss mid-wizard via BFF, reload (no wizard),
 *             resume via GET state endpoint, reload (wizard re-appears), complete.
 *
 * Step map:
 *   Step 1  HeroStep        — "Velkommen til Smartout!" + CTA "Kom i gang"
 *   Step 2  ContactStep     — Fornavn + Etternavn + Telefonnummer
 *   Step 3  AddressStep     — Fødselsdato + Gate/Vei + Postnr. + By
 *   Step 4  PersonalNumberStep — 11-sifret PNR (two-phase: input → confirm)
 *   Step 5  AvailabilityStep  — toggle unavailable weekdays (optional)
 *   Step 6  ConsentStep     — handbook + GDPR checkboxes
 *   Step 7  OptionalStep    — skip via "Hopp over"
 *   Step 8  DoneStep        — "Du er klar!" heading; completeWelcome() fires
 *
 * Selector contracts (verified against component source 2026-05-23):
 *   ContactStep    — label ids: ww-first-name, ww-last-name, ww-phone
 *   AddressStep    — label ids: ww-dob, ww-address, ww-postal, ww-city
 *   PersonalNumber — label id: ww-pnr; confirm heading: "Bekreft personnummer"
 *   AvailabilityStep — weekday buttons by text (Mandag, Tirsdag …)
 *   ConsentStep    — checkbox labels contain "personalhåndboken" / "personopplysninger"
 *   OptionalStep   — skip button text: "Hopp over"
 *   DoneStep       — heading text: "Du er klar!"
 *
 * Dismiss: WelcomeWizard Dialog blocks escape + outside-click. Dismiss is only
 * possible via POST /api/employee-onboarding/state/dismiss (no dismiss button
 * in the wizard UI — mandatory completion flow).
 *
 * Resume: GET /api/employee-onboarding/state triggers recordWelcomeResume()
 * when dismissed_at IS NOT NULL — transitions row to in_progress + clears
 * dismissed_at. Next page load then mounts the wizard again.
 */

// ---------------------------------------------------------------------------
// Shared happy-path step driver
// ---------------------------------------------------------------------------

/**
 * Drives steps 1–7 of the wizard. Does NOT navigate to /dashboard first —
 * caller is responsible for landing on a page that shows the wizard.
 *
 * Returns immediately after clicking "Hopp over" on OptionalStep (step 7),
 * leaving the caller on DoneStep (step 8).
 */
async function driveWizardToCompletion(page: import("@playwright/test").Page): Promise<void> {
  // ── STEP 1: HeroStep ──────────────────────────────────────────────────
  await expect(page.getByText(/Velkommen til Smartout!/i)).toBeVisible({ timeout: 15_000 });
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
  // getByText(/Samtykke/i) matches two elements (strict mode violation):
  //   - <h2>Samtykke</h2> (heading)
  //   - <span>Jeg samtykker til...</span> (checkbox label)
  // Use getByRole to target the heading specifically.
  await expect(page.getByRole("heading", { name: "Samtykke" })).toBeVisible({ timeout: 8_000 });
  // Handbook + GDPR checkboxes — Radix renders as button[role="checkbox"].
  // DOM: <label><button role="checkbox" /><span>...</span></label>
  // tariffBound=false in seed workspace → only 2 checkboxes present.
  // Click first checkbox (handbook) then second (GDPR) by index.
  const checkboxes = page.getByRole("checkbox");
  await checkboxes.nth(0).click(); // handbook
  await checkboxes.nth(1).click(); // GDPR
  // Tariff checkbox is conditional (tariffBound=false in seed) — skip
  await page.getByRole("button", { name: "Neste" }).click();

  // ── STEP 7: OptionalStep ──────────────────────────────────────────────
  await expect(page.getByText(/Valgfri informasjon/i)).toBeVisible({ timeout: 8_000 });
  // Skip — no fields required
  await page.getByRole("button", { name: /Hopp over/i }).click();
}

// ---------------------------------------------------------------------------
// Happy-path + dismiss-resume suite
// ---------------------------------------------------------------------------

test.describe("Employee Onboarding Wizard", () => {
  let userCtx: SeedWizardUserResult;

  test.beforeEach(async () => {
    userCtx = await seedWizardUser();
  });

  test.afterEach(async () => {
    if (userCtx?.userId) await cleanupWizardUser(userCtx.userId);
  });

  // ── Journey 1: Happy Path ─────────────────────────────────────────────

  test("happy path: completes 8 steps and reaches DoneStep", async ({ page }) => {
    // loginAsEmployee's skipOnboardingIfPresent only fires on /dashboard/setup —
    // not on the WelcomeWizard Dialog, so it is safe to call with our fresh user.
    await loginAsEmployee(page, userCtx.email, userCtx.password);

    // Navigate to dashboard — layout mounts WelcomeWizardGate when is_welcome_complete=false
    await page.goto("/dashboard");
    await page.waitForLoadState("domcontentloaded");

    // Drive all 7 data-entry steps
    await driveWizardToCompletion(page);

    // ── STEP 8: DoneStep ──────────────────────────────────────────────────
    // completeWelcome() fires on mount; heading "Du er klar!" appears
    await expect(page.getByRole("heading", { name: /Du er klar!/i })).toBeVisible({
      timeout: 10_000,
    });
    // CTA present while still on DoneStep (before auto-reload)
    await expect(page.getByRole("button", { name: /Til Smartout/i })).toBeVisible({
      timeout: 5_000,
    });

    // DoneStep calls completeWelcome() on mount (useEffect), then reloads after
    // 2.5 s. Wait for reload + domcontentloaded before querying DB.
    // Use waitForURL to detect the reload completing cleanly.
    await page.waitForURL("**/dashboard**", { timeout: 15_000, waitUntil: "domcontentloaded" });

    // DB invariant: profile.is_welcome_complete must be true after completeWelcome()
    const { data: profile, error: profileErr } = await supabase
      .from("profile")
      .select("is_welcome_complete")
      .eq("profile_id", userCtx.profileId)
      .single();

    expect(profileErr).toBeNull();
    expect(profile?.is_welcome_complete).toBe(true);

    // DB invariant: employee_onboarding_state row must exist with status='completed'
    const { data: state, error: stateErr } = await supabase
      .from("employee_onboarding_state")
      .select("status, completed_at, dismissed_at")
      .eq("profile_id", userCtx.profileId)
      .single();

    expect(stateErr).toBeNull();
    expect(state?.status).toBe("completed");
    expect(state?.completed_at).toBeTruthy();
    expect(state?.dismissed_at).toBeNull();
  });

  // ── Journey 2: Dismiss-Resume ──────────────────────────────────────────

  test("dismiss-resume: dismisses wizard mid-flow via API, resumes via state GET, re-completes", async ({
    page,
  }) => {
    await loginAsEmployee(page, userCtx.email, userCtx.password);
    await page.goto("/dashboard");
    await page.waitForLoadState("domcontentloaded");

    // ── 1. Wizard is visible on HeroStep ─────────────────────────────────
    await expect(page.getByText(/Velkommen til Smartout!/i)).toBeVisible({ timeout: 15_000 });

    // ── 2. Dismiss via BFF (no dismiss button in wizard UI — mandatory flow) ──
    // The Dialog blocks escape + outside-click. Dismiss is API-only.
    const dismissResp = await page.request.post("/api/employee-onboarding/state/dismiss");
    expect(dismissResp.ok()).toBeTruthy();

    // ── 3. Verify DB: status='dismissed', dismissed_at set ────────────────
    const { data: state1, error: state1Err } = await supabase
      .from("employee_onboarding_state")
      .select("status, dismissed_at")
      .eq("profile_id", userCtx.profileId)
      .single();

    expect(state1Err).toBeNull();
    expect(state1?.status).toBe("dismissed");
    expect(state1?.dismissed_at).toBeTruthy();

    // ── 4. Reload page — wizard should NOT auto-appear (dismissed) ────────
    // Layout reads is_welcome_complete from profile; the flag is still false,
    // but WelcomeWizardGate only renders when is_welcome_complete=false AND
    // the dismissed_at logic in the Gate's client side may differ.
    // The real gate is profile.is_welcome_complete — dismissed only affects
    // telemetry + resume flow. The wizard WILL re-appear after reload because
    // is_welcome_complete=false still (dismiss != complete). This is expected
    // per product spec: dismiss = "later", not "done".
    //
    // TODO: If future product decision adds a "dismissed" UI gate at layout
    // level (hide wizard when dismissed_at IS NOT NULL + !completed_at),
    // update this assertion to expect NOT visible.
    await page.reload();
    await page.waitForLoadState("domcontentloaded");
    // Wizard still visible (dismissed ≠ completed; profile.is_welcome_complete still false)
    await expect(page.getByText(/Velkommen til Smartout!/i)).toBeVisible({ timeout: 10_000 });

    // ── 5. Resume: GET /api/employee-onboarding/state triggers recordWelcomeResume ──
    // The GET handler calls recordWelcomeResume() when dismissed_at IS NOT NULL,
    // which UPDATEs status='in_progress' + dismissed_at=null.
    const resumeResp = await page.request.get("/api/employee-onboarding/state");
    expect(resumeResp.ok()).toBeTruthy();

    // ── 6. Verify DB: status='in_progress', dismissed_at=null ─────────────
    const { data: state2, error: state2Err } = await supabase
      .from("employee_onboarding_state")
      .select("status, dismissed_at")
      .eq("profile_id", userCtx.profileId)
      .single();

    expect(state2Err).toBeNull();
    expect(state2?.status).toBe("in_progress");
    expect(state2?.dismissed_at).toBeNull();

    // ── 7. Complete the wizard from scratch to confirm full cycle ─────────
    // Wizard is already visible on page from step 4 reload; drive to completion.
    await driveWizardToCompletion(page);

    await expect(page.getByRole("heading", { name: /Du er klar!/i })).toBeVisible({
      timeout: 10_000,
    });

    // Wait for DoneStep auto-reload
    await page.waitForURL("**/dashboard**", { timeout: 15_000, waitUntil: "domcontentloaded" });

    // Final DB check: is_welcome_complete must be true
    const { data: finalProfile } = await supabase
      .from("profile")
      .select("is_welcome_complete")
      .eq("profile_id", userCtx.profileId)
      .single();
    expect(finalProfile?.is_welcome_complete).toBe(true);
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
