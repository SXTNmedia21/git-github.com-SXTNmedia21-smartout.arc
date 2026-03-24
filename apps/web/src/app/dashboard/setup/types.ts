/**
 * SetupState — unified state shape for the Dashboard Setup wizard.
 *
 * Maps the existing SetupWizardState from wizard-state.ts into a
 * Record<string, unknown> compatible type for WizardShell.
 *
 * Each step reads and writes the subset it needs via updateState().
 */

import type { IndustryPackage, IndustryType } from "@/lib/industry/types";
import type {
  ScrapedIntelligence,
  DocumentExtractionResult,
  TeamMember,
} from "@/components/dashboard/wizard-steps/wizard-state";

export interface SetupState extends Record<string, unknown> {
  /** Scraped/enriched company data from onboarding intelligence */
  scrapedData: ScrapedIntelligence;

  /** Extracted document analysis results */
  extractedData: DocumentExtractionResult;

  /** Active industry package (hospitality, retail, etc.) */
  industryPackage: IndustryPackage | null;

  /** Detected/selected industry type */
  detectedIndustry: IndustryType;

  /** IDs of policies created during governance step */
  createdPolicyIds: string[];

  /** Whether payroll setup has been saved */
  payrollSaved: boolean;

  /** Whether employment terms have been saved */
  employmentSaved: boolean;

  /** Number of invitations sent */
  invitedCount: number;

  /** Number of shift templates created */
  shiftTemplateCount: number;

  /** Whether a season has been created */
  seasonCreated: boolean;

  /** Team members added in the team step (persisted on wizard completion) */
  teamMembers: TeamMember[];

  /** Workspace ID — set on load from context */
  workspaceId: string;

  /** Profile ID of the current user — set on load from context */
  profileId: string;
}

export const defaultSetupState: SetupState = {
  scrapedData: {},
  extractedData: {},
  industryPackage: null,
  detectedIndustry: "hospitality",
  createdPolicyIds: [],
  payrollSaved: false,
  employmentSaved: false,
  invitedCount: 0,
  shiftTemplateCount: 0,
  seasonCreated: false,
  teamMembers: [],
  workspaceId: "",
  profileId: "",
};
