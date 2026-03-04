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
    const { url } = payload;

    if (!url) {
      return new Response(JSON.stringify({ error: "URL is required." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    // 3. Call the Python Scrapling Microservice raw scrape endpoint
    // Base URL for scrapling service — no trailing slash, no path
    // Docker: http://scrapling:8000 | Local: http://host.docker.internal:8000
    const scraplingBase =
      Deno.env.get("SCRAPLING_SERVICE_URL") || "http://host.docker.internal:8000";

    console.log(`Calling Scrapling Microservice Raw Scrape at: ${scraplingBase}/scrape-raw`);

    const extractionResponse = await fetch(`${scraplingBase}/scrape-raw`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url }),
    });

    if (!extractionResponse.ok) {
      console.error("Scrapling service error:", await extractionResponse.text());
      throw new Error(`Scrapling service returned status: ${extractionResponse.status}`);
    }

    const extractionData = await extractionResponse.json();

    // 4. Return the fully raw structured data to the client UI
    return new Response(JSON.stringify({ success: true, data: extractionData }), {
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
