"use server";

/**
 * update-department-session-action.ts — Server Action for the duty-leader
 * dropdown in the day-control OversiktTab widget.
 *
 * WHY: `OversiktTab.tsx:257` previously called
 *   await supabase
 *     .from("department_session")
 *     .update({ duty_leader_id: leaderId })
 *     .eq("department_session_id", activeSession.department_session_id);
 * directly from a React `<select onChange>` closure. ADR-0156 forbids
 * day-control widgets from owning Supabase access; ADR-0204 captures the
 * gated-mutation backlog. Closed by this module per audit 2026-05-13
 * F-SC-04-13.
 *
 * The action:
 *   1. Re-derives actor identity server-side (ADR-0151) — never trust
 *      profile_id or workspace_id from the body.
 *   2. Loads the department_session row and fails-fast on missing /
 *      wrong-workspace (L-0177).
 *   3. Gates via gate_action(capability='session.update_duty_leader')
 *      seeded in 20260610100000_seed_day_control_action_authority.sql.
 *   4. UPDATEs duty_leader_id (admin client — RLS bypassed because we
 *      gated above, same pattern as report-deviation-action.ts).
 *   5. Emits the registry event `session duty_leader_updated` carrying
 *      previous + new duty_leader_id for downstream attribution.
 *
 * If duty_leader_profile_id is null the session moves to "no assigned
 * duty leader" — valid steady-state per the OversiktTab dropdown's
 * "Ingen" option.
 *
 * Idempotent: if previous_duty_leader_id == new_duty_leader_id, returns
 * ok=true without the UPDATE or emit (prevents phantom-emit L-0094 spirit).
 *
 * ADR refs: 0099, 0114, 0134, 0151, 0156, 0189, 0204.
 */

import { z } from "zod";
import { createAdminClient } from "@smartout/supabase/admin";
import { emit, nonEmpty } from "@smartout/telemetry";

import { resolveCurrentProfile, gateAction } from "./_shared";

// ── Input schema ──────────────────────────────────────────────────────────────

const InputSchema = z.object({
  department_session_id: z.string().uuid(),
  // null = "Ingen" — clear the duty leader. Empty string normalised to null
  // at the caller; the schema rejects empty string to surface call-site bugs.
  duty_leader_profile_id: z.string().uuid().nullable(),
  channel: z.enum(["chat", "voice", "system"]).optional().default("chat"),
});

// z.input (not z.infer) so callers can omit `channel` — schema defaults to "chat".
export type UpdateDepartmentSessionDutyLeaderInput = z.input<typeof InputSchema>;
export type UpdateDepartmentSessionDutyLeaderResult =
  | {
      ok: true;
      department_session_id: string;
      duty_leader_profile_id: string | null;
      changed: boolean;
    }
  | { ok: false; error: string };

export async function updateDepartmentSessionDutyLeaderAction(
  input: UpdateDepartmentSessionDutyLeaderInput,
): Promise<UpdateDepartmentSessionDutyLeaderResult> {
  const parsed = InputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Ugyldig input." };
  }

  const profile = await resolveCurrentProfile();
  if (!profile) return { ok: false, error: "Ikke autentisert." };

  const admin = createAdminClient();

  // 1. Load session — fail-fast on missing / wrong workspace (L-0177).
  const { data: row, error: loadError } = await admin
    .from("department_session")
    .select(
      "department_session_id, workspace_id, department_id, session_date, duty_leader_id, status",
    )
    .eq("department_session_id", parsed.data.department_session_id)
    .maybeSingle();

  if (loadError) {
    return { ok: false, error: `Kunne ikke laste session: ${loadError.message}` };
  }
  if (!row) {
    return { ok: false, error: "Session finnes ikke." };
  }
  if (row.workspace_id !== profile.workspaceId) {
    return { ok: false, error: "Session tilhører et annet arbeidsrom." };
  }

  const previousDutyLeaderId = row.duty_leader_id;
  const newDutyLeaderId = parsed.data.duty_leader_profile_id;

  // Idempotency — no change, no UPDATE, no emit.
  if (previousDutyLeaderId === newDutyLeaderId) {
    return {
      ok: true,
      department_session_id: row.department_session_id,
      duty_leader_profile_id: newDutyLeaderId,
      changed: false,
    };
  }

  // 2. Gate
  /* @authority-gate: capability='session.update_duty_leader' level='confirm' seed='20260610100000_seed_day_control_action_authority.sql' */
  const gate = await gateAction({
    workspaceId: profile.workspaceId,
    capability: "session.update_duty_leader",
    channel: parsed.data.channel,
    actorProfileId: profile.profileId,
    actionType: "update",
    entityId: row.department_session_id,
  });
  if (!gate.allow) {
    return { ok: false, error: gate.reason ?? "Ikke autorisert." };
  }

  // 3. Update
  const { error: updateError } = await admin
    .from("department_session")
    .update({ duty_leader_id: newDutyLeaderId })
    .eq("department_session_id", row.department_session_id);

  if (updateError) {
    return { ok: false, error: `Kunne ikke oppdatere vaktleder: ${updateError.message}` };
  }

  // 4. Emit
  await emit({
    event: "session duty_leader_updated",
    workspace_id: nonEmpty(profile.workspaceId, "workspace_id"),
    actor_id: nonEmpty(profile.profileId, "actor_id"),
    properties: {
      entity: {
        entity_type: "department_session",
        entity_id: row.department_session_id,
      },
      data: {
        department_session_id: row.department_session_id,
        department_id: row.department_id,
        session_date: row.session_date,
        previous_duty_leader_id: previousDutyLeaderId,
        new_duty_leader_id: newDutyLeaderId,
      },
    },
  });

  return {
    ok: true,
    department_session_id: row.department_session_id,
    duty_leader_profile_id: newDutyLeaderId,
    changed: true,
  };
}
