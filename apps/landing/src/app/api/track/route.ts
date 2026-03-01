// ============================================
// track/route.ts
// Public endpoint for logging anonymous landing page events.
// Called by the client tracking hooks (page views, CTA clicks,
// scroll depth, click tracking, session heartbeat/end)
// and the wizard/start route (voice session started).
//
// Three responsibilities:
//   1. Insert event into landing_event (critical path)
//   2. Upsert visitor in landing_visitor (best-effort)
//   3. Upsert session in landing_session (best-effort)
//
// No auth required — this is a public, write-only endpoint.
// All data is anonymized (no PII beyond IP address).
// Server-side only — the admin client is never exposed to the browser.
//
// Connected to: apps/landing/src/hooks/useTracking.ts (client calls)
//               apps/landing/src/hooks/useScrollTracking.ts (scroll depth)
//               apps/landing/src/hooks/useClickTracking.ts (click tracking)
//               apps/landing/src/hooks/useSessionLifecycle.ts (heartbeat/end)
//               apps/landing/src/app/api/wizard/start/route.ts (server call)
//               apps/web/src/app/platform-admin/landing/ (reads in platform admin)
// ============================================

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@smartout/supabase/admin";
import type { Json } from "@smartout/supabase";

// TODO: Remove UntypedClient cast after regenerating database.types.ts
// (landing_visitor + landing_session tables are not yet in the generated types)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type UntypedClient = ReturnType<typeof createAdminClient> & { from: (table: string) => any };

/**
 * Validates the request body for a landing event.
 * All fields except event_type are optional.
 */
