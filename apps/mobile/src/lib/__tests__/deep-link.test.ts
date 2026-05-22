import { mobileRouteForActionUrl } from "../deep-link";

describe("mobileRouteForActionUrl", () => {
  it("maps komm channel to channel-detail", () => {
    expect(mobileRouteForActionUrl("/dashboard/komm/abc123")).toBe(
      "/(app)/(me)/channel-detail/abc123",
    );
  });
  it("maps shift-clock to punch-clock", () => {
    expect(mobileRouteForActionUrl("/dashboard/shift-clock")).toBe("/(app)/(home)/punch-clock");
  });
  it("maps my-schedule and schedule to shifts tab", () => {
    expect(mobileRouteForActionUrl("/dashboard/my-schedule?date=2026-05-22")).toBe(
      "/(app)/(shifts)",
    );
    expect(mobileRouteForActionUrl("/dashboard/schedule")).toBe("/(app)/(shifts)");
  });
  it("maps operations and reconciliation to operations", () => {
    expect(mobileRouteForActionUrl("/dashboard/operations")).toBe("/(app)/(home)/operations");
    expect(mobileRouteForActionUrl("/dashboard/reconciliation")).toBe("/(app)/(home)/operations");
  });
  it("maps my-training to training", () => {
    expect(mobileRouteForActionUrl("/dashboard/my-training")).toBe("/(app)/(home)/training");
  });
  it("maps contracts to contract index", () => {
    expect(mobileRouteForActionUrl("/dashboard/contracts")).toBe("/(app)/(me)/contract");
  });
  it("maps people to team", () => {
    expect(mobileRouteForActionUrl("/dashboard/people")).toBe("/(app)/(home)/team");
  });
  it("returns null for generic dashboard and unknown paths", () => {
    expect(mobileRouteForActionUrl("/dashboard")).toBeNull();
    expect(mobileRouteForActionUrl("/dashboard/unknown-thing")).toBeNull();
    expect(mobileRouteForActionUrl("")).toBeNull();
  });
});
