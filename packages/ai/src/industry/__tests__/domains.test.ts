import { describe, it, expect } from "vitest";

import type { Domain, HospitalityDomain } from "@smartout/types";

import { defaultPackage } from "../packages/default.js";
import { hospitalityPackage, HOSPITALITY_DOMAINS } from "../packages/hospitality.js";

/**
 * Unit tests for the hospitality domain taxonomy (Phase 2 helpdesk routing).
 *
 * These tests guard the shape and policy invariants that the Phase 2
 * Botsson classifier will rely on. They are intentionally mechanical —
 * they do not call the classifier, they only verify that the taxonomy
 * itself is well-formed.
 *
 * Invariants:
 *   1. Hospitality package exports a non-empty domain list.
 *   2. Every domain has all five required fields with correct primitive
 *      types and non-empty strings where required.
 *   3. Domain IDs are unique (no duplicates).
 *   4. PII-adjacent domains (payroll, hr_personal) MUST default to
 *      voice-forbidden per ADR-0078 / ADR-0163. hms_safety and `other`
 *      are also voice-forbidden by default (sykemelding is a
 *      helseopplysning; `other` is the conservative fallback).
 *   5. Operational domains that are NOT PII-adjacent default to
 *      voice-allowed.
 *   6. Non-fallback domains carry at least one Norwegian seed keyword;
 *      `other` is allowed to be empty (it is the fallback bucket).
 *   7. The `other` fallback domain is always present.
 *   8. Non-hospitality packages may expose an empty domains array
 *      without breaking the shape contract.
 */

describe("hospitality domain taxonomy", () => {
  it("is exported both as a standalone constant and on the package", () => {
    expect(HOSPITALITY_DOMAINS.length).toBeGreaterThan(0);
    expect(hospitalityPackage.domains).toBe(HOSPITALITY_DOMAINS);
  });

  it("contains the canonical `other` fallback bucket", () => {
    const fallback = HOSPITALITY_DOMAINS.find((d) => d.id === "other");
    expect(fallback).toBeDefined();
    expect(fallback?.default_voice_allowed).toBe(false);
  });

  it("has unique domain IDs", () => {
    const ids = HOSPITALITY_DOMAINS.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  describe("per-domain shape", () => {
    it.each(HOSPITALITY_DOMAINS)("domain %# has all required fields", (domain: Domain) => {
      expect(typeof domain.id).toBe("string");
      expect(domain.id.length).toBeGreaterThan(0);

      expect(typeof domain.label).toBe("string");
      expect(domain.label.length).toBeGreaterThan(0);

      expect(typeof domain.description).toBe("string");
      expect(domain.description.length).toBeGreaterThan(0);

      expect(typeof domain.default_voice_allowed).toBe("boolean");

      expect(Array.isArray(domain.keywords)).toBe(true);
      for (const keyword of domain.keywords) {
        expect(typeof keyword).toBe("string");
        expect(keyword.length).toBeGreaterThan(0);
      }
    });
  });

  describe("voice-policy invariants (ADR-0078 / ADR-0163)", () => {
    const voiceForbidden: HospitalityDomain[] = ["payroll", "hr_personal", "hms_safety", "other"];

    it.each(voiceForbidden)("`%s` defaults to voice-forbidden", (id) => {
      const domain = HOSPITALITY_DOMAINS.find((d) => d.id === id);
      expect(domain).toBeDefined();
      expect(domain?.default_voice_allowed).toBe(false);
    });

    const voiceAllowed: HospitalityDomain[] = [
      "scheduling",
      "food_safety",
      "bar_operations",
      "kitchen_operations",
      "service_standards",
      "training",
      "equipment",
    ];

    it.each(voiceAllowed)("`%s` defaults to voice-allowed", (id) => {
      const domain = HOSPITALITY_DOMAINS.find((d) => d.id === id);
      expect(domain).toBeDefined();
      expect(domain?.default_voice_allowed).toBe(true);
    });
  });

  describe("seed keywords", () => {
    it("every non-fallback domain has at least one keyword", () => {
      for (const domain of HOSPITALITY_DOMAINS) {
        if (domain.id === "other") continue;
        expect(domain.keywords.length).toBeGreaterThan(0);
      }
    });

    it("keywords are lowercase (classifier normalization contract)", () => {
      for (const domain of HOSPITALITY_DOMAINS) {
        for (const keyword of domain.keywords) {
          expect(keyword).toBe(keyword.toLowerCase());
        }
      }
    });
  });
});

describe("non-hospitality industry packages", () => {
  it("default package exposes an empty domains array", () => {
    expect(Array.isArray(defaultPackage.domains)).toBe(true);
    expect(defaultPackage.domains?.length).toBe(0);
  });
});
