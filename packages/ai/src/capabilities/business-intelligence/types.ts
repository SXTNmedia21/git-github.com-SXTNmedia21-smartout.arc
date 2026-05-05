// packages/ai/src/capabilities/business-intelligence/types.ts
//
// Shared Zod schemas and TypeScript types for the business_intelligence
// capability (ADR-0270).
//
// All tools are read-only proxies to scrapling — no Smartout DB writes.
// No PII is stored; tool output is ephemeral (returned to chat).
//
// Binding ADRs: 0078 (chat-only), 0134 (actor_id non-null), 0270.

import { z } from "zod";

// ─────────────────────────────────────────────────────────────────────────
// Hospitality business types supported by Google Places
// ─────────────────────────────────────────────────────────────────────────

export const hospitalityTypeEnum = z.enum([
  "restaurant",
  "bar",
  "cafe",
  "bakery",
  "pub",
  "nightlife",
  "food_court",
  "seafood_restaurant",
  "fine_dining_restaurant",
]);

export type HospitalityType = z.infer<typeof hospitalityTypeEnum>;

// ─────────────────────────────────────────────────────────────────────────
// find_hospitality_businesses — input / output
// ─────────────────────────────────────────────────────────────────────────

export const FindHospitalityBusinessesSchema = z.object({
  city: z
    .string()
    .min(2)
    .describe("Norsk bynavn (Oslo, Bergen, Trondheim, Stavanger, Tromsø osv.)"),
  types: z.array(hospitalityTypeEnum).optional().default(["restaurant"]),
  limit: z.number().int().min(1).max(60).optional().default(20),
});

export type FindHospitalityBusinessesInput = z.infer<typeof FindHospitalityBusinessesSchema>;

export interface HospitalityBusiness {
  name: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  primary_type: string;
  price_level: string | null;
  rating: number | null;
  reviews: number | null;
}

// ─────────────────────────────────────────────────────────────────────────
// enrich_company_intelligence — input
// ─────────────────────────────────────────────────────────────────────────

export const EnrichCompanyIntelligenceSchema = z.object({
  company_name: z.string().min(2).describe("Bedriftsnavn"),
  city: z.string().optional().describe("Norsk by (valgfri, men anbefalt for bedre treff)"),
  website_url: z.string().url().optional().describe("Bedriftens nettside (valgfri)"),
  org_number: z.string().optional().describe("Org-nummer (9 siffer, valgfri)"),
});

export type EnrichCompanyIntelligenceInput = z.infer<typeof EnrichCompanyIntelligenceSchema>;

// ─────────────────────────────────────────────────────────────────────────
// generate_company_copy — input
// ─────────────────────────────────────────────────────────────────────────

export const GenerateCompanyCopySchema = z.object({
  intelligence: z
    .record(z.unknown())
    .describe("WorkspaceIntelligence-objekt fra enrich_company_intelligence"),
  rewrite_field: z
    .enum(["about_us", "our_history", "our_concept", "menu_description"])
    .optional()
    .describe("Felt som skal omskrives (utelat for ny generering)"),
  rewrite_mode: z.enum(["rewrite", "longer", "shorter"]).optional().describe("Omskrivningsmodus"),
  current_text: z.string().optional().describe("Eksisterende tekst som skal omskrives"),
});

export type GenerateCompanyCopyInput = z.infer<typeof GenerateCompanyCopySchema>;

// ─────────────────────────────────────────────────────────────────────────
// search_brreg — input
// ─────────────────────────────────────────────────────────────────────────

export const SearchBrregSchema = z.object({
  query: z.string().min(2).describe("Bedriftsnavn (fragment) for fuzzy-søk"),
  city: z.string().optional().describe("By for å avgrense søket"),
});

export type SearchBrregInput = z.infer<typeof SearchBrregSchema>;

// ─────────────────────────────────────────────────────────────────────────
// lookup_brreg — input
// ─────────────────────────────────────────────────────────────────────────

export const LookupBrregSchema = z.object({
  org_number: z
    .string()
    .regex(/^\d{9}$/, "Org-nummer må være eksakt 9 siffer")
    .describe("Norsk 9-sifret organisasjonsnummer"),
});

export type LookupBrregInput = z.infer<typeof LookupBrregSchema>;

// ─────────────────────────────────────────────────────────────────────────
// scrape_website — input
// ─────────────────────────────────────────────────────────────────────────

export const ScrapeWebsiteSchema = z.object({
  url: z.string().url().describe("URL til nettsiden som skal skrapes"),
  mode: z
    .enum(["extract", "raw"])
    .optional()
    .default("extract")
    .describe("`extract` = strukturert innhold; `raw` = rå HTML"),
});

export type ScrapeWebsiteInput = z.infer<typeof ScrapeWebsiteSchema>;
