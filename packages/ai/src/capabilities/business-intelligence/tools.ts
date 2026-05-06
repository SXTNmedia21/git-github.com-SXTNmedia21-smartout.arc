// packages/ai/src/capabilities/business-intelligence/tools.ts
//
// Business Intelligence capability — 6 tools (ADR-0270).
//
// All tools are read-only proxies to scrapling (scrape.smartout.ai).
// NO Smartout DB writes — output is ephemeral, returned to chat only.
// NO gate_action required — all tools are read_only (no mutation).
// All chat-only per ADR-0078.
// Godmode-only: toolAuthPattern="direct_admin". The stage-engine BFF
// resolves super-admin context before dispatch.
//
// AUTHORITY POSTURE:
//   find_hospitality_businesses  — suggestTool (costs money + GDPR aggregation)
//   generate_company_copy        — suggestTool (LLM-creative output, wizard-state side-effects)
//   enrich_company_intelligence  — readOnlyTool
//   search_brreg                 — readOnlyTool
//   lookup_brreg                 — readOnlyTool
//   scrape_website               — readOnlyTool
//
// ADR-0134: emit() called on every tool invocation (called + cost-events).
// ADR-0151: workspaceId + profileId resolved server-side by BFF, never from body.
// ADR-0078: channel guard — all tools reject voice.
// ADR-0173: no Smartout DB writes from this capability.
//
// Scrapling proxy pattern follows apps/web/src/app/api/workspace-intelligence/route.ts.

import { defineTool } from "../../types.js";
import type { AgentToolContext } from "../types.js";
import { emit } from "@smartout/telemetry";
import {
  FindHospitalityBusinessesSchema,
  EnrichCompanyIntelligenceSchema,
  GenerateCompanyCopySchema,
  SearchBrregSchema,
  LookupBrregSchema,
  ScrapeWebsiteSchema,
} from "./types.js";

// ─────────────────────────────────────────────────────────────────────────
// Shared scrapling proxy helper
// ─────────────────────────────────────────────────────────────────────────

const SCRAPLING_URL = process.env.SCRAPLING_SERVICE_URL ?? "https://scrape.smartout.ai";

function scraplingHeaders(): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = process.env.SCRAPLING_AUTH_TOKEN;
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

async function scraplingPost(
  path: string,
  body: Record<string, unknown>,
  timeoutMs = 45_000,
): Promise<{ ok: true; data: unknown } | { ok: false; error: string }> {
  try {
    const res = await fetch(`${SCRAPLING_URL}${path}`, {
      method: "POST",
      headers: scraplingHeaders(),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "no body");
      return { ok: false, error: `scrapling ${path} returned ${res.status}: ${text}` };
    }

    const data: unknown = await res.json();
    return { ok: true, data };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `scrapling ${path} fetch failed: ${message}` };
  }
}

// ─────────────────────────────────────────────────────────────────────────
// ADR-0134 guard — fail fast before any emit() if IDs are empty
// ─────────────────────────────────────────────────────────────────────────

function assertCtxIds(ctx: AgentToolContext): string | null {
  if (!ctx.workspaceId) return "Mangler workspaceId — BFF må sette dette (ADR-0134).";
  if (!ctx.profileId) return "Mangler profileId — BFF må sette dette (ADR-0134).";
  return null;
}

// ─────────────────────────────────────────────────────────────────────────
// 1. find_hospitality_businesses — NEW endpoint (POST /hospitality-search)
// ─────────────────────────────────────────────────────────────────────────

