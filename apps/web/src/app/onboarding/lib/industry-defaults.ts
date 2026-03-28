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
import type { DepartmentOption, PositionOption, ProcedureData, ProfessionOption } from "../types";
import type { PositionTemplate } from "@smartout/types";
import { createClient } from "@smartout/supabase/client";

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
      slug: t.name.toLowerCase().replace(/\s/g, "-"),
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
          slug: name.toLowerCase().replace(/\s/g, "-"),
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

/** Fetch platform professions relevant for a NACE code from DB */
export async function getProfessionsForIndustry(naceCode: string): Promise<ProfessionOption[]> {
  const supabase = createClient();

  const { data: professions } = await supabase
    .from("profession")
    .select("profession_id, slug, name, is_universal, sort_order")
    .is("workspace_id", null)
    .order("sort_order");

  if (!professions) return [];

  const { data: industryLinks } = await supabase
    .from("profession_industry")
    .select("profession_id")
    .eq("nace_code", naceCode);

  const relevantIds = new Set(industryLinks?.map((l) => l.profession_id) ?? []);

  const filtered = professions.filter((p) => p.is_universal || relevantIds.has(p.profession_id));

  return filtered.map((p) => ({
    id: p.profession_id,
    slug: p.slug,
    name: p.name,
    isUniversal: p.is_universal,
    positions: getDefaultPositionsForProfession(p.slug),
  }));
}

/** Map profession slug to default positions */
function getDefaultPositionsForProfession(slug: string): PositionOption[] {
  const PROFESSION_POSITION_MAP: Record<string, { name: string; preselected: boolean }[]> = {
    kjokken: [
      { name: "Kokk", preselected: true },
      { name: "Sous Chef", preselected: false },
      { name: "Kjøkkenassistent", preselected: true },
    ],
    servering: [
      { name: "Servitør", preselected: true },
      { name: "Sommelier", preselected: false },
    ],
    bartending: [
      { name: "Bartender", preselected: true },
      { name: "Barback", preselected: false },
    ],
    ledelse: [
      { name: "Daglig leder", preselected: true },
      { name: "Skiftleder", preselected: true },
    ],
    renhold: [{ name: "Renholder", preselected: true }],
    resepsjon: [
      { name: "Resepsjonist", preselected: true },
      { name: "Nattevakt", preselected: false },
    ],
  };

  const positions = PROFESSION_POSITION_MAP[slug] ?? [];
  return positions.map((pos, i) => ({
    id: `pos-${slug}-${i}`,
    name: pos.name,
    slug: pos.name.toLowerCase().replace(/\s+/g, "-"),
    isLeader: false,
    selected: pos.preselected,
  }));
}
