// ============================================
// api/generate-content/route.ts
// AI content generation for signup flow — proxies to Scrapling service
// which calls OpenRouter to generate Norwegian bokmål company descriptions.
//
// Connected to: services/scrapling/main.py (/generate-content endpoint)
// ============================================

import { env } from "@/env";
import { NextResponse } from "next/server";
import { z } from "zod";

const SCRAPLING_URL = env.SCRAPLING_SERVICE_URL ?? "https://scrape.smartout.ai";

const RequestSchema = z.object({
  companyName: z.string().min(1),
  scrapedData: z.record(z.unknown()).nullable(),
});

/**
 * POST /api/generate-content
 *
 * Proxies AI content generation to Scrapling service.
 */
export async function POST(request: Request) {
  let body: z.infer<typeof RequestSchema>;
  try {
    const raw: unknown = await request.json();
    body = RequestSchema.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (env.SCRAPLING_AUTH_TOKEN) {
    headers["Authorization"] = `Bearer ${env.SCRAPLING_AUTH_TOKEN}`;
  }

  try {
    const response = await fetch(`${SCRAPLING_URL}/generate-content`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        company_name: body.companyName,
        scraped_data: body.scrapedData,
      }),
      signal: AbortSignal.timeout(35_000),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      console.error("[generate-content] Scrapling error:", response.status, errorText);
      return NextResponse.json({ error: "AI generation failed" }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[generate-content] error:", message);
    return NextResponse.json({ error: "AI generation failed" }, { status: 500 });
  }
}
