import { describe, it, expectTypeOf } from "vitest";
import type { CapabilityDefinition, SessionChannel, AuthorityLevel } from "../types.js";

describe("CapabilityDefinition shape (Item 2)", () => {
  it("has required allowedChannels, toolAuthPattern, emitPrefix", () => {
    type Required =
      | "name"
      | "description"
      | "tools"
      | "readOnlyTools"
      | "allowedChannels"
      | "toolAuthPattern"
      | "emitPrefix";
    type HasRequired = Required extends keyof Omit<
      CapabilityDefinition,
      "suggestTools" | "defaultAuthority"
    >
      ? true
      : false;
    expectTypeOf<HasRequired>().toEqualTypeOf<true>();
  });

  it("toolAuthPattern is bff or direct_admin", () => {
    expectTypeOf<CapabilityDefinition["toolAuthPattern"]>().toEqualTypeOf<"bff" | "direct_admin">();
  });

  it("emitPrefix is string or null", () => {
    expectTypeOf<CapabilityDefinition["emitPrefix"]>().toEqualTypeOf<string | null>();
  });

  it("defaultAuthority is optional AuthorityLevel", () => {
    expectTypeOf<CapabilityDefinition["defaultAuthority"]>().toEqualTypeOf<
      AuthorityLevel | undefined
    >();
  });

  it("allowedChannels is required ReadonlyArray<SessionChannel>", () => {
    expectTypeOf<CapabilityDefinition["allowedChannels"]>().toEqualTypeOf<
      ReadonlyArray<SessionChannel>
    >();
  });
});
