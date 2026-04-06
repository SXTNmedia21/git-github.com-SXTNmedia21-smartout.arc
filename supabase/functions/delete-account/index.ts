/**
 * delete-account — Permanently deletes the authenticated user's account.
 *
 * Flow:
 * 1. Verify JWT (user must be logged in)
 * 2. Delete user data from workspace tables (profile, assignments, etc.)
 * 3. Delete auth user via admin API (cascades user_identity via trigger)
 *
 * POST only. No body required — uses the JWT to identify the user.
 * Returns 200 on success, 401 if not authenticated.
 */
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Authenticate via JWT
  const authHeader = req.headers.get("authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Missing authorization header" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // User client — to verify who's calling
  const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });

  const {
    data: { user },
    error: authError,
  } = await userClient.auth.getUser();
  if (authError || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const userId = user.id;

  // Admin client — for deleting user data and auth record
  const adminClient = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Step 1: Clean up user's workspace data.
    // profile rows are the main FK target — most cascade automatically.
    // We delete profile explicitly so RLS-protected data cascades.
    const { error: profileError } = await adminClient
      .from("profile")
      .delete()
      .eq("user_id", userId);

    if (profileError) {
      console.error("Failed to delete profile rows:", profileError.message);
      // Continue — auth deletion is more important than orphaned rows
    }

    // Step 2: Delete company_member entries
    const { error: memberError } = await adminClient
      .from("company_member")
      .delete()
      .eq("user_id", userId);

    if (memberError) {
      console.error("Failed to delete company_member rows:", memberError.message);
    }

    // Step 3: Delete the auth user (cascades user_identity via handle_new_user trigger)
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId);

    if (deleteError) {
      console.error("Failed to delete auth user:", deleteError.message);
      return new Response(
        JSON.stringify({ error: "Failed to delete account. Please contact support." }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    return new Response(JSON.stringify({ success: true, message: "Account deleted" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Unexpected error in delete-account:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