export const findHospitalityBusinessesTool = defineTool({
  name: "find_hospitality_businesses",
  description:
    "Finn alle hospitality-bedrifter i en norsk by med kontaktinfo. " +
    "Returnerer maks 60 resultater per kall. " +
    "Brukes til lead-research, prospect-bygging og markedsanalyse — ALDRI på enkelt-personer (GDPR Art 6). " +
    "Hver oppføring inkluderer navn, adresse, telefon (~95% suksess via Google Places), " +
    "email (~85% suksess via website-scrape), kjøkkentype, prisnivå, rating + antall reviews. " +
    "Kaller Google Places API — kostnad ~$0.02 per bedrift. " +
    "Bruk kun når du eksplisitt skal kartlegge prospekter i en by. " +
    "Ikke bruk for enkelt-oppslag (bruk enrich_company_intelligence da).",
  capability: "business_intelligence",
  schema: FindHospitalityBusinessesSchema,

  async execute({ city, types, limit }, ctx: AgentToolContext) {
    // ADR-0078: chat-only
    if (ctx.channel === "voice") {
      return "Av sikkerhetshensyn må business intelligence-verktøy brukes i chat, ikke via stemme.";
    }

    const ctxErr = assertCtxIds(ctx);
    if (ctxErr) return ctxErr;

    void emit({
      event: "business_intelligence.find_hospitality_businesses.called",
      workspace_id: ctx.workspaceId,
      actor_id: ctx.profileId,
      properties: { data: { city, types: types ?? ["restaurant"], limit: limit ?? 20 } },
    });

    const result = await scraplingPost(
      "/hospitality-search",
      { city, types: types ?? ["restaurant"], limit: limit ?? 20 },
      60_000,
    );

    if (!result.ok) {
      return `Feil ved søk etter bedrifter i ${city}: ${result.error}`;
    }

    const payload = result.data as {
      results?: unknown[];
      total?: number;
      estimated_cost_usd?: number;
    };

    const businesses = payload.results ?? [];

    void emit({
      event: "business_intelligence.find_hospitality_businesses.cost",
      workspace_id: ctx.workspaceId,
      actor_id: ctx.profileId,
      properties: {
        data: {
          city,
          result_count: businesses.length,
          estimated_cost_usd: payload.estimated_cost_usd ?? 0,
        },
      },
    });

    if (!businesses.length) {
      return `Ingen ${(types ?? ["restaurant"]).join(", ")}-bedrifter funnet i ${city}.`;
    }

    return JSON.stringify({
      city,
      count: businesses.length,
      results: businesses,
    });
  },
});

// ─────────────────────────────────────────────────────────────────────────
// 2. enrich_company_intelligence — proxy to /enrich
// ─────────────────────────────────────────────────────────────────────────

export const enrichCompanyIntelligenceTool = defineTool({
  name: "enrich_company_intelligence",
  description:
    "Hent strukturert intelligens om en bedrift fra BRREG (registreringsdata), " +
    "websidescrape (om-oss + meny), Google Maps (Places + reviews) og web-search. " +
    "Brukes til onboarding-bootstrap og workspace-profil-bygging. " +
    "Returnerer WorkspaceIntelligence med daglig leder, NACE-koder, åpningstider, " +
    "konsept-clues og kjøkkentype. " +
    "Kaller scrapling /enrich — tar 10-30 sekunder. " +
    "Bruk når du trenger full bedriftsprofil før onboarding eller ved prospect-analyse.",
  capability: "business_intelligence",
  schema: EnrichCompanyIntelligenceSchema,

  async execute({ company_name, city, website_url, org_number }, ctx: AgentToolContext) {
    if (ctx.channel === "voice") {
      return "Av sikkerhetshensyn må business intelligence-verktøy brukes i chat, ikke via stemme.";
    }

    const ctxErr = assertCtxIds(ctx);
    if (ctxErr) return ctxErr;

    void emit({
      event: "business_intelligence.enrich_company_intelligence.called",
      workspace_id: ctx.workspaceId,
      actor_id: ctx.profileId,
      properties: { data: { company_name, city: city ?? null } },
    });

    const body: Record<string, unknown> = {
      company_name,
      force_new_queries: false,
    };
    if (city) body.city = city;
    if (website_url) body.website_url = website_url;
    if (org_number) body.org_number = org_number;

    const result = await scraplingPost("/enrich", body, 45_000);

    if (!result.ok) {
      return `Feil ved enrichment av "${company_name}": ${result.error}`;
    }

    const payload = result.data as {
      intelligence?: unknown;
      sources_added?: string[];
      gaps_remaining?: string[];
    };

    void emit({
      event: "business_intelligence.enrich_company_intelligence.cost",
      workspace_id: ctx.workspaceId,
      actor_id: ctx.profileId,
      properties: {
        data: {
          company_name,
          sources_added: payload.sources_added ?? [],
          gaps_remaining: payload.gaps_remaining ?? [],
        },
      },
    });

    if (!payload.intelligence) {
      return `Ingen intelligence returnert for "${company_name}". Prøv med mer spesifikt bynavn eller org-nummer.`;
    }

    return JSON.stringify({
      intelligence: payload.intelligence,
      sources_added: payload.sources_added ?? [],
      gaps_remaining: payload.gaps_remaining ?? [],
    });
  },
});

