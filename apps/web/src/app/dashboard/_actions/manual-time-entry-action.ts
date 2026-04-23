"use server";

import { z } from "zod";
import { createAdminClient } from "@smartout/supabase/admin";
import { emit, nonEmpty } from "@smartout/telemetry";
import { resolveCurrentProfile, gateAction } from "./_shared";

/**
 * manualTimeEntryAction — admin retroactively records punch-in/out for a shift.
 *
 * Used when an employee forgot to clock in/out. Writes to `timesheet.time_entry`
 * with `source='manual'` and `status='edited'` so downstream derivations know
 * the entry was not produced by the punch-clock flow. The `reason` field
 * (min 8 chars) lands in `notes` for audit reconstruction.
 *
 * Gated via `gate_action` on capability `shift.manual_time_entry` (admin-only
 * per the authority seed).
 *
 * Idempotency: if a `time_entry` already exists for `shift_id`, we UPDATE it
 * (no true unique constraint on shift_id — emulate upsert at the application
 * layer). Otherwise INSERT. One row per shift is the documented pattern
 * (20260324090000_timesheet_schema.sql).
 */
const InputSchema = z.object({
  shiftId: z.string().uuid(),
  punchedInAt: z.string().datetime(),
  punchedOutAt: z.string().datetime().nullable(),
  reason: z.string().min(8, "Begrunnelse må være minst 8 tegn."),
});

export type ManualTimeEntryInput = z.infer<typeof InputSchema>;
export type ManualTimeEntryResult = { ok: true } | { ok: false; error: string };

export async function manualTimeEntryAction(
  input: ManualTimeEntryInput,
): Promise<ManualTimeEntryResult> {
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

  const { data: shift } = await admin
    .from("schedule_shift")
    .select("workspace_id, employee_id, schedule_shift_id")
    .eq("schedule_shift_id", parsed.data.shiftId)
    .single();
  if (!shift || shift.workspace_id !== profile.workspaceId) {
    return { ok: false, error: "Vakt ikke funnet eller annet workspace." };
  }
  if (!shift.employee_id) {
    return {
      ok: false,
      error: "Vakten har ingen tilknyttet ansatt — kan ikke skrive tidsregistrering.",
    };
  }

  const gate = await gateAction({
    workspaceId: profile.workspaceId,
    capability: "shift.manual_time_entry",
    channel: "chat",
    actorProfileId: profile.profileId,
    actionType: "create",
    entityId: parsed.data.shiftId,
  });
  if (!gate.allow) {
    return { ok: false, error: gate.reason ?? "Ikke autorisert." };
  }

  const timesheet = admin.schema("timesheet");

  // Emulate upsert-on-shift_id (no DB-level UNIQUE). Find existing row first.
  const { data: existing, error: selectError } = await timesheet
    .from("time_entry")
    .select("time_entry_id")
    .eq("shift_id", parsed.data.shiftId)
    .limit(1)
    .maybeSingle();
  if (selectError) return { ok: false, error: selectError.message };

  const status = parsed.data.punchedOutAt ? "completed" : "clocked_in";

  let timeEntryId: string | null = existing?.time_entry_id ?? null;

  if (existing) {
    const { error: updateError } = await timesheet
      .from("time_entry")
      .update({
        punch_in: parsed.data.punchedInAt,
        punch_out: parsed.data.punchedOutAt,
        source: "manual",
        status: "edited",
        notes: parsed.data.reason,
      })
      .eq("time_entry_id", existing.time_entry_id);
    if (updateError) return { ok: false, error: updateError.message };
  } else {
    const { data: inserted, error: insertError } = await timesheet
      .from("time_entry")
      .insert({
        shift_id: parsed.data.shiftId,
        profile_id: shift.employee_id,
        workspace_id: profile.workspaceId,
        punch_in: parsed.data.punchedInAt,
        punch_out: parsed.data.punchedOutAt,
        source: "manual",
        status,
        notes: parsed.data.reason,
      })
      .select("time_entry_id")
      .single();
    if (insertError || !inserted) {
      return {
        ok: false,
        error: insertError?.message ?? "Kunne ikke skrive tidsregistrering.",
      };
    }
    timeEntryId = inserted.time_entry_id;
  }

  await emit({
    event: "shift punched_in",
    workspace_id: nonEmpty(shift.workspace_id, "workspace_id"),
    actor_id: nonEmpty(profile.profileId, "actor_id"),
    properties: {
      entity_type: "shift",
      entity_id: parsed.data.shiftId,
      data: {
        shift_id: parsed.data.shiftId,
        time_entry_id: timeEntryId ?? "",
        punch_time: parsed.data.punchedInAt,
        is_adhoc: false,
        gps_verified: false,
        gps_distance_meters: null,
        manual: true,
        reason: parsed.data.reason,
      },
    },
  });

  return { ok: true };
}
