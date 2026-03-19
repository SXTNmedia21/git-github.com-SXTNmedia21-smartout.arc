/**
 * POST /api/workspace-intelligence
 *
 * Orchestrator for the enrich + generate pipeline.
 * Proxies to Scrapling's /enrich and /generate endpoints.
 *
 * Actions:
 *   "enrich"              — enrich intelligence only
 *   "generate"            — generate copy from existing intelligence
 *   "enrich_and_generate" — enrich then generate (most common)
 */

import { env } from "@/env";
import { NextResponse } from "next/server";
import { z } from "zod";

const SCRAPLING_URL = env.SCRAPLING_SERVICE_URL ?? "https://scrape.smartout.ai";

const RequestSchema = z.object({
  action: z.enum(["enrich", "generate", "enrich_and_generate"]),
  intelligence: z.record(z.unknown()).nullable(),
  company_name: z.string().min(1).optional(),
  city: z.string().optional(),
  website_url: z.string().optional(),
  org_number: z.string().optional(),
  force_new_queries: z.boolean().optional(),
});

function scraplingHeaders(): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (env.SCRAPLING_AUTH_TOKEN) {
    headers["Authorization"] = `Bearer ${env.SCRAPLING_AUTH_TOKEN}`;
  }
  return headers;
}

export async function POST(request: Request) {
  let body: z.infer<typeof RequestSchema>;
  try {
    const raw: unknown = await request.json();
    body = RequestSchema.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (body.action !== "generate" && !body.company_name) {
    return NextResponse.json({ error: "company_name required for enrich" }, { status: 400 });
  }

  let intelligence = body.intelligence;
  let sourcesAdded: string[] = [];
  let gaps: string[] = [];

  // Step 1: Enrich
  if (body.action === "enrich" || body.action === "enrich_and_generate") {
    try {
      const enrichRes = await fetch(`${SCRAPLING_URL}/enrich`, {
        method: "POST",
        headers: scraplingHeaders(),
        body: JSON.stringify({
          intelligence,
          company_name: body.company_name,
          city: body.city,
          website_url: body.website_url,
          org_number: body.org_number,
          force_new_queries: body.force_new_queries ?? false,
        }),
        signal: AbortSignal.timeout(45_000),
      });

      if (!enrichRes.ok) {
        const errorText = await enrichRes.text().catch(() => "Unknown error");
        console.error("[workspace-intelligence] Enrich failed:", enrichRes.status, errorText);
        return NextResponse.json({ error: "Enrichment failed" }, { status: enrichRes.status });
      }

      const enrichData = await enrichRes.json();
      intelligence = enrichData.intelligence;
      sourcesAdded = enrichData.sources_added;
      gaps = enrichData.gaps_remaining;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error("[workspace-intelligence] Enrich error:", message);
      return NextResponse.json({ error: "Enrichment failed" }, { status: 500 });
    }
  }

  // Step 2: Generate
  let content = null;
  if (body.action === "generate" || body.action === "enrich_and_generate") {
    if (!intelligence) {
      return NextResponse.json({ error: "No intelligence data for generation" }, { status: 400 });
    }

    try {
      const genRes = await fetch(`${SCRAPLING_URL}/generate`, {
        method: "POST",
        headers: scraplingHeaders(),
        body: JSON.stringify({ intelligence }),
        signal: AbortSignal.timeout(35_000),
      });

      if (!genRes.ok) {
        const errorText = await genRes.text().catch(() => "Unknown error");
        console.error("[workspace-intelligence] Generate failed:", genRes.status, errorText);
        return NextResponse.json(
          {
            intelligence,
            content: null,
            sources_added: sourcesAdded,
            gaps_remaining: gaps,
            error: "Content generation failed",
          },
          { status: 200 },
        );
      }

      content = await genRes.json();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error("[workspace-intelligence] Generate error:", message);
      return NextResponse.json(
        {
          intelligence,
          content: null,
          sources_added: sourcesAdded,
          gaps_remaining: gaps,
          error: "Content generation failed",
        },
        { status: 200 },
      );
    }
  }

  return NextResponse.json({
    intelligence,
    content,
    sources_added: sourcesAdded,
    gaps_remaining: gaps,
  });
}
