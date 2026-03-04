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

    // Get the user from the auth token
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();
    if (userError || !user) throw new Error("Unauthorized");

    const { workspaceData } = await req.json();
    if (!workspaceData) throw new Error("Missing workspaceData");

    // Call the RPC that handles all the inserts atomically
    const { data, error: rpcError } = await supabaseClient.rpc("activate_workspace_v3", {
      p_user_id: user.id,
      p_data: workspaceData,
    });

    if (rpcError) throw rpcError;

    // Create default agent profile (Mr. Botsson) for the new workspace.
    // Uses service-role to bypass RLS since the workspace was just created
    // and role-based policies may not resolve yet.
    // All column defaults apply (name, voice, personality sliders).
    try {
      const adminClient = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      );
      await adminClient
        .from("agent_profile")
        .upsert({ workspace_id: data }, { onConflict: "workspace_id", ignoreDuplicates: true });
    } catch (_agentProfileError) {
      // Non-fatal: workspace activation succeeded even if agent profile creation fails.
      // The profile can be created later via the settings UI.
      console.error("Failed to create default agent profile:", _agentProfileError);
    }

    return new Response(JSON.stringify({ success: true, workspaceId: data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
