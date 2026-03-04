import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { searchBrregByNameAll } from "../_shared/brreg.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { name, city } = await req.json();

    if (!name || typeof name !== "string") {
      return new Response(JSON.stringify({ error: "name is required" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    console.log(`[search-brreg] Searching for "${name}"${city ? ` in ${city}` : ""}`);

    const matches = await searchBrregByNameAll(name, city || null);

    // Filter to score >= 30, take top 5
    const candidates = matches
      .filter((m) => m.score >= 30)
      .slice(0, 5)
      .map((m) => ({
        orgNumber: m.entity.organisasjonsnummer,
        name: m.entity.navn,
        city: m.entity.forretningsadresse?.poststed || "",
        industry: m.entity.naeringskode1?.beskrivelse || "",
        industryCode: m.entity.naeringskode1?.kode || "",
        employeeCount: m.entity.antallAnsatte ?? null,
        score: m.score,
        address: m.entity.forretningsadresse?.adresse?.[0] || "",
        highConfidence: m.score >= 80,
      }));

    console.log(`[search-brreg] Found ${candidates.length} candidates (${matches.length} raw)`);

    return new Response(JSON.stringify({ candidates, matchCount: candidates.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: unknown) {
    console.error("[search-brreg] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 },
    );
  }
});
