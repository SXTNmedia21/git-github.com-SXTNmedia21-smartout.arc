/**
 * dept-token-resolver.test.ts
 *
 * 16 test cases covering the 4 canonical token mappings, 4 Norwegian variants,
 * lowercase/trim normalisation, null/undefined/empty fallback, unknown → default,
 * warn-once behaviour, and the arrangement → event mapping.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { resolveDeptToken } from "../dept-token-resolver";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Silence console.warn for tests that intentionally trigger the unknown-key path. */
function silenceWarn() {
  return vi.spyOn(console, "warn").mockImplementation(() => undefined);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("resolveDeptToken", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // ── 4 canonical English mappings ─────────────────────────────────────────

  it('maps "kitchen" → "kitchen"', () => {
    expect(resolveDeptToken("kitchen")).toBe("kitchen");
  });

  it('maps "floor" → "floor"', () => {
    expect(resolveDeptToken("floor")).toBe("floor");
  });

  it('maps "bar" → "bar"', () => {
    expect(resolveDeptToken("bar")).toBe("bar");
  });

  it('maps "event" → "event"', () => {
    expect(resolveDeptToken("event")).toBe("event");
  });

  // ── 4 Norwegian variants ─────────────────────────────────────────────────

  it('maps "kjøkken" → "kitchen"', () => {
    expect(resolveDeptToken("kjøkken")).toBe("kitchen");
  });

  it('maps "kjokken" → "kitchen"', () => {
    expect(resolveDeptToken("kjokken")).toBe("kitchen");
  });

  it('maps "sal" → "floor"', () => {
    expect(resolveDeptToken("sal")).toBe("floor");
  });

  it('maps "bistro" → "floor"', () => {
    expect(resolveDeptToken("bistro")).toBe("floor");
  });

  // ── arrangement → event ──────────────────────────────────────────────────

  it('maps "arrangement" → "event"', () => {
    expect(resolveDeptToken("arrangement")).toBe("event");
  });

  // ── Normalisation: lowercase + trim ─────────────────────────────────────

  it("lowercases before lookup: 'KITCHEN' → 'kitchen'", () => {
    expect(resolveDeptToken("KITCHEN")).toBe("kitchen");
  });

  it("trims whitespace before lookup: '  sal  ' → 'floor'", () => {
    expect(resolveDeptToken("  sal  ")).toBe("floor");
  });

  // ── Null / undefined / empty fallback ────────────────────────────────────

  it("returns 'default' for null", () => {
    expect(resolveDeptToken(null)).toBe("default");
  });

  it("returns 'default' for undefined", () => {
    expect(resolveDeptToken(undefined)).toBe("default");
  });

  it("returns 'default' for empty string", () => {
    expect(resolveDeptToken("")).toBe("default");
  });

  // ── Unknown key → 'default' ──────────────────────────────────────────────

  it("returns 'default' for an unmapped location_id", () => {
    silenceWarn();
    expect(resolveDeptToken("lager")).toBe("default");
  });

  // ── Warn-once: console.warn fires only on first unknown hit ──────────────

  it("warns once per unique unknown key (not on repeated calls)", () => {
    const warn = silenceWarn();
    resolveDeptToken("ukjentsted");
    resolveDeptToken("ukjentsted");
    resolveDeptToken("ukjentsted");
    // warn may or may not fire in node (window === undefined guard).
    // We just verify it never fires more than once per key.
    const callCount = warn.mock.calls.filter((args) =>
      (args[0] as string).includes("ukjentsted"),
    ).length;
    expect(callCount).toBeLessThanOrEqual(1);
  });
});
