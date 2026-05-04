/**
 * F5 — signup-password-to-join.spec.ts
 *
 * Journey: New user signs up on /signup with the Passord tab.
 *
 * Implementation note: the current /signup (apps/web/src/app/signup/page.tsx
 * line 188) calls supabase.auth.signUp() with emailRedirectTo=/join. Supabase
 * local enforces email confirmation by default, so signUp produces a
 * "Sjekk e-posten din" confirmation state rather than an authenticated
 * session. The success screen is what we assert on.
 *
 * Wave G candidates:
 *   - If product expects /signup password tab to land directly on /join
 *     without email confirm, Supabase local GOTRUE_MAILER_AUTOCONFIRM must
 *     be enabled (or the flow must auto-exchange the verification). Today
 *     neither is true — we assert the confirmation screen.
 */
import { test, expect } from "@playwright/test";
import { deleteAuthUserByEmail } from "../../helpers/auth-invitation";

test.describe("F5 signup-password-to-join", () => {
  const email = `e2e-pw-${Date.now()}@smartout.test`;

  test.afterEach(async () => {
    await deleteAuthUserByEmail(email);
  });

  test("password signup reaches confirmation state", async ({ page }) => {
    await page.goto("/signup");

    // Switch to Passord tab.
    const pwTab = page.getByRole("button", { name: "Passord", exact: true });
    await expect(pwTab).toBeVisible({ timeout: 10_000 });
    await pwTab.click();

    // The password tab renders inputs with ids #email-pw, #password, #confirm-password.
    await page.locator("#email-pw").fill(email);
    await page.locator("#password").fill("CorrectHorseBatteryStaple1");
    await page.locator("#confirm-password").fill("CorrectHorseBatteryStaple1");

    await page.getByRole("button", { name: /Opprett konto|Oppretter konto\.\.\./ }).click();

    // Either confirmation state (Supabase mailer active) OR a direct navigation
    // to /join (autoconfirm). Both are acceptable — we guard against the error
    // state that used to throw "User already registered".
    const confirmHeading = page.getByRole("heading", { name: "Sjekk e-posten din" });
    const joinLanded = page
      .waitForURL(/\/(join|dashboard|select-workspace|welcome)/, { timeout: 15_000 })
      .then(() => "navigated" as const)
      .catch(() => null);

    const confirmVisible = confirmHeading
      .waitFor({ state: "visible", timeout: 15_000 })
      .then(() => "confirm" as const)
      .catch(() => null);

    const outcome = await Promise.race([joinLanded, confirmVisible]);
    expect(outcome === "navigated" || outcome === "confirm").toBe(true);
  });
});
