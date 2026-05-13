/**
 * analyze-workspace — AI analysis of gathered intelligence, produces workspace suggestions.
 *
 * Auth: service-role bearer only (ADR-0029 + verifyInternalAuth pattern).
 * verify_jwt = false in config.toml because the caller is the web BFF (server-side),
 * which attaches SUPABASE_SERVICE_ROLE_KEY as Bearer.
 *
 * ADR-0029 Amendment (ADR-0123): this function is NOT a pre-workspace exception.
 * The onboarding_session RLS is JWT-scoped (auth.uid() = user_id), confirming this
 * is a server-internal (post-workspace-provisioning) call — service-role gate applies.
 *
 * References: F-EF-05 fix (feat/audit-fef05-analyze-workspace-auth), ADR-0029, ADR-0123.
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { verifyInternalAuth } from "../_shared/internal-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // ADR-0029 / F-EF-05: reject anonymous callers — service-role bearer only.
  // analyze-workspace is a server-internal function (web BFF → service role).
  // Anonymous browser callers must NEVER reach this function directly.
  const authResult = verifyInternalAuth(req);
  if (!authResult.ok) {
    console.warn("[analyze-workspace] auth_failure: missing or invalid bearer");
    return authResult.response;
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // Validate request body — fail-fast on missing required field.
    // sessionId must be a non-empty string (UUID of the onboarding_session row).
    const payload = await req.json().catch(() => null);
    if (!payload || typeof payload !== "object") {
      return new Response(JSON.stringify({ error: "invalid request body" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    const { sessionId, companyName, scrapedData, webSearchData } = payload as {
      sessionId?: unknown;
      companyName?: unknown;
      scrapedData?: Record<string, unknown>;
      webSearchData?: Record<string, unknown>;
    };

    if (!sessionId || typeof sessionId !== "string" || sessionId.trim() === "") {
      return new Response(JSON.stringify({ error: "sessionId is required." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    const safeCompanyName = typeof companyName === "string" ? companyName : "";

    console.log(`Starting AI Analysis for session ${sessionId} (${safeCompanyName || "Unknown"})`);

    // 1. Mock AI Analysis Call (Replace with actual Claude API call later)
    //
    // Example Claude prompt:
    // "You are an expert hospitality consultant. Given the following scraped data
    // and web search results, suggest an optimal Smartout workspace configuration.
    // Return ONLY a JSON object with:
    // - suggested_departments (array of {name, description, roles, isSeasonal, recommendedReason})
    // - suggested_teams (array of {name, department, isSeasonal, recommendedReason})
    // - suggested_zones (array of {name, location, capacity, isSeasonal, recommendedReason})
    // - suggested_branding (slogan, shortDescription, tone)"

    // Simulating Claude's JSON output based on the provided inputs
    const isRestaurant =
      webSearchData?.classification?.includes("Restaurant") ||
      scrapedData?.companyName?.toLowerCase().includes("restaurant");
    const hasTerrace =
      webSearchData?.mentions?.some((m: string) => m.toLowerCase().includes("terrace")) || false;

    const mockAiResponse = {
      suggested_departments: [
        {
          id: "1",
          name: "Kjøkken",
          roles: ["Kokk", "Sous Chef", "Oppvask"],
          description: "Your kitchen brigade",
          recommendedReason: "Required for all food-serving establishments.",
        },
        {
          id: "2",
          name: "Service",
          roles: ["Hovmester", "Servitør", "Runner"],
          description: "Front of house",
          recommendedReason: "Required for all dining establishments.",
        },
        ...(isRestaurant && webSearchData?.classification?.includes("Bar")
          ? [
              {
                id: "3",
                name: "Bar",
                roles: ["Bartender", "Barback"],
                description: "Detected from website mentions of cocktails",
                recommendedReason: "You mentioned award winning cocktails on TripAdvisor.",
              },
            ]
          : []),
      ],
      suggested_teams: [
        {
          name: "Kjøkken Dag",
          department: "Kjøkken",
          isSeasonal: false,
          recommendedReason: "Standard daily operations",
        },
        {
          name: "Kjøkken Kveld",
          department: "Kjøkken",
          isSeasonal: false,
          recommendedReason: "Standard evening operations",
        },
        {
          name: "Service Dag",
          department: "Service",
          isSeasonal: false,
          recommendedReason: "Standard daily operations",
        },
        {
          name: "Service Kveld",
          department: "Service",
          isSeasonal: false,
          recommendedReason: "Standard evening operations",
        },
        ...(hasTerrace
          ? [
              {
                name: "Uteservering-teamet",
                department: "Service",
                isSeasonal: true,
                recommendedReason:
                  "Detected terrace operations in reviews. Perfect for summer season.",
              },
            ]
          : []),
      ],
      suggested_zones: [
        {
          name: "Hovedsal",
          location: "Main",
          capacity: 60,
          isSeasonal: false,
          recommendedReason: "Standard indoor dining",
        },
        ...(hasTerrace
          ? [
              {
                name: "Uteservering",
                location: "Main",
                capacity: 40,
                isSeasonal: true,
                recommendedReason: "Detected from Google Reviews.",
              },
            ]
          : []),
      ],
      suggested_branding: {
        slogan: safeCompanyName
          ? `Quality experiences at ${safeCompanyName}`
          : "Your perfect dining experience",
        shortDescription: `A premium dining experience featuring ${webSearchData?.mentions?.join(" and ") || "excellent food and service"}.`,
        tone: "Professional & Upbeat",
      },
    };

    // 2. Save AI Analysis to DB
    const { error: updateError } = await supabaseClient
      .from("onboarding_session")
      .update({
        ai_analysis: mockAiResponse,
        suggested_departments: mockAiResponse.suggested_departments,
        suggested_teams: mockAiResponse.suggested_teams,
        suggested_zones: mockAiResponse.suggested_zones,
        suggested_branding: mockAiResponse.suggested_branding,
      })
      .eq("id", sessionId);

    if (updateError) console.error("Error saving AI analysis:", updateError);

    return new Response(JSON.stringify({ success: true, ai_analysis: mockAiResponse }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: unknown) {
    console.error("Function Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      },
    );
  }
});
