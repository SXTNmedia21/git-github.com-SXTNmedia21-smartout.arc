/**
 * deriveDisplayStatus.test.ts
 * Unit tests for the pure derivation function that maps
 * (db status, opened_at, expires_at) -> display status.
 *
 * Guards the contract Wave D (InvitationStatusList) + any admin UI
 * relies on. The DB enum is 4-valued (pending|accepted|expired|cancelled)
 * but the display space is 5-valued — "opened" is reconstructed at read
 * time from `opened_at` presence.
 *
 * On-read expiry (Auth Spec Council Q7=b) is exercised explicitly so a
 * later SQL-trigger change can't silently flip UI behaviour.
 */
import { describe, it, expect } from "vitest";
import { deriveDisplayStatus, type InvitationForStatus } from "../InvitationStatusBadge";

const FUTURE = "2099-01-01T00:00:00Z";
const PAST = "2000-01-01T00:00:00Z";

function make(partial: Partial<InvitationForStatus>): InvitationForStatus {
  return {
    status: "pending",
    opened_at: null,
    expires_at: FUTURE,
    ...partial,
  };
}

describe("deriveDisplayStatus", () => {
  it("returns 'accepted' when db status is accepted (terminal wins over opened_at)", () => {
    expect(
      deriveDisplayStatus(make({ status: "accepted", opened_at: "2026-04-20T10:00:00Z" })),
    ).toBe("accepted");
  });

  it("returns 'cancelled' when db status is cancelled", () => {
    expect(deriveDisplayStatus(make({ status: "cancelled" }))).toBe("cancelled");
  });

  it("returns 'expired' when db status is expired", () => {
    expect(deriveDisplayStatus(make({ status: "expired" }))).toBe("expired");
  });

  it("returns 'expired' when pending but expires_at is in the past (on-read expiry)", () => {
    expect(deriveDisplayStatus(make({ status: "pending", expires_at: PAST }))).toBe("expired");
  });

  it("returns 'opened' when pending + opened_at set + not yet expired", () => {
    expect(
      deriveDisplayStatus(
        make({
          status: "pending",
          opened_at: "2026-04-20T12:00:00Z",
          expires_at: FUTURE,
        }),
      ),
    ).toBe("opened");
  });

  it("returns 'pending' when pending + no opened_at + not expired", () => {
    expect(deriveDisplayStatus(make({ status: "pending" }))).toBe("pending");
  });

  it("treats opened_at as irrelevant when expired — expiry wins", () => {
    // Pending row that was opened then sat unused past expires_at should
    // read as expired, not opened, so admins see the actionable state.
    expect(
      deriveDisplayStatus(
        make({
          status: "pending",
          opened_at: "2024-12-31T00:00:00Z",
          expires_at: PAST,
        }),
      ),
    ).toBe("expired");
  });

  it("boundary: expires_at one second in the future stays pending", () => {
    // Derivation uses strict < against Date.now(). Anything >= now stays
    // pending; anything < now flips to expired. We use now+1s (not now
    // exactly) because the derivation re-reads Date.now() internally — a
    // naïve "pin to now" test flakes when the clock ticks between
    // encoding the ISO string and the internal comparison.
    const oneSecFuture = new Date(Date.now() + 1000).toISOString();
    expect(
      deriveDisplayStatus(make({ status: "pending", opened_at: null, expires_at: oneSecFuture })),
    ).toBe("pending");
  });

  it("boundary: expires_at one second in the past flips to expired", () => {
    // Mirror of the above — proves the strict < comparison catches the
    // moment we cross the expiry line.
    const oneSecPast = new Date(Date.now() - 1000).toISOString();
    expect(
      deriveDisplayStatus(make({ status: "pending", opened_at: null, expires_at: oneSecPast })),
    ).toBe("expired");
  });
});
