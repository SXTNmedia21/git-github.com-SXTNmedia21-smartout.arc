import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// --- Brreg helpers ---

interface BrregEntity {
  organisasjonsnummer: string;
  navn: string;
  forretningsadresse?: {
    adresse?: string[];
    postnummer?: string;
    poststed?: string;
    kommune?: string;
  };
  naeringskode1?: { kode: string; beskrivelse: string };
  antallAnsatte?: number;
  organisasjonsform?: { kode: string; beskrivelse: string };
  registreringsdatoEnhetsregisteret?: string;
  underAvvikling?: boolean;
  konkurs?: boolean;
}

interface BrregMatch {
  entity: BrregEntity;
  score: number;
}

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(as|ans|da|asa|sa|enk)\b/gi, "")
    .replace(/[^a-zæøå0-9\s]/g, "")
    .trim()
    .replace(/\s+/g, " ");
}

function scoreBrregMatch(
  entity: BrregEntity,
  scrapedName: string,
  scrapedCity: string | null,
): number {
  let score = 0;
  const normalEntity = normalizeName(entity.navn);
  const normalScraped = normalizeName(scrapedName);

  // Exact match
  if (normalEntity === normalScraped) {
    score += 100;
  } else if (normalEntity.includes(normalScraped) || normalScraped.includes(normalEntity)) {
    score += 50;
  }

  // City match
  if (
    scrapedCity &&
    entity.forretningsadresse?.poststed?.toLowerCase() === scrapedCity.toLowerCase()
  ) {
    score += 30;
  }

  // Has employees
  if (entity.antallAnsatte && entity.antallAnsatte > 0) {
    score += 10;
  }

  // Not under liquidation
  if (!entity.underAvvikling && !entity.konkurs) {
    score += 10;
  }

  return score;
}

async function searchBrregByName(
  companyName: string,
  scrapedCity: string | null,
): Promise<BrregEntity | null> {
  try {
    const encoded = encodeURIComponent(companyName);
    const res = await fetch(
      `https://data.brreg.no/enhetsregisteret/api/enheter?navn=${encoded}&size=5`,
    );
    if (!res.ok) return null;

    const data = await res.json();
    const entities: BrregEntity[] = data?._embedded?.enheter || [];

    if (entities.length === 0) return null;

    // Score and rank
    const scored: BrregMatch[] = entities.map((entity) => ({
      entity,
      score: scoreBrregMatch(entity, companyName, scrapedCity),
    }));

    scored.sort((a, b) => b.score - a.score);

    // Only return if confidence is high enough
    if (scored[0].score >= 50) {
      return scored[0].entity;
    }

    return null;
  } catch (e) {
    console.warn("Brreg name search failed:", e);
    return null;
  }
}

async function fetchBrregDetails(orgNumber: string): Promise<BrregEntity | null> {
  try {
    const res = await fetch(`https://data.brreg.no/enhetsregisteret/api/enheter/${orgNumber}`);
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

async function fetchDagligLeder(orgNumber: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://data.brreg.no/enhetsregisteret/api/enheter/${orgNumber}/roller`,
    );
    if (!res.ok) return null;

    const data = await res.json();
    const groups = data?.rollegrupper || [];

    // Priority: Daglig leder (CEO) > Styrets leder (Board chair) > Innehaver (Owner)
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

// --- Scrapling helper (kept from original) ---

async function fetchScraplingWithRetry(scraplingBase: string, url: string, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(`${scraplingBase}/extract`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url,
          config: {
            include_company_info: true,
            include_locations: true,
            include_departments: true,
          },
        }),
      });
      if (res.ok) return await res.json();
      console.warn(`Scrapling attempt ${i + 1} failed: ${res.status}`);
    } catch (e: unknown) {
      console.warn(`Scrapling attempt ${i + 1} threw:`, e instanceof Error ? e.message : String(e));
    }
    if (i < retries - 1) {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  throw new Error(`Scrapling service unavailable after ${retries} attempts.`);
}

// --- Web search helper ---

async function fetchWebSearch(
  companyName: string,
  city: string,
): Promise<Record<string, unknown> | null> {
  try {
    const edgeFunctionUrl = Deno.env.get("SUPABASE_URL")
      ? `${Deno.env.get("SUPABASE_URL")}/functions/v1`
      : "http://host.docker.internal:54321/functions/v1";

    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    const res = await fetch(`${edgeFunctionUrl}/web-search-intelligence`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ companyName, city }),
    });

    return res.ok ? await res.json() : null;
  } catch (e) {
    console.warn("Web search failed:", e);
    return null;
  }
}

