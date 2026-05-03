import { NextResponse } from "next/server";
import { z } from "zod";

import { env } from "@/env";

const BRREG_BASE = "https://data.brreg.no/enhetsregisteret/api";

// Industry → BRREG næringskode prefix. Mirror of services/scrapling
// INDUSTRY_NACE_MAP — kept in sync so the fallback path (direct BRREG)
// still filters when the scrapling service is unreachable.
const INDUSTRY_NACE: Record<string, string[]> = {
  restaurant: ["56.10"],
  cafe: ["56.10", "56.301"],
  bar: ["56.301", "56.302"],
  hotel: ["55.1", "55.2", "55.3"],
  catering: ["56.21", "56.29"],
  fast_food: ["56.10"],
  retail: ["47"],
  other: [],
};

const QuerySchema = z
  .object({
    name: z.string().min(2).optional(),
    orgNumber: z.string().min(9).optional(),
  })
  .refine((d) => d.name || d.orgNumber, { message: "name or orgNumber required" });

type Candidate = {
  orgNumber: string;
  name: string;
  street: string;
  postalCode: string;
  city: string;
  foundingDate: string | null;
  industry: string;
  score?: number;
};

type PlacesMatch = {
  name: string;
  address: string;
  category: string;
  rating: number | null;
  reviewCount: number | null;
  phone: string;
  website: string;
  latitude: number | null;
  longitude: number | null;
};

type SearchResponse = {
  candidates: Candidate[];
  needOrgNumber: boolean;
  placesMatch: PlacesMatch | null;
};

