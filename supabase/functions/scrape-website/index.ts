import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { verifyInternalAuth } from "../_shared/internal-auth.ts";

async function fetchScraplingWithRetry(scraplingBase: string, url: string, retries = 3) {
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // ADR-0029 / F-EF-03: reject anonymous callers — service-role or cron bearer only.
  // Legacy browser caller (apps/web/src/app/onboarding/hooks/useOnboardingState.ts) will
  // surface 401 here until F-EF-04 migrates it to a Next.js route handler.
  const authResult = verifyInternalAuth(req);
  if (!authResult.ok) {
    console.warn("[scrape-website] auth_failure: missing or invalid bearer");
    return authResult.response;
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
