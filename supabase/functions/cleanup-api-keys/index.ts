import { createClient } from "jsr:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  const authHeader = req.headers.get("authorization");
  const cronSecret = Deno.env.get("WATCHDOG_CRON_SECRET");
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data, error } = await supabase.rpc("cleanup_expired_api_keys");

  return new Response(
    JSON.stringify({
      status: error ? "error" : "ok",
      revoked_count: data ?? 0,
      timestamp: new Date().toISOString(),
      error: error?.message,
    }),
    { headers: { "Content-Type": "application/json" } },
  );
});
