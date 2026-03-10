import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import {
  type BrregEntity,
  searchBrregByName,
  fetchBrregDetails,
  fetchDagligLeder,
} from "../_shared/brreg.ts";

// --- Scrapling helper ---

async function fetchScraplingWithRetry(
  scraplingBase: string,
  url: string,
  naceCode?: string | null,
  retries = 3,
) {
  const scraplingToken = Deno.env.get("SCRAPLING_AUTH_TOKEN");
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (scraplingToken) headers["Authorization"] = `Bearer ${scraplingToken}`;

  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(`${scraplingBase}/extract`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          url,
          config: {
            include_company_info: true,
            include_locations: true,
            include_departments: true,
            nace_code: naceCode || undefined,
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

Deno.serve(async (req) => {
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

    // Auth is optional — unauthenticated callers get intelligence data without workspace provisioning
    const {
      data: { user },
    } = await supabaseClient.auth.getUser();

    const {
      url,
      orgNumber: rawOrgNumber,
      companyName: rawCompanyName,
      city: rawCity,
    } = await req.json();
    const orgNumber = rawOrgNumber?.replace(/\s+/g, "") || "";
    const inputCompanyName = rawCompanyName?.trim() || "";
    const inputCity = rawCity?.trim() || "";

    if (!url && !orgNumber && !inputCompanyName) {
      return new Response(
        JSON.stringify({ error: "URL, org number, or company name is required." }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        },
      );
    }

    console.log(
      `[intelligence] Starting pipeline — url: ${url || "(none)"}, orgNumber: ${orgNumber || "(none)"}, companyName: ${inputCompanyName || "(none)"}, city: ${inputCity || "(none)"}`,
    );

    // ══════════════════════════════════════════════════════════════
    // PHASE A (parallel): Scrape website + Brreg direct/name lookup
    // ══════════════════════════════════════════════════════════════

    let scrapedData: Record<string, unknown> | null = null;
    let companyName: string | null = inputCompanyName || null;
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
          companyName =
            companyName || ((scrapedData as Record<string, unknown>)?.companyName as string | null);
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

    // Name-only path: search Brreg by company name (no URL, no org number)
    if (!url && !orgNumber && inputCompanyName) {
      phaseAPromises.push(
        (async () => {
          console.log(
            `[intelligence] Phase A: Name-only path — searching Brreg for "${inputCompanyName}"...`,
          );
          brregEntity = await searchBrregByName(inputCompanyName, inputCity || null);

          if (brregEntity) {
            brregMatched = true;
            const matchedOrgNumber = brregEntity.organisasjonsnummer;
            const [fullDetails, leader] = await Promise.all([
              fetchBrregDetails(matchedOrgNumber),
              fetchDagligLeder(matchedOrgNumber),
            ]);
            if (fullDetails) brregEntity = fullDetails;
            dagligLeder = leader;
            companyName = companyName || brregEntity?.navn || inputCompanyName;
            console.log(
              `[intelligence] Brreg name match: ${brregEntity?.navn} (${matchedOrgNumber})`,
            );

            // Auto-scrape website from Brreg result
            if (brregEntity?.hjemmeside) {
              const brregUrl = brregEntity.hjemmeside.startsWith("http")
                ? brregEntity.hjemmeside
                : `https://${brregEntity.hjemmeside}`;
              console.log(`[intelligence] Auto-scraping Brreg website: ${brregUrl}`);
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

    // If we scraped a website but have no Brreg match yet, search by scraped name
    if (!brregMatched && !orgNumber && companyName) {
      const scrapedCity: string | null =
        (inputCity || ((scrapedData as Record<string, unknown>)?.city as string)) ??
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

    const city = brregEntity?.forretningsadresse?.poststed || inputCity || "";

    // ══════════════════════════════════════════════════════════════
    // PHASE A2: Web search to find website + email (if no scrape yet)
    // ══════════════════════════════════════════════════════════════

    let webSearchData: Record<string, unknown> | null = null;

    if (!scrapedData) {
      console.log(`[intelligence] Phase A2: Web search for "${companyName}" to find website...`);
      webSearchData = await fetchWebSearch(companyName, city);

      const discoveredWebsite = (webSearchData as Record<string, unknown>)?.website as
        | string
        | null;

      if (discoveredWebsite) {
        console.log(`[intelligence] Web search found website: ${discoveredWebsite}`);
        const scraplingBase =
          Deno.env.get("SCRAPLING_SERVICE_URL") || "http://host.docker.internal:8000";
        try {
          const nace = brregEntity?.naeringskode1?.kode || null;
          scrapedData = await fetchScraplingWithRetry(scraplingBase, discoveredWebsite, nace);
          console.log(`[intelligence] Scraped discovered website successfully`);
        } catch {
          console.warn(`[intelligence] Failed to scrape discovered website: ${discoveredWebsite}`);
        }
      }
    }

    // Domain fallback: try common patterns if still no scrape
    if (!scrapedData && companyName) {
      const baseName = companyName
        .toLowerCase()
        .replace(/\b(as|ans|da|asa|sa|enk)\b/gi, "")
        .replace(/[^a-z0-9]/g, "")
        .trim();

      const domainCandidates = [`${baseName}.no`, `${baseName}.ai`, `${baseName}.com`];

      const scraplingBase =
        Deno.env.get("SCRAPLING_SERVICE_URL") || "http://host.docker.internal:8000";
      const nace = brregEntity?.naeringskode1?.kode || null;

      for (const domain of domainCandidates) {
        try {
          console.log(`[intelligence] Trying domain fallback: ${domain}`);
          scrapedData = await fetchScraplingWithRetry(scraplingBase, `https://${domain}`, nace);
          console.log(`[intelligence] Domain fallback succeeded: ${domain}`);
          break;
        } catch {
          // Domain didn't work, try next
        }
      }
    }

    // Enrich email/phone from web search if scraping didn't find them
    if (scrapedData && webSearchData) {
      const sd = scrapedData as Record<string, unknown>;
      const ws = webSearchData as Record<string, unknown>;
      if (!sd.email && ws.email) {
        console.log(`[intelligence] Enriching email from web search: ${ws.email}`);
        sd.email = ws.email;
      }
      if (!sd.phone && ws.phone) {
        console.log(`[intelligence] Enriching phone from web search: ${ws.phone}`);
        sd.phone = ws.phone;
      }
    }

    // ══════════════════════════════════════════════════════════════
    // PHASE B: Create workspace via provision RPC (only if authenticated)
    // ══════════════════════════════════════════════════════════════

    const sourceUrl = url || (orgNumber ? `brreg:${orgNumber}` : `name:${inputCompanyName}`);
    let workspaceId: string | null = null;

    if (user) {
      console.log(`[intelligence] Phase B: Provisioning workspace for "${companyName}"...`);

      const { data: wsId, error: provisionError } = await adminClient.rpc(
        "provision_onboarding_workspace",
        {
          p_user_id: user.id,
          p_company_name: companyName,
          p_intelligence_data: {
            source_url: sourceUrl,
            pipeline_started_at: new Date().toISOString(),
          },
        },
      );

      if (provisionError) {
        console.error("Failed to provision workspace:", provisionError);
        throw new Error(`Workspace provisioning failed: ${provisionError.message}`);
      }

      workspaceId = wsId;
      console.log(`[intelligence] Workspace provisioned: ${workspaceId}`);
    } else {
      console.log("[intelligence] Phase B: Skipping workspace provisioning (no auth)");
    }

    // ══════════════════════════════════════════════════════════════
    // PHASE C (parallel): Places + Web Search (if not already done)
    // ══════════════════════════════════════════════════════════════

    console.log(`[intelligence] Phase C: Parallel lookups for "${companyName}" in "${city}"...`);

    const [placesResult, webSearchResult] = await Promise.allSettled([
      fetchGooglePlaces(companyName, city),
      // Skip web search if already done in Phase A2
      webSearchData ? Promise.resolve(webSearchData) : fetchWebSearch(companyName, city),
    ]);

    const placesData = placesResult.status === "fulfilled" ? placesResult.value : null;
    // Use existing webSearchData if already fetched, otherwise use Phase C result
    if (!webSearchData) {
      webSearchData = webSearchResult.status === "fulfilled" ? webSearchResult.value : null;
    }

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

    // Update workspace with all intelligence data + promoted columns (only if workspace was created)
    if (workspaceId) {
      const updatePayload: Record<string, unknown> = {
        intelligence_data: {
          source_url: sourceUrl,
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
    }

    console.log(`[intelligence] Pipeline complete. Workspace: ${workspaceId || "(no workspace)"}`);

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
