import { describe, it, expect } from "vitest";
import { applyTransform } from "../../src/migration/transforms.js";
import { strikeUuid } from "../../src/migration/uuid.js";

describe("applyTransform", () => {
  it("trim removes whitespace", () => {
    expect(applyTransform("trim", "  hello  ")).toBe("hello");
  });

  it("trim passes through non-strings unchanged", () => {
    expect(applyTransform("trim", 42)).toBe(42);
    expect(applyTransform("trim", null)).toBe(null);
  });

  it("lowercase converts strings", () => {
    expect(applyTransform("lowercase", "HELLO")).toBe("hello");
  });

  it("uppercase converts strings", () => {
    expect(applyTransform("uppercase", "hello")).toBe("HELLO");
  });

  it("bubble_date_to_tstz passes through ISO dates", () => {
    const iso = "2026-03-15T10:30:00.000Z";
    expect(applyTransform("bubble_date_to_tstz", iso)).toBe(iso);
  });

  it("bubble_date_to_tstz returns null for null input", () => {
    expect(applyTransform("bubble_date_to_tstz", null)).toBe(null);
  });

  it("fk_uuid:workspaces produces deterministic UUID from Bubble ID", () => {
    const result = applyTransform("fk_uuid:workspaces", "1612345678901x111111111111111111");
    expect(result).toBe(strikeUuid("workspaces", "1612345678901x111111111111111111"));
  });

  it("fk_uuid returns null when input is null", () => {
    expect(applyTransform("fk_uuid:workspaces", null)).toBe(null);
  });

  it("fk_uuid returns null when input is empty string", () => {
    expect(applyTransform("fk_uuid:workspaces", "")).toBe(null);
  });

  it("nullable converts empty string to null", () => {
    expect(applyTransform("nullable", "")).toBe(null);
    expect(applyTransform("nullable", null)).toBe(null);
    expect(applyTransform("nullable", undefined)).toBe(null);
    expect(applyTransform("nullable", "value")).toBe("value");
  });

  it("returns value unchanged when transform name is null", () => {
    expect(applyTransform(null, "anything")).toBe("anything");
  });

  it("slugify converts a name to a v3-safe slug", () => {
    expect(applyTransform("slugify", "Wrightegaarden Langesund AS")).toBe("wrightegaarden-langesund-as");
  });

  it("slugify returns null for null/empty input", () => {
    expect(applyTransform("slugify", null)).toBe(null);
    expect(applyTransform("slugify", "")).toBe(null);
  });

  it("slugify throws for non-string input (catches misuse)", () => {
    expect(() => applyTransform("slugify", 42)).toThrow(/slugify expected string/);
  });

  it("iso_to_date extracts the date component from ISO 8601", () => {
    expect(applyTransform("iso_to_date", "2023-05-02T20:25:56.230Z")).toBe("2023-05-02");
  });

  it("iso_to_date returns null for null/empty", () => {
    expect(applyTransform("iso_to_date", null)).toBe(null);
    expect(applyTransform("iso_to_date", "")).toBe(null);
  });

  it("iso_to_date handles Bubble dot-separated date format", () => {
    expect(applyTransform("iso_to_date", "2024.06.12")).toBe("2024-06-12");
  });

  it("iso_to_date throws on truly unrecognized format", () => {
    expect(() => applyTransform("iso_to_date", "May 2, 2023")).toThrow(/unrecognized format/);
  });

  it("iso_to_time extracts HH:MM:SS from ISO 8601", () => {
    expect(applyTransform("iso_to_time", "2023-05-02T20:25:56.230Z")).toBe("20:25:56");
  });

  it("iso_to_time strips fractional seconds and timezone", () => {
    expect(applyTransform("iso_to_time", "2023-05-02T08:00:00.000+02:00")).toBe("08:00:00");
  });

  it("iso_to_time returns null for null/empty", () => {
    expect(applyTransform("iso_to_time", null)).toBe(null);
  });

  it("seconds_to_hours converts duration to NUMERIC(4,2)", () => {
    expect(applyTransform("seconds_to_hours", 3600)).toBe(1);
    expect(applyTransform("seconds_to_hours", 27000)).toBe(7.5);
    expect(applyTransform("seconds_to_hours", 12345)).toBe(3.43); // rounded
  });

  it("seconds_to_hours returns null for null/empty", () => {
    expect(applyTransform("seconds_to_hours", null)).toBe(null);
  });

  it("seconds_to_hours throws on non-finite numbers", () => {
    expect(() => applyTransform("seconds_to_hours", Infinity)).toThrow(/finite number/);
    expect(() => applyTransform("seconds_to_hours", "3600")).toThrow(/finite number/);
  });

  it("throws on unknown transform name", () => {
    expect(() => applyTransform("nonexistent", "x")).toThrow(/unknown transform/i);
  });

  describe("profile_code_from_id", () => {
    it("generates EMP- prefix + first 8 chars of v5 uuid (deterministic)", () => {
      const result = applyTransform("profile_code_from_id", "1683059157430x101700354381603740");
      const expectedHex = strikeUuid("profile", "1683059157430x101700354381603740").slice(0, 8);
      expect(result).toBe(`EMP-${expectedHex}`);
      expect(result).toMatch(/^EMP-[0-9a-f]{8}$/);
    });

    it("is deterministic — same input → same output", () => {
      const a = applyTransform("profile_code_from_id", "abc123");
      const b = applyTransform("profile_code_from_id", "abc123");
      expect(a).toBe(b);
    });

    it("returns null for null/empty input", () => {
      expect(applyTransform("profile_code_from_id", null)).toBeNull();
      expect(applyTransform("profile_code_from_id", "")).toBeNull();
    });

    it("throws for non-string input (catches misuse)", () => {
      expect(() => applyTransform("profile_code_from_id", 42)).toThrow(/expected string/);
    });
  });

  describe("email_from_auth", () => {
    it("extracts email from Bubble auth object's nested path", () => {
      const auth = { email: { email: "anneli@sf-nett.no", email_confirmed: null } };
      expect(applyTransform("email_from_auth", auth)).toBe("anneli@sf-nett.no");
    });

    it("returns null when authentication object is null/undefined", () => {
      expect(applyTransform("email_from_auth", null)).toBeNull();
      expect(applyTransform("email_from_auth", undefined)).toBeNull();
    });

    it("returns null when email sub-object is missing", () => {
      expect(applyTransform("email_from_auth", { other_provider: {} })).toBeNull();
    });

    it("returns null when inner email field is missing", () => {
      expect(applyTransform("email_from_auth", { email: { email_confirmed: null } })).toBeNull();
    });

    it("returns null when inner email is empty string", () => {
      expect(applyTransform("email_from_auth", { email: { email: "" } })).toBeNull();
    });

    it("throws when value is not an object (catches misuse)", () => {
      expect(() => applyTransform("email_from_auth", "anneli@x.no")).toThrow(/expected object/);
      expect(() => applyTransform("email_from_auth", 42)).toThrow(/expected object/);
    });

    it("returns null when value is an array (not the auth object shape)", () => {
      expect(() => applyTransform("email_from_auth", ["a", "b"])).toThrow(/expected object/);
    });
  });

  describe("fk_uuid_array", () => {
    it("converts an array of Bubble IDs to an array of UUIDs", () => {
      const ids = ["1612345678901x111111111111111111", "1612345678902x222222222222222222"];
      const result = applyTransform("fk_uuid_array:workspaces", ids);
      expect(Array.isArray(result)).toBe(true);
      const arr = result as string[];
      expect(arr).toHaveLength(2);
      expect(arr[0]).toBe(strikeUuid("workspaces", ids[0]));
      expect(arr[1]).toBe(strikeUuid("workspaces", ids[1]));
    });

    it("returns null for null input", () => {
      expect(applyTransform("fk_uuid_array:workspaces", null)).toBeNull();
    });

    it("returns null for undefined input", () => {
      expect(applyTransform("fk_uuid_array:workspaces", undefined)).toBeNull();
    });

    it("returns null for empty array", () => {
      expect(applyTransform("fk_uuid_array:workspaces", [])).toBeNull();
    });

    it("throws when input is not an array", () => {
      expect(() => applyTransform("fk_uuid_array:workspaces", "not-an-array")).toThrow();
    });

    it("produces deterministic UUIDs", () => {
      const ids = ["abc"];
      const r1 = applyTransform("fk_uuid_array:workspaces", ids);
      const r2 = applyTransform("fk_uuid_array:workspaces", ids);
      expect(r1).toEqual(r2);
    });
  });
});
