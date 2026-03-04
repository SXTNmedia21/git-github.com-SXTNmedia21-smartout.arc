// ============================================
// search-company.ts — Search Company Tool
// Stage Engine tool for searching Norwegian companies
// in Brønnøysundregistrene by name.
// ============================================

import { z } from "zod";
import { defineTool } from "../../types";
import type { IntelligenceToolContext } from "./types";
import { searchBrregByNameAll, toBrregCandidates } from "./brreg";

export const searchCompany = defineTool({
  name: "search_company",
  description:
    "Search for a Norwegian company by name in Brønnøysundregistrene. Returns candidates with org number, city, industry, and confidence score. Use as soon as you know the company name.",
  schema: z.object({
    name: z.string().describe("Company name to search for (e.g. 'Sjøbris')"),
    city: z.string().optional().describe("City where the business is located (e.g. 'Trondheim')"),
  }),
  execute: async ({ name, city }, _ctx: IntelligenceToolContext) => {
    const matches = await searchBrregByNameAll(name, city ?? null);
    const candidates = toBrregCandidates(matches);

    if (candidates.length === 0) {
      return JSON.stringify({
        found: false,
        count: 0,
        candidates: [],
        message: `Fant ingen treff for "${name}"${city ? ` i ${city}` : ""}.`,
      });
    }

    const highConfidence = candidates.filter((c) => c.highConfidence);

    return JSON.stringify({
      found: true,
      count: candidates.length,
      highConfidenceCount: highConfidence.length,
      candidates: candidates.map((c) => ({
        orgNumber: c.orgNumber,
        name: c.name,
        city: c.city,
        industry: c.industry,
        employeeCount: c.employeeCount,
        highConfidence: c.highConfidence,
      })),
    });
  },
});
