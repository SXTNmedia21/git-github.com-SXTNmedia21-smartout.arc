/**
 * NACE code mappings and industry defaults — consolidated canonical source.
 *
 * Maps Norwegian industry codes (NACE) to default departments, positions,
 * and procedures for onboarding and AI tool pipelines.
 *
 * Previously existed in three copies — now single source of truth.
 */

import type { IndustrySuggestion, IndustryProcedureSuggestion } from "@smartout/types";

/** NACE code lookup from common industry keywords */
export const INDUSTRY_NACE_MAP: Record<string, string> = {
  restaurant: "56.101",
  kafé: "56.101",
  hotell: "55.101",
  bar: "56.301",
  catering: "56.210",
};

/** Department config per NACE code */
const DEPARTMENT_CONFIGS: Record<string, { name: string; icon: string; preselected: boolean }[]> = {
  "56.101": [
    { name: "Kjøkken", icon: "chef-hat", preselected: true },
    { name: "Sal", icon: "utensils", preselected: true },
    { name: "Bar", icon: "wine", preselected: true },
    { name: "Ledelse", icon: "briefcase", preselected: false },
    { name: "Event", icon: "calendar", preselected: false },
    { name: "Housekeeping", icon: "sparkles", preselected: false },
  ],
  "55.101": [
    { name: "Resepsjon", icon: "concierge-bell", preselected: true },
    { name: "Housekeeping", icon: "sparkles", preselected: true },
    { name: "Restaurant", icon: "utensils", preselected: true },
    { name: "Bar", icon: "wine", preselected: false },
    { name: "Ledelse", icon: "briefcase", preselected: false },
    { name: "Spa", icon: "droplets", preselected: false },
  ],
  "56.301": [
    { name: "Bar", icon: "wine", preselected: true },
    { name: "Kjøkken", icon: "chef-hat", preselected: true },
    { name: "Ledelse", icon: "briefcase", preselected: false },
  ],
  default: [
    { name: "Administrasjon", icon: "briefcase", preselected: true },
    { name: "Drift", icon: "settings", preselected: true },
    { name: "Kundeservice", icon: "headphones", preselected: false },
  ],
};

/** Position templates per department name */
const POSITION_MAP: Record<string, string[]> = {
  Kjøkken: ["Kokk", "Sous Chef", "Kjøkkenassistent"],
  Sal: ["Servitør", "Hovmester"],
  Bar: ["Bartender", "Barback"],
  Ledelse: ["Daglig leder", "Skiftleder"],
  Event: ["Eventkoordinator"],
  Housekeeping: ["Renholder"],
  Resepsjon: ["Resepsjonist", "Nattevakt"],
  Restaurant: ["Servitør", "Kokk", "Hovmester"],
  Spa: ["Terapeut", "Resepsjonist"],
  Administrasjon: ["Leder", "Koordinator"],
  Drift: ["Driftsansvarlig", "Tekniker"],
  Kundeservice: ["Kundebehandler"],
};

/** Procedure templates per NACE code */
const PROCEDURE_CONFIGS: Record<string, { name: string; preselected: boolean }[]> = {
  "56.101": [
    { name: "Temperaturkontroll", preselected: true },
    { name: "Allergenhåndtering", preselected: true },
    { name: "Åpningsrutine", preselected: true },
    { name: "Stengerutine", preselected: true },
    { name: "Varemottak", preselected: false },
    { name: "Renholdsplan", preselected: false },
    { name: "Brannrutine", preselected: false },
  ],
  "55.101": [
    { name: "Innsjekk-rutine", preselected: true },
    { name: "Utsjekk-rutine", preselected: true },
    { name: "Renholdsprotokoll", preselected: true },
    { name: "Brannrutine", preselected: true },
    { name: "Temperaturkontroll", preselected: false },
    { name: "Nattevakt-rutine", preselected: false },
  ],
  "56.301": [
    { name: "Åpningsrutine", preselected: true },
    { name: "Stengerutine", preselected: true },
    { name: "Alderskontroll", preselected: true },
    { name: "Renholdsplan", preselected: false },
    { name: "Brannrutine", preselected: false },
  ],
  default: [
    { name: "Åpningsrutine", preselected: true },
    { name: "Stengerutine", preselected: true },
    { name: "Brannrutine", preselected: true },
    { name: "HMS-sjekk", preselected: false },
  ],
};

/** Get suggested departments for a NACE code */
export function getDepartmentsForIndustry(naceCode: string): IndustrySuggestion[] {
  const config = DEPARTMENT_CONFIGS[naceCode] ?? DEPARTMENT_CONFIGS["default"]!;
  return config.map((dept) => ({
    name: dept.name,
    icon: dept.icon,
    preselected: dept.preselected,
    positions: POSITION_MAP[dept.name] ?? [],
  }));
}

/** Get positions for a specific department name */
export function getPositionsForDepartment(departmentName: string): string[] {
  return POSITION_MAP[departmentName] ?? [];
}

/** Get suggested procedures for a NACE code */
export function getProceduresForIndustry(naceCode: string): IndustryProcedureSuggestion[] {
  const config = PROCEDURE_CONFIGS[naceCode] ?? PROCEDURE_CONFIGS["default"]!;
  return config.map((proc) => ({
    name: proc.name,
    preselected: proc.preselected,
  }));
}

/** Resolve a human-readable industry string to a NACE code */
export function resolveNaceCode(industry: string): string {
  const lower = industry.toLowerCase();
  for (const [keyword, code] of Object.entries(INDUSTRY_NACE_MAP)) {
    if (lower.includes(keyword)) return code;
  }
  return "default";
}