// --- Main handler ---

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      },
    );

    const {
      data: { user },
    } = await supabaseClient.auth.getUser();
    const userId = user?.id || null;

    const { url, orgNumber: rawOrgNumber } = await req.json();
    const orgNumber = rawOrgNumber?.replace(/\s+/g, "") || "";

    if (!url && !orgNumber) {
      return new Response(JSON.stringify({ error: "URL or org number is required." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    console.log(
      `[intelligence] Starting pipeline — url: ${url || "(none)"}, orgNumber: ${orgNumber || "(none)"}`,
    );

    // ── STEP 1: Scrape website (skip if org-number-only) ──
    let scrapedData: Record<string, unknown> | null = null;
    let companyName: string | null = null;

    if (url) {
      const scraplingBase =
        Deno.env.get("SCRAPLING_SERVICE_URL") || "http://host.docker.internal:8000";

      console.log("[intelligence] Step 1: Scraping...");
      scrapedData = await fetchScraplingWithRetry(scraplingBase, url);
      companyName = (scrapedData as Record<string, unknown>)?.companyName as string | null;
      console.log(`[intelligence] Scraped company: ${companyName || "unknown"}`);
    } else {
      console.log("[intelligence] Step 1: Skipped (org-number-only mode)");
    }

    // ── STEP 2: Brreg lookup ──
    let brregEntity: BrregEntity | null = null;
    let dagligLeder: string | null = null;
    let brregMatched = false;

    if (orgNumber) {
      // Direct lookup by org number
      console.log(`[intelligence] Step 2: Direct Brreg lookup for ${orgNumber}...`);
      const [details, leader] = await Promise.all([
        fetchBrregDetails(orgNumber),
        fetchDagligLeder(orgNumber),
      ]);

      if (details) {
        brregEntity = details;
        brregMatched = true;
        dagligLeder = leader;
        companyName = companyName || details.navn;
        console.log(`[intelligence] Brreg found: ${details.navn} (${orgNumber})`);
        console.log(`[intelligence] Daglig leder: ${dagligLeder || "not found"}`);
      } else {
        console.log(`[intelligence] No Brreg entity found for ${orgNumber}`);
      }
    } else if (companyName) {
      // Search by scraped company name
      const scrapedCity: string | null =
        ((scrapedData as Record<string, unknown>)?.city as string) ??
        (((scrapedData as Record<string, unknown>)?.address as Record<string, unknown>)
          ?.city as string) ??
        null;

      // Clean company name for Brreg search: take first part before common separators
      const cleanName = companyName
        .split(/\s*[–—\-|:]\s*/)[0] // Split on dashes, pipes, colons
        .replace(/\s+(restaurant|bar|cafe|kafé|hotell|hotel|bistro|brasserie)\s*$/i, "") // Strip venue type suffixes
        .trim();

      console.log(
        `[intelligence] Step 2: Searching Brreg for "${cleanName}" (raw: "${companyName}")...`,
      );
      brregEntity = await searchBrregByName(cleanName, scrapedCity);

      // ── STEP 3: Fetch full Brreg details + roles ──
      if (brregEntity) {
        brregMatched = true;
        const matchedOrgNumber = brregEntity.organisasjonsnummer;
        console.log(
          `[intelligence] Step 3: Brreg match found: ${matchedOrgNumber} (${brregEntity.navn})`,
        );

        // Fetch details + roles in parallel
        const [fullDetails, leader] = await Promise.all([
          fetchBrregDetails(matchedOrgNumber),
          fetchDagligLeder(matchedOrgNumber),
        ]);

        if (fullDetails) brregEntity = fullDetails;
        dagligLeder = leader;
        console.log(`[intelligence] Daglig leder: ${dagligLeder || "not found"}`);
      } else {
        console.log("[intelligence] No confident Brreg match found");
      }
    }

    // ── STEP 4: Web search ──
    const city = brregEntity?.forretningsadresse?.poststed || "";

    console.log(`[intelligence] Step 4: Web search for "${companyName}" in "${city}"...`);
    const webSearchData = companyName ? await fetchWebSearch(companyName, city) : null;

    // ── STEP 5: Build structured Brreg response ──
    const brregResponse = {
      matched: brregMatched,
      orgNumber: brregEntity?.organisasjonsnummer || null,
      legalName: brregEntity?.navn || null,
      naceCode: brregEntity?.naeringskode1?.kode || null,
      naceDescription: brregEntity?.naeringskode1?.beskrivelse || null,
      address: brregEntity?.forretningsadresse
        ? {
            street: brregEntity.forretningsadresse.adresse?.[0] || "",
            postalCode: brregEntity.forretningsadresse.postnummer || "",
            city: brregEntity.forretningsadresse.poststed || "",
          }
        : null,
      dagligLeder,
      employeeCount: brregEntity?.antallAnsatte || null,
      companyType: brregEntity?.organisasjonsform?.beskrivelse || null,
      registrationDate: brregEntity?.registreringsdatoEnhetsregisteret || null,
    };

    // ── STEP 6: Store in onboarding_session ──
    const { data: sessionData, error: sessionError } = await supabaseClient
      .from("onboarding_session")
      .insert({
        user_id: userId,
        source_url: url || `brreg:${orgNumber}`,
        current_step: 1,
        scraped_data: scrapedData,
        brreg_data: brregResponse,
        web_search_data: webSearchData,
      })
      .select()
      .single();

    if (sessionError) {
      console.error("Failed to create onboarding session:", sessionError);
    }

    console.log(`[intelligence] Pipeline complete. Session: ${sessionData?.id || "none"}`);

    return new Response(
      JSON.stringify({
        success: true,
        sessionId: sessionData?.id || null,
        scrapedData,
        brregData: brregResponse,
        webSearchData: webSearchData || {
          rating: null,
          reviewCount: null,
          newsArticles: [],
          seasonalPatterns: [],
          mentions: [],
          jobListings: [],
        },
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      },
    );
  } catch (error: unknown) {
    console.error("Pipeline error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : String(error),
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      },
    );
  }
});
