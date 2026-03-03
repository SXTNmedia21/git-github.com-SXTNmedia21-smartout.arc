import type { DepartmentOption } from "../types";

export const INDUSTRY_NACE_MAP: Record<string, string> = {
  restaurant: "56.101",
  kafé: "56.101",
  hotell: "55.101",
  bar: "56.301",
  catering: "56.210",
};

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

export function getDepartmentsForIndustry(naceCode: string): DepartmentOption[] {
  const config = DEPARTMENT_CONFIGS[naceCode] ?? DEPARTMENT_CONFIGS["default"]!;
  return config.map((dept, i) => ({
    id: `dept-${i}`,
    name: dept.name,
    icon: dept.icon,
    selected: dept.preselected,
    positions: POSITION_MAP[dept.name] ?? [],
  }));
}

export function getPositionsForDepartment(departmentName: string): string[] {
  return POSITION_MAP[departmentName] ?? [];
}

export function resolveNaceCode(industry: string): string {
  const lower = industry.toLowerCase();
  for (const [keyword, code] of Object.entries(INDUSTRY_NACE_MAP)) {
    if (lower.includes(keyword)) return code;
  }
  return "default";
}
