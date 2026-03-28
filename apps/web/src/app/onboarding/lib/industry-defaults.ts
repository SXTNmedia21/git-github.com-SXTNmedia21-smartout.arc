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
import type { DepartmentOption, PositionOption, ProcedureData } from "../types";
import type { PositionTemplate } from "@smartout/types";

/** Names that count as "opening" or "closing" procedures */
const OPENING_NAMES = ["åpningsrutine", "innsjekk-rutine"];
const CLOSING_NAMES = ["stengerutine", "lukkerutine", "utsjekk-rutine"];

/** Tier thresholds — positions at or below this tier are pre-selected */
function getMaxPreselectedTier(employeeCount: number): "basis" | "mid" | "specialist" {
  if (employeeCount >= 16) return "specialist";
  if (employeeCount >= 6) return "mid";
  return "basis";
}

/** How many non-leader positions to pre-select per tier threshold */
function getPreselectedCount(employeeCount: number): number {
  if (employeeCount >= 30) return 6;
  if (employeeCount >= 16) return 4;
  if (employeeCount >= 6) return 3;
  return 1;
}

const TIER_ORDER: Record<string, number> = { basis: 0, mid: 1, specialist: 2 };

function buildPositionOptions(
  templates: PositionTemplate[],
  employeeCount: number,
): PositionOption[] {
  const maxTier = getMaxPreselectedTier(employeeCount);
  const maxPreselected = getPreselectedCount(employeeCount);

  const sorted = [...templates].sort((a, b) => TIER_ORDER[a.tier]! - TIER_ORDER[b.tier]!);

  let nonLeaderCount = 0;
  return sorted.map((t, i) => {
    const withinTier = TIER_ORDER[t.tier]! <= TIER_ORDER[maxTier]!;
    let selected: boolean;

    if (t.isLeader) {
      selected = withinTier;
    } else {
      selected = withinTier && nonLeaderCount < maxPreselected;
      if (withinTier) nonLeaderCount++;
    }

    return {
      id: `pos-${i}-${t.name.toLowerCase().replace(/\s/g, "-")}`,
      name: t.name,
      isLeader: t.isLeader,
      selected,
    };
  });
}

/** Get departments mapped to onboarding wizard state shape */
export function getDepartmentsForIndustry(naceCode: string, employeeCount = 5): DepartmentOption[] {
  const suggestions = getRawDepartments(naceCode);
  return suggestions.map((dept, i) => ({
    id: `dept-${i}`,
    name: dept.name,
    icon: dept.icon,
    selected: dept.preselected,
    positions: dept.positionTemplates
      ? buildPositionOptions(dept.positionTemplates, employeeCount)
      : dept.positions.map((name, j) => ({
          id: `pos-${j}-${name.toLowerCase().replace(/\s/g, "-")}`,
          name,
          isLeader: j === 0,
          selected: true,
        })),
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
