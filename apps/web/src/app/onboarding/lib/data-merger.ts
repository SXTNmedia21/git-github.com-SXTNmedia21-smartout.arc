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

interface BrregData {
  navn?: string;
  organisasjonsnummer?: string;
  forretningsadresse?: {
    adresse?: string[];
    postnummer?: string;
    poststed?: string;
  };
  naeringskode1?: {
    kode?: string;
    beskrivelse?: string;
  };
  antallAnsatte?: number;
  [key: string]: unknown;
}

/**
 * Merge scraped website data with Brønnøysund registry data.
 * Brreg is authoritative for legal fields (name, org number, address).
 * Scraped data fills operational fields (phone, email, hours, logo).
 */
export function mergeBusinessData(
  scraped: ScrapedData | null,
  brreg: BrregData | null,
): BusinessData {
  const s = scraped ?? {};
  const b = brreg ?? {};
  const addr = b.forretningsadresse;

  return {
    ...EMPTY_BUSINESS_DATA,
    legalName: b.navn ?? "",
    name: b.navn ?? s.companyName ?? "",
    orgNumber: b.organisasjonsnummer ?? "",
    address: addr?.adresse?.[0] ?? "",
    postalCode: addr?.postnummer ?? "",
    city: capitalize(addr?.poststed ?? ""),
    industryCode: b.naeringskode1?.kode ?? "",
    industry: b.naeringskode1?.beskrivelse ?? "",
    employeeCount: b.antallAnsatte ? String(b.antallAnsatte) : "",
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
