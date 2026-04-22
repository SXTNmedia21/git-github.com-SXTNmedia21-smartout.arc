"use server";

import { z } from "zod";
import { createAdminClient } from "@smartout/supabase/admin";
import { emit } from "@smartout/telemetry";
import { resolveCurrentProfile, gateAction } from "./_shared";

/**
 * openSessionAction — create a `department_session` row for (department, date).
 *
 * Gated via `gate_action` on capability `session.open`. Idempotent — if a row
 * already exists for the (department_id, session_date) pair, returns the existing
 * id without re-inserting or re-emitting.
 *
 * Supports retroactive creation — admin may open a session for a past date when
 * the day was previously unattended (Invariant #13: no blockers, always navigable).
 */
const InputSchema = z.object({
  departmentId: z.string().uuid(),
  dateISO: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  /**
   * If true, mark session as `active` immediately (admin manually opening).
   * If false (default), session is created in `upcoming` status — let the
   * cascade lifecycle progress it naturally.
   */
  activateNow: z.boolean().default(false),
});

export type OpenSessionInput = z.infer<typeof InputSchema>;
export type OpenSessionResult =
  | { ok: true; sessionId: string; created: boolean }
  | { ok: false; error: string };

export async function openSessionAction(input: OpenSessionInput): Promise<OpenSessionResult> {
  const parsed = InputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Ugyldig input.",
    };
  }

  const profile = await resolveCurrentProfile();
  if (!profile) return { ok: false, error: "Ikke autentisert." };

  const admin = createAdminClient();

  // Verify department belongs to actor's workspace
  const { data: dept } = await admin
    .from("department")
    .select("workspace_id")
    .eq("department_id", parsed.data.departmentId)
    .single();
  if (!dept || dept.workspace_id !== profile.workspaceId) {
    return { ok: false, error: "Avdeling hører til annet workspace." };
  }

  const gate = await gateAction({
    workspaceId: profile.workspaceId,
    capability: "session.open",
    channel: "chat",
    actorProfileId: profile.profileId,
    actionType: "create",
    entityId: parsed.data.departmentId,
  });
  if (!gate.allow) {
    return { ok: false, error: gate.reason ?? "Ikke autorisert." };
  }

  // Idempotency — return existing if (dept, date) already has a session
  const { data: existing } = await admin
    .from("department_session")
    .select("department_session_id, status")
    .eq("department_id", parsed.data.departmentId)
    .eq("session_date", parsed.data.dateISO)
    .maybeSingle();

  if (existing) {
    return {
      ok: true,
      sessionId: existing.department_session_id,
      created: false,
    };
  }

  // Insert new session
  const status = parsed.data.activateNow ? "active" : "upcoming";
  const nowIso = new Date().toISOString();
  const { data: created, error: insertError } = await admin
    .from("department_session")
    .insert({
      workspace_id: profile.workspaceId,
      department_id: parsed.data.departmentId,
      session_date: parsed.data.dateISO,
      status,
      opened_by: parsed.data.activateNow ? profile.profileId : null,
      opened_at: parsed.data.activateNow ? nowIso : null,
    })
    .select("department_session_id")
    .single();

  if (insertError || !created) {
    return {
      ok: false,
      error: insertError?.message ?? "Kunne ikke opprette session.",
    };
  }

  await emit({
    event: "session opened",
    workspace_id: profile.workspaceId,
    actor_id: profile.profileId,
    properties: {
      entity: {
        entity_type: "department_session",
        entity_id: created.department_session_id,
      },
      data: {
        department_id: parsed.data.departmentId,
        date: parsed.data.dateISO,
        department_session_id: created.department_session_id,
        to_status: status,
        manual: true,
      },
    },
  });

  return {
    ok: true,
    sessionId: created.department_session_id,
    created: true,
  };
}
