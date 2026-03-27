/**
 * Onboarding-specific adapters for industry defaults.
 *
 * Maps canonical IndustrySuggestion from @smartout/ai/industry
 * to onboarding wizard state types (DepartmentOption, ProcedureData).
 */

import {
  getDepartmentsForIndustry as getRawDepartments,
  getProceduresForIndustry as getRawProcedures,
} from "@smartout/ai/industry";
import type { DepartmentOption, ProcedureData } from "../types";

/** Names that count as "opening" or "closing" procedures */
const OPENING_NAMES = ["åpningsrutine", "innsjekk-rutine"];
const CLOSING_NAMES = ["stengerutine", "lukkerutine", "utsjekk-rutine"];

/** Get departments mapped to onboarding wizard state shape */
export function getDepartmentsForIndustry(naceCode: string): DepartmentOption[] {
  const suggestions = getRawDepartments(naceCode);
  return suggestions.map((dept, i) => ({
    id: `dept-${i}`,
    name: dept.name,
    icon: dept.icon,
    selected: dept.preselected,
    positions: dept.positions,
  }));
}

/** Get procedures mapped to onboarding wizard state shape */
export function getProceduresForIndustry(naceCode: string): ProcedureData[] {
  const suggestions = getRawProcedures(naceCode);

  const procedures: ProcedureData[] = suggestions.map((proc, i) => {
    const lower = proc.name.toLowerCase();
    const isRecommended = OPENING_NAMES.includes(lower) || CLOSING_NAMES.includes(lower);
    return {
      id: `proc-${i}`,
      name: proc.name,
      selected: proc.preselected,
      isCustom: false,
      recommended: isRecommended,
    };
  });

  // Ensure opening + closing are always present
  const hasOpening = procedures.some((p) => OPENING_NAMES.includes(p.name.toLowerCase()));
  const hasClosing = procedures.some((p) => CLOSING_NAMES.includes(p.name.toLowerCase()));

  if (!hasOpening) {
    procedures.unshift({
      id: "proc-open-default",
      name: "Åpningsrutine",
      selected: true,
      isCustom: false,
      recommended: true,
    });
  }

  if (!hasClosing) {
    procedures.splice(hasOpening ? 1 : 1, 0, {
      id: "proc-close-default",
      name: "Lukkerutine",
      selected: true,
      isCustom: false,
      recommended: true,
    });
  }

  return procedures;
}

// Re-export unchanged functions and constants
export {
  getPositionsForDepartment,
  resolveNaceCode,
  INDUSTRY_NACE_MAP,
} from "@smartout/ai/industry";
