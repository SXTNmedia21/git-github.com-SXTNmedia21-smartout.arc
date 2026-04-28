"use server";

import { z } from "zod";
import { createAdminClient } from "@smartout/supabase/admin";
import { emit, nonEmpty } from "@smartout/telemetry";
import { resolveCurrentProfile, gateAction } from "./_shared";
import { toWorkspaceDateTimeParts } from "../_lib/cockpit/date-anchor";

/**
 * Matches `schedule_shift_is_temporally_locked` (PL/pgSQL) fallback
 * contract — when `workspace.timezone` is NULL or empty string, operate
 * on `Europe/Oslo`. Hospitality Riksavtalen tariff rules (kveldstillegg
 * 21:00-06:00, helgetillegg lør 15:00 – søn 24:00) only make sense in
 * Oslo wall-clock.
 */
const FALLBACK_TIMEZONE = "Europe/Oslo";

/**
 * addShiftAction — admin manually inserts a planned/ad-hoc shift for an employee.
 *
 * Invariant #13 (campaign/daily-operation): empty states are CTAs, not
 * dead-ends. RosterTab previously rendered a text cross-link to
 * `/dashboard/schedule` when no shifts existed — this action backs the
 * in-place "Legg til vakt" CTA that replaces that dead-end.
 *
 * Writes to `schedule_shift` with `source='manual_admin'` so the engine
 * and settlement pipeline can distinguish admin-created shifts from
 * bulk/auto-filled roster output. The `reason` field (min 8 chars)
 * lands in `notes` for audit reconstruction — same contract as
 * `manualTimeEntryAction`.
 *
 * Gated via `gate_action()` on capability `roster.add_shift_manual`
 * (ADR-0099 unified authority gate). The migration
 * `20260517100000_seed_roster_add_shift_authority.sql` seeds the row
 * with `level='confirm'` and `min_role='manager'`, so default-allow
 * (L-0107) cannot leak.
 *
 * Emits `shift added_manual` (see packages/telemetry/src/registry.ts)
 * with `manual: true` + `reason` in `data`, landing in
 * `activity_trail.data` via the telemetry engine's activity_trail
 * provider. No direct `activity_trail.insert()` or `engine_event.insert()`
 * — all four destinations (posthog/logger/activity_trail/engine_event)
 * flow through `emit()`.
 */
const InputSchema = z
  .object({
    departmentSessionId: z.string().uuid().nullable(),
    profileId: z.string().uuid(),
    startAtISO: z.string().datetime(),
    endAtISO: z.string().datetime(),
    role: z.string().min(1, "Rolle er påkrevd."),
    reason: z.string().min(8, "Begrunnelse må være minst 8 tegn."),
    /**
     * Set by AddShiftDialog (Sortie 3) when the selected profile is
     * `unavailable` / `absent` on the shift date. Carries the resolved
     * status + underlying availability-rule reason as a short
     * `key=value; key=value` string. Folded into
     * `activity_trail.data.override_reason` via `emit()` below so the
     * audit trail reconstructs WHO overrode WHAT availability signal
     * WHEN. No direct `activity_trail.insert()` (ADR-0175 — all four
     * destinations flow through the telemetry emit).
     */
    overrideReason: z.string().min(1).optional(),
  })
  .refine((v) => new Date(v.endAtISO).getTime() > new Date(v.startAtISO).getTime(), {
    message: "Slutt-tid må være etter start-tid.",
    path: ["endAtISO"],
  });

export type AddShiftInput = z.infer<typeof InputSchema>;
export type AddShiftResult = { ok: true; shiftId: string } | { ok: false; error: string };

type DayCategory = "morning" | "midday" | "afternoon" | "evening" | "night" | "weekend";

/**
 * Mirrors `use-employee-roster.ts` day-category derivation: start-hour
 * bucket with weekend override. Keeping derivation server-side avoids
 * a client/server drift in tariff treatment (cascade D3).
 *
 * Both weekday AND hour MUST resolve in the SAME workspace timezone
 * as the `shift_date` / `start_time` columns that hospitality.ts
 * tariff-calc later reads. If weekday/hour used the server process tz
 * (UTC on Vercel) while `shift_date` used workspace tz, a 23:30 Oslo
 * shift on fredag could land in `day_category='weekend'` (UTC Saturday
 * 22:30 on summer DST) while `shift_date=fredag` — which silently
 * double-counts helgetillegg. Workspace tz on both sides is the only
 * stable invariant.
 */
function deriveDayCategory(startAtISO: string, timezone: string): DayCategory {
  const { weekday, hour } = toWorkspaceDateTimeParts(startAtISO, timezone);
  if (weekday === 0 || weekday === 6) return "weekend";
  if (hour >= 22 || hour < 5) return "night";
  if (hour >= 16) return "evening";
  if (hour >= 14) return "afternoon";
  if (hour >= 11) return "midday";
  return "morning";
}

