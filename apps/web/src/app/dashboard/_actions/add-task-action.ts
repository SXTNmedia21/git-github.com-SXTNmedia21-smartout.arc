"use server";

import { z } from "zod";
import { createAdminClient } from "@smartout/supabase/admin";
import { emit, nonEmpty } from "@smartout/telemetry";
import { resolveCurrentProfile, gateAction } from "./_shared";

/**
 * addTaskAction — admin adds an ad-hoc session_task from the WebDayControl
 * Oppgaver tab (Item 2 of campaign/daily-operation closure).
 *
 * Mirrors `manualTimeEntryAction` (shift.manual_time_entry capability seed):
 *   - `gate_action('task.add_task_manual')` with channel='chat'
 *   - `reason` min 8 chars, carried in telemetry + activity_trail
 *   - `session_task` has NO `source_type` column (database.types.ts:15368),
 *     so the manual origin is carried via `emit('task.added_manual')` with
 *     `manual=true` metadata. Activity_trail is registered as a destination
 *     in packages/telemetry/src/registry.ts:"task.added_manual".
 *
 * Session hook attachment: `session_hook_id` is nullable on session_task
 * (database.types.ts:15395). If the caller does not supply `hookId`, we
 * insert with `session_hook_id=null` — `useSessionHooksWithTasks` already
 * displays these under the "Andre oppgaver" null bucket (Phase 1 decision:
 * no ad-hoc hook creation, per plan fallback).
 *
 * Dual-auth extension (ADR-0266 §B2/B3): when `actor` is supplied the
 * cookie-based `resolveCurrentProfile()` call is skipped. The BFF
 * (`/api/mobile/tasks`) resolves identity server-side from the Bearer JWT
 * and passes `actor` directly — so the profile_id is never forgeable from
 * the request body (ADR-0151). Existing cookie callers are unaffected.
 */

/**
 * Server-derived actor identity supplied by the BFF when the caller is the
 * mobile surface. Mirrors the shape returned by `resolveCurrentProfile()`.
 */
export type ResolvedActor = {
  profileId: string;
  workspaceId: string;
  role: string | null;
};

const InputSchema = z.object({
  sessionId: z.string().uuid(),
  title: z.string().trim().min(1, "Tittel er påkrevd.").max(200, "Tittel for lang."),
  ownerProfileId: z.string().uuid().optional().nullable(),
  hookId: z.string().uuid().optional().nullable(),
  isComplianceRequired: z.boolean().default(false),
  reason: z.string().trim().min(8, "Begrunnelse må være minst 8 tegn."),
});

export type AddTaskInput = z.infer<typeof InputSchema>;
export type AddTaskResult = { ok: true; taskId: string } | { ok: false; error: string };

export async function addTaskAction(
  input: AddTaskInput,
  actor?: ResolvedActor,
  channel: "chat" | "system" = "chat",
): Promise<AddTaskResult> {
  const parsed = InputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Ugyldig input.",
    };
  }

  // When the BFF supplies a pre-resolved actor (mobile path), skip the cookie
  // lookup entirely — the JWT was already validated by the BFF (ADR-0151).
  const profile: ResolvedActor | null = actor ?? (await resolveCurrentProfile());
  if (!profile) return { ok: false, error: "Ikke autentisert." };

  const admin = createAdminClient();

  // 1) Load the session and verify workspace match — never trust a client
  //    sessionId to map to the caller's workspace (ADR-0151 server-side
  //    re-derivation).
  const { data: session } = await admin
    .from("department_session")
    .select("department_session_id, workspace_id, department_id")
    .eq("department_session_id", parsed.data.sessionId)
    .maybeSingle();

  if (!session || session.workspace_id !== profile.workspaceId) {
    return { ok: false, error: "Dagen finnes ikke eller annet arbeidsrom." };
  }

  // 2) Validate optional hookId: must belong to same workspace AND same
  //    department as the session (session_hook is a department-level
  //    template — ADR-0156 §3).
  if (parsed.data.hookId) {
    const { data: hook } = await admin
      .from("session_hook")
      .select("id, workspace_id, department_id")
      .eq("id", parsed.data.hookId)
      .maybeSingle();
    if (
      !hook ||
      hook.workspace_id !== profile.workspaceId ||
      hook.department_id !== session.department_id
    ) {
      return { ok: false, error: "Valgt hook tilhører ikke denne avdelingen." };
    }
  }

  // 3) Validate optional ownerProfileId: must be in same workspace.
  if (parsed.data.ownerProfileId) {
    const { data: owner } = await admin
      .from("profile")
      .select("profile_id, workspace_id")
      .eq("profile_id", parsed.data.ownerProfileId)
      .maybeSingle();
    if (!owner || owner.workspace_id !== profile.workspaceId) {
      return { ok: false, error: "Valgt ansvarlig finnes ikke i arbeidsrommet." };
    }
  }

  // 4) C4 authority gate. Per _shared.gateAction contract, default-allow
  //    applies if no engine_authority_config row exists — the seed
  //    migration that accompanies this Server Action establishes the
  //    'suggest' floor (see 20260517*_closure_authority_seed_task.sql).
  /* @authority-gate: capability='task.add_task_manual' level='suggest' seed='20260517*_closure_authority_seed_task.sql' */
  const gate = await gateAction({
    workspaceId: profile.workspaceId,
    capability: "task.add_task_manual",
    channel,
    actorProfileId: profile.profileId,
    actionType: "create",
    entityId: session.department_session_id,
  });
  if (!gate.allow) {
    return { ok: false, error: gate.reason ?? "Ikke autorisert." };
  }

  // 5) Insert the task. session_task has no `source_type` column —
  //    manual origin is carried by the telemetry event below.
  const { data: inserted, error: insertError } = await admin
    .from("session_task")
    .insert({
      workspace_id: profile.workspaceId,
      department_session_id: session.department_session_id,
      session_hook_id: parsed.data.hookId ?? null,
      assigned_to: parsed.data.ownerProfileId ?? null,
      title: parsed.data.title,
      description: null,
      is_compliance_required: parsed.data.isComplianceRequired,
      status: "pending",
    })
    .select("id")
    .single();

  if (insertError || !inserted) {
    return {
      ok: false,
      error: insertError?.message ?? "Kunne ikke lagre oppgaven.",
    };
  }

  // 6) Emit via registry — fans out to PostHog, logger, activity_trail,
  //    engine_event per the destinations map in
  //    packages/telemetry/src/registry.ts:"task.added_manual".
  await emit({
    event: "task.added_manual",
    workspace_id: nonEmpty(profile.workspaceId, "workspace_id"),
    actor_id: nonEmpty(profile.profileId, "actor_id"),
    properties: {
      entity: {
        entity_type: "session_task",
        entity_id: inserted.id,
        entity_label: parsed.data.title,
      },
      metadata: {
        source: channel === "system" ? "mobile_addsheet" : "web_day_control_tasks_tab",
        department_session_id: session.department_session_id,
        session_hook_id: parsed.data.hookId ?? null,
        assigned_to: parsed.data.ownerProfileId ?? null,
        is_compliance_required: parsed.data.isComplianceRequired,
        reason: parsed.data.reason,
        manual: true,
      },
    },
  });

  return { ok: true, taskId: inserted.id };
}