const TrackEventSchema = z.object({
  event_type: z.enum([
    "page_view",
    "voice_session_started",
    "cta_click",
    "click",
    "scroll_depth",
    "session_heartbeat",
    "session_end",
  ]),
  variant: z.string().optional(),
  session_id: z.string().optional(),
  visitor_id: z.string().uuid().optional(),
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

/**
 * Detects device type from User-Agent string.
 * Simple regex — no external dependency needed.
 */
function detectDeviceType(ua: string | null): string {
  if (!ua) return "desktop";
  const lower = ua.toLowerCase();
  if (/tablet|ipad|playbook|silk/i.test(lower)) return "tablet";
  if (/mobile|iphone|ipod|android.*mobile|windows phone/i.test(lower)) return "mobile";
  return "desktop";
}

/**
 * Best-effort visitor upsert.
 * First event from a visitor: INSERT with first_referrer, first_variant, etc.
 * Subsequent events: UPDATE last_seen only (preserve first_* fields).
 */
async function upsertVisitor(
  admin: UntypedClient,
  visitor_id: string,
  referrer: string | null,
  variant: string | null,
  ip_address: string | null,
  user_agent: string | null,
): Promise<void> {
  // Try insert (new visitor)
  const { error: insertError } = await admin.from("landing_visitor").insert({
    id: visitor_id,
    first_referrer: referrer ?? null,
    first_variant: variant ?? null,
    ip_addresses: ip_address ? [ip_address] : [],
    user_agents: user_agent ? [user_agent] : [],
  });

  if (insertError) {
    // Visitor already exists — just update last_seen
    const now = new Date().toISOString();
    await admin
      .from("landing_visitor")
      .update({ last_seen: now, updated_at: now })
      .eq("id", visitor_id);
  }
}

/**
 * Best-effort session upsert.
 * New session: INSERT row and increment visitor visit_count.
 * Existing session: UPDATE counters incrementally based on event type.
 */
async function upsertSession(
  admin: UntypedClient,
  session_id: string,
  visitor_id: string,
  event_type: string,
  referrer: string | null,
  variant: string | null,
  ip_address: string | null,
  user_agent: string | null,
  details: Record<string, unknown> | undefined,
): Promise<void> {
  const now = new Date().toISOString();
  const device_type = detectDeviceType(user_agent);

  // Check if session already exists
  const { data: existing } = await admin
    .from("landing_session")
    .select("id, page_count, click_count, cta_click_count, max_scroll_depth, started_at")
    .eq("session_id", session_id)
    .single();

  if (existing) {
    // --- Update existing session ---
    const updates: Record<string, unknown> = {
      ended_at: now,
      updated_at: now,
    };

    // Calculate duration from session start
    const startedAt = new Date(existing.started_at as string).getTime();
    const currentTime = new Date(now).getTime();
    updates.duration_seconds = Math.round((currentTime - startedAt) / 1000);

    // Increment counters based on event type
    if (event_type === "page_view") {
      updates.page_count = (existing.page_count as number) + 1;
    } else if (event_type === "click") {
      updates.click_count = (existing.click_count as number) + 1;
    } else if (event_type === "cta_click") {
      updates.cta_click_count = (existing.cta_click_count as number) + 1;
    } else if (event_type === "scroll_depth" && details?.percent != null) {
      const newDepth = Number(details.percent);
      const currentDepth = existing.max_scroll_depth as number;
      if (newDepth > currentDepth) {
        updates.max_scroll_depth = newDepth;
      }
    } else if (event_type === "session_end" && details?.timeOnPage != null) {
      updates.duration_seconds = Number(details.timeOnPage);
    }

    await admin.from("landing_session").update(updates).eq("id", existing.id);
  } else {
    // --- Insert new session ---
    await admin.from("landing_session").insert({
      visitor_id,
      session_id,
      variant: variant ?? null,
      referrer: referrer ?? null,
      ip_address: ip_address ?? null,
      user_agent: user_agent ?? null,
      device_type,
      page_count: event_type === "page_view" ? 1 : 0,
      click_count: event_type === "click" ? 1 : 0,
      cta_click_count: event_type === "cta_click" ? 1 : 0,
      max_scroll_depth:
        event_type === "scroll_depth" && details?.percent != null ? Number(details.percent) : 0,
    });

    // Increment the visitor's visit_count for new sessions
    const { data: v } = await admin
      .from("landing_visitor")
      .select("visit_count")
      .eq("id", visitor_id)
      .single();

    if (v) {
      await admin
        .from("landing_visitor")
        .update({ visit_count: (v.visit_count as number) + 1 })
        .eq("id", visitor_id);
    }
  }
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

  const { event_type, variant, session_id, visitor_id, referrer, details } = parsed.data;

  // Capture server-side request metadata that the client cannot fake
  const ip_address = getIpAddress(request);
  const user_agent = request.headers.get("user-agent");

  try {
    // TODO: Remove cast after regenerating database.types.ts
    const admin = createAdminClient() as unknown as UntypedClient;

    // --- 1. Insert event (critical path) ---
    const { error } = await admin.from("landing_event").insert({
      event_type,
      variant: variant ?? null,
      session_id: session_id ?? null,
      visitor_id: visitor_id ?? null,
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

    // --- 2. Visitor upsert (best-effort, fire-and-forget) ---
    if (visitor_id) {
      try {
        await upsertVisitor(
          admin,
          visitor_id,
          referrer ?? null,
          variant ?? null,
          ip_address,
          user_agent,
        );
      } catch (err) {
        console.error("[track] Visitor upsert failed:", err);
        // Non-critical — continue
      }
    }

    // --- 3. Session upsert (best-effort, fire-and-forget) ---
    if (session_id && visitor_id) {
      try {
        await upsertSession(
          admin,
          session_id,
          visitor_id,
          event_type,
          referrer ?? null,
          variant ?? null,
          ip_address,
          user_agent,
          details,
        );
      } catch (err) {
        console.error("[track] Session upsert failed:", err);
        // Non-critical — continue
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    // If admin client is not configured (local dev without service role key),
    // silently swallow the error so the landing page keeps working.
    console.warn("[track] Admin client unavailable — event not stored:", err);
    return NextResponse.json({ ok: false });
  }
}
