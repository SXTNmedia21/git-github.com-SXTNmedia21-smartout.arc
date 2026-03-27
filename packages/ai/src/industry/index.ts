/**
 * @smartout/ai/industry — Canonical Industry Intelligence Module
 *
 * Single source of truth for I1 industry bootstrap data:
 * - IndustryPackage configs (hospitality, default)
 * - NACE code mappings and department/position/procedure defaults
 * - Department type classification
 * - Runtime tariff loader with 3-tier fallback (workspace -> K1a -> hardcoded)
 *
 * Types are in @smartout/types (IndustryPackage, IndustryTariff, etc.)
 */

// Packages
export { hospitalityPackage } from "./packages/hospitality.js";
export {
  HOSPITALITY_TARIFF_RATES,
  PAYROLL_PROFILE_TEMPLATES,
  ADMINISTRATIVE_DEFAULT_HOURS,
  HOSPITALITY_DEFAULT_HOURS,
} from "./packages/hospitality.js";
export { defaultPackage } from "./packages/default.js";

// NACE defaults
export {
  INDUSTRY_NACE_MAP,
  getDepartmentsForIndustry,
  getPositionsForDepartment,
  getProceduresForIndustry,
  resolveNaceCode,
} from "./defaults.js";

// Department classification
export {
  DEPARTMENT_TYPE_MAP,
  DEPARTMENT_OFFSET_DEFAULTS,
  lookupDepartmentType,
} from "./department-classifier.js";

// Runtime loader
export { loadIndustryPackage, getStaticIndustryPackage } from "./loader.js";
