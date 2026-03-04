// ============================================
// index.ts — Intelligence Tool Exports
// Progressive intelligence pipeline tools for searching,
// identifying, and enriching Norwegian companies.
//
// Tools:
//   search_company  — Brreg name search, returns candidates
//   identify_company — Full Brreg details + daglig leder
//
// Helpers:
//   brreg.ts          — Raw Brreg API functions
//   data-merger.ts    — Merge multiple data sources
//   industry-defaults — NACE code → departments/procedures
//
// Types:
//   BrregCandidate, IdentifiedCompany, PlacesData, ScrapedData, etc.
// ============================================

// Tools
export { searchCompany } from "./search-company";
export { identifyCompany } from "./identify-company";

// Tool context
export type { IntelligenceToolContext } from "./types";

// Type exports
export type {
  BrregEntity,
  BrregMatch,
  BrregCandidate,
  IdentifiedCompany,
  PlacesData,
  ScrapedData,
  IntelligenceResult,
  SearchBrregResponse,
  IdentifyCompanyResponse,
  ScrapeWebsiteResponse,
  SearchCompanyToolResult,
  IdentifyCompanyToolResult,
  ScrapeWebsiteToolResult,
} from "./types";

// Brreg helpers
export {
  normalizeName,
  scoreBrregMatch,
  searchBrregByName,
  searchBrregByNameAll,
  fetchBrregDetails,
  fetchDagligLeder,
  toBrregCandidates,
} from "./brreg";

// Data merger
export { mergeBusinessData } from "./data-merger";
export type { MergedBusinessData } from "./data-merger";

// Industry defaults
export {
  INDUSTRY_NACE_MAP,
  getDepartmentsForIndustry,
  getPositionsForDepartment,
  getProceduresForIndustry,
  resolveNaceCode,
} from "./industry-defaults";
export type { DepartmentSuggestion, ProcedureSuggestion } from "./industry-defaults";

// Tool collection
import { searchCompany } from "./search-company";
import { identifyCompany } from "./identify-company";
import type { SmartoutTool } from "../../types";
import type { IntelligenceToolContext } from "./types";

export const INTELLIGENCE_TOOLS = [searchCompany, identifyCompany] as unknown as ReadonlyArray<
  SmartoutTool<IntelligenceToolContext>
>;
