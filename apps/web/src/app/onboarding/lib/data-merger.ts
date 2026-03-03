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
  naceCode?: string | null;
  naceDescription?: string | null;
  address?: {
    street?: string;
    postalCode?: string;
    city?: string;
  } | null;
  dagligLeder?: string | null;
  employeeCount?: number | null;
  companyType?: string | null;
  registrationDate?: string | null;
  [key: string]: unknown;
}

/**
 * Merge scraped website data with Brønnøysund registry data.
 * Brreg is authoritative for legal fields (name, org number, address).
 * Scraped data fills operational fields (phone, email, hours, logo).
 */
export function mergeBusinessData(
  scraped: ScrapedData | null,
  brreg: BrregResponse | null,
): BusinessData {
  const s = scraped ?? {};
  const b = brreg ?? {};

  return {
    ...EMPTY_BUSINESS_DATA,
    legalName: b.legalName ?? "",
    name: b.legalName ?? s.companyName ?? "",
    orgNumber: b.orgNumber ?? "",
    address: b.address?.street ?? "",
    postalCode: b.address?.postalCode ?? "",
    city: capitalize(b.address?.city ?? ""),
    industryCode: b.naceCode ?? "",
    industry: b.naceDescription ?? "",
    employeeCount: b.employeeCount ? String(b.employeeCount) : "",
    email: s.email ?? "",
    phone: s.phone ?? "",
    description: s.summary ?? "",
    openingHours: s.openingHours ?? "",
    logoUrl: s.logoUrl ?? s.images?.[0]?.src ?? "",
    website: "",
  };
}

function capitalize(str: string): string {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}
