import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { verifyInternalAuth } from "../_shared/internal-auth.ts";
import { searchBrregByNameAll } from "../_shared/brreg.ts";

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  // ADR-0029 / F-EF-03: reject anonymous callers — service-role or cron bearer only.
  // Legacy browser caller (apps/web/src/app/onboarding/hooks/useOnboardingState.ts) will
  // surface 401 here until F-EF-04 migrates it to a Next.js route handler.
  const authResult = verifyInternalAuth(req);
  if (!authResult.ok) {
    console.warn("[search-brreg] auth_failure: missing or invalid bearer");
    return authResult.response;
  }

  try {
    const { name, city } = await req.json();

    if (!name || typeof name !== "string") {
      return new Response(JSON.stringify({ error: "name is required" }), {
        headers: { ...cors, "Content-Type": "application/json" },
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
      headers: { ...cors, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: unknown) {
    console.error("[search-brreg] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { headers: { ...cors, "Content-Type": "application/json" }, status: 400 },
    );
  }
});
