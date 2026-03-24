import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } },
    );

    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();
    if (userError || !user) throw new Error("Unauthorized");

    const { workspaceId, workspaceData } = await req.json();
    if (!workspaceId) throw new Error("Missing workspaceId");
    if (!workspaceData) throw new Error("Missing workspaceData");

    // Verify the workspace belongs to this user and is in onboarding state
    const { data: profile } = await supabaseClient
      .from("profile")
      .select("workspace_id")
      .eq("user_id", user.id)
      .eq("workspace_id", workspaceId)
      .single();

    if (!profile) throw new Error("Workspace not found or access denied");

    // Use service-role client for the RPC (SECURITY DEFINER)
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const { data, error: rpcError } = await adminClient.rpc("finalize_onboarding_workspace", {
      p_workspace_id: workspaceId,
      p_data: workspaceData,
    });

    if (rpcError) throw rpcError;

    // Link the onboarding contract to this workspace
    if (workspaceData.contractId) {
      await adminClient
        .from("contract")
        .update({
          workspace_id: data,
          updated_at: new Date().toISOString(),
        })
        .eq("contract_id", workspaceData.contractId);

      // Set workspace contract_status to pending_contract
      await adminClient
        .from("workspace")
        .update({
          contract_status: "pending_contract",
          updated_at: new Date().toISOString(),
        })
        .eq("workspace_id", data);
    }

    // Post-creation: seed cascade dimension data (D1-D4, K1a) for the workspace.
    // Workspace is created regardless, but bootstrap errors are surfaced to the caller
    // so they can prompt re-run from settings instead of silently losing cascade data.
    let bootstrapWarnings: string[] | undefined;
    let bootstrapError: string | undefined;

    try {
      const bootstrapResponse = await fetch(
        `${Deno.env.get("SUPABASE_URL")}/functions/v1/bootstrap-cascade`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          },
          body: JSON.stringify({ workspaceId: data, sourcePath: "onboarding" }),
        },
      );

      if (!bootstrapResponse.ok) {
        bootstrapError = `Bootstrap returned ${bootstrapResponse.status}: ${await bootstrapResponse.text()}`;
        console.error(bootstrapError);
      } else {
        try {
          const bootstrapResult = await bootstrapResponse.json();
          if (bootstrapResult.warnings?.length) {
            bootstrapWarnings = bootstrapResult.warnings;
          }
        } catch {
          // Response was OK but not JSON — no warnings to extract
        }
      }
    } catch (bootstrapErr) {
      bootstrapError = `Bootstrap fetch failed: ${bootstrapErr instanceof Error ? bootstrapErr.message : String(bootstrapErr)}`;
      console.error(bootstrapError);
    }

    // Fetch the workspace slug for redirect
    const { data: ws } = await adminClient
      .from("workspace")
      .select("slug")
      .eq("workspace_id", data)
      .single();

    return new Response(
      JSON.stringify({
        success: !bootstrapError,
        workspaceId: data,
        slug: ws?.slug ?? null,
        ...(bootstrapError && { error: bootstrapError }),
        ...(bootstrapWarnings && { warnings: bootstrapWarnings }),
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: bootstrapError ? 207 : 200,
      },
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    const status = message === "Unauthorized" ? 401 : 400;
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status,
    });
  }
});
