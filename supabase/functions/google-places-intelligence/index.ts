import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders } from "../_shared/cors.ts";

const FIELD_MASK = [
  "places.displayName",
  "places.rating",
  "places.userRatingCount",
  "places.regularOpeningHours",
  "places.priceLevel",
  "places.photos",
  "places.websiteUri",
  "places.nationalPhoneNumber",
  "places.googleMapsUri",
  "places.location",
  "places.primaryType",
  "places.id",
].join(",");

interface PlacesResult {
  placeId: string | null;
  displayName: string | null;
  rating: number | null;
  userRatingCount: number | null;
  openingHours: string[] | null;
  priceLevel: string | null;
  photos: string[];
  websiteUri: string | null;
  phone: string | null;
  googleMapsUri: string | null;
  location: { lat: number; lng: number } | null;
  primaryType: string | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("GOOGLE_API_KEY");

    // Graceful degradation: if no API key, return empty result
    if (!apiKey) {
      console.log("[places] No GOOGLE_API_KEY configured, returning empty");
      return new Response(JSON.stringify({ success: true, data: null, reason: "no_api_key" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const { companyName, city } = await req.json();

    if (!companyName) {
      return new Response(JSON.stringify({ error: "companyName is required" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    const query = city ? `${companyName} ${city}` : companyName;
    console.log(`[places] Searching for: "${query}"`);

    const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": FIELD_MASK,
      },
      body: JSON.stringify({
        textQuery: query,
        languageCode: "no",
        regionCode: "NO",
        maxResultCount: 1,
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error(`[places] Google API error ${res.status}: ${errorText}`);
      return new Response(JSON.stringify({ success: true, data: null, reason: "api_error" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const json = await res.json();
    const place = json.places?.[0];

    if (!place) {
      console.log("[places] No results found");
      return new Response(JSON.stringify({ success: true, data: null, reason: "no_results" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Extract photo URIs (first 5)
    const photos: string[] = (place.photos || [])
      .slice(0, 5)
      .map(
        (p: { name: string }) =>
          `https://places.googleapis.com/v1/${p.name}/media?maxWidthPx=800&key=${apiKey}`,
      );

    // Format opening hours as simple string array
    const openingHours: string[] | null = place.regularOpeningHours?.weekdayDescriptions || null;

    const result: PlacesResult = {
      placeId: place.id || null,
      displayName: place.displayName?.text || null,
      rating: place.rating ?? null,
      userRatingCount: place.userRatingCount ?? null,
      openingHours,
      priceLevel: place.priceLevel || null,
      photos,
      websiteUri: place.websiteUri || null,
      phone: place.nationalPhoneNumber || null,
      googleMapsUri: place.googleMapsUri || null,
      location: place.location
        ? { lat: place.location.latitude, lng: place.location.longitude }
        : null,
      primaryType: place.primaryType || null,
    };

    console.log(
      `[places] Found: ${result.displayName} (rating: ${result.rating}, reviews: ${result.userRatingCount})`,
    );

    return new Response(JSON.stringify({ success: true, data: result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: unknown) {
    console.error("[places] Error:", error);
    return new Response(
      JSON.stringify({
        success: true,
        data: null,
        reason: "exception",
        error: error instanceof Error ? error.message : String(error),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  }
});
