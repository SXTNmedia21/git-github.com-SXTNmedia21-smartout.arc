import { describe, it, expect } from "vitest";
import {
  HOSPITALITY_TARIFF_RATES,
  DEPARTMENT_TYPE_MAP,
  DEPARTMENT_OFFSET_DEFAULTS,
  PAYROLL_PROFILE_TEMPLATES,
  ADMINISTRATIVE_DEFAULT_HOURS,
  HOSPITALITY_DEFAULT_HOURS,
  lookupDepartmentType,
  hospitalityPackage,
} from "@smartout/ai/industry";

describe("hospitality industry package", () => {
  describe("tariff rates", () => {
    it("has correct Riksavtalen tariff rates", () => {
      const kveld = HOSPITALITY_TARIFF_RATES.find((r) => r.rateType === "kveldstillegg");
      expect(kveld?.amount).toBe(15.65);
      expect(kveld?.unit).toBe("kr/t");

      const helg = HOSPITALITY_TARIFF_RATES.find((r) => r.rateType === "helgetillegg");
      expect(helg?.amount).toBe(29.74);

      const hellig = HOSPITALITY_TARIFF_RATES.find((r) => r.rateType === "helligdagstillegg");
      expect(hellig?.amount).toBe(100);
      expect(hellig?.unit).toBe("percent");
    });

    it("has 5 tariff rate entries", () => {
      expect(HOSPITALITY_TARIFF_RATES).toHaveLength(5);
    });

    it("hospitalityPackage tariffs also have correct rates", () => {
      const riksavtalen = hospitalityPackage.tariffs.find((t) => t.key === "riksavtalen");
      expect(riksavtalen?.supplements.kveldstillegg.rate).toBe(15.65);
      expect(riksavtalen?.supplements.helgetillegg.rate).toBe(29.74);
      expect(riksavtalen?.supplements.helligdagstillegg.rate).toBe(100);
    });
  });

  describe("department type mapping", () => {
    it("maps operational departments correctly", () => {
      expect(DEPARTMENT_TYPE_MAP["Kjøkken"]!.type).toBe("operational");
      expect(DEPARTMENT_TYPE_MAP["Sal"]!.type).toBe("operational");
      expect(DEPARTMENT_TYPE_MAP["Bar"]!.type).toBe("operational");
    });

    it("maps administrative departments correctly", () => {
      expect(DEPARTMENT_TYPE_MAP["Kontor"]!.type).toBe("administrative");
      expect(DEPARTMENT_TYPE_MAP["HR"]!.type).toBe("administrative");
      expect(DEPARTMENT_TYPE_MAP["Regnskap"]!.type).toBe("administrative");
    });

    it("includes confidence for all mappings", () => {
      for (const [, value] of Object.entries(DEPARTMENT_TYPE_MAP)) {
        expect(["high", "medium", "low"]).toContain(value.confidence);
      }
    });
  });

  describe("lookupDepartmentType", () => {
    it("matches exact names", () => {
      expect(lookupDepartmentType("Kjøkken")?.type).toBe("operational");
      expect(lookupDepartmentType("Kontor")?.type).toBe("administrative");
    });

    it("matches case-insensitively", () => {
      expect(lookupDepartmentType("kjøkken")?.type).toBe("operational");
      expect(lookupDepartmentType("KJØKKEN")?.type).toBe("operational");
      expect(lookupDepartmentType("kontor")?.type).toBe("administrative");
    });

    it("trims whitespace", () => {
      expect(lookupDepartmentType("  Kjøkken  ")?.type).toBe("operational");
    });

    it("handles diacritics substitution (ø → o)", () => {
      expect(lookupDepartmentType("Kjokken")?.type).toBe("operational");
    });

    it("returns null for unknown departments", () => {
      expect(lookupDepartmentType("unknown dept")).toBeNull();
      expect(lookupDepartmentType("")).toBeNull();
    });
  });

  describe("department offset defaults", () => {
    it("kitchen opens 2h before workspace", () => {
      expect(DEPARTMENT_OFFSET_DEFAULTS["Kjøkken"]!.openOffset).toBe(-120);
      expect(DEPARTMENT_OFFSET_DEFAULTS["Kjøkken"]!.closeOffset).toBe(0);
    });

    it("floor/sal opens 1h before workspace", () => {
      expect(DEPARTMENT_OFFSET_DEFAULTS["Sal"]!.openOffset).toBe(-60);
    });

    it("bar has no offset", () => {
      expect(DEPARTMENT_OFFSET_DEFAULTS["Bar"]!.openOffset).toBe(0);
    });

    it("bar ute opens 4h after workspace", () => {
      expect(DEPARTMENT_OFFSET_DEFAULTS["Bar ute"]!.openOffset).toBe(240);
    });
  });

  describe("payroll profile templates", () => {
    it("has at least 4 templates", () => {
      expect(PAYROLL_PROFILE_TEMPLATES.length).toBeGreaterThanOrEqual(4);
    });

    it("servitør heltid template is correct", () => {
      const servitor = PAYROLL_PROFILE_TEMPLATES.find((t) => t.name === "Servitør heltid");
      expect(servitor?.salaryType).toBe("hourly");
      expect(servitor?.weeklyHours).toBe(37.5);
      expect(servitor?.tariffCategory).toBe("ufaglart");
      expect(servitor?.employmentCategory).toBe("fast");
    });

    it("leder template is monthly", () => {
      const leder = PAYROLL_PROFILE_TEMPLATES.find((t) => t.name === "Leder");
      expect(leder?.salaryType).toBe("monthly");
    });
  });

  describe("default hours", () => {
    it("administrative: 09-17 Mon-Fri, closed weekends", () => {
      expect(ADMINISTRATIVE_DEFAULT_HOURS).toHaveLength(7);
      expect(ADMINISTRATIVE_DEFAULT_HOURS[0].openTime).toBe("09:00");
      expect(ADMINISTRATIVE_DEFAULT_HOURS[5].isClosed).toBe(true);
      expect(ADMINISTRATIVE_DEFAULT_HOURS[6].isClosed).toBe(true);
    });

    it("hospitality: 11-23 Mon-Sat, 12-22 Sun", () => {
      expect(HOSPITALITY_DEFAULT_HOURS).toHaveLength(7);
      expect(HOSPITALITY_DEFAULT_HOURS[0].openTime).toBe("11:00");
      expect(HOSPITALITY_DEFAULT_HOURS[0].closeTime).toBe("23:00");
      expect(HOSPITALITY_DEFAULT_HOURS[6].openTime).toBe("12:00");
      expect(HOSPITALITY_DEFAULT_HOURS[6].closeTime).toBe("22:00");
    });
  });
});
