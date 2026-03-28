/**
 * guards.test.ts
 * Verifies authority guard rules for schedule messaging API.
 * Ensures only manager/admin/owner can send schedule messages.
 */
import { describe, expect, it } from "vitest";
import { canSendScheduleMessage } from "../guards";

describe("canSendScheduleMessage", () => {
  it.each(["manager", "admin", "owner"])("allows '%s' to send schedule messages", (role) => {
    expect(canSendScheduleMessage(role)).toBe(true);
  });

  it.each(["employee", "trainee", "viewer", "guest", "system"])(
    "forbids '%s' from sending schedule messages",
    (role) => {
      expect(canSendScheduleMessage(role)).toBe(false);
    },
  );

  it.each([" manager ", "owner\n", "  "])("forbids malformed role string '%s'", (role) => {
    expect(canSendScheduleMessage(role)).toBe(false);
  });

  it("forbids missing role values", () => {
    expect(canSendScheduleMessage(null)).toBe(false);
    expect(canSendScheduleMessage(undefined)).toBe(false);
  });
});
