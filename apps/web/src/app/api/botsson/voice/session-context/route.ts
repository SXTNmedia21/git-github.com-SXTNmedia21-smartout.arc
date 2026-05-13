/**
 * GET /api/botsson/voice/session-context
 *
 * Returns a snapshot of the context blocks the voice-agent needs:
 *
 *   user      — who is speaking (role, status, department, display name, language)
 *   workspace — workspace identity + active cascade state (season, framework, cycle)
 *   workforce — D2+D6 snapshot: employees, today+tomorrow shifts, absences,
 *               department sessions. Same access for voice and chat per
 *               2026-05-13 directive (Botsson is workforce assistant — must
 *               have workforce state at session start, not fetch via tools).
 *
 * The browser fetches this endpoint immediately after connecting a LiveKit room
 * and publishes the result as a data event on topic="botsson-context" with
 * type="context_init". The voice-agent worker receives it via RoomEvent.DataReceived
 * and stores it in module-level state (services/voice-agent/src/context.ts).
 *
 * Auth: cookie session (web only — voice connect originates from the dashboard).
 * profile_id is derived server-side (ADR-0151 — never from request body).
 *
 * PII policy:
 *   - Names, roles, departments, phones: INCLUDED on voice (Pontus directive 2026-05-13)
 *   - Bank/tax/personnummer/contract details: NEVER included (ADR-0078)
 *   - Absence reason ("sykmeldt" vs "ferie"): INCLUDED (managers need it)
 *
 * Query param: workspaceId (required UUID)
 *
 * Assembly is delegated to apps/web/src/lib/botsson-context-snapshot.ts —
 * the same helper used by /api/emma/chat and /api/botsson/chat (2026-05-13 S4
 * chat-voice parity). One source of truth for what Botsson knows at session start.
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { createClient } from "@smartout/supabase/server";
import { createAdminClient } from "@smartout/supabase/admin";
import { assembleBotssonContext, isBotssonContextError } from "@/lib/botsson-context-snapshot";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = userData.user.id;

  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get("workspaceId");
  if (!workspaceId || !/^[0-9a-f-]{36}$/.test(workspaceId)) {
    return NextResponse.json(
      { error: "BAD_REQUEST", message: "workspaceId query param is required (UUID)" },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  const result = await assembleBotssonContext(admin, userId, workspaceId);

  if (isBotssonContextError(result)) {
    if (result.error === "PROFILE_NOT_FOUND") {
      return NextResponse.json(
        { error: "FORBIDDEN", message: "Profile not found in workspace" },
        { status: 403 },
      );
    }
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: "Workspace not found" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    user: result.user,
    workspace: result.workspace,
    workforce: result.workforce,
  });
}
