import type { BusinessData } from "../types";
import { EMPTY_BUSINESS_DATA } from "../types";

interface ScrapedData {
  companyName?: string;
  email?: string;
  phone?: string;
  summary?: string;
  openingHours?: string;
  logoUrl?: string;
  images?: { src: string; alt: string }[];
  [key: string]: unknown;
}

/**
 * Brreg response as returned by the gather-workspace-intelligence Edge Function.
 * This is the restructured format, NOT the raw Brreg API shape.
 */
interface BrregResponse {
  matched?: boolean;
  orgNumber?: string | null;
  legalName?: string | null;
  website?: string | null;
  naceCode?: string | null;
  naceDescription?: string | null;
  address?: {
    street?: string;
    postalCode?: string;
    city?: string;
    municipality?: string;
  } | null;
  dagligLeder?: string | null;
  employeeCount?: number | null;
  companyType?: string | null;
  registrationDate?: string | null;
  foundingDate?: string | null;
  vatRegistered?: boolean | null;
  parentCompany?: string | null;
  navn?: string | null;
  organisasjonsnummer?: string | null;
  forretningsadresse?: {
    adresse?: string[];
    postnummer?: string;
    poststed?: string;
  } | null;
  naeringskode1?: {
    kode?: string;
    beskrivelse?: string;
  } | null;
  [key: string]: unknown;
}

/**
 * Google Places response from the google-places-intelligence Edge Function.
 */
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

/**
 * Merge scraped website data, Brønnøysund registry data, and Google Places data.
 *
 * Priority:
 * - Legal fields (name, org number, address): Brreg > Scraped > Places
 * - Phone: Scraped > Places (scraped is the business's own website)
 * - Website: Brreg (via company) > Places > Scraped
 * - Opening hours: Places > Scraped (Places is structured and up-to-date)
 * - Rating/coords/photos: Places only
 */
export function mergeBusinessData(
  scraped: ScrapedData | null,
  brreg: BrregResponse | null,
  places?: PlacesData | null,
): BusinessData {
  const s = scraped ?? {};
  const b = brreg ?? {};
  const p = places ?? {};

  // Format Places opening hours into a single string
  const placesHours = p.openingHours?.join(", ") || "";
  const legalName = coalesceString(b.legalName, b.navn);
  const orgNumber = coalesceString(b.orgNumber, b.organisasjonsnummer);
  const addressStreet = coalesceString(
    b.address?.street,
    b.forretningsadresse?.adresse?.join(", "),
  );
  const postalCode = coalesceString(b.address?.postalCode, b.forretningsadresse?.postnummer);
  const city = capitalize(coalesceString(b.address?.city, b.forretningsadresse?.poststed));
  const industryCode = coalesceString(b.naceCode, b.naeringskode1?.kode);
  const industry = coalesceString(b.naceDescription, b.naeringskode1?.beskrivelse);

  return {
    ...EMPTY_BUSINESS_DATA,
    legalName,
    name: legalName || s.companyName || p.displayName || "",
    orgNumber,
    address: addressStreet,
    postalCode,
    city,
    industryCode,
    industry,
    employeeCount: b.employeeCount ? String(b.employeeCount) : "",
    email: s.email ?? "",
    phone: s.phone ?? p.phone ?? "",
    description: s.summary ?? "",
    openingHours: placesHours || s.openingHours || "",
    logoUrl: s.logoUrl ?? s.images?.[0]?.src ?? "",
    website: p.websiteUri ?? "",
    // Places-specific fields
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

function capitalize(str: string): string {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

function coalesceString(...values: Array<string | null | undefined>): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) {
      return value;
    }
  }
  return "";
}
