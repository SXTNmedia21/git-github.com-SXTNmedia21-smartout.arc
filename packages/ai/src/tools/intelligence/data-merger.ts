// ============================================
// data-merger.ts — Merge Intelligence Sources
// Combines Brreg, scraped website, and Google Places data
// into a unified business profile.
//
// Priority:
//   Legal fields (name, org, address): Brreg > Scraped > Places
//   Phone: Scraped > Places
//   Website: Brreg > Places > Scraped
//   Opening hours: Places > Scraped
//   Rating/coords/photos: Places only
// ============================================

import type { IdentifiedCompany, PlacesData, ScrapedData } from "./types";

/** Unified business data — the final merged profile */
export interface MergedBusinessData {
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

const EMPTY: MergedBusinessData = {
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

function capitalize(str: string): string {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

/**
 * Merge scraped, Brreg, and Places data into a unified business profile.
 * Any source can be null — missing sources are simply skipped.
 */
export function mergeBusinessData(
  scraped: ScrapedData | null,
  company: IdentifiedCompany | null,
  places: PlacesData | null,
): MergedBusinessData {
  const s = scraped ?? {};
  const c = company ?? ({} as Partial<IdentifiedCompany>);
  const p = places ?? {};

  const placesHours = p.openingHours?.join(", ") || "";

  return {
    ...EMPTY,
    legalName: c.legalName ?? "",
    name: c.legalName ?? s.companyName ?? p.displayName ?? "",
    orgNumber: c.orgNumber ?? "",
    address: c.address ?? "",
    postalCode: c.postalCode ?? "",
    city: capitalize(c.city ?? ""),
    industryCode: c.industryCode ?? "",
    industry: c.industry ?? "",
    employeeCount: c.employeeCount ? String(c.employeeCount) : "",
    email: s.email ?? "",
    phone: s.phone ?? p.phone ?? "",
    description: s.summary ?? "",
    openingHours: placesHours || s.openingHours || "",
    logoUrl: s.logoUrl ?? s.images?.[0]?.src ?? "",
    website: c.website ?? p.websiteUri ?? "",
    googleRating: p.rating ?? null,
    googleRatingCount: p.userRatingCount ?? null,
    priceLevel: p.priceLevel ?? "",
    googleMapsUrl: p.googleMapsUri ?? "",
    googlePlaceId: p.placeId ?? "",
    latitude: p.location?.lat ?? null,
    longitude: p.location?.lng ?? null,
    photos: p.photos ?? [],
  };
}