/**
 * GET /api/scrape/brreg?name=Røra+Cafe&city=Porsgrunn&industry=restaurant
 * GET /api/scrape/brreg?orgNumber=123456789
 *
 * Smart BRREG lookup — prefers the scrapling service for AI-style ranking
 * (Jaro-Winkler name similarity + city + industry scoring). Falls back to
 * direct BRREG with poststed + næringskode filters when scrapling is
 * unreachable.
 *
 * Response shapes:
 *   { match: Candidate | null }                    ← orgNumber direct lookup
 *   { candidates: Candidate[], needOrgNumber: bool } ← name search
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const name = searchParams.get("name") ?? undefined;
  const city = searchParams.get("city") ?? undefined;
  const industry = searchParams.get("industry") ?? undefined;
  const orgNumber = searchParams.get("orgNumber")?.replace(/\s/g, "") ?? undefined;

  const parsed = QuerySchema.safeParse({ name, orgNumber });
  if (!parsed.success) {
    return NextResponse.json({ error: "name or orgNumber required" }, { status: 400 });
  }

  // Direct lookup by org number — try scrapling first, fall back to BRREG.
  if (orgNumber && orgNumber.length >= 9) {
    const scraplingMatch = await scraplingLookupByOrg(orgNumber);
    if (scraplingMatch !== undefined) {
      return NextResponse.json({ match: scraplingMatch });
    }
    return NextResponse.json({ match: await brregDirectLookup(orgNumber) });
  }

  if (!name) {
    return NextResponse.json({ error: "name or orgNumber required" }, { status: 400 });
  }

  // Smart search via scrapling — preferred path
  const smart = await scraplingSmartSearch(name, city, industry);
  if (smart) {
    return NextResponse.json(smart);
  }

  // Fallback: direct BRREG with poststed + næringskode filters
  return NextResponse.json(await brregDirectSearch(name, city, industry));
}

// ── Scrapling client ────────────────────────────────────────────────

async function scraplingSmartSearch(
  companyName: string,
  city: string | undefined,
  industry: string | undefined,
): Promise<SearchResponse | null> {
  const baseUrl = env.SCRAPLING_SERVICE_URL;
  if (!baseUrl) return null;

  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (env.SCRAPLING_AUTH_TOKEN) {
      headers["Authorization"] = `Bearer ${env.SCRAPLING_AUTH_TOKEN}`;
    }
    // Larger timeout — scrapling does BRREG + Serper Places in parallel,
    // so the call can take several seconds when both are queried.
    const res = await fetch(`${baseUrl}/brreg-search`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        company_name: companyName,
        city,
        industry,
        max_results: 5,
      }),
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return null;
    return (await res.json()) as SearchResponse;
  } catch {
    return null;
  }
}

async function scraplingLookupByOrg(orgNumber: string): Promise<Candidate | null | undefined> {
  const baseUrl = env.SCRAPLING_SERVICE_URL;
  if (!baseUrl) return undefined;

  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (env.SCRAPLING_AUTH_TOKEN) {
      headers["Authorization"] = `Bearer ${env.SCRAPLING_AUTH_TOKEN}`;
    }
    const res = await fetch(`${baseUrl}/brreg-lookup`, {
      method: "POST",
      headers,
      body: JSON.stringify({ orgNumber }),
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return undefined;
    const data = (await res.json()) as { match: Candidate | null };
    return data.match;
  } catch {
    return undefined;
  }
}

// ── Direct BRREG fallback ───────────────────────────────────────────

async function brregDirectLookup(orgNumber: string): Promise<Candidate | null> {
  try {
    const res = await fetch(`${BRREG_BASE}/enheter/${orgNumber}`, {
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const entity = (await res.json()) as Record<string, unknown>;
    return mapEntity(entity);
  } catch {
    return null;
  }
}

async function brregDirectSearch(
  name: string,
  city: string | undefined,
  industry: string | undefined,
): Promise<SearchResponse> {
  const naceList = industry ? (INDUSTRY_NACE[industry] ?? []) : [];

  // Relax sequence — most specific first, fall back to broader queries.
  const attempts: URLSearchParams[] = [];
  if (city && naceList.length > 0) {
    const p = new URLSearchParams({ navn: name, size: "20" });
    p.set("forretningsadresse.poststed", city.toUpperCase());
    p.set("naeringskode", naceList.join(","));
    attempts.push(p);
  }
  if (city) {
    const p = new URLSearchParams({ navn: name, size: "20" });
    p.set("forretningsadresse.poststed", city.toUpperCase());
    attempts.push(p);
  }
  if (naceList.length > 0) {
    const p = new URLSearchParams({ navn: name, size: "20" });
    p.set("naeringskode", naceList.join(","));
    attempts.push(p);
  }
  attempts.push(new URLSearchParams({ navn: name, size: "10" }));

  try {
    for (const params of attempts) {
      const res = await fetch(`${BRREG_BASE}/enheter?${params}`, {
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) continue;
      const data = (await res.json()) as {
        _embedded?: { enheter?: Record<string, unknown>[] };
      };
      const entities = data?._embedded?.enheter ?? [];
      if (entities.length === 0) continue;

      // Crude city-match preference (no fuzzy scoring in fallback)
      const candidates = entities.map((e) => mapEntity(e));
      if (city) {
        const cityUpper = city.toUpperCase();
        candidates.sort((a, b) => {
          const aMatch = a.city.toUpperCase() === cityUpper ? 0 : 1;
          const bMatch = b.city.toUpperCase() === cityUpper ? 0 : 1;
          return aMatch - bMatch;
        });
      }
      return { candidates: candidates.slice(0, 5), needOrgNumber: false, placesMatch: null };
    }
    return { candidates: [], needOrgNumber: true, placesMatch: null };
  } catch {
    return { candidates: [], needOrgNumber: true, placesMatch: null };
  }
}

function mapEntity(e: Record<string, unknown>): Candidate {
  const addr =
    (e.forretningsadresse as Record<string, unknown> | undefined) ??
    (e.postadresse as Record<string, unknown> | undefined);
  const nace = e.naeringskode1 as { beskrivelse?: string } | undefined;
  return {
    orgNumber: (e.organisasjonsnummer as string) ?? "",
    name: (e.navn as string) ?? "",
    street: ((addr?.adresse as string[] | undefined) ?? [])[0] || "",
    postalCode: (addr?.postnummer as string) || "",
    city: (addr?.poststed as string) || "",
    foundingDate: (e.stiftelsesdato as string) || null,
    industry: nace?.beskrivelse || "",
  };
}
