import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { corsHeaders } from "../_shared/cors.ts";

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

    const scored: BrregMatch[] = entities.map((entity) => ({
      entity,
      score: scoreBrregMatch(entity, companyName, scrapedCity),
    }));

    scored.sort((a, b) => b.score - a.score);

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

// --- Scrapling helper ---

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

// --- Google Places helper ---

async function fetchGooglePlaces(
  companyName: string,
  city: string,
): Promise<Record<string, unknown> | null> {
  try {
    const edgeFunctionUrl = Deno.env.get("SUPABASE_URL")
      ? `${Deno.env.get("SUPABASE_URL")}/functions/v1`
      : "http://host.docker.internal:54321/functions/v1";

    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    const res = await fetch(`${edgeFunctionUrl}/google-places-intelligence`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ companyName, city }),
    });

    if (!res.ok) return null;

    const json = await res.json();
    return json?.data || null;
  } catch (e) {
    console.warn("Google Places lookup failed:", e);
    return null;
  }
}

// --- Main handler ---

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Auth client (for user context)
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization") ?? "" },
        },
      },
    );

    // Service-role client (for RPC calls)
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const {
      data: { user },
    } = await supabaseClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

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

    // ══════════════════════════════════════════════════════════════
    // PHASE A (parallel): Scrape website + Brreg direct lookup
    // ══════════════════════════════════════════════════════════════

    let scrapedData: Record<string, unknown> | null = null;
    let companyName: string | null = null;
    let brregEntity: BrregEntity | null = null;
    let dagligLeder: string | null = null;
    let brregMatched = false;

    const phaseAPromises: Promise<void>[] = [];

    // Scrape website (if URL provided)
    if (url) {
      phaseAPromises.push(
        (async () => {
          const scraplingBase =
            Deno.env.get("SCRAPLING_SERVICE_URL") || "http://host.docker.internal:8000";
          console.log("[intelligence] Phase A: Scraping...");
          scrapedData = await fetchScraplingWithRetry(scraplingBase, url);
          companyName = (scrapedData as Record<string, unknown>)?.companyName as string | null;
          console.log(`[intelligence] Scraped company: ${companyName || "unknown"}`);
        })(),
      );
    }

    // Brreg direct lookup (if org number provided)
    if (orgNumber) {
      phaseAPromises.push(
        (async () => {
          console.log(`[intelligence] Phase A: Direct Brreg lookup for ${orgNumber}...`);
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

            // Auto-scrape website from Brreg if user didn't provide a URL
            if (!url && details.hjemmeside) {
              const brregUrl = details.hjemmeside.startsWith("http")
                ? details.hjemmeside
                : `https://${details.hjemmeside}`;
              console.log(`[intelligence] Step 2b: Auto-scraping Brreg website: ${brregUrl}`);
              try {
                const scraplingBase =
                  Deno.env.get("SCRAPLING_SERVICE_URL") || "http://host.docker.internal:8000";
                scrapedData = await fetchScraplingWithRetry(scraplingBase, brregUrl);
                console.log("[intelligence] Auto-scrape from Brreg website succeeded");
              } catch (e: unknown) {
                console.warn(
                  "[intelligence] Auto-scrape from Brreg website failed:",
                  e instanceof Error ? e.message : String(e),
                );
              }
            }
          }
        })(),
      );
    }

    await Promise.allSettled(phaseAPromises);

    // If no org number but we have a scraped name, search Brreg by name
    if (!orgNumber && companyName) {
      const scrapedCity: string | null =
        ((scrapedData as Record<string, unknown>)?.city as string) ??
        (((scrapedData as Record<string, unknown>)?.address as Record<string, unknown>)
          ?.city as string) ??
        null;

      const cleanName = companyName
        .split(/\s*[–—\-|:]\s*/)[0]
        .replace(/\s+(restaurant|bar|cafe|kafé|hotell|hotel|bistro|brasserie)\s*$/i, "")
        .trim();

      console.log(`[intelligence] Searching Brreg for "${cleanName}"...`);
      brregEntity = await searchBrregByName(cleanName, scrapedCity);

      if (brregEntity) {
        brregMatched = true;
        const matchedOrgNumber = brregEntity.organisasjonsnummer;
        const [fullDetails, leader] = await Promise.all([
          fetchBrregDetails(matchedOrgNumber),
          fetchDagligLeder(matchedOrgNumber),
        ]);
        if (fullDetails) brregEntity = fullDetails;
        dagligLeder = leader;
      }
    }

    // Resolve final company name
    companyName = companyName || brregEntity?.navn || null;

    if (!companyName) {
      return new Response(
        JSON.stringify({ error: "Could not determine company name from scraping or Brreg." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 },
      );
    }

    // ══════════════════════════════════════════════════════════════
    // PHASE B: Create workspace via provision RPC
    // ══════════════════════════════════════════════════════════════

    console.log(`[intelligence] Phase B: Provisioning workspace for "${companyName}"...`);

    const { data: workspaceId, error: provisionError } = await adminClient.rpc(
      "provision_onboarding_workspace",
      {
        p_user_id: user.id,
        p_company_name: companyName,
        p_intelligence_data: {
          source_url: url || `brreg:${orgNumber}`,
          pipeline_started_at: new Date().toISOString(),
        },
      },
    );

    if (provisionError) {
      console.error("Failed to provision workspace:", provisionError);
      throw new Error(`Workspace provisioning failed: ${provisionError.message}`);
    }

    console.log(`[intelligence] Workspace provisioned: ${workspaceId}`);

    // ══════════════════════════════════════════════════════════════
    // PHASE C (parallel): Places + Web Search
    // ══════════════════════════════════════════════════════════════

    const city = brregEntity?.forretningsadresse?.poststed || "";

    console.log(`[intelligence] Phase C: Parallel lookups for "${companyName}" in "${city}"...`);

    const [placesResult, webSearchResult] = await Promise.allSettled([
      fetchGooglePlaces(companyName, city),
      companyName ? fetchWebSearch(companyName, city) : Promise.resolve(null),
    ]);

    const placesData = placesResult.status === "fulfilled" ? placesResult.value : null;
    const webSearchData = webSearchResult.status === "fulfilled" ? webSearchResult.value : null;

    // ══════════════════════════════════════════════════════════════
    // PHASE D: Build response + store in workspace
    // ══════════════════════════════════════════════════════════════

    const brregResponse = {
      matched: brregMatched,
      orgNumber: brregEntity?.organisasjonsnummer || null,
      legalName: brregEntity?.navn || null,
      website: brregEntity?.hjemmeside || null,
      naceCode: brregEntity?.naeringskode1?.kode || null,
      naceDescription: brregEntity?.naeringskode1?.beskrivelse || null,
      secondaryIndustries: [
        brregEntity?.naeringskode2
          ? {
              code: brregEntity.naeringskode2.kode,
              description: brregEntity.naeringskode2.beskrivelse,
            }
          : null,
        brregEntity?.naeringskode3
          ? {
              code: brregEntity.naeringskode3.kode,
              description: brregEntity.naeringskode3.beskrivelse,
            }
          : null,
      ].filter(Boolean),
      address: brregEntity?.forretningsadresse
        ? {
            street: brregEntity.forretningsadresse.adresse?.[0] || "",
            postalCode: brregEntity.forretningsadresse.postnummer || "",
            city: brregEntity.forretningsadresse.poststed || "",
            municipality: brregEntity.forretningsadresse.kommune || "",
          }
        : null,
      dagligLeder,
      employeeCount: brregEntity?.antallAnsatte ?? null,
      companyType: brregEntity?.organisasjonsform?.beskrivelse || null,
      registrationDate: brregEntity?.registreringsdatoEnhetsregisteret || null,
      foundingDate: brregEntity?.stiftelsesdato || null,
      vatRegistered: brregEntity?.registrertIMvaregisteret ?? null,
      lastAnnualReport: brregEntity?.sisteInnsendteAarsregnskap || null,
      parentCompany: brregEntity?.overordnetEnhet || null,
    };

    // Update workspace with all intelligence data + promoted columns
    const updatePayload: Record<string, unknown> = {
      intelligence_data: {
        source_url: url || `brreg:${orgNumber}`,
        pipeline_completed_at: new Date().toISOString(),
        scraped: scrapedData,
        brreg: brregResponse,
        places: placesData,
        webSearch: webSearchData,
      },
    };

    // Promote Places data to dedicated columns
    if (placesData) {
      const places = placesData as Record<string, unknown>;
      if (places.location) {
        const loc = places.location as { lat: number; lng: number };
        updatePayload.latitude = loc.lat;
        updatePayload.longitude = loc.lng;
      }
      if (places.googleMapsUri) updatePayload.google_maps_url = places.googleMapsUri;
      if (places.rating != null) updatePayload.google_rating = places.rating;
      if (places.userRatingCount != null)
        updatePayload.google_rating_count = places.userRatingCount;
      if (places.priceLevel) updatePayload.google_price_level = places.priceLevel;
      if (places.placeId) updatePayload.google_place_id = places.placeId;
    }

    const { error: updateError } = await adminClient
      .from("workspace")
      .update(updatePayload)
      .eq("workspace_id", workspaceId);

    if (updateError) {
      console.error("Failed to update workspace with intelligence:", updateError);
    }

    console.log(`[intelligence] Pipeline complete. Workspace: ${workspaceId}`);

    return new Response(
      JSON.stringify({
        success: true,
        workspaceId,
        scrapedData,
        brregData: brregResponse,
        placesData: placesData || null,
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
