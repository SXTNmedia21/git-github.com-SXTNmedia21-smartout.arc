/**
 * Platform Admin — Email Suppression Management API
 *
 * GET  — List suppressions with optional search/filter/pagination
 * POST — Add a manual suppression entry
 * DELETE — Remove a suppression by ID
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireGodmode, logPlatformAction } from "@/lib/platform-admin";

const VALID_REASONS = ["bounce", "unsubscribe", "complaint", "manual"] as const;

const addSuppressionSchema = z.object({
  email: z.string().email("Invalid email address"),
  reason: z.literal("manual"),
});

const deleteSuppressionSchema = z.object({
  suppression_id: z.string().uuid("Invalid suppression ID"),
});

export async function GET(request: NextRequest) {
  const result = await requireGodmode();
  if (result.error) return result.error;
  const { admin } = result;

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const reason = searchParams.get("reason") ?? "";
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "50", 10)));
  const offset = Math.max(0, parseInt(searchParams.get("offset") ?? "0", 10));

  let query = admin
    .from("platform_email_suppression" as never)
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (q) {
    query = query.ilike("email", `%${q}%`);
  }

  if (reason && VALID_REASONS.includes(reason as (typeof VALID_REASONS)[number])) {
    query = query.eq("reason", reason);
  }

  const { data, count, error } = await query;

  if (error) {
    return NextResponse.json({ error: "Failed to fetch suppressions" }, { status: 500 });
  }

  return NextResponse.json({ data: data ?? [], total: count ?? 0 });
}

export async function POST(request: NextRequest) {
  const result = await requireGodmode();
  if (result.error) return result.error;
  const { adminId, admin } = result;

  const body = await request.json();
  const parsed = addSuppressionSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { email, reason } = parsed.data;

  const { data, error } = await admin
    .from("platform_email_suppression" as never)
    .insert({ email: email.toLowerCase(), reason, source: "platform-admin" } as never)
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "Email is already suppressed" }, { status: 409 });
    }
    return NextResponse.json({ error: "Failed to add suppression" }, { status: 500 });
  }

  await logPlatformAction(adminId, "suppression_add", "email_suppression", email, {
    email,
    reason,
  });

  return NextResponse.json({ data }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const result = await requireGodmode();
  if (result.error) return result.error;
  const { adminId, admin } = result;

  const body = await request.json();
  const parsed = deleteSuppressionSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { suppression_id } = parsed.data;

  // Fetch the record first for audit logging
  const { data: existing } = await admin
    .from("platform_email_suppression" as never)
    .select("email, reason")
    .eq("suppression_id", suppression_id)
    .single();

  const { error } = await admin
    .from("platform_email_suppression" as never)
    .delete()
    .eq("suppression_id", suppression_id);

  if (error) {
    return NextResponse.json({ error: "Failed to remove suppression" }, { status: 500 });
  }

  await logPlatformAction(adminId, "suppression_remove", "email_suppression", suppression_id, {
    email: (existing as Record<string, unknown> | null)?.email ?? "unknown",
    reason: (existing as Record<string, unknown> | null)?.reason ?? "unknown",
  });

  return NextResponse.json({ success: true });
}
