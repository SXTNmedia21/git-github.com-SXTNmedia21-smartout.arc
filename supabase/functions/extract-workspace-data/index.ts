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

    // 1. Authorize User
    const {
      data: { user },
    } = await supabaseClient.auth.getUser();

    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    // 2. Parse Request
    const payload = await req.json();
    const { url, config } = payload;

    if (!url) {
      return new Response(JSON.stringify({ error: "URL is required." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    // 3. Call the Python Scrapling Microservice
    // For local development, using host.docker.internal to reach localhost:8000
    // In production, this would be an environment variable for the microservice URL
    const scraplingUrl =
      Deno.env.get("SCRAPLING_SERVICE_URL") || "http://host.docker.internal:8000/extract";

    console.log(`Calling Scrapling Microservice at: ${scraplingUrl}`);

    const extractionResponse = await fetch(scraplingUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url, config }),
    });

    if (!extractionResponse.ok) {
      console.error("Scrapling service error:", await extractionResponse.text());
      throw new Error(`Scrapling service returned status: ${extractionResponse.status}`);
    }

    const extractionData = await extractionResponse.json();

    // 4. Save to Database via Transaction
    const generatedPolicies = [
      {
        title: "Standard Opening Routine",
        summary: "Daily unlock and setup checklist adjusted for your locations.",
      },
      {
        title: "Health & Safety (HACCP) Base",
        summary:
          "Required temperature checks and hygiene routines applicable to all food-handling departments.",
      },
    ];

    const { data: workspaceId, error: txError } = await supabaseClient.rpc(
      "create_workspace_transaction",
      {
        p_user_id: user.id,
        p_company_name: extractionData.companyName || "Unknown Company",
        p_locations: extractionData.locations || [],
        p_departments: extractionData.departments || [],
        p_policies: generatedPolicies,
        p_raw_scraped_data: extractionData,
      },
    );

    if (txError) {
      console.error("Failed to create workspace:", txError);
      throw new Error("Failed to create workspace during extraction");
    }

    // 5. Return the structured data to the client UI
    return new Response(
      JSON.stringify({
        success: true,
        workspaceId,
        data: extractionData,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      },
    );
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
