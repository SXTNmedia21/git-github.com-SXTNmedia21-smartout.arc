/**
 * @deprecated Import from @smartout/ai/industry instead.
 * This file exists only for backward compatibility during migration.
 */

export {
  INDUSTRY_NACE_MAP,
  getDepartmentsForIndustry,
  getPositionsForDepartment,
  getProceduresForIndustry,
  resolveNaceCode,
} from "../../industry/defaults.js";

export type { IndustrySuggestion as DepartmentSuggestion } from "@smartout/types";
export type { IndustryProcedureSuggestion as ProcedureSuggestion } from "@smartout/types";
