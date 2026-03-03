/**
 * onboarding/types.ts
 * Shared types for the onboarding wizard.
 * All step components and the useOnboardingWizard hook import from here.
 */

/** All possible wizard steps in order. */
export const WIZARD_STEPS = [
  "init",
  "crawling",
  "auth",
  "org_verification",
  "branding",
  "season_education",
  "season_identity",
  "departments",
  "teams",
  "locations",
  "procedures",
  "battlefield_review",
  "finalizing",
  "invite",
  "done",
] as const;

export type WizardStep = (typeof WIZARD_STEPS)[number];

/**
 * Maps step names to onboarding_session.current_step integer values.
 * The DB column is integer, so we need this mapping for progressive save.
 */
export const STEP_INDEX: Record<WizardStep, number> = Object.fromEntries(
  WIZARD_STEPS.map((step, i) => [step, i]),
) as Record<WizardStep, number>;

/** Reverse mapping: integer -> step name for session resume. */
export function stepFromIndex(index: number): WizardStep {
  return WIZARD_STEPS[index] ?? "init";
}

export interface CoreLocation {
  id?: string;
  name: string;
  description?: string;
  type?: string;
  [key: string]: unknown;
}

export interface CoreTeam {
  id?: string;
  name: string;
  description?: string;
  roles?: string[];
  isMultiDepartment?: boolean;
  [key: string]: unknown;
}

export interface CoreDepartment {
  id?: string;
  name: string;
  description?: string;
  teams?: CoreTeam[];
  isSeasonActive?: boolean;
  [key: string]: unknown;
}

export interface CoreProcedure {
  id?: string;
  title: string;
  description?: string;
  urgency?: string;
  assignedTo?: string;
  [key: string]: unknown;
}

export interface Policy {
  id: string;
  title: string;
  summary: string;
}

/** Full workspace data accumulated across all wizard steps. */
export interface WorkspaceData {
  name: string;
  website: string;
  email: string;
  phone: string;
  address: string;
  ceo: string;
  employeeCount: string;
  industry: string;
  concept: string;
  summary: string;
  slogan: string;
  locations: CoreLocation[];
  departments: CoreDepartment[];
  multiDepartmentTeams: CoreTeam[];
  procedures: CoreProcedure[];
  policies: Policy[];
  pageDictionary: Record<string, string>;
  images: { src: string; alt: string }[];
  menus: { href: string; text: string }[];
  socialLinks: Record<string, string>;
  reservationUrl: string | null;
  orgNumber: string;
  naceCode: string;
  brandColor: string;
  communicationTone: string;
  seasonName: string;
  seasonStartDate: string;
  seasonEndDate: string;
  seasonType: string;
}

/** Default empty workspace data for wizard initialization. */
export const EMPTY_WORKSPACE_DATA: WorkspaceData = {
  name: "",
  website: "",
  email: "",
  phone: "",
  address: "",
  ceo: "",
  employeeCount: "",
  industry: "",
  concept: "",
  summary: "",
  slogan: "",
  locations: [],
  departments: [],
  multiDepartmentTeams: [],
  procedures: [],
  policies: [],
  pageDictionary: {},
  images: [],
  menus: [],
  socialLinks: {},
  reservationUrl: null,
  orgNumber: "",
  naceCode: "",
  brandColor: "#3B82F6",
  communicationTone: "Professional & Formal",
  seasonName: "Core Operations",
  seasonStartDate: "",
  seasonEndDate: "",
  seasonType: "default",
};

/** Verified org data from Bronnoydsundregistrene lookup. */
export interface VerifiedOrgData {
  name: string;
  address: string;
  ceo: string;
  employeeCount?: string;
  industry?: string;
  description?: string;
}

/** Props that every step component receives from the wizard context. */
export interface WizardContext {
  step: WizardStep;
  goTo: (step: WizardStep) => void;
  workspaceData: WorkspaceData;
  updateData: (partial: Partial<WorkspaceData>) => void;
  sessionId: string | null;
  isAuthenticated: boolean;
  userId: string | null;
  error: string | null;
  setError: (error: string | null) => void;

  /** Org verification state */
  orgNumberInput: string;
  setOrgNumberInput: (value: string) => void;
  verifiedOrgData: VerifiedOrgData | null;
  setVerifiedOrgData: (data: VerifiedOrgData | null) => void;

  /** Workspace activation result */
  activatedWorkspaceId: string | null;
  activatedWorkspaceSlug: string | null;

  /** Finalize the workspace (call activate_workspace_v3) */
  finalize: () => Promise<void>;
}
