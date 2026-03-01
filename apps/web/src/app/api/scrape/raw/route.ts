// ============================================
// api/scrape/raw/route.ts
// Proxy route for the Scrapling microservice's /scrape-raw endpoint.
// Keeps the microservice URL server-side — the browser never knows
// where scrapling actually lives (local, Docker, or production).
//
// Connected to: services/scrapling/main.py (/scrape-raw endpoint)
// Connected to: apps/web/src/app/scrape/page.tsx (client caller)
// Connected to: apps/web/src/env.ts (SCRAPLING_SERVICE_URL)
// ============================================

import { env } from "@/env";
import { type NextRequest, NextResponse } from "next/server";

/**
 * POST /api/scrape/raw
 *
 * Forwards the request body to the Scrapling service and returns the raw
 * extraction result. Used by the diagnostics scraper test page.
 *
 * Requires: SCRAPLING_SERVICE_URL in environment variables.
 */
export async function POST(request: NextRequest) {
  const scraplingUrl = env.SCRAPLING_SERVICE_URL;

  if (!scraplingUrl) {
    return NextResponse.json(
      { error: "Scrapling service not configured (SCRAPLING_SERVICE_URL missing)" },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Forward the request to the Scrapling microservice
  const upstream = await fetch(`${scraplingUrl}/scrape-raw`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data: unknown = await upstream.json();

  return NextResponse.json(data, { status: upstream.status });
}
