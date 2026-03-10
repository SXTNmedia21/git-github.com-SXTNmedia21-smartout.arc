// Shared Brreg (Brønnøysundregistrene) helpers
// Used by: gather-workspace-intelligence, search-brreg, identify-company

export interface BrregEntity {
  organisasjonsnummer: string;
  navn: string;
  forretningsadresse?: {
    adresse?: string[];
    postnummer?: string;
    poststed?: string;
    kommune?: string;
  };
  postadresse?: {
    adresse?: string[];
    postnummer?: string;
    poststed?: string;
  };
  hjemmeside?: string;
  naeringskode1?: { kode: string; beskrivelse: string };
  naeringskode2?: { kode: string; beskrivelse: string };
  naeringskode3?: { kode: string; beskrivelse: string };
  antallAnsatte?: number;
  organisasjonsform?: { kode: string; beskrivelse: string };
  registreringsdatoEnhetsregisteret?: string;
  stiftelsesdato?: string;
  registrertIMvaregisteret?: boolean;
  sisteInnsendteAarsregnskap?: string;
  overordnetEnhet?: string;
  underAvvikling?: boolean;
  konkurs?: boolean;
}

export interface BrregMatch {
  entity: BrregEntity;
  score: number;
}

export function normalizeName(name: string): string {
  return (
    name
      .toLowerCase()
      // Swedish → Norwegian character normalization
      .replace(/ö/g, "ø")
      .replace(/ä/g, "æ")
      .replace(/ü/g, "u")
      // Common synonyms in business names
      .replace(/\boch\b/g, "og")
      .replace(/&/g, "og")
      // Strip legal suffixes
      .replace(/\b(as|ans|da|asa|sa|enk)\b/gi, "")
      .replace(/[^a-zæøå0-9\s]/g, "")
      .trim()
      .replace(/\s+/g, " ")
  );
}

export function scoreBrregMatch(
  entity: BrregEntity,
  scrapedName: string,
  scrapedCity: string | null,
): number {
  let score = 0;
  const normalEntity = normalizeName(entity.navn);
  const normalScraped = normalizeName(scrapedName);

  if (normalEntity === normalScraped) {
    score += 100;
  } else if (normalEntity.includes(normalScraped) || normalScraped.includes(normalEntity)) {
    score += 50;
  }

  if (
    scrapedCity &&
    entity.forretningsadresse?.poststed?.toLowerCase() === scrapedCity.toLowerCase()
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

/**
 * Generate search variations for a company name.
 * Handles Swedish/Norwegian differences, common abbreviations, and partial names.
 */
function generateSearchVariations(name: string): string[] {
  const variations: string[] = [name];
  const lower = name.toLowerCase();

  // Swedish → Norwegian: ö→ø, ä→æ
  if (/[öä]/.test(lower)) {
    variations.push(
      name
        .replace(/[öÖ]/g, (c) => (c === "ö" ? "ø" : "Ø"))
        .replace(/[äÄ]/g, (c) => (c === "ä" ? "æ" : "Æ")),
    );
  }
  // Norwegian → Swedish (reverse)
  if (/[øæ]/.test(lower)) {
    variations.push(
      name
        .replace(/[øØ]/g, (c) => (c === "ø" ? "ö" : "Ö"))
        .replace(/[æÆ]/g, (c) => (c === "æ" ? "ä" : "Ä")),
    );
  }

  // "och" ↔ "og" ↔ "&"
  if (/\boch\b/i.test(name)) {
    variations.push(name.replace(/\boch\b/gi, "og"));
    variations.push(name.replace(/\boch\b/gi, "&"));
  }
  if (/\bog\b/i.test(name)) {
    variations.push(name.replace(/\bog\b/gi, "&"));
  }
  if (/&/.test(name)) {
    variations.push(name.replace(/&/g, "og"));
  }

  // Try without trailing words like "restaurant", "bar", "café"
  const stripped = name
    .replace(/\s+(restaurant|bar|café|cafe|kafé|hotell|hotel|bistro|brasserie|mat)\s*$/i, "")
    .trim();
  if (stripped !== name && stripped.length > 2) {
    variations.push(stripped);
  }

  // Try first word only (for "Lysverket Restaurant" → "Lysverket")
  const firstWord = name.split(/\s+/)[0];
  if (firstWord && firstWord.length > 3 && firstWord !== name) {
    variations.push(firstWord);
  }

  // Deduplicate
  return [...new Set(variations)];
}

export async function searchBrregByName(
  companyName: string,
  scrapedCity: string | null,
): Promise<BrregEntity | null> {
  const variations = generateSearchVariations(companyName);
  let bestMatch: BrregMatch | null = null;

  for (const variant of variations) {
    try {
      const encoded = encodeURIComponent(variant);
      const res = await fetch(
        `https://data.brreg.no/enhetsregisteret/api/enheter?navn=${encoded}&size=5`,
      );
      if (!res.ok) continue;

      const data = await res.json();
      const entities: BrregEntity[] = data?._embedded?.enheter || [];
      if (entities.length === 0) continue;

      // Score against the ORIGINAL name (not the variant)
      const scored: BrregMatch[] = entities.map((entity) => ({
        entity,
        score: scoreBrregMatch(entity, companyName, scrapedCity),
      }));

      scored.sort((a, b) => b.score - a.score);

      if (scored[0].score >= 50 && (!bestMatch || scored[0].score > bestMatch.score)) {
        bestMatch = scored[0];
      }

      // Perfect match — stop searching
      if (bestMatch && bestMatch.score >= 100) break;
    } catch (e) {
      console.warn(`Brreg search for "${variant}" failed:`, e);
    }
  }

  if (bestMatch) {
    console.log(
      `[brreg] Matched: ${bestMatch.entity.navn} (score: ${bestMatch.score}, searched: ${variations.length} variations)`,
    );
    return bestMatch.entity;
  }

  console.log(`[brreg] No match for "${companyName}" after ${variations.length} variations`);
  return null;
}

/**
 * Search Brreg and return ALL scored matches (not just the best one).
 * Used by search-brreg Edge Function for progressive intelligence.
 */
export async function searchBrregByNameAll(
  companyName: string,
  city: string | null,
): Promise<BrregMatch[]> {
  try {
    const encoded = encodeURIComponent(companyName);
    const res = await fetch(
      `https://data.brreg.no/enhetsregisteret/api/enheter?navn=${encoded}&size=10`,
    );
    if (!res.ok) return [];

    const data = await res.json();
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

export async function fetchBrregDetails(orgNumber: string): Promise<BrregEntity | null> {
  try {
    const res = await fetch(`https://data.brreg.no/enhetsregisteret/api/enheter/${orgNumber}`);
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

export async function fetchDagligLeder(orgNumber: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://data.brreg.no/enhetsregisteret/api/enheter/${orgNumber}/roller`,
    );
    if (!res.ok) return null;

    const data = await res.json();
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
