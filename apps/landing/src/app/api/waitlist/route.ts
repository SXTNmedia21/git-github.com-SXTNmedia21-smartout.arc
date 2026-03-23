// ============================================
// waitlist/route.ts
// Public endpoint for storing structured campaign
// waitlist submissions.
//
// Why: the free-forever campaign needs structured
// premium-interest capture, not only anonymous
// landing analytics.
// ============================================

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@smartout/supabase/admin";

// TODO: Remove UntypedClient cast after database types are regenerated
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type UntypedClient = ReturnType<typeof createAdminClient> & { from: (table: string) => any };

const WaitlistSchema = z.object({
  campaignKey: z.string().min(1).max(100),
  fullName: z.string().trim().min(2).max(120),
  companyName: z.string().trim().min(2).max(160),
  email: z.string().email().max(160),
  phone: z.string().trim().max(40).optional(),
  employeeCount: z.string().trim().min(1).max(40),
  interestedPackage: z.enum(["free", "premium", "pro", "enterprise"]),
  premiumReservationInterest: z.boolean(),
  sourcePath: z.string().trim().max(200).optional(),
  visitor_id: z.string().uuid().optional(),
  session_id: z.string().max(120).optional(),
  variant: z.string().max(50).optional(),
});

/**
 * Returns the best-effort client IP address from forwarded headers.
 * Why: campaign lead submissions should preserve operational context for
 * follow-up without trusting a client-sent value.
 *
 * @returns The first forwarded IP, the real IP header, or null.
 */
function getIpAddress(request: NextRequest): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const firstIp = forwarded.split(",")[0]?.trim();
    return firstIp && firstIp !== "" ? firstIp : null;
  }

  const realIp = request.headers.get("x-real-ip")?.trim();
  return realIp && realIp !== "" ? realIp : null;
}

/**
 * POST stores one structured waitlist submission for the landing campaign.
 * Why: premium interest needs a durable lead record that sales can review
 * later, separate from anonymous-only tracking events.
 *
 * @returns JSON result describing whether the submission was stored.
 */
export async function POST(request: NextRequest) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = WaitlistSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid waitlist payload" }, { status: 400 });
  }

  const ipAddress = getIpAddress(request);
  const userAgent = request.headers.get("user-agent");
  const hostHeader = request.headers.get("host");
  const sourceHostname =
    hostHeader?.split(":")[0]?.toLowerCase() ?? request.nextUrl.hostname.toLowerCase();

  try {
    const admin = createAdminClient() as unknown as UntypedClient;

    const { error } = await admin.from("landing_waitlist_submission").insert({
      campaign_key: parsed.data.campaignKey,
      full_name: parsed.data.fullName,
      company_name: parsed.data.companyName,
      email: parsed.data.email,
      phone: parsed.data.phone ?? null,
      employee_count: parsed.data.employeeCount,
      interested_package: parsed.data.interestedPackage,
      premium_reservation_interest: parsed.data.premiumReservationInterest,
      status: "new",
      source_hostname: sourceHostname,
      source_path: parsed.data.sourcePath ?? request.nextUrl.pathname,
      visitor_id: parsed.data.visitor_id ?? null,
      session_id: parsed.data.session_id ?? null,
      variant: parsed.data.variant ?? null,
      ip_address: ipAddress,
      user_agent: userAgent,
    });

    if (error) {
      console.error("[waitlist] Insert failed:", error.message);
      return NextResponse.json({ ok: false }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.warn("[waitlist] Admin client unavailable:", error);
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
