import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
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
    // Base URL for scrapling service — no trailing slash, no path
    // Docker: http://scrapling:8000 | Local: http://host.docker.internal:8000
    const scraplingBase =
      Deno.env.get("SCRAPLING_SERVICE_URL") || "http://host.docker.internal:8000";

    console.log(`Calling Scrapling Microservice at: ${scraplingBase}/extract`);

    const scraplingHeaders: Record<string, string> = { "Content-Type": "application/json" };
    const scraplingToken = Deno.env.get("SCRAPLING_AUTH_TOKEN");
    if (scraplingToken) scraplingHeaders["Authorization"] = `Bearer ${scraplingToken}`;

    const extractionResponse = await fetch(`${scraplingBase}/extract`, {
      method: "POST",
      headers: scraplingHeaders,
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
