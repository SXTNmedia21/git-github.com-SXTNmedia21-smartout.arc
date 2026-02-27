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
      }
    );

    const {
      data: { user },
    } = await supabaseClient.auth.getUser();

    // Allow anonymous execution for pre-signup onboarding scan
    const userId = user?.id || null;

    const payload = await req.json();
    const { url, orgNumber } = payload;

    if (!url) {
      return new Response(JSON.stringify({ error: "URL is required." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    console.log(`Gathering intelligence for URL: ${url}`);

    // SOURCE 1: Scrape (using existing Python microservice)
    const scraplingUrl = Deno.env.get("SCRAPLING_SERVICE_URL") || "http://host.docker.internal:8000/extract";
    
    const fetchScraplingWithRetry = async (retries = 3) => {
      for (let i = 0; i < retries; i++) {
        try {
          const res = await fetch(scraplingUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url, config: { include_company_info: true, include_locations: true, include_departments: true } }),
          });
          if (res.ok) {
            return await res.json();
          }
          console.warn(`Scrapling attempt ${i + 1} failed: ${res.status}`);
        } catch (e: any) {
          console.warn(`Scrapling attempt ${i + 1} threw error:`, e.message || e);
        }
        // Small delay before retrying
        if (i < retries - 1) await new Promise(resolve => setTimeout(resolve, 1000));
      }
      const alertMsg = "CRITICAL ERROR ALERT: User onboarding critical function (Scrapling service) failed after 3 attempts.";
      console.error(alertMsg);
      // In a real scenario, this would send an email/Slack notification or a Sentry alert.
      throw new Error(`Scrapling service unavailable after ${retries} attempts.`);
    };

    const scrapedDataPromise = fetchScraplingWithRetry();

    // SOURCE 2: Brreg (Optional, but try to fetch if org number is provided, otherwise search by name after scraping)
    // For simplicity in Phase 2 MVP, we will fetch Brreg if orgNumber is passed. If not, the UI handles it in Step 2.
    let brregDataPromise = Promise.resolve(null);
    if (orgNumber) {
        brregDataPromise = fetch(`https://data.brreg.no/enhetsregisteret/api/enheter/${orgNumber}`)
            .then(res => res.ok ? res.json() : null)
            .catch(() => null);
    }
    
    // SOURCE 3 & 4 (Web Search & AI Analysis) will be triggered via separate endpoints or in the background
    // to prevent timeout and allow UI to show Step 2 quickly, as per architectural spec.

    const [scrapedData, brregData] = await Promise.all([
      scrapedDataPromise,
      brregDataPromise
    ]);

    // Create onboarding_session record
    const { data: sessionData, error: sessionError } = await supabaseClient
      .from('onboarding_session')
      .insert({
        user_id: userId,
        source_url: url,
        current_step: 1, // Moving from Step 0 to Step 1 (Intelligence Gathering)
        scraped_data: scrapedData,
        brreg_data: brregData
      })
      .select()
      .single();

    if (sessionError) {
        console.error("Failed to create onboarding session:", sessionError);
        // Continue anyway; we still have the data
    }

    // Trigger background analysis if we have a company name
    const companyName = brregData?.navn || scrapedData?.companyName;
    const city = brregData?.forretningsadresse?.poststed || 'Oslo'; // Try to extract city

    if (companyName && sessionData) {
         // Fire and forget background task to do web search and AI analysis
         const edgeFunctionUrl = Deno.env.get('SUPABASE_URL') ? 
            `${Deno.env.get('SUPABASE_URL')}/functions/v1` : 
            'http://host.docker.internal:54321/functions/v1';
            
         fetch(`${edgeFunctionUrl}/web-search-intelligence`, {
             method: 'POST',
             headers: {
                 'Content-Type': 'application/json',
                 'Authorization': req.headers.get("Authorization")!
             },
             body: JSON.stringify({
                 sessionId: sessionData.id,
                 companyName,
                 city,
                 scrapedData
             })
         }).catch(e => console.error("Failed to trigger background analysis", e));
    }

    return new Response(JSON.stringify({ 
      success: true, 
      sessionId: sessionData?.id,
      scrapedData,
      brregData
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
    
  } catch (error: any) {
    console.error("Function Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
