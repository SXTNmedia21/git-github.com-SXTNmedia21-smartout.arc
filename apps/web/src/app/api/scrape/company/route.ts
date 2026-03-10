// ============================================
// api/scrape/company/route.ts
// Scraping proxy for signup flow — triggers company data extraction
// via the Scrapling microservice and persists results to company_scraped_data.
//
// Connected to: services/scrapling/main.py (/extract endpoint)
// Connected to: supabase/migrations/20260310140000_signup_tables.sql
// Connected to: apps/web/src/env.ts (SCRAPLING_SERVICE_URL)
// ============================================

import { env } from "@/env";
import { createClient } from "@smartout/supabase/server";
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
 * POST /api/scrape/company
 *
 * Triggers a scrape of the given URL via the Scrapling service,
 * upserts a company_scraped_data row, and returns the result.
 */
export async function POST(request: Request) {
  const supabase = await createClient();

  // 1. Auth check
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Parse and validate body
  let body: z.infer<typeof PostBodySchema>;
  try {
    const raw: unknown = await request.json();
    body = PostBodySchema.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const scraplingUrl = env.SCRAPLING_SERVICE_URL;
  if (!scraplingUrl) {
    return NextResponse.json(
      { error: "Scrapling service not configured (SCRAPLING_SERVICE_URL missing)" },
      { status: 503 },
    );
  }

  const normalizedUrl = normalizeUrl(body.url);

  // 3. Upsert row with status 'scraping'
  const { data: upsertData, error: upsertError } = await supabase
    .from("company_scraped_data")
    .upsert(
      {
        auth_id: user.id,
        source_url: normalizedUrl,
        scrape_status: "scraping",
        parsed_data: null,
        raw_data: null,
        scraped_at: null,
      },
      { onConflict: "auth_id" },
    )
    .select("id")
    .single();

  if (upsertError) {
    console.error("[scrape/company] upsert error:", upsertError);
    return NextResponse.json({ error: "Failed to create scrape record" }, { status: 500 });
  }

  const rowId = upsertData.id;

  // 4. Call scrapling /extract with 30s timeout
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
      const errorText = await upstream.text().catch(() => "Unknown upstream error");
      // 6. On failure: update row with error, status 'failed'
      await supabase
        .from("company_scraped_data")
        .update({
          scrape_status: "failed",
          raw_data: { error: errorText, status: upstream.status },
        })
        .eq("id", rowId);

      return NextResponse.json({ status: "failed", id: rowId }, { status: 200 });
    }

    const result: unknown = await upstream.json();

    // 5. On success: update row with parsed_data, status 'success'
    await supabase
      .from("company_scraped_data")
      .update({
        scrape_status: "success",
        parsed_data: result as Record<string, unknown>,
        raw_data: result as Record<string, unknown>,
        scraped_at: new Date().toISOString(),
      })
      .eq("id", rowId);

    return NextResponse.json({ status: "success", id: rowId }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";

    // 6. On failure: update row with error, status 'failed'
    await supabase
      .from("company_scraped_data")
      .update({
        scrape_status: "failed",
        raw_data: { error: message },
      })
      .eq("id", rowId);

    return NextResponse.json({ status: "failed", id: rowId }, { status: 200 });
  }
}

/**
 * GET /api/scrape/company
 *
 * Returns the latest company_scraped_data row for the authenticated user.
 */
export async function GET() {
  const supabase = await createClient();

  // 1. Auth check
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Select latest row for this auth_id
  const { data, error } = await supabase
    .from("company_scraped_data")
    .select("id, scrape_status, parsed_data, scraped_at")
    .eq("auth_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[scrape/company] select error:", error);
    return NextResponse.json({ error: "Failed to fetch scrape data" }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ id: null, scrape_status: null, parsed_data: null, scraped_at: null });
  }

  return NextResponse.json({
    id: data.id,
    scrape_status: data.scrape_status,
    parsed_data: data.parsed_data,
    scraped_at: data.scraped_at,
  });
}
