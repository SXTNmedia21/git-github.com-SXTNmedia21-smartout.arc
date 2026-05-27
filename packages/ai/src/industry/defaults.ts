/**
 * NACE code mappings and industry defaults — consolidated canonical source.
 *
 * Maps Norwegian industry codes (NACE) to default departments, positions,
 * and procedures for onboarding and AI tool pipelines.
 *
 * Previously existed in three copies — now single source of truth.
 */

import type {
  IndustrySuggestion,
  IndustryProcedureSuggestion,
  PositionTemplate,
} from "@smartout/types";

/** NACE code lookup from common industry keywords */
export const INDUSTRY_NACE_MAP: Record<string, string> = {
  restaurant: "56.101",
  kafé: "56.101",
  hotell: "55.101",
  bar: "56.301",
  catering: "56.210",
};

/** Department config per NACE code */
// ADR-0429: Restaurant default is FoH / BoH / Admin (replaces Kjøkken/Sal/Bar/Ledelse).
// Bar and Events are size-conditional extras offered via wizard toggles, not default-selected.
const DEPARTMENT_CONFIGS: Record<string, { name: string; icon: string; preselected: boolean }[]> = {
  "56.101": [
    { name: "FoH", icon: "utensils", preselected: true },
    { name: "BoH", icon: "chef-hat", preselected: true },
    { name: "Admin", icon: "briefcase", preselected: true },
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

/** Tiered position registry — tier controls visibility by employee count */
// ADR-0429: FoH/BoH/Admin position sets per department canonical.
// Bar positions are kept for optional Bar dept (size-conditional wizard toggle).
const POSITION_REGISTRY: Record<string, PositionTemplate[]> = {
  // ADR-0429 canonical restaurant departments
  FoH: [
    { name: "Hovmester", isLeader: true, tier: "basis" },
    { name: "Servitør", isLeader: false, tier: "basis" },
    { name: "Bartender", isLeader: false, tier: "basis" },
    { name: "Runner", isLeader: false, tier: "mid" },
    { name: "Sommelier", isLeader: false, tier: "specialist" },
    { name: "Hostess", isLeader: false, tier: "specialist" },
  ],
  BoH: [
    { name: "Kjøkkensjef", isLeader: true, tier: "basis" },
    { name: "Kokk", isLeader: false, tier: "basis" },
    { name: "Oppvask", isLeader: false, tier: "basis" },
    { name: "Sous Chef", isLeader: false, tier: "mid" },
    { name: "Lærling", isLeader: false, tier: "mid" },
    { name: "Stewarding", isLeader: false, tier: "specialist" },
  ],
  Admin: [
    { name: "Daglig leder", isLeader: true, tier: "basis" },
    { name: "Eier", isLeader: true, tier: "basis" },
    { name: "Regnskap", isLeader: false, tier: "mid" },
    { name: "HR", isLeader: false, tier: "mid" },
    { name: "Innkjøp", isLeader: false, tier: "specialist" },
  ],
  // Size-conditional Bar dept — activated via wizard toggle (ADR-0429 §size-conditional)
  Bar: [
    { name: "Barsjef", isLeader: true, tier: "basis" },
    { name: "Bartender", isLeader: false, tier: "basis" },
    { name: "Barback", isLeader: false, tier: "mid" },
  ],
  // Legacy keys retained for hotel (55.101) and bar-venue (56.301) NACE codes
  Kjøkken: [
    { name: "Kjøkkensjef", isLeader: true, tier: "basis" },
    { name: "Kokk", isLeader: false, tier: "basis" },
    { name: "Sous Chef", isLeader: false, tier: "mid" },
    { name: "Kjøkkenassistent", isLeader: false, tier: "mid" },
    { name: "Gardemanger", isLeader: false, tier: "specialist" },
    { name: "Patissier", isLeader: false, tier: "specialist" },
    { name: "Oppvaskhjelp", isLeader: false, tier: "specialist" },
  ],
  Sal: [
    { name: "Hovmester", isLeader: true, tier: "basis" },
    { name: "Servitør", isLeader: false, tier: "basis" },
    { name: "Runner", isLeader: false, tier: "mid" },
    { name: "Sommelier", isLeader: false, tier: "specialist" },
    { name: "Vertinne", isLeader: false, tier: "specialist" },
  ],
  Ledelse: [
    { name: "Daglig leder", isLeader: true, tier: "basis" },
    { name: "Skiftleder", isLeader: false, tier: "mid" },
  ],
  Event: [
    { name: "Eventkoordinator", isLeader: true, tier: "basis" },
    { name: "Eventmedarbeider", isLeader: false, tier: "mid" },
  ],
  Housekeeping: [
    { name: "Renholder", isLeader: true, tier: "basis" },
    { name: "Renholdsansvarlig", isLeader: true, tier: "specialist" },
  ],
  Resepsjon: [
    { name: "Resepsjonist", isLeader: true, tier: "basis" },
    { name: "Nattevakt", isLeader: false, tier: "mid" },
  ],
  Restaurant: [
    { name: "Hovmester", isLeader: true, tier: "basis" },
    { name: "Servitør", isLeader: false, tier: "basis" },
    { name: "Kokk", isLeader: false, tier: "basis" },
  ],
  Spa: [
    { name: "Terapeut", isLeader: true, tier: "basis" },
    { name: "Resepsjonist", isLeader: false, tier: "mid" },
  ],
  Administrasjon: [
    { name: "Leder", isLeader: true, tier: "basis" },
    { name: "Koordinator", isLeader: false, tier: "mid" },
  ],
  Drift: [
    { name: "Driftsansvarlig", isLeader: true, tier: "basis" },
    { name: "Tekniker", isLeader: false, tier: "mid" },
  ],
  Kundeservice: [{ name: "Kundebehandler", isLeader: true, tier: "basis" }],
  Catering: [
    { name: "Cateringsjef", isLeader: true, tier: "basis" },
    { name: "Cateringmedarbeider", isLeader: false, tier: "mid" },
  ],
  Levering: [
    { name: "Sjåfør", isLeader: true, tier: "basis" },
    { name: "Leveringskoordinator", isLeader: true, tier: "specialist" },
  ],
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
    positions: (POSITION_REGISTRY[dept.name] ?? []).map((p) => p.name),
    positionTemplates: POSITION_REGISTRY[dept.name] ?? [],
  }));
}

/** Get tiered position templates for a department */
export function getPositionsForDepartment(departmentName: string): PositionTemplate[] {
  return POSITION_REGISTRY[departmentName] ?? [];
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
