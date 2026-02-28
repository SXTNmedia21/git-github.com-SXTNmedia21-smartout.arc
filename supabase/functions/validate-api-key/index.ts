import { corsHeaders } from "../_shared/cors.ts";
import { resolveAuth } from "../_shared/auth-middleware.ts";
import { checkRateLimit } from "../_shared/rate-limit.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const auth = await resolveAuth(req);

    if (!auth) {
      return new Response(
        JSON.stringify({ valid: false, error: "Invalid or missing credentials" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Rate limit check
    const rl = await checkRateLimit(auth.rateLimitKey, auth.rateLimitPerMinute);
    if (!rl.allowed) {
      return new Response(JSON.stringify({ valid: false, error: "Rate limit exceeded" }), {
        status: 429,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "X-RateLimit-Remaining": String(rl.remaining),
          "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)),
        },
      });
    }

    return new Response(
      JSON.stringify({
        valid: true,
        method: auth.method,
        key_id: auth.keyId,
        workspace_id: auth.workspaceId,
        scopes: auth.scopes,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    return new Response(
      JSON.stringify({
        valid: false,
        error: error instanceof Error ? error.message : String(error),
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
