import { type NextRequest, NextResponse } from "next/server";

type CheckResult = { status: "pass" | "fail"; latency_ms?: number; error?: string };

type HealthStatus = {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  version: string;
  checks: Record<string, CheckResult>;
};

const isProd = process.env.NODE_ENV === "production";

export async function GET(req: NextRequest) {
  const secret = process.env.HEALTH_CHECK_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ status: "unauthorized" }, { status: 401 });
    }
  }

  const checks: HealthStatus["checks"] = {};
  let overall: HealthStatus["status"] = "healthy";

  // DB health check via Supabase REST API (no SDK import needed)
  const dbStart = Date.now();
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) {
      checks.database = { status: "fail", latency_ms: 0, error: "Missing env vars" };
      overall = "degraded";
    } else {
      const res = await fetch(`${supabaseUrl}/rest/v1/company?select=company_id&limit=1`, {
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
        },
      });
      checks.database = {
        status: res.ok ? "pass" : "fail",
        latency_ms: Date.now() - dbStart,
        ...(!res.ok && !isProd ? { error: `HTTP ${res.status}` } : {}),
      };
      if (!res.ok) {
        overall = "degraded";
        if (isProd) console.error("[health] DB check failed:", res.status);
      }
    }
  } catch (e) {
    checks.database = {
      status: "fail",
      latency_ms: Date.now() - dbStart,
      ...(isProd ? {} : { error: String(e) }),
    };
    overall = "unhealthy";
    if (isProd) console.error("[health] DB check exception:", e);
  }

  const memUsage = process.memoryUsage();
  const heapPercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
  checks.memory = {
    status: heapPercent > 90 ? "fail" : "pass",
    latency_ms: 0,
  };
  if (heapPercent > 90) overall = "degraded";

  const response: HealthStatus = {
    status: overall,
    timestamp: new Date().toISOString(),
    version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local",
    checks,
  };

  return NextResponse.json(response, {
    status: overall === "unhealthy" ? 503 : 200,
  });
}
