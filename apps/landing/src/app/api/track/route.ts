// ============================================
// track/route.ts
// Public endpoint for logging anonymous landing page events.
// Called by the useTracking hook (page views, CTA clicks)
// and the wizard/start route (voice session started).
//
// No auth required — this is a public, write-only endpoint.
// All data is anonymized (no PII beyond IP address).
// Server-side only — the admin client is never exposed to the browser.
//
// Connected to: apps/landing/src/hooks/useTracking.ts (client calls)
//               apps/landing/src/app/api/wizard/start/route.ts (server call)
//               apps/web/src/app/platform-admin/landing/ (reads in platform admin)
// ============================================

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@smartout/supabase/admin";
import type { Json } from "@smartout/supabase";

/**
 * Validates the request body for a landing event.
 * All fields except event_type are optional.
 */
const TrackEventSchema = z.object({
  event_type: z.enum(["page_view", "voice_session_started", "cta_click"]),
  variant: z.string().optional(),
  session_id: z.string().optional(),
  referrer: z.string().optional(),
  details: z.record(z.unknown()).optional(),
});

/**
 * Extracts the visitor IP address from Vercel/proxy headers.
 * Prefers x-forwarded-for (set by Vercel) over x-real-ip.
 */
function getIpAddress(req: NextRequest): string | null {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    // x-forwarded-for can contain multiple IPs — take the first (original client)
    const forwardedIp = forwarded.split(",")[0]?.trim();
    return forwardedIp === "" ? null : (forwardedIp ?? null);
  }
  const realIp = req.headers.get("x-real-ip")?.trim();
  return realIp === "" ? null : (realIp ?? null);
}

export async function POST(request: NextRequest) {
  // Parse and validate the request body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = TrackEventSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid event data" }, { status: 400 });
  }

  const { event_type, variant, session_id, referrer, details } = parsed.data;

  // Capture server-side request metadata that the client cannot fake
  const ip_address = getIpAddress(request);
  const user_agent = request.headers.get("user-agent");

  try {
    const admin = createAdminClient();

    const { error } = await admin.from("landing_event").insert({
      event_type,
      variant: variant ?? null,
      session_id: session_id ?? null,
      referrer: referrer ?? null,
      ip_address: ip_address ?? null,
      user_agent: user_agent ?? null,
      details: (details ?? {}) as unknown as Json,
    });

    if (error) {
      console.error("[track] Insert failed:", error.message);
      // Return 200 anyway — tracking failures should not break the visitor experience
      return NextResponse.json({ ok: false });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    // If admin client is not configured (local dev without service role key),
    // silently swallow the error so the landing page keeps working.
    console.warn("[track] Admin client unavailable — event not stored:", err);
    return NextResponse.json({ ok: false });
  }
}
