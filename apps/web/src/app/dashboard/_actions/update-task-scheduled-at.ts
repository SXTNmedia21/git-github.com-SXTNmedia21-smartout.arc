"use server";

/**
 * updateTaskScheduledAtAction — Server Action for DnD task re-timing on the
 * Manager Timeline (/dashboard/oppgaver, Wave 1 Phase A.4).
 *
 * Delegates all gate / mutation / single task.session_task_updated emit logic
 * to the task.update_session_task capability tool body. This wrapper:
 *   1. Validates input shape via Zod.
 *   2. Resolves workspace_id + profile_id server-side (ADR-0151 — never from body).
 *   3. Fails fast on missing identity per L-0177.
 *   4. Constructs AgentToolContext and calls updateSessionTask.execute().
 *   5. On success emits oppgaver.task_re_timed (DnD surface audit — distinct
 *      from task.session_task_updated which the tool emits internally).
 *
 * Emit note: the capability tool already emits task.session_task_updated.
 * This action additionally emits oppgaver.task_re_timed — a SURFACE-level event
 * for the oppgaver Gantt (posthog analytics + activity_trail). Two events,
 * different semantic level — not a double-emit of the same mutation.
 * Per ADR-0134 §single-emitter: each emitter owns a distinct event name.
 *
 * References: ADR-0099, ADR-0134, ADR-0151, ADR-0298, L-0177, L-0340.
 */

import { z } from "zod";
import { createAdminClient } from "@smartout/supabase/admin";
import { emit, nonEmpty } from "@smartout/telemetry";
import { updateSessionTask } from "@smartout/ai/capabilities/task/tools";
import type { NonEmptyString } from "@smartout/telemetry/server";
import { resolveCurrentProfile } from "./_shared";

// ─── Input schema ─────────────────────────────────────────────────────────────

const UUIDRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const InputSchema = z.object({
  /** UUID of the session_task being re-timed or re-assigned. */
  task_id: z.string().regex(UUIDRegex, "Ugyldig task UUID"),
  /** New ISO-8601 datetime for scheduled_at. */
  scheduled_at: z.string().datetime({ message: "Expected ISO-8601 datetime" }),
  /** New assignee profile UUID, or null to unassign. */
  assignee_profile_id: z.string().regex(UUIDRegex).nullable(),
  /**
   * Previous scheduled_at — passed for telemetry only; NOT sent to the
   * capability tool. Null when the task had no prior schedule.
   */
  fromIso: z.string().nullable(),
  /**
   * Previous assignee profile_id — passed for telemetry only; NOT sent to
   * the capability tool. Null when task was previously unassigned.
   */
  fromAssignee: z.string().nullable(),
});

export type UpdateTaskScheduledAtInput = z.infer<typeof InputSchema>;
export type UpdateTaskScheduledAtResult = { ok: true } | { ok: false; reason: string };

// ─── Server Action ────────────────────────────────────────────────────────────

export async function updateTaskScheduledAtAction(
  input: UpdateTaskScheduledAtInput,
): Promise<UpdateTaskScheduledAtResult> {
  // 1. Validate input.
  const parsed = InputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, reason: parsed.error.issues[0]?.message ?? "Ugyldig input." };
  }

  // 2. Resolve workspace + profile server-side (ADR-0151).
  const profile = await resolveCurrentProfile();

  // 3. L-0177 fail-fast: if identity missing, bail before any DB call.
  if (!profile?.workspaceId || !profile.workspaceId.trim()) {
    return { ok: false, reason: "Mangler workspace-kontekst." };
  }
  if (!profile?.profileId || !profile.profileId.trim()) {
    return { ok: false, reason: "Ikke autentisert." };
  }

  // 4. Build AgentToolContext and delegate to capability tool.
  const supabaseAdmin = createAdminClient();
  const ctx = {
    workspaceId: profile.workspaceId as NonEmptyString,
    profileId: profile.profileId as NonEmptyString,
    sessionId: "server-action-dnd",
    channel: "chat" as const,
    supabaseAdmin,
  };

  let raw: string;
  try {
    raw = await updateSessionTask.execute(
      {
        task_id: parsed.data.task_id,
        scheduled_at: parsed.data.scheduled_at,
        assignee_profile_id: parsed.data.assignee_profile_id ?? undefined,
        reason: "Dag-planen DnD re-timing (Wave 1 Phase A)",
        actor_capability: "day-line",
        delegated_via: "day-line-dnd",
      },
      ctx,
    );
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? err.message : "Ukjent feil fra oppgavemotor.",
    };
  }

  // 5. Parse tool result.
  let toolResult: { ok?: boolean; error?: string } = {};
  try {
    toolResult = JSON.parse(raw) as { ok?: boolean; error?: string };
  } catch {
    return { ok: false, reason: "Uventet svar fra oppgavemotor." };
  }

  if (toolResult.ok === false) {
    return { ok: false, reason: toolResult.error ?? "ikke_tillatt" };
  }

  // 6. Surface-level telemetry: oppgaver.task_re_timed (ADR-0134 / L-0340).
  // nonEmpty() guards ensure no empty-string corruption in activity_trail.
  await emit({
    event: "oppgaver.task_re_timed",
    workspace_id: nonEmpty(profile.workspaceId, "workspace_id"),
    actor_id: nonEmpty(profile.profileId, "actor_id"),
    properties: {
      data: {
        task_id: parsed.data.task_id,
        from_iso: parsed.data.fromIso ?? "",
        to_iso: parsed.data.scheduled_at,
        from_assignee: parsed.data.fromAssignee,
        to_assignee: parsed.data.assignee_profile_id,
      },
    },
  });

  return { ok: true };
}
