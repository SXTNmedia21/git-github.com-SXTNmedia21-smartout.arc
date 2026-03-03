/**
 * onboarding/types.ts
 * Scroll-based onboarding type system.
 * Replaces the old 15-step wizard types.
 */

export const ONBOARDING_SECTIONS = [
  "hero",
  "business",
  "season",
  "departments",
  "contract",
  "done",
] as const;

export type OnboardingSection = (typeof ONBOARDING_SECTIONS)[number];

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
  positions: string[];
}

/** Contract template state */
export interface ContractData {
  templateGenerated: boolean;
  previewUrl: string | null;
}

/** Memory saved by Lise (voice agent) — user-specific knowledge context */
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
  contract: ContractData;

  // Scraping state
  scrapeStatus: "idle" | "scraping" | "done" | "error";
  scrapeSource: "url" | "org" | "both" | null;

  // Agent-driven memories (knowledge context saved by Lise)
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
