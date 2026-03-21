import { describe, it, expect } from "vitest";
import { computeAnchoredTime } from "../compute-anchored-shift";
import type { AnchorInput, EffectiveHours } from "../types";

const normalHours: EffectiveHours = {
  date: "2026-04-07",
  isOpen: true,
  openTime: "10:00",
  closeTime: "22:00",
  crossesMidnight: false,
  effectiveCloseTimestamp: "2026-04-07T22:00",
  source: "default_weekly",
};

const overnightHours: EffectiveHours = {
  date: "2026-04-11",
  isOpen: true,
  openTime: "16:00",
  closeTime: "02:00",
  crossesMidnight: true,
  effectiveCloseTimestamp: "2026-04-12T02:00",
  source: "default_weekly",
};

const closedHours: EffectiveHours = {
  date: "2026-04-07",
  isOpen: false,
  openTime: null,
  closeTime: null,
  crossesMidnight: false,
  effectiveCloseTimestamp: null,
  source: "closed",
};

describe("computeAnchoredTime", () => {
  it("fixed anchor returns the fixed time", () => {
    const anchor: AnchorInput = { anchorType: "fixed", fixedTime: "14:00", offsetMin: 0 };
    const result = computeAnchoredTime(anchor, normalHours);

    expect(result.resolvedTime).toBe("14:00");
    expect(result.source).toBe("fixed");
    expect(result.isNextDay).toBe(false);
  });

  it("open anchor returns openTime + offset", () => {
    const anchor: AnchorInput = { anchorType: "open", fixedTime: null, offsetMin: -30 };
    const result = computeAnchoredTime(anchor, normalHours);

    expect(result.resolvedTime).toBe("09:30");
    expect(result.source).toBe("open");
  });

  it("close anchor returns closeTime + offset", () => {
    const anchor: AnchorInput = { anchorType: "close", fixedTime: null, offsetMin: 30 };
    const result = computeAnchoredTime(anchor, normalHours);

    expect(result.resolvedTime).toBe("22:30");
    expect(result.source).toBe("close");
  });

  it("close anchor with overnight hours", () => {
    const anchor: AnchorInput = { anchorType: "close", fixedTime: null, offsetMin: -60 };
    const result = computeAnchoredTime(anchor, overnightHours);

    expect(result.resolvedTime).toBe("01:00");
    expect(result.source).toBe("close");
    expect(result.isNextDay).toBe(true);
  });

  it("falls back to fixedTime when hours are closed", () => {
    const anchor: AnchorInput = { anchorType: "open", fixedTime: "10:00", offsetMin: 0 };
    const result = computeAnchoredTime(anchor, closedHours);

    expect(result.resolvedTime).toBe("10:00");
    expect(result.source).toBe("fixed");
  });

  it("open anchor with positive offset", () => {
    const anchor: AnchorInput = { anchorType: "open", fixedTime: null, offsetMin: 60 };
    const result = computeAnchoredTime(anchor, normalHours);

    expect(result.resolvedTime).toBe("11:00");
  });
});
