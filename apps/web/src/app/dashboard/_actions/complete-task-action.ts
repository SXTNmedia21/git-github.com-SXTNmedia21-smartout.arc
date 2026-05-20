"use server";

/**
 * complete-task-action.ts — Cookie-path Server Action for completing a session_task.
 *
 * WHY: `use-complete-task.ts` (HMS surface) previously called
 * `supabase.from("session_task").update(...)` from the browser anon client
 * with fire-and-forget `void emit()`. Violations:
 *   - ADR-0099: no gate_action() RPC
 *   - ADR-0114: client-side DB write
 *   - ADR-0151: workspace_id + actor resolved client-side
 *   - ADR-0134: fire-and-forget emit
 *
 * This action resolves identity from the SSR cookie session (web path),
 * then delegates to `completeSessionTaskAction` which owns all gate / mutation
 * / emit logic (via task.complete capability tool body per ADR-0298 Sortie 5b).
 *
 * NOTE: `completeSessionTaskAction` (complete-session-task-action.ts) accepts a
 * pre-resolved `ResolvedActor` to support both cookie (web) and Bearer (mobile)
 * paths. This thin wrapper handles the cookie path: resolves actor, adapts shape.
 *
 * Sortie 1 of M5 HMS 4-sortie sequence. Council-verified 2026-05-17.
 * ADR refs: 0099, 0114, 0134, 0151, 0204, 0298.
 */

import { createClient } from "@smartout/supabase/server";
import { completeSessionTaskAction } from "@/app/dashboard/_actions/complete-session-task-action";
import type { CompleteSessionTaskResult } from "@/app/dashboard/_actions/complete-session-task-action";

export type { CompleteSessionTaskResult };

/**
 * Completes a session_task from the web cookie session.
 *
 * Resolves actor server-side (ADR-0151) — never accepts workspace_id or
 * profile_id from the request body. Delegates to completeSessionTaskAction
 * which calls gate_action + admin-client update + await emit (ADR-0099/0134).
 */
export async function completeTaskAction(
  taskId: string,
  channel: "chat" | "voice" | "system" = "chat",
): Promise<CompleteSessionTaskResult> {
  if (!taskId || !taskId.match(/^[0-9a-f-]{36}$/i)) {
    return { ok: false, error: "Ugyldig oppgave-ID." };
  }

  // Resolve identity from SSR cookie — never trust body-supplied IDs (ADR-0151).
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Ikke autentisert." };

  const { data: profile } = await supabase
    .from("profile")
    .select("profile_id, workspace_id, role")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (!profile || !profile.profile_id || !profile.workspace_id) {
    return { ok: false, error: "Ikke autentisert." };
  }

  return completeSessionTaskAction(
    taskId,
    {
      userId: user.id,
      profileId: profile.profile_id,
      workspaceId: profile.workspace_id,
      role: profile.role ?? null,
    },
    channel,
  );
}
