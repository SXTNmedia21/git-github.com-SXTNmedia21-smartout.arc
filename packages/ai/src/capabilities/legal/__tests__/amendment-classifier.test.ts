// packages/ai/src/capabilities/legal/__tests__/amendment-classifier.test.ts
//
// Unit tests for Aml. §14-6 amendment classifier (Phase 7f Track 5).
//
// Covers the rule matrix in amendment-classifier.ts:
//   - UP                — no-op, Riksavtalen revisjon (samme union, ny lov-versjon)
//   - MATERIAL          — union-bytte uten reduksjon, not-bound → tariff-bound,
//                         small lønn-justering < 15%
//   - ENDRINGSOPPSIGELSE — union-bytte med >5% rate reduksjon, tariff → non-bound,
//                          lønn-floor reduksjon ≥15%, stilling-/arbeidstid-endring
//
// Test names cite the Aml. paragraph the case enforces. reason strings are
// asserted to include the §-reference (defence against L-0176 drift between
// rule code and Norwegian-language audit text).

import { describe, it, expect } from "vitest";
import {
  classifyAmendment,
  type AmendmentPrevState,
  type AmendmentNextState,
} from "../amendment-classifier.js";

describe("classifyAmendment — Aml. §14-6 rule matrix", () => {
  // ── Case 1: same union, same law_version → UP ─────────────────────────────
  it("Aml. §14-6: no-op (same union, same law_version) → UP, no resigning", () => {
    const prev: AmendmentPrevState = {
      union_id: "taro-79",
      law_version: "2024-2026",
      is_tariff_bound: true,
      hourly_rate_floor_ore: 19850, // 198.50 kr/t i ore
    };
    const next: AmendmentNextState = { ...prev };

    const result = classifyAmendment(prev, next);

    expect(result.classifier).toBe("UP");
    expect(result.requires_resigning).toBe(false);
    expect(result.notice_period_days).toBeNull();
    expect(result.aml_refs).toContain("Aml. §14-6");
  });

  // ── Case 2: same union, new law_version (Riksavtalen revisjon) → UP ──────
  it("Riksavtalen §4 + Aml. §14-6 carve-out: same union + new law_version → UP", () => {
    const prev: AmendmentPrevState = {
      union_id: "taro-79",
      law_version: "2024-2026",
      is_tariff_bound: true,
      hourly_rate_floor_ore: 19850,
    };
    const next: AmendmentNextState = {
      union_id: "taro-79",
      law_version: "2025-mellomoppgjor",
      is_tariff_bound: true,
      hourly_rate_floor_ore: 20500, // satsoppjustering — forbedring
    };

    const result = classifyAmendment(prev, next);

    expect(result.classifier).toBe("UP");
    expect(result.requires_resigning).toBe(false);
    expect(result.reason).toContain("Riksavtalen");
    expect(result.aml_refs).toContain("Riksavtalen §4");
  });

  // ── Case 3: different union, same law_version → MATERIAL ──────────────────
  it("Aml. §14-6 bokstav m: different union, no rate reduction → MATERIAL (admin-commit)", () => {
    const prev: AmendmentPrevState = {
      union_id: "taro-79",
      law_version: "2024-2026",
      is_tariff_bound: true,
      hourly_rate_floor_ore: 19850,
    };
    const next: AmendmentNextState = {
      union_id: "taro-226",
      law_version: "2024-2026",
      is_tariff_bound: true,
      hourly_rate_floor_ore: 19900, // marginal improvement
    };

    const result = classifyAmendment(prev, next);

    expect(result.classifier).toBe("MATERIAL");
    expect(result.requires_resigning).toBe(false);
    expect(result.aml_refs).toContain("Aml. §14-6 bokstav m");
  });

  // ── Case 4: different union + significant rate delta → ENDRINGSOPPSIGELSE ─
  it("Aml. §15-7 analog: union-switch with >5% rate-floor drop → ENDRINGSOPPSIGELSE", () => {
    const prev: AmendmentPrevState = {
      union_id: "taro-79",
      law_version: "2024-2026",
      is_tariff_bound: true,
      hourly_rate_floor_ore: 19850, // 198.50 kr/t
    };
    const next: AmendmentNextState = {
      union_id: "taro-226",
      law_version: "2024-2026",
      is_tariff_bound: true,
      hourly_rate_floor_ore: 18000, // 180 kr/t — ~9.3% reduction
    };

    const result = classifyAmendment(prev, next);

    expect(result.classifier).toBe("ENDRINGSOPPSIGELSE");
    expect(result.requires_resigning).toBe(true);
    expect(result.notice_period_days).toBeGreaterThan(0);
    expect(result.aml_refs).toContain("Aml. §15-7");
    expect(result.aml_refs).toContain("Aml. §15-3");
  });

  // ── Case 5: tariff-bound → not-bound transition → ENDRINGSOPPSIGELSE ─────
  it("Aml. §14-6 bokstav m + §15-7: tariff-bound → non-bound → ENDRINGSOPPSIGELSE", () => {
    const prev: AmendmentPrevState = {
      union_id: "taro-79",
      law_version: "2024-2026",
      is_tariff_bound: true,
      hourly_rate_floor_ore: 19850,
    };
    const next: AmendmentNextState = {
      union_id: "non-bound",
      law_version: "n/a",
      is_tariff_bound: false,
      hourly_rate_floor_ore: null,
    };

    const result = classifyAmendment(prev, next);

    expect(result.classifier).toBe("ENDRINGSOPPSIGELSE");
    expect(result.requires_resigning).toBe(true);
    expect(result.reason).toContain("tariff");
    expect(result.aml_refs).toContain("Aml. §14-6 bokstav m");
    expect(result.aml_refs).toContain("Aml. §15-3");
  });

  // ── Case 6: not-bound → tariff-bound → MATERIAL (improvement) ────────────
  it("Aml. §14-6 bokstav m: not-bound → tariff-bound (improvement) → MATERIAL", () => {
    const prev: AmendmentPrevState = {
      union_id: "non-bound",
      law_version: "n/a",
      is_tariff_bound: false,
      hourly_rate_floor_ore: null,
    };
    const next: AmendmentNextState = {
      union_id: "taro-79",
      law_version: "2024-2026",
      is_tariff_bound: true,
      hourly_rate_floor_ore: 19850,
    };

    const result = classifyAmendment(prev, next);

    expect(result.classifier).toBe("MATERIAL");
    expect(result.requires_resigning).toBe(false);
    expect(result.reason).toContain("Forbedring");
    expect(result.aml_refs).toContain("Aml. §14-6 bokstav m");
  });

  // ── Case 7: lønn-floor change >15% → ENDRINGSOPPSIGELSE ──────────────────
  it("Aml. §14-6 bokstav b + §15-7: lønn reduksjon >15% → ENDRINGSOPPSIGELSE", () => {
    const prev: AmendmentPrevState = {
      union_id: "taro-79",
      law_version: "2024-2026",
      is_tariff_bound: true,
      monthly_salary_ore: 4_000_000, // 40 000 kr/mnd
    };
    const next: AmendmentNextState = {
      union_id: "taro-79",
      law_version: "2024-2026",
      is_tariff_bound: true,
      monthly_salary_ore: 3_200_000, // 32 000 kr/mnd = 20% reduksjon
    };

    const result = classifyAmendment(prev, next);

    expect(result.classifier).toBe("ENDRINGSOPPSIGELSE");
    expect(result.requires_resigning).toBe(true);
    expect(result.reason).toContain("20.0%");
    expect(result.aml_refs).toContain("Aml. §14-6 bokstav b");
    expect(result.aml_refs).toContain("Aml. §15-7");
  });

  // ── Case 8: stilling change → ENDRINGSOPPSIGELSE ─────────────────────────
  it("Aml. §14-6 bokstav c + §15-7: stilling-endring → ENDRINGSOPPSIGELSE", () => {
    const prev: AmendmentPrevState = {
      union_id: "taro-79",
      law_version: "2024-2026",
      is_tariff_bound: true,
      position_title: "Servitør",
    };
    const next: AmendmentNextState = {
      union_id: "taro-79",
      law_version: "2024-2026",
      is_tariff_bound: true,
      position_title: "Kjøkkenassistent",
    };

    const result = classifyAmendment(prev, next);

    expect(result.classifier).toBe("ENDRINGSOPPSIGELSE");
    expect(result.requires_resigning).toBe(true);
    expect(result.reason).toContain("Servitør");
    expect(result.reason).toContain("Kjøkkenassistent");
    expect(result.aml_refs).toContain("Aml. §14-6 bokstav c");
    expect(result.aml_refs).toContain("Aml. §15-7");
  });

  // ── Case 8b: arbeidstid change → ENDRINGSOPPSIGELSE ──────────────────────
  // Bokstav d (arbeidstid) — paired with case 8 (bokstav c) to lock both legs
  // of the same §14-6 load-bearing element check.
  it("Aml. §14-6 bokstav d + §15-7: arbeidstid-endring → ENDRINGSOPPSIGELSE", () => {
    const prev: AmendmentPrevState = {
      union_id: "taro-79",
      law_version: "2024-2026",
      is_tariff_bound: true,
      agreed_weekly_hours: 37.5,
    };
    const next: AmendmentNextState = {
      union_id: "taro-79",
      law_version: "2024-2026",
      is_tariff_bound: true,
      agreed_weekly_hours: 25, // permanent reduksjon i avtalt arbeidstid
    };

    const result = classifyAmendment(prev, next);

    expect(result.classifier).toBe("ENDRINGSOPPSIGELSE");
    expect(result.requires_resigning).toBe(true);
    expect(result.aml_refs).toContain("Aml. §14-6 bokstav d");
    expect(result.aml_refs).toContain("Aml. §15-3");
  });

  // ── Case 9: small lønn-reduksjon (<15%) → MATERIAL ───────────────────────
  // Confirms 15% threshold is a hard boundary, not a soft one. <15% is
  // gråsone (MEDIUM per LEGAL-FRAMEWORK.md §5) but classifier picks MATERIAL.
  it("Aml. §14-6 bokstav b: small lønn-reduksjon (5–14%) → MATERIAL (under 15%-terskel)", () => {
    const prev: AmendmentPrevState = {
      union_id: "taro-79",
      law_version: "2024-2026",
      is_tariff_bound: true,
      monthly_salary_ore: 4_000_000,
    };
    const next: AmendmentNextState = {
      union_id: "taro-79",
      law_version: "2024-2026",
      is_tariff_bound: true,
      monthly_salary_ore: 3_600_000, // 10% reduction
    };

    const result = classifyAmendment(prev, next);

    expect(result.classifier).toBe("MATERIAL");
    expect(result.requires_resigning).toBe(false);
    expect(result.reason).toContain("10.0%");
    expect(result.aml_refs).toContain("Aml. §14-6 bokstav b");
  });
});
