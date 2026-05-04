import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { nonEmpty } from "../non-empty-string.js";

describe("nonEmpty", () => {
  const originalEnv = process.env.NODE_ENV;
  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  it("returns the value branded for non-empty strings", () => {
    process.env.NODE_ENV = "production";
    const v = nonEmpty("abc", "actor_id");
    expect(v).toBe("abc");
  });

  it("throws in development when value is empty string", () => {
    process.env.NODE_ENV = "development";
    expect(() => nonEmpty("", "actor_id")).toThrow(/actor_id must be non-empty/);
  });

  it("throws in development when value is null", () => {
    process.env.NODE_ENV = "development";
    expect(() => nonEmpty(null, "workspace_id")).toThrow(/workspace_id must be non-empty/);
  });

  it("throws in test environment too (CI catches)", () => {
    process.env.NODE_ENV = "test";
    expect(() => nonEmpty(undefined, "session_id")).toThrow(/session_id must be non-empty/);
  });

  it("returns sentinel and warns in production on empty", () => {
    process.env.NODE_ENV = "production";
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const v = nonEmpty("", "actor_id");
    expect(v).toBe("__EMIT_DROPPED__");
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("actor_id is empty"));
    warn.mockRestore();
  });
});
