// ============================================
// identify-company.ts — Identify Company Tool
// Stage Engine tool for fetching full Brreg details,
// daglig leder, and optionally enriching with Google Places.
// ============================================

import { z } from "zod";
import { defineTool } from "../../types";
import type { IntelligenceToolContext } from "./types";
import { fetchBrregDetails, fetchDagligLeder } from "./brreg";

export const identifyCompany = defineTool({
  name: "identify_company",
  description:
    "Confirm and identify a company using its Norwegian org number. Returns full details: address, CEO (daglig leder), employee count, industry, website, and founding date.",
  schema: z.object({
    orgNumber: z.string().describe("Norwegian org number (9 digits) from search_company results"),
  }),
  execute: async ({ orgNumber }, _ctx: IntelligenceToolContext) => {
    const cleanOrg = orgNumber.replace(/\s+/g, "");

    const [entity, dagligLeder] = await Promise.all([
      fetchBrregDetails(cleanOrg),
      fetchDagligLeder(cleanOrg),
    ]);

    if (!entity) {
      return JSON.stringify({
        success: false,
        error: `Fant ingen bedrift med org.nummer ${cleanOrg}.`,
      });
    }

    return JSON.stringify({
      success: true,
      company: {
        orgNumber: entity.organisasjonsnummer,
        legalName: entity.navn,
        website: entity.hjemmeside || null,
        address: entity.forretningsadresse?.adresse?.[0] || "",
        postalCode: entity.forretningsadresse?.postnummer || "",
        city: entity.forretningsadresse?.poststed || "",
        industry: entity.naeringskode1?.beskrivelse || "",
        industryCode: entity.naeringskode1?.kode || "",
        employeeCount: entity.antallAnsatte ?? null,
        dagligLeder,
        vatRegistered: entity.registrertIMvaregisteret ?? false,
        foundingDate: entity.stiftelsesdato || null,
      },
    });
  },
});
