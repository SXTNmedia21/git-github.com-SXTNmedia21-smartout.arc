/**
 * F6 — invitation-accept-new-user.spec.ts
 *
 * Journey: new-user variant B of the invitation flow.
 * Open /invite/<token> → page shows valid_new_user form → CTA navigates to
 * /signup?invite=<token>. We also verify the opened_at column transitions
 * from NULL → timestamp after mount (track_invitation_opened RPC fires).
 *
 * We do NOT drive the /signup submit end-to-end here — Supabase mailer
 * confirmation makes the session transition unreliable. That is F4 territory.
 */
import { test, expect } from "@playwright/test";
import { deleteInvitation, getInvitation, seedInvitation } from "../../helpers/auth-invitation";

test.describe("F6 invitation-accept-new-user", () => {
  let invitationId: string | null = null;

  test.afterEach(async () => {
    if (invitationId) {
      await deleteInvitation(invitationId);
      invitationId = null;
    }
  });

  test("valid new-user invitation renders context header + signup CTA + marks opened_at", async ({
    page,
  }) => {
    const inviteeEmail = `new-invitee-${Date.now()}@smartout.test`;
    const seeded = await seedInvitation(undefined, undefined, {
      email: inviteeEmail,
      role: "employee",
    });
    invitationId = seeded.invitation_id;

    expect(seeded.opened_at).toBeNull();

    await page.goto(`/invite/${seeded.token}`);

    // Valid state heading — uses workspace name, default from HQ_WORKSPACE.
    await expect(page.getByRole("heading", { name: /Du er invitert til/ })).toBeVisible({
      timeout: 10_000,
    });

    // CTA: "Opprett konto og bli med"
    const cta = page.getByRole("button", { name: /Opprett konto og bli med/ });
    await expect(cta).toBeVisible();

    // opened_at should have been stamped. Wait up to 5s for the RPC to fire.
    let marked: string | null = null;
    for (let i = 0; i < 10; i += 1) {
      const row = await getInvitation(seeded.invitation_id);
      if (row?.opened_at) {
        marked = row.opened_at;
        break;
      }
      await page.waitForTimeout(500);
    }
    expect(marked).not.toBeNull();

    // Click CTA → navigates to /signup?invite=<token>
    await cta.click();
    await page.waitForURL(/\/signup\?invite=/, { timeout: 10_000 });
    expect(page.url()).toContain(`invite=${seeded.token}`);
  });
});