// ─────────────────────────────────────────────────────────────────────────
// 3. generate_company_copy — proxy to /generate
// ─────────────────────────────────────────────────────────────────────────

export const generateCompanyCopyTool = defineTool({
  name: "generate_company_copy",
  description:
    "Generer eller omskriv bedriftsbeskrivelse på norsk basert på strukturert intelligens. " +
    "Returnerer 7 felt: about_us, our_history, our_concept, menu_description, " +
    "restaurant_type, cuisine_types, price_category. " +
    "Bruk rewrite_mode='longer'/'shorter'/'rewrite' for å justere eksisterende tekst. " +
    "Krever WorkspaceIntelligence fra enrich_company_intelligence som input. " +
    "Bruk aldri uten at brukeren har sett og godkjent intelligence-dataene.",
  capability: "business_intelligence",
  schema: GenerateCompanyCopySchema,

  async execute(
    { intelligence, rewrite_field, rewrite_mode, current_text },
    ctx: AgentToolContext,
  ) {
    if (ctx.channel === "voice") {
      return "Av sikkerhetshensyn må business intelligence-verktøy brukes i chat, ikke via stemme.";
    }

    const ctxErr = assertCtxIds(ctx);
    if (ctxErr) return ctxErr;

    void emit({
      event: "business_intelligence.generate_company_copy.called",
      workspace_id: ctx.workspaceId,
      actor_id: ctx.profileId,
      properties: {
        data: { rewrite_field: rewrite_field ?? null, rewrite_mode: rewrite_mode ?? null },
      },
    });

    const body: Record<string, unknown> = { intelligence };
    if (rewrite_field) body.rewrite_field = rewrite_field;
    if (rewrite_mode) body.rewrite_mode = rewrite_mode;
    if (current_text) body.current_text = current_text;

    const result = await scraplingPost("/generate", body, 35_000);

    if (!result.ok) {
      return `Feil ved tekstgenerering: ${result.error}`;
    }

    void emit({
      event: "business_intelligence.generate_company_copy.cost",
      workspace_id: ctx.workspaceId,
      actor_id: ctx.profileId,
      properties: {
        data: {
          rewrite_mode: rewrite_mode ?? "new",
          rewrite_field: rewrite_field ?? "all",
        },
      },
    });

    return JSON.stringify(result.data);
  },
});

// ─────────────────────────────────────────────────────────────────────────
// 4. search_brreg — proxy to /brreg-search
// ─────────────────────────────────────────────────────────────────────────

export const searchBrregTool = defineTool({
  name: "search_brreg",
  description:
    "Smart fuzzy-søk i BRREG (Brønnøysundregisteret) med Jaro-Winkler-matching " +
    "+ by/næring filter + Google Places fallback. " +
    "Returnerer kandidater med org-nummer, navn, adresse og match-score. " +
    "Brukes til onboarding når brukeren skriver delvis bedriftsnavn. " +
    "Alltid det første steget ved onboarding-hjelp. " +
    "Bekreft resultater med lookup_brreg etter at brukeren har valgt kandidat.",
  capability: "business_intelligence",
  schema: SearchBrregSchema,

  async execute({ query, city }, ctx: AgentToolContext) {
    if (ctx.channel === "voice") {
      return "Av sikkerhetshensyn må business intelligence-verktøy brukes i chat, ikke via stemme.";
    }

    const ctxErr = assertCtxIds(ctx);
    if (ctxErr) return ctxErr;

    void emit({
      event: "business_intelligence.search_brreg.called",
      workspace_id: ctx.workspaceId,
      actor_id: ctx.profileId,
      properties: { data: { query, city: city ?? null } },
    });

    const body: Record<string, unknown> = { company_name: query };
    if (city) body.city = city;

    const result = await scraplingPost("/brreg-search", body, 20_000);

    if (!result.ok) {
      return `Feil ved BRREG-søk for "${query}": ${result.error}`;
    }

    void emit({
      event: "business_intelligence.search_brreg.cost",
      workspace_id: ctx.workspaceId,
      actor_id: ctx.profileId,
      properties: { data: { query, city: city ?? null } },
    });

    const payload = result.data as {
      candidates?: unknown[];
      needOrgNumber?: boolean;
      placesMatch?: unknown;
    };

    if (!payload.candidates?.length) {
      const placesMsg = payload.placesMatch
        ? ` Google Places fant: ${JSON.stringify(payload.placesMatch)}. Be brukeren om org-nummer.`
        : " Ingen resultater funnet.";
      return `Ingen BRREG-treff for "${query}".${placesMsg}`;
    }

    return JSON.stringify({
      candidates: payload.candidates,
      needOrgNumber: payload.needOrgNumber ?? false,
      placesMatch: payload.placesMatch ?? null,
    });
  },
});

