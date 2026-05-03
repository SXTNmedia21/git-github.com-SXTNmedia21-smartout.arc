/**
 * Internal auth — shared bearer check for Edge Functions invoked by trusted
 * server-side callers (cron, engine-dispatch, web BFF via service role).
 *
 * Accepts:
 *   - Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}  (supabase.functions.invoke from server)
 *   - Authorization: Bearer ${WATCHDOG_CRON_SECRET}        (pg_cron / external schedulers)
 *
 * Fail-closed: if neither secret is configured, all calls rejected.
 *
 * Use at the top of Deno.serve() for any function with `verify_jwt = false`
 * that is NOT a public webhook (those use signature verification instead).
 */

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export type InternalAuthOk = { ok: true };
export type InternalAuthFail = { ok: false; response: Response };

/**
 * Verify the request carries either the service role key or the cron secret
 * as a Bearer token. Returns either { ok: true } or { ok: false, response }
 * where response is a ready-to-return 401/500.
 */
export function verifyInternalAuth(req: Request): InternalAuthOk | InternalAuthFail {
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const cronSecret = Deno.env.get("WATCHDOG_CRON_SECRET") ?? "";

  if (!serviceRoleKey && !cronSecret) {
    return {
      ok: false,
      response: new Response(
        JSON.stringify({ error: "internal auth not configured" }),
        { status: 500, headers: { ...corsHeaders, "content-type": "application/json" } },
      ),
    };
  }

  const auth = req.headers.get("authorization") ?? "";
  const matchesServiceRole = serviceRoleKey && auth === `Bearer ${serviceRoleKey}`;
  const matchesCron = cronSecret && auth === `Bearer ${cronSecret}`;

  if (!matchesServiceRole && !matchesCron) {
    return {
      ok: false,
      response: new Response(
        JSON.stringify({ error: "unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "content-type": "application/json" } },
      ),
    };
  }

  return { ok: true };
}
