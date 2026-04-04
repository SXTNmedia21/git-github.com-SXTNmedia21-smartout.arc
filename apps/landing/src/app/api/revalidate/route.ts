// ============================================
// api/revalidate/route.ts
// On-demand revalidation endpoint for the landing page cache.
// Called by platform-admin after publishing a variant change.
// Busts the unstable_cache tag 'landing' so the next request
// fetches fresh data from Supabase.
//
// Security: Requires REVALIDATION_SECRET in the request body.
// Connected to: lib/get-variant.ts (cache producer)
//               apps/web/src/app/platform-admin/landing/ (caller)
// ============================================

import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";

const RevalidateSchema = z.object({
  secret: z.string().min(1),
});

export async function POST(request: Request) {
  // Parse request body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = RevalidateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Missing or invalid secret" }, { status: 400 });
  }

  // Validate the secret against the env var
  const expectedSecret = process.env.REVALIDATION_SECRET;
  if (!expectedSecret) {
    console.error("[revalidate] REVALIDATION_SECRET is not configured");
    return NextResponse.json({ error: "Revalidation not configured" }, { status: 500 });
  }

  if (parsed.data.secret !== expectedSecret) {
    return NextResponse.json({ error: "Invalid secret" }, { status: 401 });
  }

  // Bust the cache — invalidates all unstable_cache entries tagged 'landing'.
  revalidateTag("landing");

  return NextResponse.json({ revalidated: true });
}
