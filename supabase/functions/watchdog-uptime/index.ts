interface ServiceCheck {
  service: string;
  url: string;
  status: "up" | "down" | "degraded";
  latency_ms: number;
  statusCode?: number;
  error?: string;
}

const SERVICES = [
  { service: "web", url: Deno.env.get("WEB_URL") ?? "https://app.smartout.ai" },
  { service: "landing", url: Deno.env.get("LANDING_URL") ?? "https://smartout.ai" },
];

async function checkService(service: string, baseUrl: string): Promise<ServiceCheck> {
  const url = `${baseUrl}/api/health`;
  const start = Date.now();

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    const latency = Date.now() - start;
    const body = await res.json().catch(() => null);

    return {
      service,
      url,
      status: res.ok ? (body?.status === "degraded" ? "degraded" : "up") : "down",
      latency_ms: latency,
      statusCode: res.status,
    };
  } catch (e) {
    return {
      service,
      url,
      status: "down",
      latency_ms: Date.now() - start,
      error: String(e),
    };
  }
}

Deno.serve(async (req) => {
  const authHeader = req.headers.get("authorization");
  const cronSecret = Deno.env.get("WATCHDOG_CRON_SECRET");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const checks = await Promise.all(SERVICES.map((s) => checkService(s.service, s.url)));

  const anyDown = checks.some((c) => c.status === "down");
  const anyDegraded = checks.some((c) => c.status === "degraded");

  const result = {
    status: anyDown ? "outage" : anyDegraded ? "degraded" : "operational",
    timestamp: new Date().toISOString(),
    checks,
  };

  console.log(
    JSON.stringify({
      level: anyDown ? "error" : anyDegraded ? "warn" : "info",
      action: "watchdog_uptime_check",
      category: "system",
      ...result,
    }),
  );

  return new Response(JSON.stringify(result), {
    status: anyDown ? 503 : 200,
    headers: { "Content-Type": "application/json" },
  });
});
