import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: { headers: { Authorization: req.headers.get("Authorization")! } },
      },
    );

    const payload = await req.json();
    const { sessionId, companyName, scrapedData } = payload;

    if (!sessionId || !companyName) {
      return new Response(JSON.stringify({ error: "sessionId and companyName are required." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    console.log(`Starting background intelligence for ${companyName} (${sessionId})`);

    // 1. Perform mock Web Search (Replace with real SerpAPI/Brave Search later)
    const webSearchData = {
      rating: 4.3,
      reviewCount: 127,
      classification: ["Restaurant", "Bar"],
      mentions: ["Great terrace in summer", "Award winning cocktails"],
      seasonalPatterns: ["Sommermeny", "Julebord"],
      jobListings: ["Sous Chef", "Bartender"],
    };

    // Save web search data to DB
    const { error: updateError } = await supabaseClient
      .from("onboarding_session")
      .update({ web_search_data: webSearchData })
      .eq("id", sessionId);

    if (updateError) console.error("Error saving web search data:", updateError);

    // 2. Trigger AI Analysis
    const edgeFunctionUrl = Deno.env.get("SUPABASE_URL")
      ? `${Deno.env.get("SUPABASE_URL")}/functions/v1`
      : "http://host.docker.internal:54321/functions/v1";

    await fetch(`${edgeFunctionUrl}/analyze-workspace`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: req.headers.get("Authorization")!,
      },
      body: JSON.stringify({
        sessionId,
        companyName,
        scrapedData,
        webSearchData,
      }),
    });

    return new Response(JSON.stringify({ success: true }), {
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
