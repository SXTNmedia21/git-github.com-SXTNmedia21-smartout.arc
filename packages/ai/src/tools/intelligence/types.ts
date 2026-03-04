// ============================================
// types.ts — Intelligence Tool Types
// Shared types for the progressive intelligence pipeline.
// Used by Edge Functions, frontend hooks, and Stage Engine tools.
// ============================================

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@smartout/supabase";

/**
 * Context passed to intelligence agent tools.
 * Provides database access for workspace provisioning and data storage.
 */
export type IntelligenceToolContext = {
  supabase: SupabaseClient<Database>;
  workspaceId: string | null;
  userId: string | null;
};

// ------------------------------------
// Brreg (Brønnøysundregistrene) types
// ------------------------------------

/** Raw entity from the Brreg API */
export interface BrregEntity {
  organisasjonsnummer: string;
  navn: string;
  forretningsadresse?: {
    adresse?: string[];
    postnummer?: string;
    poststed?: string;
    kommune?: string;
  };
  postadresse?: {
    adresse?: string[];
    postnummer?: string;
    poststed?: string;
  };
  hjemmeside?: string;
  naeringskode1?: { kode: string; beskrivelse: string };
  naeringskode2?: { kode: string; beskrivelse: string };
  naeringskode3?: { kode: string; beskrivelse: string };
  antallAnsatte?: number;
  organisasjonsform?: { kode: string; beskrivelse: string };
  registreringsdatoEnhetsregisteret?: string;
  stiftelsesdato?: string;
  registrertIMvaregisteret?: boolean;
  sisteInnsendteAarsregnskap?: string;
  overordnetEnhet?: string;
  underAvvikling?: boolean;
  konkurs?: boolean;
}

/** A scored Brreg match */
export interface BrregMatch {
  entity: BrregEntity;
  score: number;
}

/** A candidate returned by search-brreg Edge Function */
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

// ------------------------------------
// Company identification types
// ------------------------------------

/** Structured company data from identify-company */
export interface IdentifiedCompany {
  orgNumber: string;
  legalName: string;
  website: string | null;
  address: string;
  postalCode: string;
  city: string;
  industry: string;
  industryCode: string;
  employeeCount: number | null;
  dagligLeder: string | null;
  vatRegistered: boolean;
  foundingDate: string | null;
}

/** Google Places enrichment data */
export interface PlacesData {
  placeId?: string | null;
  displayName?: string | null;
  rating?: number | null;
  userRatingCount?: number | null;
  openingHours?: string[] | null;
  priceLevel?: string | null;
  photos?: string[];
  websiteUri?: string | null;
  phone?: string | null;
  googleMapsUri?: string | null;
  location?: { lat: number; lng: number } | null;
  primaryType?: string | null;
}

// ------------------------------------
// Scraping types
// ------------------------------------

/** Data extracted from website scraping */
export interface ScrapedData {
  companyName?: string | null;
  email?: string | null;
  phone?: string | null;
  summary?: string | null;
  locations?: Array<{ name: string; type?: string }>;
  departments?: Array<{ name: string; roles?: string[] }>;
  images?: Array<{ src: string; alt: string }>;
  menus?: Array<{ href: string; text: string }>;
  socialLinks?: Record<string, string>;
  reservationUrl?: string | null;
  openingHours?: string;
  logoUrl?: string;
}

// ------------------------------------
// Pipeline types
// ------------------------------------

/** Full intelligence result combining all sources */
export interface IntelligenceResult {
  company: IdentifiedCompany | null;
  places: PlacesData | null;
  scraped: ScrapedData | null;
  workspaceId: string | null;
  pipelineCompletedAt: string;
}

// ------------------------------------
// Edge Function response types
// ------------------------------------

/** Response from search-brreg Edge Function */
export interface SearchBrregResponse {
  candidates: BrregCandidate[];
  matchCount: number;
}

/** Response from identify-company Edge Function */
export interface IdentifyCompanyResponse {
  company: IdentifiedCompany;
  places: PlacesData | null;
  workspaceId: string | null;
}

/** Response from scrape-website Edge Function */
export interface ScrapeWebsiteResponse {
  scrapedData: ScrapedData | null;
}

// ------------------------------------
// Ultravox client tool return types
// (what the voice agent receives back)
// ------------------------------------

/** Return type for searchCompany client tool */
export interface SearchCompanyToolResult {
  found: boolean;
  count: number;
  candidates: Array<{
    orgNumber: string;
    name: string;
    city: string;
    industry: string;
    employeeCount: number | null;
    highConfidence: boolean;
  }>;
}

/** Return type for identifyCompany client tool */
export interface IdentifyCompanyToolResult {
  success: boolean;
  company?: {
    legalName: string;
    address: string;
    city: string;
    industry: string;
    employeeCount: number | null;
    dagligLeder: string | null;
    website: string | null;
  };
  google?: {
    rating: number | null;
    ratingCount: number | null;
    priceLevel: string | null;
  } | null;
  workspaceCreated?: boolean;
  error?: string;
}

/** Return type for scrapeWebsite client tool */
export interface ScrapeWebsiteToolResult {
  success: boolean;
  email?: string | null;
  phone?: string | null;
  locationCount?: number;
  departmentCount?: number;
  error?: string;
}
