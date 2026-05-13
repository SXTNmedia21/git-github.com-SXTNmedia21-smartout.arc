"use server";

/**
 * completeSessionTaskAction — Server Action for completing a session_task.
 *
 * ADR-0298 Sortie 5b: rewired to delegate to task.complete capability tool body.
 * All gate / mutation / emit logic lives in the tool body (complete.execute).
 * This wrapper only adapts the calling shape (cookie-actor vs Bearer-actor,
 * taskId string → { id, source:'session' } tool params, JSON result → ServerAction result).
 *
 * Gate key change: Server Action no longer calls gate_action directly.
 * The tool body calls gate_action with capability='task', actionType='task.complete'.
 * Server Action previously called gateAction with capability='task.complete_session_task'.
 *
 * File signature + exports preserved verbatim for callers:
 *   completeSessionTaskAction(taskId, actor, channel) → CompleteSessionTaskResult
 *   CompleteSessionTaskResult = { ok: true; taskId: string } | { ok: false; error: string }
 *   ResolvedActor (re-exported for test imports)
 *
 * References: ADR-0099, ADR-0114, ADR-0134, ADR-0151, ADR-0287, ADR-0298.
 */

import { createAdminClient } from "@smartout/supabase/admin";
import { complete } from "@smartout/ai/capabilities/task/tools";
import type { NonEmptyString } from "@smartout/telemetry/server";

import type { ResolvedActor } from "@/app/api/mobile/_shared/actor";

// Re-export ResolvedActor so existing imports from this file continue to work.
export type { ResolvedActor };

export type CompleteSessionTaskResult = { ok: true; taskId: string } | { ok: false; error: string };

export async function completeSessionTaskAction(
  taskId: string,
  actor: ResolvedActor,
  channel: "chat" | "voice" | "system" = "chat",
): Promise<CompleteSessionTaskResult> {
  // Validate taskId shape (fail-fast before hitting DB).
  if (!taskId || !taskId.match(/^[0-9a-f-]{36}$/i)) {
    return { ok: false, error: "Ugyldig oppgave-ID." };
  }

  // Fail-fast on empty identity (ADR-0134 / L-0177 — never pass "" to emit()).
  if (!actor.profileId || !actor.workspaceId) {
    return { ok: false, error: "Ikke autentisert." };
  }

  // Synthesize AgentToolContext and delegate to task.complete tool body.
  // The tool owns: workspace-scope check, assignee-auth check, gate_action, UPDATE, emit.
  // channel='voice' is allowed by task.complete (chat + voice capability per ADR-0298 R6).
  const supabaseAdmin = createAdminClient();
  const ctx = {
    workspaceId: actor.workspaceId as NonEmptyString,
    profileId: actor.profileId as NonEmptyString,
    sessionId: "server-action",
    channel:
      channel === "system"
        ? ("system" as const)
        : channel === "voice"
          ? ("voice" as const)
          : ("chat" as const),
    supabaseAdmin,
  };

  let raw: string;
  try {
    raw = await complete.execute({ id: taskId, source: "session" }, ctx);
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Ukjent feil fra oppgavemotor.",
    };
  }

  let result: { ok?: boolean; error?: string } = {};
  try {
    result = JSON.parse(raw) as { ok?: boolean; error?: string };
  } catch {
    return { ok: false, error: "Uventet svar fra oppgavemotor." };
  }

  if (result.ok === false) {
    // Map tool error codes → Norwegian user-facing messages for existing callers.
    const err = result.error ?? "ukjent";
    if (err === "not_found_or_unauthorized") {
      return { ok: false, error: "Oppgaven finnes ikke eller du har ikke tilgang." };
    }
    if (err.includes("ikke_tillatt") || err.includes("gate")) {
      return { ok: false, error: `Ikke autorisert: ${err}` };
    }
    return { ok: false, error: err };
  }

  return { ok: true, taskId };
}
