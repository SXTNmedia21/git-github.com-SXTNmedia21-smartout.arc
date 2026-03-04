import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
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
