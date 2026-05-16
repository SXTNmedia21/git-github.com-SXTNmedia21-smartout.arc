import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { verifyInternalAuth } from "../_shared/internal-auth.ts";
import { fetchBrregDetails, fetchDagligLeder } from "../_shared/brreg.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // ADR-0029 / F-EF-05: reject anonymous callers — service-role or cron bearer only.
  // Matches the F-EF-03 pattern shipped 2026-05-13 for the other 5 intelligence EFs.
  const authResult = verifyInternalAuth(req);
  if (!authResult.ok) {
    console.warn("[identify-company] auth_failure: missing or invalid bearer");
    return authResult.response;
  }

  try {
    const { orgNumber, companyName, city } = await req.json();

    if (!orgNumber || typeof orgNumber !== "string") {
      return new Response(JSON.stringify({ error: "orgNumber is required" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    const cleanOrg = orgNumber.replace(/\s+/g, "");
    console.log(`[identify-company] Identifying org ${cleanOrg}`);

    // Phase 1: Brreg details + daglig leder (parallel)
    const [entity, dagligLeder] = await Promise.all([
      fetchBrregDetails(cleanOrg),
      fetchDagligLeder(cleanOrg),
    ]);

    if (!entity) {
      return new Response(
        JSON.stringify({ error: `No Brreg entity found for org number ${cleanOrg}` }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 },
      );
    }

    const resolvedName = companyName || entity.navn;
    const resolvedCity = entity.forretningsadresse?.poststed || city || "";

    // Phase 2: Google Places enrichment + workspace provisioning (parallel)
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization") ?? "" },
        },
      },
    );

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // Auth check — workspace provisioning only if authenticated
    const {
      data: { user },
    } = await supabaseClient.auth.getUser();

    // Google Places call (service-to-service)
    const placesPromise = (async () => {
      try {
        const edgeFunctionUrl = Deno.env.get("SUPABASE_URL")
          ? `${Deno.env.get("SUPABASE_URL")}/functions/v1`
          : "http://host.docker.internal:54321/functions/v1";

        const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

        const res = await fetch(`${edgeFunctionUrl}/google-places-intelligence`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({ companyName: resolvedName, city: resolvedCity }),
        });

        if (!res.ok) return null;
        const json = await res.json();
        return json?.data || null;
      } catch (e) {
        console.warn("[identify-company] Google Places failed:", e);
        return null;
      }
    })();

    // Workspace provisioning (only if authenticated)
    const provisionPromise = user
      ? (async () => {
          try {
            const { data: wsId, error } = await adminClient.rpc("provision_onboarding_workspace", {
              p_user_id: user.id,
              p_company_name: resolvedName,
              p_intelligence_data: {
                source_url: `brreg:${cleanOrg}`,
                pipeline_started_at: new Date().toISOString(),
              },
            });

            if (error) {
              console.error("[identify-company] Provisioning failed:", error);
              return null;
            }
            return wsId;
          } catch (e) {
            console.error("[identify-company] Provisioning error:", e);
            return null;
          }
        })()
      : Promise.resolve(null);

    const [placesData, workspaceId] = await Promise.all([placesPromise, provisionPromise]);

    // Build structured company response
    const company = {
      orgNumber: entity.organisasjonsnummer,
      legalName: entity.navn,
      website: entity.hjemmeside || null,
      address: entity.forretningsadresse?.adresse?.[0] || "",
      postalCode: entity.forretningsadresse?.postnummer || "",
      city: entity.forretningsadresse?.poststed || "",
      industry: entity.naeringskode1?.beskrivelse || "",
      industryCode: entity.naeringskode1?.kode || "",
      employeeCount: entity.antallAnsatte ?? null,
      dagligLeder,
      vatRegistered: entity.registrertIMvaregisteret ?? false,
      foundingDate: entity.stiftelsesdato || null,
    };

    console.log(
      `[identify-company] Done: ${company.legalName}, ws=${workspaceId || "none"}, places=${placesData ? "yes" : "no"}`,
    );

    return new Response(JSON.stringify({ company, places: placesData, workspaceId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: unknown) {
    console.error("[identify-company] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 },
    );
  }
});
