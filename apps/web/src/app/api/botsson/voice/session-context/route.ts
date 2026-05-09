/**
 * GET /api/botsson/voice/session-context
 *
 * Returns a snapshot of the three context blocks the voice-agent needs to
 * understand the speaker:
 *
 *   user      — who is speaking (role, status, department, display name, language)
 *   workspace — workspace identity + active cascade state (season, framework, cycle)
 *
 * The browser fetches this endpoint immediately after connecting a LiveKit room
 * and publishes the result as a data event on topic="botsson-context" with
 * type="context_init". The voice-agent worker receives it via RoomEvent.DataReceived
 * and stores it in module-level state (services/voice-agent/src/context.ts).
 *
 * Route context ("context_route") is published separately on every Next.js
 * pathname/params change and is NOT part of this response.
 *
 * Auth: dual-mode — Bearer JWT (mobile LiveKit sessions) or cookie (web).
 * profile_id is derived server-side (ADR-0151 — never from request body).
 *
 * Query param: workspaceId (required UUID)
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { createAdminClient } from "@smartout/supabase/admin";
import type { UserContext, WorkspaceContext } from "@smartout/ai/agents/context-types";
import { resolveAuth } from "@/lib/auth/resolve-auth";

export async function GET(request: NextRequest) {
  // 1. Dual-mode auth — Bearer (mobile) or cookie (web).
  const auth = await resolveAuth(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = auth.user.id;

  // 2. Workspace from query param.
  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get("workspaceId");
  if (!workspaceId || !/^[0-9a-f-]{36}$/.test(workspaceId)) {
    return NextResponse.json(
      { error: "BAD_REQUEST", message: "workspaceId query param is required (UUID)" },
      { status: 400 },
    );
  }

  const admin = createAdminClient();

  // 3. Resolve profile (server-side — ADR-0151).
  const { data: profile, error: profileError } = await admin
    .from("profile")
    .select("profile_id, role, status, department_id, display_name, language_override")
    .eq("user_id", userId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (profileError || !profile) {
    return NextResponse.json(
      { error: "FORBIDDEN", message: "Profile not found in workspace" },
      { status: 403 },
    );
  }

  // 4. Resolve workspace + active cascade state in parallel.
  const [
    { data: workspace, error: workspaceError },
    { data: activeSeason },
    { data: frameworkBinding },
    { data: activeCycle },
  ] = await Promise.all([
    admin
      .from("workspace")
      .select("workspace_id, name, language")
      .eq("workspace_id", workspaceId)
      .maybeSingle(),

    admin
      .from("season")
      .select("season_id")
      .eq("workspace_id", workspaceId)
      .eq("status", "active")
      .maybeSingle(),

    admin
      .from("workspace_framework_binding")
      .select("framework_id")
      .eq("workspace_id", workspaceId)
      .eq("is_active", true)
      .maybeSingle(),

    admin
      .from("planning_cycle")
      .select("planning_cycle_id")
      .eq("workspace_id", workspaceId)
      .eq("status", "active")
      .order("start_date", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (workspaceError || !workspace) {
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: "Workspace not found" },
      { status: 500 },
    );
  }

  // 5. Assemble context blocks.
  // language: profile.language_override takes precedence; fallback to workspace.language.
  const resolvedLanguage = (profile.language_override ?? workspace.language ?? "no") as
    | "no"
    | "en"
    | "sv"
    | "da"
    | "fi";

  const userContext: UserContext = {
    profile_id: profile.profile_id as string,
    role: profile.role as UserContext["role"],
    status: profile.status as UserContext["status"],
    department_id: (profile.department_id as string | null) ?? null,
    display_name: profile.display_name as string,
    language: resolvedLanguage,
  };

  const workspaceContext: WorkspaceContext = {
    workspace_id: workspace.workspace_id as string,
    name: workspace.name as string,
    // workspace table has no `industry` column today; future migration will
    // surface niche from company.industry or a new workspace.niche column.
    niche: null,
    active_season_id: (activeSeason?.season_id as string | null) ?? null,
    active_framework_id: (frameworkBinding?.framework_id as string | null) ?? null,
    planning_cycle_id: (activeCycle?.planning_cycle_id as string | null) ?? null,
  };

  return NextResponse.json({ user: userContext, workspace: workspaceContext });
}
