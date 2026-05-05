/**
 * BFF /api/mobile/tasks — mobile surface creates an ad-hoc session_task.
 *
 * Mobile MUST route through this BFF (ADR-0132). Identity is resolved
 * server-side from the Bearer JWT — workspace_id and profile_id are never
 * accepted from the request body (ADR-0151 / ADR-0176 Invariant 3).
 *
 * Delegates to `addTaskAction()` with a pre-resolved `actor` and
 * `channel='system'` so the gate + telemetry know the request origin
 * without re-deriving from a cookie that doesn't exist on mobile
 * (ADR-0266 §B2/B3).
 *
 * Auth: Bearer only (mobile). Cookie path is web-only (handled by the
 * Server Action directly from the DayControl UI).
 *
 * References: ADR-0114, ADR-0099, ADR-0134, ADR-0151, ADR-0261, ADR-0266.
 */
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import { createAdminClient } from "@smartout/supabase/admin";
import {
  addTaskAction,
  type AddTaskInput,
  type ResolvedActor,
} from "@/app/dashboard/_actions/add-task-action";

export const runtime = "nodejs";

// Request schema — mirrors AddTaskInput but excludes any identity fields.
// workspace_id and profile_id MUST NOT appear in the body (ADR-0151).
const RequestSchema = z.object({
  sessionId: z.string().uuid(),
  title: z.string().trim().min(1).max(200),
  ownerProfileId: z.string().uuid().optional().nullable(),
  hookId: z.string().uuid().optional().nullable(),
  isComplianceRequired: z.boolean().optional().default(false),
  reason: z.string().trim().min(8),
});

/**
 * Resolve workspace + profile from a Bearer access token.
 * Returns null if the token is invalid, the user has no active profile, or
 * any identity field is empty (ADR-0134 — empty identity is forbidden).
 */
async function resolveMobileActor(
  bearerToken: string,
): Promise<(ResolvedActor & { userId: string }) | null> {
  const admin = createAdminClient();

  const { data: userData, error: userErr } = await admin.auth.getUser(bearerToken);
  if (userErr || !userData.user) return null;

  const { data: profile, error: profileErr } = await admin
    .from("profile")
    .select("profile_id, workspace_id, role")
    .eq("user_id", userData.user.id)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (profileErr || !profile) return null;

  // Fail fast on empty identity (ADR-0134 — empty-string IDs corrupt
  // activity_trail + engine_event routing).
  if (!profile.profile_id || !profile.workspace_id) return null;

  return {
    userId: userData.user.id,
    profileId: profile.profile_id,
    workspaceId: profile.workspace_id,
    role: profile.role ?? null,
  };
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  // 1. Bearer auth — mobile has no cookie session.
  const authHeader = request.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!bearerToken) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const actor = await resolveMobileActor(bearerToken);
  if (!actor) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  // 2. Parse + validate body. Identity fields are NOT in this schema.
  let body: z.infer<typeof RequestSchema>;
  try {
    const raw = await request.json();
    body = RequestSchema.parse(raw);
  } catch (err) {
    const message =
      err instanceof z.ZodError
        ? (err.errors[0]?.message ?? "Invalid request body")
        : "Invalid request body";
    return NextResponse.json({ ok: false, error: message }, { status: 422 });
  }

  // 3. Delegate to the canonical Server Action with pre-resolved actor.
  //    channel='system' signals mobile origin through gate + telemetry.
  const taskInput: AddTaskInput = {
    sessionId: body.sessionId,
    title: body.title,
    ownerProfileId: body.ownerProfileId ?? null,
    hookId: body.hookId ?? null,
    isComplianceRequired: body.isComplianceRequired,
    reason: body.reason,
  };

  const resolvedActor: ResolvedActor = {
    profileId: actor.profileId,
    workspaceId: actor.workspaceId,
    role: actor.role,
  };

  const result = await addTaskAction(taskInput, resolvedActor, "system");

  if (result.ok === false) {
    // Distinguish auth/gate rejections from validation errors. The action
    // returns Norwegian-language error strings — forward them directly so
    // the mobile client can surface them.
    const errMsg = result.error;
    const isAuthError =
      errMsg === "Ikke autentisert." ||
      errMsg.startsWith("Ikke autorisert") ||
      errMsg.startsWith("gate_action_rpc_error");

    return NextResponse.json({ ok: false, error: errMsg }, { status: isAuthError ? 403 : 422 });
  }

  return NextResponse.json({ ok: true, taskId: result.taskId }, { status: 200 });
}
