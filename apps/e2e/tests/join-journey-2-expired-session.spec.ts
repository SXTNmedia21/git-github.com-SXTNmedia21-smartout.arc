import { test, expect } from "@playwright/test";

/**
 * Journey 2 — Expired session restore (ADR-0358).
 * Wizard envelope in localStorage, Supabase auth cookies wiped.
 * ExpiredSessionGate detects → redirects to /login?return_to=/join&reason=expired.
 */
test.describe("join-journey-2-expired-session", () => {
  test("expired cookie redirects to /login with return_to", async ({ page, context }) => {
    test.setTimeout(60_000);

    // Inject a wizard envelope into localStorage matching current schema
    await page.goto("/join");
    await page.evaluate(() => {
      const envelope = {
        schemaVersion: 1,
        savedAt: new Date().toISOString(),
        state: {
          account: {
            email: "expired-session@e2e-smartout.local",
            firstName: "Test",
            lastName: "User",
            companyName: "Expired Co",
            industry: "restaurant",
            city: "Oslo",
            websiteUrl: "",
          },
          business: { street: "S1", postalCode: "0000", city: "Oslo", orgNumber: "911722267" },
          about: { aboutUs: "test", ourHistory: "", ourConcept: "test" },
          hours: { openingHours: [], phone: "+47" },
          menu: {},
          createAccount: {},
          team: {},
          scrapeJobId: null,
          intelligence: null,
        },
      };
      localStorage.setItem("smartout_signup_wizard", JSON.stringify(envelope));
    });

    // Clear all Supabase cookies (sb-*)
    const cookies = await context.cookies();
    const supabaseCookies = cookies
      .filter((c) => c.name.startsWith("sb-"))
      .map((c) => ({ name: c.name, domain: c.domain, path: c.path }));
    if (supabaseCookies.length > 0) {
      await context.clearCookies({ name: /^sb-/ });
    }

    // Reload — gate should fire and redirect
    await page.goto("/join");

    await page.waitForURL(/\/login\?.*return_to=%2Fjoin.*reason=expired/, {
      timeout: 20_000,
    });

    // Banner should be visible on /login
    await expect(page.getByText(/Sesjonen er utløpt/)).toBeVisible({ timeout: 10_000 });
  });

  test("fresh visitor (no envelope) does NOT redirect", async ({ page }) => {
    test.setTimeout(30_000);
    await page.goto("/join");
    await page.evaluate(() => localStorage.removeItem("smartout_signup_wizard"));
    await page.reload();

    // Should stay on /join
    await expect(page.getByRole("heading", { name: /Opprett din konto/ })).toBeVisible({
      timeout: 25_000,
    });
    expect(page.url()).toContain("/join");
  });
});
