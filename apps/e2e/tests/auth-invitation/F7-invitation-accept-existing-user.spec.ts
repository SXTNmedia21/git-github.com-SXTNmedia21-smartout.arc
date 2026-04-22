/**
 * F7 — invitation-accept-existing-user.spec.ts
 *
 * Journey: Variant A — email already exists in auth.users.
 * The /invite/[token] page branches to `valid_existing_user` and renders a
 * "Velkommen tilbake" header with a "Logg inn og bli med <workspace>" CTA
 * that navigates to /login?invite=<token>.
 *
 * EXISTING_USER_EMAIL (anna@smartout.local) is seeded by seed.sql so it
 * exists in auth.users. Our seeded invitation re-uses this email to force
 * the variant-A branch via the `email_account_exists` flag in the RPC.
 */
import { test, expect } from "@playwright/test";
import {
  EXISTING_USER_EMAIL,
  deleteInvitation,
  seedInvitation,
} from "../../helpers/auth-invitation";

test.describe("F7 invitation-accept-existing-user", () => {
  let invitationId: string | null = null;

  test.afterEach(async () => {
    if (invitationId) {
      await deleteInvitation(invitationId);
      invitationId = null;
    }
  });

  test("variant A renders existing-user panel and routes to /login with invite token", async ({
    page,
  }) => {
    const seeded = await seedInvitation(undefined, undefined, {
      email: EXISTING_USER_EMAIL,
      role: "employee",
    });
    invitationId = seeded.invitation_id;

    await page.goto(`/invite/${seeded.token}`);

    // Variant-A heading includes "Velkommen tilbake".
    await expect(page.getByRole("heading", { name: /Velkommen tilbake/ })).toBeVisible({
      timeout: 10_000,
    });

    // CTA label starts with "Logg inn og bli med".
    const cta = page.getByRole("button", { name: /Logg inn og bli med/ });
    await expect(cta).toBeVisible();

    await cta.click();
    await page.waitForURL(/\/login\?invite=/, { timeout: 10_000 });
    expect(page.url()).toContain(`invite=${seeded.token}`);
  });
});
