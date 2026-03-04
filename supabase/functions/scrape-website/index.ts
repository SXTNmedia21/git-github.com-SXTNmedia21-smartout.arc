import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

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
      console.warn(`[scrape-website] Attempt ${i + 1} failed: ${res.status}`);
    } catch (e: unknown) {
      console.warn(
        `[scrape-website] Attempt ${i + 1} threw:`,
        e instanceof Error ? e.message : String(e),
      );
    }
    if (i < retries - 1) {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  throw new Error(`Scrapling service unavailable after ${retries} attempts.`);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();

    if (!url || typeof url !== "string") {
      return new Response(JSON.stringify({ error: "url is required" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    console.log(`[scrape-website] Scraping: ${url}`);

    const scraplingBase =
      Deno.env.get("SCRAPLING_SERVICE_URL") || "http://host.docker.internal:8000";

    const scrapedData = await fetchScraplingWithRetry(scraplingBase, url);

    console.log(`[scrape-website] Done. Company: ${scrapedData?.companyName || "unknown"}`);

    return new Response(JSON.stringify({ scrapedData }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: unknown) {
    console.error("[scrape-website] Error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : String(error),
        scrapedData: null,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  }
});
