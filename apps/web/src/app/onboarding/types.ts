/**
 * onboarding/types.ts
 * Scroll-based onboarding type system.
 * Replaces the old 15-step wizard types.
 */

export const ONBOARDING_SECTIONS = [
  "hero",
  "business",
  "departments",
  "locations",
  "procedures",
  "season",
  "contract",
  "welcome",
] as const;

export type OnboardingSection = (typeof ONBOARDING_SECTIONS)[number];

/** Sections currently visible in the onboarding flow (contract skipped for now) */
export const VISIBLE_SECTIONS = ONBOARDING_SECTIONS.filter(
  (s): s is OnboardingSection => s !== "contract",
);

/** Section-level progress tracking */
export interface SectionProgress {
  section: OnboardingSection;
  status: "locked" | "active" | "completed";
  completedAt?: Date;
}

/** Scraped + merged business data */
export interface BusinessData {
  name: string;
  legalName: string;
  orgNumber: string;
  website: string;
  email: string;
  phone: string;
  address: string;
  postalCode: string;
  city: string;
  industry: string;
  industryCode: string;
  employeeCount: string;
  logoUrl: string;
  description: string;
  openingHours: string;
  googleRating: number | null;
  googleRatingCount: number | null;
  priceLevel: string;
  googleMapsUrl: string;
  googlePlaceId: string;
  latitude: number | null;
  longitude: number | null;
  photos: string[];
  // Join intake fields — restored from intelligence_data
  socialLinks?: Record<string, string>;
  restaurantType?: string;
  cuisineTypes?: string[];
  menuDescription?: string;
  priceCategory?: string;
  ourHistory?: string;
  ourConcept?: string;
  reservationUrl?: string;
  menuLinks?: Array<{ href: string; text: string }>;
}

/** Season configuration */
export interface SeasonData {
  name: string;
  startDate: string;
  endDate: string;
  expectedRevenue: number | null;
  targetMargin: number | null;
}

/** Department with selection state */
export interface DepartmentOption {
  id: string;
  name: string;
  icon: string;
  selected: boolean;
  positions: PositionOption[];
}

/** Contract template state */
export interface ContractData {
  templateGenerated: boolean;
  previewUrl: string | null;
  contractId: string | null;
  contractSent: boolean;
  signingUrl: string | null;
}

/** A zone within a location */
export interface ZoneData {
  id: string;
  name: string;
}

/** A position within a department — used in onboarding wizard */
export interface PositionOption {
  id: string;
  name: string;
  slug: string;
  isLeader: boolean;
  selected: boolean;
}

/** A physical location */
export interface LocationData {
  id: string;
  name: string;
  type: "main" | "outdoor" | "satellite" | "other";
  zones: ZoneData[];
}

/** A standard procedure */
export interface ProcedureData {
  id: string;
  name: string;
  selected: boolean;
  isCustom: boolean;
  /** Recommended procedures show a warning when deselected */
  recommended?: boolean;
}

/** Brreg search candidate — returned by search-brreg Edge Function */
export interface BrregCandidate {
  orgNumber: string;
  name: string;
  city: string;
  industry: string;
  industryCode: string;
  employeeCount: number | null;
  score: number;
  address: string;
  highConfidence: boolean;
}

/** Memory saved by Botsson (voice agent) — user-specific knowledge context */
export interface Memory {
  id: string;
  content: string;
  savedAt: Date;
}

/** Full onboarding state */
export interface OnboardingState {
  currentSection: OnboardingSection;
  sections: SectionProgress[];
  isAuthenticated: boolean;
  userId: string | null;
  sessionId: string | null;
  onboardingWorkspaceId: string | null;

  // Section data
  business: BusinessData;
  season: SeasonData;
  departments: DepartmentOption[];
  locations: LocationData[];
  procedures: ProcedureData[];
  contract: ContractData;

  // Scraping state
  scrapeStatus: "idle" | "scraping" | "done" | "error";
  scrapeSource: "url" | "org" | "both" | "name" | null;

  // Agent-driven memories (knowledge context saved by Botsson)
  memories: Memory[];

  // Finalization
  activatedWorkspaceId: string | null;
  activatedWorkspaceSlug: string | null;
}

export const EMPTY_BUSINESS_DATA: BusinessData = {
  name: "",
  legalName: "",
  orgNumber: "",
  website: "",
  email: "",
  phone: "",
  address: "",
  postalCode: "",
  city: "",
  industry: "",
  industryCode: "",
  employeeCount: "",
  logoUrl: "",
  description: "",
  openingHours: "",
  googleRating: null,
  googleRatingCount: null,
  priceLevel: "",
  googleMapsUrl: "",
  googlePlaceId: "",
  latitude: null,
  longitude: null,
  photos: [],
};

export const DEFAULT_SEASON_DATA: SeasonData = {
  name: "",
  startDate: "",
  endDate: "",
  expectedRevenue: null,
  targetMargin: null,
};

/** A profession (Fag) with positions for onboarding confirmation */
export interface ProfessionOption {
  id: string;
  slug: string;
  name: string;
  isUniversal: boolean;
  positions: PositionOption[];
}

/** A leadership/organizational role — selected during onboarding */
export interface RoleOption {
  id: string;
  name: string;
  description: string;
  selected: boolean;
  /** Whether this role is required by regulation (cannot be deselected) */
  required: boolean;
}
