/**
 * F8 — invitation-expired.spec.ts
 *
 * Journey: seeded expired invitation (expires_at in past, status='pending')
 * renders the expired terminal card + the Clock icon. track_invitation_opened
 * returns false for expired rows (RPC WHERE clause filters status='pending'
 * + expires_at > now()), so opened_at remains NULL.
 */
import { test, expect } from "@playwright/test";
import { deleteInvitation, getInvitation, seedInvitation } from "../../helpers/auth-invitation";

test.describe("F8 invitation-expired", () => {
  let invitationId: string | null = null;

  test.afterEach(async () => {
    if (invitationId) {
      await deleteInvitation(invitationId);
      invitationId = null;
    }
  });

  test("expired invitation renders terminal error state", async ({ page }) => {
    const seeded = await seedInvitation(undefined, undefined, {
      email: `expired-${Date.now()}@smartout.test`,
      expiresAt: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
      status: "pending", // still pending; server-side expiry check flips it
    });
    invitationId = seeded.invitation_id;

    await page.goto(`/invite/${seeded.token}`);

    // Terminal-card title.
    await expect(page.getByRole("heading", { name: "Invitasjonen er utløpt" })).toBeVisible({
      timeout: 10_000,
    });

    // Primary action "Gå til innlogging" is a Link (role=link).
    const loginCta = page.getByRole("link", { name: /Gå til innlogging/ });
    await expect(loginCta).toBeVisible();

    // Wait for any RPC roundtrip to settle.
    await page.waitForTimeout(1000);

    // opened_at should still be NULL — RPC returns false for expired rows.
    const row = await getInvitation(seeded.invitation_id);
    expect(row?.opened_at).toBeNull();

    // Clicking "Gå til innlogging" navigates to /login.
    await loginCta.click();
    await page.waitForURL(/\/login/, { timeout: 10_000 });
  });
});
