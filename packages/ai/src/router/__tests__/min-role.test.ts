import { describe, it, expect } from "vitest";
import {
  applyMinRoleDowngrade,
  isRoleSufficient,
  MIN_ROLE_DOWNGRADE_LEVEL,
  type MinRoleConfig,
} from "../min-role.js";
import type { AuthorityConfig } from "../tool-selector.js";

describe("isRoleSufficient", () => {
  it("owner meets every requirement", () => {
    expect(isRoleSufficient("owner", "employee")).toBe(true);
    expect(isRoleSufficient("owner", "manager")).toBe(true);
    expect(isRoleSufficient("owner", "admin")).toBe(true);
    expect(isRoleSufficient("owner", "owner")).toBe(true);
  });

  it("employee only meets employee", () => {
    expect(isRoleSufficient("employee", "employee")).toBe(true);
    expect(isRoleSufficient("employee", "manager")).toBe(false);
    expect(isRoleSufficient("employee", "admin")).toBe(false);
    expect(isRoleSufficient("employee", "owner")).toBe(false);
  });

  it("manager meets employee and manager but not admin/owner", () => {
    expect(isRoleSufficient("manager", "employee")).toBe(true);
    expect(isRoleSufficient("manager", "manager")).toBe(true);
    expect(isRoleSufficient("manager", "admin")).toBe(false);
    expect(isRoleSufficient("manager", "owner")).toBe(false);
  });
});

describe("applyMinRoleDowngrade", () => {
  it("returns empty when input is empty", () => {
    expect(applyMinRoleDowngrade({}, {}, "owner")).toEqual({});
  });

  it("passes through when no min_role is configured", () => {
    const authority: AuthorityConfig = { schedule: "autonomous", training: "read_only" };
    expect(applyMinRoleDowngrade(authority, {}, "employee")).toEqual(authority);
  });

  it("passes through when role meets min_role", () => {
    const authority: AuthorityConfig = { schedule: "autonomous" };
    const minRoles: MinRoleConfig = { schedule: "manager" };
    expect(applyMinRoleDowngrade(authority, minRoles, "admin")).toEqual({
      schedule: "autonomous",
    });
  });

  it("downgrades to suggest when role is below min_role", () => {
    const authority: AuthorityConfig = { schedule: "autonomous" };
    const minRoles: MinRoleConfig = { schedule: "admin" };
    expect(applyMinRoleDowngrade(authority, minRoles, "employee")).toEqual({
      schedule: MIN_ROLE_DOWNGRADE_LEVEL,
    });
  });

  it("downgrades only insufficient capabilities, preserves others", () => {
    const authority: AuthorityConfig = {
      schedule: "autonomous",
      training: "confirm",
      profile: "read_only",
    };
    const minRoles: MinRoleConfig = {
      schedule: "admin", // employee below → downgrade
      training: "employee", // employee meets → keep
      // profile: no entry → keep
    };
    expect(applyMinRoleDowngrade(authority, minRoles, "employee")).toEqual({
      schedule: "suggest",
      training: "confirm",
      profile: "read_only",
    });
  });

  it("does not mutate inputs", () => {
    const authority: AuthorityConfig = { schedule: "autonomous" };
    const minRoles: MinRoleConfig = { schedule: "admin" };
    const result = applyMinRoleDowngrade(authority, minRoles, "employee");
    expect(authority).toEqual({ schedule: "autonomous" });
    expect(minRoles).toEqual({ schedule: "admin" });
    expect(result).not.toBe(authority);
  });

  it("downgrade level is always 'suggest' (migration spec)", () => {
    // Even if configured as 'autonomous' or 'disabled', insufficient role
    // downgrades to 'suggest' per the column comment on engine_authority_config.
    const cases: Array<[AuthorityConfig[string], AuthorityConfig[string]]> = [
      ["autonomous", "suggest"],
      ["confirm", "suggest"],
      ["read_only", "suggest"],
      ["disabled", "suggest"],
    ];
    for (const [input, expected] of cases) {
      const result = applyMinRoleDowngrade({ x: input }, { x: "owner" }, "employee");
      expect(result.x).toBe(expected);
    }
  });
});
