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
    // This is NOT an onboarding dependency — it runs after workspace is fully created.
    // If it fails, the workspace is still functional; bootstrap can be re-run from settings.
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
        console.error("Bootstrap cascade returned non-OK:", await bootstrapResponse.text());
      }
    } catch (bootstrapErr) {
      console.error("Bootstrap cascade failed (non-fatal):", bootstrapErr);
    }

    // Fetch the workspace slug for redirect
    const { data: ws } = await adminClient
      .from("workspace")
      .select("slug")
      .eq("workspace_id", data)
      .single();

    return new Response(
      JSON.stringify({
        success: true,
        workspaceId: data,
        slug: ws?.slug ?? null,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
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
