import { env } from "@/env";
import { NextResponse } from "next/server";
import { z } from "zod";

const PostBodySchema = z.object({
  url: z.string().min(1),
  naceCode: z.string().optional(),
});

function normalizeUrl(raw: string): string {
  let url = raw.trim();
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    url = `https://${url}`;
  }
  return url;
}

/**
 * POST /api/scrape/public
 *
 * Public scrape proxy — no auth required.
 * Calls Scrapling and returns the result directly.
 */
export async function POST(request: Request) {
  let body: z.infer<typeof PostBodySchema>;
  try {
    const raw: unknown = await request.json();
    body = PostBodySchema.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const scraplingUrl = env.SCRAPLING_SERVICE_URL;
  if (!scraplingUrl) {
    return NextResponse.json({ error: "Scrapling service not configured" }, { status: 503 });
  }

  const normalizedUrl = normalizeUrl(body.url);

  // SSRF protection
  try {
    const parsed = new URL(normalizedUrl);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return NextResponse.json({ error: "Invalid URL scheme" }, { status: 400 });
    }
    const hostname = parsed.hostname.toLowerCase();
    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "0.0.0.0" ||
      hostname.startsWith("10.") ||
      hostname.startsWith("172.") ||
      hostname.startsWith("192.168.") ||
      hostname === "169.254.169.254" ||
      hostname.endsWith(".internal") ||
      hostname.endsWith(".local")
    ) {
      return NextResponse.json({ error: "Private URLs not allowed" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);

    const upstream = await fetch(`${scraplingUrl}/extract`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: normalizedUrl,
        config: {
          include_company_info: true,
          include_locations: true,
          include_departments: true,
          nace_code: body.naceCode ?? "56.101",
        },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!upstream.ok) {
      return NextResponse.json({ status: "failed" }, { status: 200 });
    }

    const result: unknown = await upstream.json();
    return NextResponse.json({ status: "success", data: result }, { status: 200 });
  } catch {
    return NextResponse.json({ status: "failed" }, { status: 200 });
  }
}
