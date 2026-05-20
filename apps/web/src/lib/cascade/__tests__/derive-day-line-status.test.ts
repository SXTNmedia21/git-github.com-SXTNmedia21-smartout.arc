import { describe, it, expect } from "vitest";
import { deriveDayLineStatus } from "../derive-day-line-status";

const baseLine = {
  cancelled_at: null,
  business_date: "2026-06-20",
};

describe("deriveDayLineStatus — precedence order: locked > cancelled > draft > closed > active", () => {
  it("returns 'locked' when reconciliationLocked is true, regardless of other state", () => {
    expect(
      deriveDayLineStatus({
        line: { ...baseLine, cancelled_at: "2026-06-20T10:00:00Z" },
        sessionStatus: "open",
        reconciliationLocked: true,
      }),
    ).toBe("locked");
  });

  it("returns 'cancelled' when cancelled_at is set and not locked", () => {
    expect(
      deriveDayLineStatus({
        line: { ...baseLine, cancelled_at: "2026-06-20T09:00:00Z" },
        sessionStatus: "open",
        reconciliationLocked: false,
      }),
    ).toBe("cancelled");
  });

  it("returns 'draft' when session is draft and line is not cancelled or locked", () => {
    expect(
      deriveDayLineStatus({
        line: baseLine,
        sessionStatus: "draft",
        reconciliationLocked: false,
      }),
    ).toBe("draft");
  });

  it("returns 'closed' when session is closed and line is not cancelled or locked", () => {
    expect(
      deriveDayLineStatus({
        line: baseLine,
        sessionStatus: "closed",
        reconciliationLocked: false,
      }),
    ).toBe("closed");
  });

  it("returns 'active' when session is open and line is not cancelled or locked", () => {
    expect(
      deriveDayLineStatus({
        line: baseLine,
        sessionStatus: "open",
        reconciliationLocked: false,
      }),
    ).toBe("active");
  });
});
