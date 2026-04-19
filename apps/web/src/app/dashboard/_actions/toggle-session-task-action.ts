"use server";

import { z } from "zod";
import { createClient } from "@smartout/supabase/server";
import { emit } from "@smartout/telemetry";
import { revalidatePath } from "next/cache";
import { resolveCurrentProfile } from "./_shared";

const ToggleSchema = z.object({
  taskId: z.string().uuid(),
  done: z.boolean(),
  evidence: z
    .object({
      photos: z.array(z.string()).optional(),
    })
    .optional(),
});

export type ToggleSessionTaskInput = z.infer<typeof ToggleSchema>;
export type ToggleSessionTaskResult =
  | { ok: true; status: "completed" | "pending" }
  | { ok: false; error: string };

/**
 * Server Action for session_task completion toggle in WebDayControl Oppgaver.
 *
 * Unlike the `operations.complete_task` agent tool (packages/ai/src/capabilities/
 * operations/tools.ts:254) which bypasses the emit() registry and inserts
 * directly into engine_event, this Server Action uses the registry-path so
 * the event fans out to all 4 destinations (PostHog, logger, activity_trail,
 * engine_event). Per ADR-0156 + L-0064.
 */
export async function toggleSessionTaskAction(
  input: ToggleSessionTaskInput,
): Promise<ToggleSessionTaskResult> {
  const parsed = ToggleSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid input." };
  }

  const profile = await resolveCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated." };

  const supabase = await createClient();

  // Load the task so we can enrich telemetry + respect RLS
  const { data: task, error: loadErr } = await supabase
    .from("session_task")
    .select("id, workspace_id, department_session_id, title, status, assigned_to, evidence")
    .eq("id", parsed.data.taskId)
    .maybeSingle();

  if (loadErr || !task) {
    return { ok: false, error: "Oppgaven finnes ikke." };
  }
  if (task.workspace_id !== profile.workspaceId) {
    return { ok: false, error: "Arbeidsrom-mismatch." };
  }

  const nowIso = new Date().toISOString();
  const nextStatus = parsed.data.done ? ("completed" as const) : ("pending" as const);

  const mergedEvidence =
    parsed.data.evidence && parsed.data.done
      ? { ...((task.evidence as Record<string, unknown>) ?? {}), ...parsed.data.evidence }
      : task.evidence;

  const { error: updateErr } = await supabase
    .from("session_task")
    .update({
      status: nextStatus,
      completed_at: parsed.data.done ? nowIso : null,
      completed_by: parsed.data.done ? profile.profileId : null,
      evidence: mergedEvidence,
      updated_at: nowIso,
    })
    .eq("id", task.id);

  if (updateErr) return { ok: false, error: updateErr.message };

  // Emit via registry (NOT direct engine_event insert — that's the bypass
  // pattern from operations/tools.ts:254 that we explicitly avoid).
  // session task_completed fires only on done=true; un-check doesn't emit.
  if (parsed.data.done) {
    await emit({
      event: "session task_completed",
      workspace_id: profile.workspaceId,
      actor_id: profile.profileId,
      properties: {
        data: {
          task_id: task.id,
          profile_id: profile.profileId,
        },
      },
    });
  }

  revalidatePath("/dashboard");
  return { ok: true, status: nextStatus };
}