// ─────────────────────────────────────────────────────────────────────────
// 5. lookup_brreg — proxy to /brreg-lookup
// ─────────────────────────────────────────────────────────────────────────

export const lookupBrregTool = defineTool({
  name: "lookup_brreg",
  description:
    "Hent komplett BRREG-data for et bekreftet org-nummer. " +
    "Inkluderer offisielt navn, adresse, NACE-koder, daglig leder, " +
    "registreringsdato, organisasjonsform. " +
    "Brukes etter at brukeren har bekreftet hvilken bedrift fra search_brreg-resultater. " +
    "Aldri kall dette uten at org-nummer er eksplisitt bekreftet av brukeren.",
  capability: "business_intelligence",
  schema: LookupBrregSchema,

  async execute({ org_number }, ctx: AgentToolContext) {
    if (ctx.channel === "voice") {
      return "Av sikkerhetshensyn må business intelligence-verktøy brukes i chat, ikke via stemme.";
    }

    const ctxErr = assertCtxIds(ctx);
    if (ctxErr) return ctxErr;

    void emit({
      event: "business_intelligence.lookup_brreg.called",
      workspace_id: ctx.workspaceId,
      actor_id: ctx.profileId,
      properties: { data: { org_number } },
    });

    const result = await scraplingPost("/brreg-lookup", { orgNumber: org_number }, 15_000);

    if (!result.ok) {
      return `Feil ved BRREG-oppslag for org-nummer ${org_number}: ${result.error}`;
    }

    void emit({
      event: "business_intelligence.lookup_brreg.cost",
      workspace_id: ctx.workspaceId,
      actor_id: ctx.profileId,
      properties: { data: { org_number } },
    });

    const payload = result.data as { match?: unknown };

    if (!payload.match) {
      return `Ingen BRREG-data funnet for org-nummer ${org_number}. Sjekk at nummeret er korrekt.`;
    }

    return JSON.stringify({ match: payload.match });
  },
});

// ─────────────────────────────────────────────────────────────────────────
// 6. scrape_website — proxy to /extract (or /scrape-raw)
// ─────────────────────────────────────────────────────────────────────────

export const scrapeWebsiteTool = defineTool({
  name: "scrape_website",
  description:
    "Hent og parse innhold fra en webside. " +
    "`extract`-modus returnerer strukturert tekst (om-oss, meny, kontakt) — " +
    "`raw`-modus returnerer ren HTML. " +
    "Respekterer robots.txt + 8-sek timeout. " +
    "Bruk for menu-extraction, scrape av om-oss-sider, kontakt-info-uthenting. " +
    "Ikke bruk for generell web-search — bruk search_brreg eller enrich_company_intelligence da.",
  capability: "business_intelligence",
  schema: ScrapeWebsiteSchema,

  async execute({ url, mode }, ctx: AgentToolContext) {
    if (ctx.channel === "voice") {
      return "Av sikkerhetshensyn må business intelligence-verktøy brukes i chat, ikke via stemme.";
    }

    const ctxErr = assertCtxIds(ctx);
    if (ctxErr) return ctxErr;

    const resolvedMode = mode ?? "extract";

    void emit({
      event: "business_intelligence.scrape_website.called",
      workspace_id: ctx.workspaceId,
      actor_id: ctx.profileId,
      properties: { data: { url, mode: resolvedMode } },
    });

    const endpoint = resolvedMode === "raw" ? "/scrape-raw" : "/extract";
    const result = await scraplingPost(endpoint, { url }, 30_000);

    if (!result.ok) {
      return `Feil ved scraping av ${url}: ${result.error}`;
    }

    void emit({
      event: "business_intelligence.scrape_website.cost",
      workspace_id: ctx.workspaceId,
      actor_id: ctx.profileId,
      properties: { data: { url, mode: resolvedMode } },
    });

    return JSON.stringify(result.data);
  },
});
