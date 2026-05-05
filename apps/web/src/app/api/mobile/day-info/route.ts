/**
 * POST /api/mobile/day-info
 *
 * Mobile BFF for schedule day-info creation.
 *
 * WHY: Mobile clients cannot call Next.js Server Actions directly (no
 * SSR cookie path). This route resolves the caller's identity from a
 * Bearer JWT, then delegates to createDayInfoAction with the resolved
 * actor + channel='system'.
 *
 * ADR-0132: Mobile routes through BFF, never directly to capabilities.
 * ADR-0134: workspace_id + actor_id derived server-side before any emit.
 * ADR-0151: identity NEVER accepted from request body.
 *
 * Auth: Bearer JWT only (no cookie — mobile has no SSR session).
 * Status codes: 200 ok | 401 unauthenticated | 422 gate/validation fail.
 */

import { type NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@smartout/supabase/admin";
import type { ResolvedActor } from "@/app/dashboard/_actions/create-day-info-action";
import { createDayInfoAction } from "@/app/dashboard/_actions/create-day-info-action";
import type { CreateDayInfoInput } from "@/app/dashboard/_actions/create-day-info-action";

async function resolveBearerActor(request: NextRequest): Promise<ResolvedActor | null> {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return null;

  const admin = createAdminClient();
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return null;

  const { data: profile } = await admin
    .from("profile")
    .select("profile_id, workspace_id, role")
    .eq("user_id", data.user.id)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (!profile) return null;
  if (!profile.profile_id || !profile.workspace_id) return null;
  if (profile.profile_id.trim() === "" || profile.workspace_id.trim() === "") return null;

  return {
    profileId: profile.profile_id,
    workspaceId: profile.workspace_id,
    role: profile.role ?? null,
  };
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  // 1. Resolve identity from Bearer token (ADR-0151 — never from body)
  const actor = await resolveBearerActor(request);
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Parse body — workspace_id + createdBy NOT expected; derived from actor.
  //    channel is pinned to 'system' (mobile BFF path, server-initiated write).
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // 3. Delegate entirely to the Server Action
  const input: CreateDayInfoInput = {
    ...(body as Omit<CreateDayInfoInput, "channel">),
    channel: "system",
  };

  const result = await createDayInfoAction(input, actor);

  if (result.ok === false) {
    return NextResponse.json({ error: result.error }, { status: 422 });
  }

  return NextResponse.json({ id: result.id });
}
