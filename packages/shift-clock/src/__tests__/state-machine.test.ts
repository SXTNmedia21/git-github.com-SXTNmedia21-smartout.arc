import { describe, it, expect } from "vitest";
import { canTransition, getNextPhase } from "../state-machine";

describe("canTransition", () => {
  it("allows idle → clocked_in", () => expect(canTransition("idle", "punch_in")).toBe(true));
  it("allows clocked_in → on_break", () =>
    expect(canTransition("clocked_in", "start_break")).toBe(true));
  it("allows on_break → clocked_in", () =>
    expect(canTransition("on_break", "end_break")).toBe(true));
  it("allows clocked_in → summary", () =>
    expect(canTransition("clocked_in", "punch_out")).toBe(true));
  it("allows summary → idle", () => expect(canTransition("summary", "dismiss")).toBe(true));
  it("blocks idle → on_break", () => expect(canTransition("idle", "start_break")).toBe(false));
  it("blocks on_break → summary", () => expect(canTransition("on_break", "punch_out")).toBe(false));
});

describe("getNextPhase", () => {
  it("returns clocked_in for punch_in from idle", () =>
    expect(getNextPhase("idle", "punch_in")).toBe("clocked_in"));
  it("returns null for invalid transition", () =>
    expect(getNextPhase("idle", "start_break")).toBeNull());
});
