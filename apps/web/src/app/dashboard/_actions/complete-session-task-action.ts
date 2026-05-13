"use server";

/**
 * completeSessionTaskAction — Server Action for completing a session_task.
 *
 * Per ADR-0298 §3.1 + Spec §4.3:
 * - Identity pre-resolved via ResolvedActor (ADR-0151)
 * - gateAction from ./_shared with dotted-slug capability + actorProfileId
 *   + entityId (matches add-task-action.ts pattern)
 * - session_task PK is `id`
 * - Emits canonical "session_task completed" event (registry.ts:984)
 * - Idempotent: status='completed' short-circuits before gate call
 * - Fail-fast on missing row / workspace mismatch (L-0177)
 *
 * References: ADR-0099, ADR-0114, ADR-0134, ADR-0151, ADR-0287, ADR-0298.
 */
import { createAdminClient } from "@smartout/supabase/admin";
import { emit, nonEmpty } from "@smartout/telemetry";

import { gateAction } from "./_shared";
import type { ResolvedActor } from "@/app/api/mobile/_shared/actor";

export type CompleteSessionTaskResult = { ok: true; taskId: string } | { ok: false; error: string };

export async function completeSessionTaskAction(
  taskId: string,
  actor: ResolvedActor,
  channel: "chat" | "voice" | "system" = "chat",
): Promise<CompleteSessionTaskResult> {
  const admin = createAdminClient();

  // 1. Load row — fail-fast on missing / wrong workspace (L-0177).
  const { data: row, error: loadErr } = await admin
    .from("session_task")
    .select("workspace_id, assigned_to, title, status")
    .eq("id", taskId)
    .maybeSingle();

  if (loadErr) {
    return { ok: false, error: `Kunne ikke laste oppgaven: ${loadErr.message}` };
  }
  if (!row) {
    return { ok: false, error: "Oppgaven finnes ikke." };
  }
  if (row.workspace_id !== actor.workspaceId) {
    return { ok: false, error: "Oppgaven tilhører et annet arbeidsrom." };
  }

  // 2. Idempotency — already completed.
  if (row.status === "completed") {
    return { ok: true, taskId };
  }

  // 3. Gate check (per add-task-action.ts pattern).
  /* @authority-gate: capability='task.complete_session_task' level='suggest' seed='20260604121000_sortie_1_gate_action_seed.sql' */
  const gate = await gateAction({
    workspaceId: actor.workspaceId,
    capability: "task.complete_session_task",
    channel,
    actorProfileId: actor.profileId,
    actionType: "complete",
    entityId: taskId,
  });

  if (!gate.allow) {
    return { ok: false, error: gate.reason ?? "Ikke autorisert." };
  }

  // 4. Gated UPDATE — RLS WITH CHECK enforces assignee | NULL | admin (Task 2).
  const now = new Date().toISOString();
  const { error: updateErr } = await admin
    .from("session_task")
    .update({
      status: "completed",
      completed_at: now,
      completed_by: actor.profileId,
    })
    .eq("id", taskId);

  if (updateErr) {
    return { ok: false, error: `Kunne ikke oppdatere oppgaven: ${updateErr.message}` };
  }

  // 5. Telemetry — canonical "session_task completed" event (registry.ts:984).
  //    data.task_id + data.profile_id required by SessionTaskCompleted interface.
  void emit({
    event: "session_task completed",
    workspace_id: nonEmpty(actor.workspaceId, "workspace_id"),
    actor_id: nonEmpty(actor.profileId, "actor_id"),
    properties: {
      entity: {
        entity_type: "session_task",
        entity_id: taskId,
        entity_label: row.title ?? undefined,
      },
      data: {
        task_id: taskId,
        profile_id: actor.profileId,
      },
    },
  });

  return { ok: true, taskId };
}