/**
 * `schedule_shift` stores start/end as `time` columns and `shift_date`
 * as a DATE. Convert UTC ISO → workspace-local HH:MM:SS + YYYY-MM-DD
 * at the workspace's timezone boundary. The wizard's
 * `<input type="datetime-local">` + `localToISO` pair does
 * local → UTC at submit; this undoes that hop in the workspace tz so
 * the DATE/TIME columns align with the PL/pgSQL `schedule_shift_is_
 * temporally_locked()` fallback contract (Europe/Oslo on NULL tz).
 *
 * Truncates seconds to :00 to preserve the prior contract — the
 * wizard input is minute-precision anyway.
 */
function toTimeParts(iso: string, timezone: string): { date: string; time: string } {
  const { date, time } = toWorkspaceDateTimeParts(iso, timezone);
  // Preserve the pre-existing ":00" seconds contract — wizard is minute-precision.
  const [hh, mm] = time.split(":");
  return { date, time: `${hh}:${mm}:00` };
}

function hoursBetween(startISO: string, endISO: string): number {
  const ms = new Date(endISO).getTime() - new Date(startISO).getTime();
  return Math.round((ms / 3_600_000) * 100) / 100;
}

export async function addShiftAction(input: AddShiftInput): Promise<AddShiftResult> {
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

  // Cross-workspace guard: the selected employee must belong to the
  // same workspace as the admin. Mirrors the manual-time-entry check.
  const { data: employee } = await admin
    .from("profile")
    .select("profile_id, workspace_id")
    .eq("profile_id", parsed.data.profileId)
    .maybeSingle();
  if (!employee || employee.workspace_id !== profile.workspaceId) {
    return { ok: false, error: "Ansatt ikke funnet eller annet workspace." };
  }

  // Workspace tz drives day_category + shift_date/start_time derivation.
  // Fetched server-side (never trusted from client) so tariff treatment
  // aligns with the `schedule_shift_is_temporally_locked()` PL/pgSQL
  // function, which already reads `workspace.timezone` with an
  // Oslo fallback (migration 20260428130000).
  const { data: workspaceRow } = await admin
    .from("workspace")
    .select("timezone")
    .eq("workspace_id", profile.workspaceId)
    .maybeSingle();
  const workspaceTimezone =
    workspaceRow?.timezone && workspaceRow.timezone.trim() !== ""
      ? workspaceRow.timezone
      : FALLBACK_TIMEZONE;

  // Optional department session handle — if supplied, verify it belongs
  // to the same workspace. The current RosterTab has departmentId but
  // not department_session_id in-scope, so this stays nullable.
  let departmentId: string | null = null;
  if (parsed.data.departmentSessionId) {
    const { data: ds } = await admin
      .from("department_session")
      .select("department_session_id, workspace_id, department_id")
      .eq("department_session_id", parsed.data.departmentSessionId)
      .maybeSingle();
    if (!ds || ds.workspace_id !== profile.workspaceId) {
      return { ok: false, error: "Dag-økt ikke funnet eller annet workspace." };
    }
    departmentId = ds.department_id ?? null;
  }

  const gate = await gateAction({
    workspaceId: profile.workspaceId,
    capability: "roster.add_shift_manual",
    channel: "chat",
    actorProfileId: profile.profileId,
    actionType: "create",
    entityId: parsed.data.profileId,
  });
  if (!gate.allow) {
    return { ok: false, error: gate.reason ?? "Ikke autorisert." };
  }

  const { date, time: startTime } = toTimeParts(parsed.data.startAtISO, workspaceTimezone);
  const { time: endTime } = toTimeParts(parsed.data.endAtISO, workspaceTimezone);
  const workHours = hoursBetween(parsed.data.startAtISO, parsed.data.endAtISO);
  const dayCategory = deriveDayCategory(parsed.data.startAtISO, workspaceTimezone);

  const { data: inserted, error: insertError } = await admin
    .from("schedule_shift")
    .insert({
      workspace_id: profile.workspaceId,
      employee_id: parsed.data.profileId,
      department_id: departmentId,
      shift_date: date,
      start_time: startTime,
      end_time: endTime,
      role: parsed.data.role,
      work_hours: workHours,
      breaks: 0,
      day_category: dayCategory,
      status: "created" as const,
      is_published: true,
      indicator: "blue",
      source: "manual_admin",
      notes: parsed.data.reason,
    })
    .select("schedule_shift_id")
    .single();

  if (insertError || !inserted) {
    return {
      ok: false,
      error: insertError?.message ?? "Kunne ikke lagre vakt.",
    };
  }

  const override = parsed.data.overrideReason;
  await emit({
    event: "shift added_manual",
    workspace_id: nonEmpty(profile.workspaceId, "workspace_id"),
    actor_id: nonEmpty(profile.profileId, "actor_id"),
    properties: {
      entity_type: "shift",
      entity_id: inserted.schedule_shift_id,
      data: {
        assigned_to: parsed.data.profileId,
        date,
        start_time: startTime,
        end_time: endTime,
        role: parsed.data.role,
        source: "manual_admin",
        manual: true,
        reason: parsed.data.reason,
        // Availability-override context — present only when the admin
        // assigned a profile flagged `unavailable` / `absent` on the
        // shift date. Lands in `activity_trail.data` via the telemetry
        // engine's activity_trail destination (ADR-0175 — four
        // destinations, one emit).
        ...(override ? { override: true, override_reason: override } : {}),
      },
    },
  });

  return { ok: true, shiftId: inserted.schedule_shift_id };
}
