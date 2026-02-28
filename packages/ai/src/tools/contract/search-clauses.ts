import { z } from "zod";
import { defineTool } from "../../types";
import type { ContractToolContext } from "./types";

/**
 * Pre-approved clause templates for common contract sections.
 * In the future, these will be stored in the clause_library database table.
 */
const CLAUSE_LIBRARY = [
  {
    id: "gdpr-dpa",
    title: "Personvern og databehandling",
    category: "gdpr",
    language: "no",
    content: `<p>Partene er enige om at behandling av personopplysninger skjer i henhold til gjeldende personvernlovgivning, herunder GDPR og Personopplysningsloven. Smartout opptrer som databehandler på vegne av Kunden. Separat databehandleravtale (DPA) er vedlagt denne avtalen som Vedlegg A.</p>`,
  },
  {
    id: "payment-terms",
    title: "Betalingsvilkår",
    category: "payment",
    language: "no",
    content: `<p>Betaling skjer forskuddsvis per måned basert på antall aktive ansatte registrert i systemet. Faktura sendes elektronisk den 1. i hver måned med 14 dagers betalingsfrist. Ved forsinket betaling påløper forsinkelsesrente i henhold til Forsinkelsesrenteloven.</p>`,
  },
  {
    id: "termination-clause",
    title: "Oppsigelse",
    category: "termination",
    language: "no",
    content: `<p>Avtalen kan sies opp av begge parter med 3 måneders skriftlig varsel. Ved oppsigelse har Kunden rett til å eksportere alle sine data innen 30 dager etter avtalens utløp. Smartout sletter alle kundedata 90 dager etter avtalens opphør, med mindre annet er avtalt.</p>`,
  },
  {
    id: "governing-law",
    title: "Lovvalg og verneting",
    category: "legal",
    language: "no",
    content: `<p>Denne avtalen er underlagt norsk lov. Eventuelle tvister som springer ut av avtalen skal forsøkes løst ved forhandlinger. Dersom partene ikke kommer til enighet, skal tvisten avgjøres ved Oslo tingrett som verneting.</p>`,
  },
  {
    id: "service-description",
    title: "Tjenestebeskrivelse",
    category: "service",
    language: "no",
    content: `<p>Smartout leverer en skybasert SaaS-plattform for personalhåndtering i serveringsbransjen. Tjenesten inkluderer opplæring, vaktplanlegging, internkommunikasjon, HACCP-oppfølging og personaladministrasjon. Tjenesten er tilgjengelig 24/7 med garantert oppetid på 99,5%.</p>`,
  },
  {
    id: "force-majeure",
    title: "Force majeure",
    category: "legal",
    language: "no",
    content: `<p>Ingen av partene er ansvarlige for manglende oppfyllelse av sine forpliktelser dersom dette skyldes forhold utenfor partens rimelige kontroll, herunder, men ikke begrenset til, naturkatastrofer, krig, streik, lockout, epidemier, strømbrudd eller feil i internettilgang.</p>`,
  },
  {
    id: "confidentiality",
    title: "Konfidensialitet",
    category: "legal",
    language: "no",
    content: `<p>Partene forplikter seg til å behandle all informasjon mottatt fra den andre parten som konfidensiell. Konfidensialitetsforpliktelsen gjelder også etter avtalens opphør i en periode på 2 år. Forpliktelsen gjelder ikke informasjon som er allment tilgjengelig eller som parten kan påvise at den hadde kjennskap til fra før.</p>`,
  },
  {
    id: "sla-uptime",
    title: "SLA og oppetid",
    category: "service",
    language: "no",
    content: `<p>Smartout garanterer en oppetid på minimum 99,5% målt over en kalendermåned. Planlagt vedlikehold varsles minimum 48 timer i forveien og utføres fortrinnsvis mellom kl. 02:00-06:00 CET. Ved brudd på SLA gis Kunden en kreditt tilsvarende 5% av månedlig avgift per hele prosent nedetid utover grensen.</p>`,
  },
];

/**
 * search_clauses — Searches the clause library for pre-approved clauses.
 * Returns matching clauses that can be inserted into the contract.
 */
export const searchClauses = defineTool({
  name: "search_clauses",
  description:
    "Search the pre-approved clause library for contract clauses. Returns matching clauses that can be inserted into the contract using insert_section. Search by keyword, category, or browse all available clauses.",
  schema: z.object({
    query: z
      .string()
      .optional()
      .describe("Search keyword (e.g., 'personvern', 'betaling', 'oppsigelse')"),
    category: z
      .enum([
        "general",
        "parties",
        "service",
        "payment",
        "legal",
        "gdpr",
        "signature",
        "termination",
      ])
      .optional()
      .describe("Filter by category"),
  }),
  execute: async ({ query, category }, _ctx: ContractToolContext) => {
    let results = [...CLAUSE_LIBRARY];

    if (category) {
      results = results.filter((c) => c.category === category);
    }

    if (query) {
      const lowerQuery = query.toLowerCase();
      results = results.filter(
        (c) =>
          c.title.toLowerCase().includes(lowerQuery) ||
          c.content.toLowerCase().includes(lowerQuery) ||
          c.category.toLowerCase().includes(lowerQuery),
      );
    }

    return JSON.stringify({
      clauses: results.map((c) => ({
        id: c.id,
        title: c.title,
        category: c.category,
        language: c.language,
        contentPreview: c.content.substring(0, 150) + "...",
        content: c.content,
      })),
      total: results.length,
      message:
        results.length > 0
          ? `Fant ${results.length} klausul(er). Bruk insert_section for å legge til en klausul i kontrakten.`
          : "Ingen klausuler funnet. Prøv et annet søkeord.",
    });
  },
});
