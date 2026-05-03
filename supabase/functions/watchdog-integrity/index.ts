import { createClient } from "jsr:@supabase/supabase-js@2";

interface IntegrityCheck {
  name: string;
  status: "pass" | "fail" | "warn" | "error";
  count?: number;
  details?: string;
}

Deno.serve(async (req) => {
  const authHeader = req.headers.get("authorization");
  const cronSecret = Deno.env.get("WATCHDOG_CRON_SECRET");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const checks: IntegrityCheck[] = [];

    // Run all checks concurrently
    const [danglingResult, staleResult, emptyWsResult, expiredInvitesResult, cleanupResult] =
      await Promise.all([
        // 1. Company members without matching user_identity (FK prevents this normally — defensive check)
        supabase.rpc("count_dangling_company_members"),
        // 2. Stale active sessions (>24h old)
        supabase
          .from("department_session")
          .select("*", { count: "exact", head: true })
          .eq("status", "active")
          .lt("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
        // 3. Workspaces with zero profiles
        supabase.rpc("count_empty_workspaces"),
        // 4. Pending invitations past their expires_at date
        supabase
          .from("invitation")
          .select("*", { count: "exact", head: true })
          .eq("status", "pending")
          .lt("expires_at", new Date().toISOString()),
        // 5. Clean up stale invitations (marks expired)
        supabase.rpc("expire_stale_invitations"),
      ]);

    // 1. Dangling company members
    if (danglingResult.error) {
      checks.push({
        name: "dangling_company_members",
        status: "error",
        details: danglingResult.error.message,
      });
    } else {
      const count: number = danglingResult.data ?? 0;
      checks.push({ name: "dangling_company_members", status: count > 0 ? "warn" : "pass", count });
    }

    // 2. Stale sessions
    if (staleResult.error) {
      checks.push({
        name: "stale_active_sessions",
        status: "error",
        details: staleResult.error.message,
      });
    } else {
      const count = staleResult.count ?? 0;
      checks.push({ name: "stale_active_sessions", status: count > 0 ? "warn" : "pass", count });
    }

    // 3. Empty workspaces
    if (emptyWsResult.error) {
      checks.push({
        name: "empty_workspaces",
        status: "error",
        details: emptyWsResult.error.message,
      });
    } else {
      const count: number = emptyWsResult.data ?? 0;
      checks.push({ name: "empty_workspaces", status: count > 0 ? "warn" : "pass", count });
    }

    // 4. Expired invitations
    if (expiredInvitesResult.error) {
      checks.push({
        name: "expired_pending_invitations",
        status: "error",
        details: expiredInvitesResult.error.message,
      });
    } else {
      const count = expiredInvitesResult.count ?? 0;
      checks.push({
        name: "expired_pending_invitations",
        status: count > 10 ? "warn" : "pass",
        count,
      });
    }

    // 5. Expired invitations cleaned up
    if (cleanupResult.error) {
      checks.push({
        name: "invitation_cleanup",
        status: "error",
        details: cleanupResult.error.message,
      });
    } else {
      const cleaned = cleanupResult.data ?? 0;
      checks.push({
        name: "invitation_cleanup",
        status: "pass",
        count: cleaned,
        details: cleaned > 0 ? `Expired ${cleaned} stale invitations` : "No stale invitations",
      });
    }

    const hasErrors = checks.some((c) => c.status === "error");
    const hasFailures = checks.some((c) => c.status === "fail");
    const hasWarnings = checks.some((c) => c.status === "warn");

    const result = {
      status: hasErrors || hasFailures ? "unhealthy" : hasWarnings ? "degraded" : "healthy",
      timestamp: new Date().toISOString(),
      checks,
    };

    console.log(
      JSON.stringify({
        level: hasErrors || hasFailures ? "error" : hasWarnings ? "warn" : "info",
        action: "watchdog_integrity_check",
        category: "system",
        ...result,
      }),
    );

    return new Response(JSON.stringify(result), {
      status: hasErrors || hasFailures ? 503 : 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[watchdog-integrity] Unhandled error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
