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

  try {
    const checks: Record<string, unknown> = {};

    const { error } = await supabase.from("company").select("company_id").limit(1);
    checks.database = { status: error ? "fail" : "pass" };

    checks.runtime = { status: "pass", deno_version: Deno.version.deno };

    return new Response(
      JSON.stringify({
        status: error ? "degraded" : "healthy",
        timestamp: new Date().toISOString(),
        checks,
      }),
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[health-check] Unhandled error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
