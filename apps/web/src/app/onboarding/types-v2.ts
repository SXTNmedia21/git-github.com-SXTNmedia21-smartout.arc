/**
 * types-v2.ts — State shape for the onboarding confirmation wizard.
 *
 * The onboarding wizard loads pre-filled data from workspace.intelligence_data
 * (populated by the Join wizard + I1 bootstrap) and lets the user confirm
 * or adjust departments, locations, and procedures before finalizing.
 */

import type { BusinessData, DepartmentOption, LocationData, ProcedureData, ProfessionOption } from "./types";
import { EMPTY_BUSINESS_DATA } from "./types";

export interface OnboardingConfirmState extends Record<string, unknown> {
  /** Business identity — pre-filled from intelligence pipeline */
  business: BusinessData;

  /** Departments suggested by I1 based on NACE code */
  departments: DepartmentOption[];

  /** Locations scraped from website + Google Places */
  locations: LocationData[];

  /** Standard procedures for the industry vertical */
  procedures: ProcedureData[];

  /** Workspace being onboarded — null means no workspace found (redirect to /join) */
  workspaceId: string | null;

  /** Workspace slug for post-finalization redirect */
  workspaceSlug: string | null;

  /** Professions with positions, loaded from K1a platform data */
  professions: ProfessionOption[];
}

export const defaultOnboardingConfirmState: OnboardingConfirmState = {
  business: EMPTY_BUSINESS_DATA,
  departments: [],
  locations: [],
  procedures: [],
  workspaceId: null,
  workspaceSlug: null,
  professions: [],
};
