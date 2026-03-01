/**
 * subdomain.test.ts
 * Unit tests for subdomain extraction and reserved slug validation.
 * Ensures all 19 reserved slugs are correctly identified and routed.
 */
import { describe, it, expect } from "vitest";
import { extractSubdomain, RESERVED_SUBDOMAINS } from "../subdomain";

describe("extractSubdomain", () => {
  it("detects workspace slugs in production", () => {
    const result = extractSubdomain("peppes.smartout.ai");
    expect(result).toEqual({ type: "workspace", slug: "peppes" });
  });

  it("detects portal in production", () => {
    const result = extractSubdomain("app.smartout.ai");
    expect(result).toEqual({ type: "portal" });
  });

  it("detects root domain", () => {
    const result = extractSubdomain("smartout.ai");
    expect(result).toEqual({ type: "root" });
  });

  it("detects workspace slugs in development", () => {
    const result = extractSubdomain("peppes.localhost:3050");
    expect(result).toEqual({ type: "workspace", slug: "peppes" });
  });

  it("detects portal in development", () => {
    const result = extractSubdomain("app.localhost:3050");
    expect(result).toEqual({ type: "portal" });
  });

  it("treats unknown domains as root", () => {
    const result = extractSubdomain("random-preview.vercel.app");
    expect(result).toEqual({ type: "root" });
  });
});

describe("RESERVED_SUBDOMAINS", () => {
  const ALL_RESERVED = [
    "app",
    "api",
    "docs",
    "www",
    "admin",
    "status",
    "voice",
    "staging",
    "dev",
    "mail",
    "smtp",
    "ftp",
    "cdn",
    "assets",
    "static",
    "media",
    "blog",
    "help",
    "support",
  ];

  it("contains all 19 reserved slugs", () => {
    expect(RESERVED_SUBDOMAINS.size).toBe(19);
    for (const slug of ALL_RESERVED) {
      expect(RESERVED_SUBDOMAINS.has(slug)).toBe(true);
    }
  });

  /**
   * Production routing for reserved slugs.
   *
   * Special cases:
   * - "app" returns { type: "portal" } — explicit check before reserved set
   * - "www" returns { type: "root" } — explicit check for www.{rootDomain}
   * - All others return { type: "reserved", subdomain: slug }
   */
  it.each(ALL_RESERVED)("routes '%s' correctly in production", (slug) => {
    const result = extractSubdomain(`${slug}.smartout.ai`);
    if (slug === "app") {
      expect(result).toEqual({ type: "portal" });
    } else if (slug === "www") {
      // www.smartout.ai is treated as root domain alias, not as reserved
      expect(result).toEqual({ type: "root" });
    } else {
      expect(result).toEqual({ type: "reserved", subdomain: slug });
    }
  });

  /**
   * Development routing for reserved slugs.
   *
   * Special case: "app" returns { type: "portal" }
   * All others (including "www") return { type: "reserved" }
   * because there is no www.localhost alias check in dev mode.
   */
  it.each(ALL_RESERVED)("routes '%s' correctly in development", (slug) => {
    const result = extractSubdomain(`${slug}.localhost:3050`);
    if (slug === "app") {
      expect(result).toEqual({ type: "portal" });
    } else {
      expect(result).toEqual({ type: "reserved", subdomain: slug });
    }
  });
});
