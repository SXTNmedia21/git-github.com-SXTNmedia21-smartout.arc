/**
 * GET /api/botsson/sessions/[id]   — full conversation read
 * DELETE /api/botsson/sessions/[id] — soft-archive (sets is_archived=true)
 *
 * Auth (ADR-0151): workspace_id + profile_id derived server-side via getServerContext.
 * RLS scopes to workspace; ownership cross-checked by profile_id in WHERE clause
 * (belt-and-braces — RLS + explicit eq() predicate).
 *
 * Fail-fast (L-0177): missing/empty workspace_id or profile_id → 403.
 *
 * Telemetry (ADR-0152): DELETE emits botsson.session.archived with entity
 * discriminator { entity_type: 'agent_session', entity_id: <uuid>,
 * entity_label: summary OR first-user-turn slice(0,60) OR 'Botsson chat' }.
 *
 * anon+JWT client only — no service-role per Law 5.
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getServerContext } from "@/lib/auth/get-server-context";
import { createClient } from "@smartout/supabase/server";
import { emit, nonEmpty } from "@smartout/telemetry";
import type { SessionDetail, ConversationTurn } from "../_schema";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const ctx = await getServerContext(request);

  if (!ctx) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  // L-0177 fail-fast
  if (!ctx.profile?.workspace_id || !ctx.profile?.profile_id) {
    return NextResponse.json({ error: "no_workspace_profile" }, { status: 403 });
  }

  const { id } = await params;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("engine_sessions")
    .select(
      "id, summary, channel, mode, status, is_archived, collected_data, created_at, updated_at, workspace_id, profile_id",
    )
    .eq("id", id)
    .eq("workspace_id", ctx.profile.workspace_id)
    .eq("profile_id", ctx.profile.profile_id)
    .eq("mode", "agent")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "get_failed", details: error.message }, { status: 500 });
  }

  // Not found OR not owned (RLS makes ownership transparent — both return null)
  if (!data) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const conversation = ((data.collected_data as { conversation?: ConversationTurn[] } | null)
    ?.conversation ?? []) as ConversationTurn[];

  const payload: SessionDetail = {
    id: data.id,
    summary: data.summary,
    channel: data.channel as "chat" | "voice",
    mode: "agent",
    status: data.status as SessionDetail["status"],
    is_archived: data.is_archived,
    created_at: data.created_at,
    updated_at: data.updated_at,
    conversation,
  };

  return NextResponse.json(payload);
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const ctx = await getServerContext(request);

  if (!ctx) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  // L-0177 fail-fast
  if (!ctx.profile?.workspace_id || !ctx.profile?.profile_id) {
    return NextResponse.json({ error: "no_workspace_profile" }, { status: 403 });
  }

  const { id } = await params;
  const supabase = await createClient();

  // Fetch first to build entity_label for ADR-0152 discriminator.
  // Scoped by workspace_id + profile_id — non-owned sessions return null.
  const { data: row, error: fetchErr } = await supabase
    .from("engine_sessions")
    .select("id, summary, collected_data")
    .eq("id", id)
    .eq("workspace_id", ctx.profile.workspace_id)
    .eq("profile_id", ctx.profile.profile_id)
    .eq("mode", "agent")
    .maybeSingle();

  if (fetchErr) {
    return NextResponse.json({ error: "fetch_failed", details: fetchErr.message }, { status: 500 });
  }

  if (!row) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // Build entity_label per ADR-0152: summary → first-user-turn(0,60) → fallback
  const firstUserTurn = (
    (row.collected_data as { conversation?: Array<{ role: string; content: string }> } | null)
      ?.conversation ?? []
  ).find((t) => t.role === "user");

  const entityLabel = row.summary ?? firstUserTurn?.content?.slice(0, 60) ?? "Botsson chat";

  const { error: updateErr } = await supabase
    .from("engine_sessions")
    .update({ is_archived: true, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("workspace_id", ctx.profile.workspace_id)
    .eq("profile_id", ctx.profile.profile_id);

  if (updateErr) {
    return NextResponse.json(
      { error: "archive_failed", details: updateErr.message },
      { status: 500 },
    );
  }

  // Telemetry — ADR-0116 + ADR-0152 entity discriminator.
  // nonEmpty() throws in dev/test on empty strings (ADR-0193 fail-fast).
  await emit({
    event: "botsson.session.archived",
    workspace_id: nonEmpty(ctx.profile.workspace_id, "workspace_id"),
    actor_id: nonEmpty(ctx.profile.profile_id, "actor_id"),
    properties: {
      entity: {
        entity_type: "agent_session",
        entity_id: row.id,
        entity_label: entityLabel,
      },
      data: {
        session_id: row.id,
        archived_by: ctx.profile.profile_id,
        archived_at: new Date().toISOString(),
      },
    },
  });

  return new NextResponse(null, { status: 204 });
}
