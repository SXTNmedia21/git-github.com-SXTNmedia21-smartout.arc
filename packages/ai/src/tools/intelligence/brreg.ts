// ============================================
// brreg.ts — Brreg Helper Functions (Node.js)
// Mirror of supabase/functions/_shared/brreg.ts for use in Node.js context.
// The Edge Function version uses Deno APIs; this version uses standard fetch.
// ============================================

import type { BrregEntity, BrregMatch, BrregCandidate } from "./types";

const BRREG_API = "https://data.brreg.no/enhetsregisteret/api/enheter";

/** Normalize a company name for fuzzy matching */
export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(as|ans|da|asa|sa|enk)\b/gi, "")
    .replace(/[^a-zæøå0-9\s]/g, "")
    .trim()
    .replace(/\s+/g, " ");
}

/** Score how well a Brreg entity matches a search query */
export function scoreBrregMatch(
  entity: BrregEntity,
  searchName: string,
  searchCity: string | null,
): number {
  let score = 0;
  const normalEntity = normalizeName(entity.navn);
  const normalSearch = normalizeName(searchName);

  if (normalEntity === normalSearch) {
    score += 100;
  } else if (normalEntity.includes(normalSearch) || normalSearch.includes(normalEntity)) {
    score += 50;
  }

  if (
    searchCity &&
    entity.forretningsadresse?.poststed?.toLowerCase() === searchCity.toLowerCase()
  ) {
    score += 30;
  }

  if (entity.antallAnsatte && entity.antallAnsatte > 0) {
    score += 10;
  }

  if (!entity.underAvvikling && !entity.konkurs) {
    score += 10;
  }

  return score;
}

// Brreg API response shape for name search
interface BrregSearchResponse {
  _embedded?: { enheter?: BrregEntity[] };
}

// Brreg roles response shape
interface BrregRolesResponse {
  rollegrupper?: Array<{
    roller?: Array<{
      type?: { kode: string };
      person?: {
        navn?: { fornavn?: string; mellomnavn?: string; etternavn?: string };
      };
    }>;
  }>;
}

/** Search Brreg by name and return the best match (score >= 50) */
export async function searchBrregByName(
  companyName: string,
  city: string | null,
): Promise<BrregEntity | null> {
  try {
    const encoded = encodeURIComponent(companyName);
    const res = await fetch(`${BRREG_API}?navn=${encoded}&size=5`);
    if (!res.ok) return null;

    const data = (await res.json()) as BrregSearchResponse;
    const entities: BrregEntity[] = data?._embedded?.enheter || [];
    if (entities.length === 0) return null;

    const scored: BrregMatch[] = entities.map((entity) => ({
      entity,
      score: scoreBrregMatch(entity, companyName, city),
    }));
    scored.sort((a, b) => b.score - a.score);

    const best = scored[0];
    return best && best.score >= 50 ? best.entity : null;
  } catch (e) {
    console.warn("Brreg name search failed:", e);
    return null;
  }
}

/** Search Brreg by name and return ALL scored matches */
export async function searchBrregByNameAll(
  companyName: string,
  city: string | null,
): Promise<BrregMatch[]> {
  try {
    const encoded = encodeURIComponent(companyName);
    const res = await fetch(`${BRREG_API}?navn=${encoded}&size=10`);
    if (!res.ok) return [];

    const data = (await res.json()) as BrregSearchResponse;
    const entities: BrregEntity[] = data?._embedded?.enheter || [];
    if (entities.length === 0) return [];

    const scored: BrregMatch[] = entities.map((entity) => ({
      entity,
      score: scoreBrregMatch(entity, companyName, city),
    }));
    scored.sort((a, b) => b.score - a.score);
    return scored;
  } catch (e) {
    console.warn("Brreg name search failed:", e);
    return [];
  }
}

/** Fetch full Brreg details for a single org number */
export async function fetchBrregDetails(orgNumber: string): Promise<BrregEntity | null> {
  try {
    const res = await fetch(`${BRREG_API}/${orgNumber}`);
    return res.ok ? ((await res.json()) as BrregEntity) : null;
  } catch {
    return null;
  }
}

/** Fetch daglig leder (CEO) name from Brreg roles API */
export async function fetchDagligLeder(orgNumber: string): Promise<string | null> {
  try {
    const res = await fetch(`${BRREG_API}/${orgNumber}/roller`);
    if (!res.ok) return null;

    const data = (await res.json()) as BrregRolesResponse;
    const groups = data?.rollegrupper || [];

    const rolePriority = ["DAGL", "LEDE", "INHA"];
    for (const code of rolePriority) {
      for (const group of groups) {
        for (const rolle of group.roller || []) {
          if (rolle.type?.kode === code && rolle.person?.navn) {
            const n = rolle.person.navn;
            return [n.fornavn, n.mellomnavn, n.etternavn].filter(Boolean).join(" ");
          }
        }
      }
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Convert raw Brreg matches to BrregCandidate format.
 * Filters to score >= minScore and limits to maxResults.
 */
export function toBrregCandidates(
  matches: BrregMatch[],
  minScore = 30,
  maxResults = 5,
): BrregCandidate[] {
  return matches
    .filter((m) => m.score >= minScore)
    .slice(0, maxResults)
    .map((m) => ({
      orgNumber: m.entity.organisasjonsnummer,
      name: m.entity.navn,
      city: m.entity.forretningsadresse?.poststed || "",
      industry: m.entity.naeringskode1?.beskrivelse || "",
      industryCode: m.entity.naeringskode1?.kode || "",
      employeeCount: m.entity.antallAnsatte ?? null,
      score: m.score,
      address: m.entity.forretningsadresse?.adresse?.[0] || "",
      highConfidence: m.score >= 80,
    }));
}
