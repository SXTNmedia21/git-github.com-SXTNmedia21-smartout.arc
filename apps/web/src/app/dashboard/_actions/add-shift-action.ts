"use server";

import { z } from "zod";
import { createAdminClient } from "@smartout/supabase/admin";
import { emit, nonEmpty } from "@smartout/telemetry";
import { resolveCurrentProfile, gateAction } from "./_shared";
import { mutateWithGate, MutateWithGateDenied } from "@smartout/ai/gate/mutate-with-gate";
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
 *
 * @param input - Validated shift fields. `channel` controls the authority gate
 *   signal (default "chat" for web callers; "system" for BFF callers per
 *   ADR-0078). Do NOT pass from untrusted client input — the BFF pins it.
 *
 * @param actor - Optional pre-resolved actor identity. When provided, bypasses
 *   the cookie-based `resolveCurrentProfile()` call. MUST be server-derived
 *   (e.g. from a Bearer JWT validated by `admin.auth.getUser()`). BFF routes
 *   use this path (ADR-0151 + ADR-0132). Web call sites omit it and fall back
 *   to cookie-based resolution. Empty-string fields are rejected at the gate.
 */
const InputSchema = z
  .object({
    departmentSessionId: z.string().uuid().nullable(),
    /**
     * Direct department scope. Used when `departmentSessionId` is null —
     * e.g. RosterTab empty-state CTA where no session yet exists for the
     * day. Without this, shifts land with `schedule_shift.department_id
     * IS NULL` and become invisible to `use-roster.ts`'s department-
     * scoped filter. The DB trigger `schedule_shift_derive_department_id`
     * (migration 20260519000001) covers the position-path; this prop
     * covers the session-less manual-add path.
     */
    departmentId: z.string().uuid().optional(),
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
    /**
     * Optional location scope for the shift (Cascade D1).
     * Stored as schedule_shift.location_id — FK to location table.
     * The ensure_shift_session trigger propagates this to shift_session.location_id.
     * Pass undefined to leave location_id NULL (unscoped shift).
     */
    locationId: z.string().uuid().optional(),
    /**
     * Call origin for the authority gate (`gate_action` p_channel parameter).
     *
     * - "chat"   — default. Web AddShiftDialog, RosterTab CTA (cookie-authed).
     * - "system" — BFF caller (`POST /api/mobile/shifts`) on behalf of mobile.
     *              Server-to-server semantic; the mobile user gesture is one
     *              hop removed. Pinned by the BFF, not by the client.
     *
     * Per ADR-0078 the channel signal flows into `engine_authority_config`
     * for future per-channel rule enforcement (e.g. restrict voice callers).
     * Default "chat" ensures all existing web call sites are unaffected.
     *
     * Rule 9 (ADR-0430) + L-0083 sibling: voice excluded at Zod boundary;
     * gate_action RPC does not yet read channel_constraint (deferred enforcement).
     * channel_constraint='chat_only' seed row in engine_authority_config is
     * forensic-only until gate_action PL/pgSQL is amended (future ADR).
     */
    channel: z.enum(["chat", "system"]).default("chat"),
    /**
     * Zone assignments for the shift (ADR-0430 Rule 4 — shift × zone M2N).
     * Each zone_id must belong to the shift's workspace AND the shift's
     * department-area (Rule 7 forgery defense). Server validates all IDs.
     * Mobile BFF always passes [] — no zone authoring on mobile surface
     * (ADR-0133 + MF-F).
     */
    zone_ids: z.array(z.string().uuid()).default([]),
  })
  .refine((v) => new Date(v.endAtISO).getTime() > new Date(v.startAtISO).getTime(), {
    message: "Slutt-tid må være etter start-tid.",
    path: ["endAtISO"],
  });

export type AddShiftInput = z.infer<typeof InputSchema>;
export type AddShiftResult =
  | { ok: true; shiftId: string; warnings?: string[] }
  | { ok: false; error: string };

/**
 * Pre-resolved actor identity for BFF callers (Bearer JWT path).
 * Server MUST validate the JWT via `admin.auth.getUser(bearerToken)` and
 * derive these fields from the authenticated profile row — never accept
 * them from client body (ADR-0151).
 */
export type ResolvedActor = {
  profileId: string;
  workspaceId: string;
  role: string | null;
};

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

export async function addShiftAction(
  input: AddShiftInput,
  actor?: ResolvedActor,
): Promise<AddShiftResult> {
  const parsed = InputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Ugyldig input.",
    };
  }

  // Identity resolution. BFF callers pass a server-derived `actor`
  // (Bearer JWT validated via admin.auth.getUser — ADR-0151). Web callers
  // omit `actor` and fall through to cookie-based resolution. Both paths
  // produce the same shape; no identity field ever comes from client body.
  const profile = actor ?? (await resolveCurrentProfile());
  if (!profile) return { ok: false, error: "Ikke autentisert." };
  // Fail-fast on empty identity — matches ADR-0134 nonEmpty() contract.
  if (!profile.profileId.trim() || !profile.workspaceId.trim()) {
    return { ok: false, error: "Ugyldig aktør-identitet." };
  }

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

  // Resolve department scope. Preference order:
  //   1. departmentSessionId → department_session.department_id (strongest — ties to live session)
  //   2. departmentId        → direct input (RosterTab CTA path)
  // ADR-0430 M1: department_id is NOT NULL on schedule_shift. The trigger-derive
  // path (position_id → department_id) only fires on UPDATE OF position_id, not
  // on INSERT when position_id is NULL. A department must be resolved before insert.
  // Cross-workspace verification runs on whichever path is used.
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
  } else if (parsed.data.departmentId) {
    const { data: dept } = await admin
      .from("department")
      .select("department_id, workspace_id")
      .eq("department_id", parsed.data.departmentId)
      .maybeSingle();
    if (!dept || dept.workspace_id !== profile.workspaceId) {
      return { ok: false, error: "Avdeling ikke funnet eller annet workspace." };
    }
    departmentId = dept.department_id;
  }

  // ADR-0430 M1: department_id is NOT NULL — block if neither resolution path worked.
  if (!departmentId) {
    return {
      ok: false,
      error:
        "Kunne ikke bestemme avdeling for vakten. Angi departmentSessionId eller departmentId.",
    };
  }

  const gate = await gateAction({
    workspaceId: profile.workspaceId,
    capability: "roster.add_shift_manual",
    // Pass through the caller's channel signal (Lovsen S5 fix, ADR-0078).
    // Web callers default to "chat"; BFF passes "system". Never hardcoded.
    channel: parsed.data.channel,
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

  // M1 — pause-validation (Aml. §10-9 informational warning).
  // Shifts over 5.5 hours without a planned break are flagged.
  // `breaks` is a planning hint (number of minutes); 0 = no break planned.
  // This does NOT block the insert — the actual break is recorded at
  // punch-time via time_entry.breaks JSONB. Warning surfaced in BFF response.
  const warnings: string[] = [];
  if (workHours > 5.5) {
    // schedule_shift.breaks is always 0 on manual-admin inserts (no break
    // planning UI yet). Flag unconditionally for any > 5.5h shift so the
    // BFF can surface it to the caller.
    warnings.push("shift_over_5h_no_break_planned");
  }

  // ── Rule 7 forgery defense (ADR-0430) ──────────────────────────────────────
  // Validate all zone_ids belong to this workspace AND this department's area
  // before the gatedMutation write executes. Fail-fast on first invalid zone
  // (L-0177: NO silent fallback to default zone, NO skip-on-null).
  const resolvedZoneLocationPairs: Array<{ zone_id: string; location_id: string }> = [];
  for (const zone_id of parsed.data.zone_ids) {
    // Step 1: verify zone belongs to this workspace (ADR-0151 forgery defense).
    const { data: zoneRow } = await admin
      .from("zone")
      .select("zone_id, location_id")
      .eq("zone_id", zone_id)
      .eq("workspace_id", profile.workspaceId)
      .maybeSingle();
    if (!zoneRow) {
      // L-0177: null = zone not found OR wrong workspace — return explicit error.
      return { ok: false, error: `zone_forgery_workspace: zone ${zone_id} not found in workspace` };
    }

    // Step 2: verify zone's location_id is in department_location for this dept.
    const { data: deptLocRow } = await admin
      .from("department_location")
      .select("location_id")
      .eq("department_id", departmentId!)
      .eq("location_id", zoneRow.location_id)
      .eq("workspace_id", profile.workspaceId)
      .maybeSingle();
    if (!deptLocRow) {
      // L-0177: null = zone's location not linked to this department — explicit error.
      return {
        ok: false,
        error: `zone_forgery_dept_area: zone ${zone_id} location not in department area`,
      };
    }

    resolvedZoneLocationPairs.push({ zone_id, location_id: zoneRow.location_id });
  }

  // ── G4 closure — gatedMutation wraps the INSERT (ADR-0204) ─────────────────
  // Both gateway policies (Pathway A: gate_action + Pathway B: cascade_gate_write)
  // evaluated before the domain write runs. The existing gateAction call above
  // is ALSO retained for the legacy Server Action path (web AddShiftDialog uses
  // gateAction directly); gatedMutation provides the full composition gate for
  // the domain write step.
  let insertedShiftId: string | null = null;
  try {
    const gateResult = await mutateWithGate(admin, {
      workspaceId: profile.workspaceId,
      profileId: profile.profileId,
      capability: "roster.add_shift_manual",
      actionType: "create",
      channel: parsed.data.channel as "chat" | "system",
      targetId: null,
      cascade: {
        entityType: "schedule_shift",
        action: "create",
        proposedData: {
          workspace_id: profile.workspaceId,
          employee_id: parsed.data.profileId,
          department_id: departmentId,
          shift_date: date,
          start_time: startTime,
          end_time: endTime,
          role: parsed.data.role,
        },
      },
      exec: async (client) => {
        // ── INSERT schedule_shift ─────────────────────────────────────────
        const { data: insertedRow, error: insertError } = await client
          .from("schedule_shift")
          .insert({
            workspace_id: profile.workspaceId,
            employee_id: parsed.data.profileId,
            department_id: departmentId!, // guarded: null check above returns early
            // Cascade D1: location scope — nullable, set when provided by the dialog.
            // The ensure_shift_session trigger propagates this to shift_session.location_id.
            ...(parsed.data.locationId ? { location_id: parsed.data.locationId } : {}),
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
            // ADR-0108 provenance discriminator — row-level value is constrained to
            // operational | bubble_migration | v3_engine. A manually-created admin
            // shift is operational. The "manual_admin" audit provenance is recorded
            // on the telemetry emit below (→ activity_trail), not on the row.
            source: "operational",
            notes: parsed.data.reason,
          })
          .select("schedule_shift_id")
          .single();

        if (insertError || !insertedRow) {
          return { ok: false, reason: insertError?.message ?? "schedule_shift insert failed" };
        }

        const newShiftId = insertedRow.schedule_shift_id;

        // ── INSERT shift_zone rows (ADR-0430 Rule 4) ──────────────────────
        // Requires shift_session + shift_session_day_line rows created by the
        // ensure_shift_session trigger (migration 20260620130000). The trigger
        // fires AFTER INSERT on schedule_shift — we query them here.
        // If no zone_ids were requested, skip this block (empty shift is valid).
        if (resolvedZoneLocationPairs.length > 0) {
          // Fetch shift_session created by the trigger (may not exist if
          // employee_id/location_id/department_session conditions not met).
          const { data: ssRow } = await client
            .from("shift_session")
            .select("shift_session_id")
            .eq("schedule_shift_id", newShiftId)
            .maybeSingle();

          if (!ssRow) {
            // No shift_session means trigger preconditions not met (no session
            // for this date/dept/location). Cannot insert shift_zone without
            // shift_session_id FK. Compensating DELETE schedule_shift (MF-B).
            await client
              .from("schedule_shift")
              .delete()
              .eq("schedule_shift_id", newShiftId)
              .eq("workspace_id", profile.workspaceId);
            return {
              ok: false,
              reason: "shift_zone_insert_failed: no shift_session created by trigger",
            };
          }

          // Fetch day_line for the shift_session (created by trigger alongside shift_session).
          const { data: sdlRows } = await client
            .from("shift_session_day_line")
            .select("day_line_id")
            .eq("shift_session_id", ssRow.shift_session_id);

          // Use first day_line (V1: single day_line per shift_session for manual shifts).
          const dayLineId = sdlRows?.[0]?.day_line_id ?? null;
          if (!dayLineId) {
            // No day_line — compensating rollback (MF-B).
            await client
              .from("schedule_shift")
              .delete()
              .eq("schedule_shift_id", newShiftId)
              .eq("workspace_id", profile.workspaceId);
            return {
              ok: false,
              reason: "shift_zone_insert_failed: no day_line found for shift_session",
            };
          }

          // Insert one shift_zone row per zone_id (ADR-0430 Rule 4: M2N).
          for (const { zone_id, location_id } of resolvedZoneLocationPairs) {
            const { error: szError } = await client.from("shift_zone").insert({
              shift_session_id: ssRow.shift_session_id,
              day_line_id: dayLineId,
              zone_id,
              location_id,
              workspace_id: profile.workspaceId,
            });

            if (szError) {
              // Compensating DELETE on shift_zone failure — remove the parent shift (MF-B).
              await client
                .from("schedule_shift")
                .delete()
                .eq("schedule_shift_id", newShiftId)
                .eq("workspace_id", profile.workspaceId);
              return {
                ok: false,
                reason: `shift_zone_insert_failed:${zone_id} — ${szError.message}`,
              };
            }
          }
        }

        return { ok: true, shiftId: newShiftId };
      },
    });

    if (!gateResult.result || !(gateResult.result as { ok: boolean }).ok) {
      const failResult = gateResult.result as { ok: false; reason: string } | undefined;
      return { ok: false, error: failResult?.reason ?? "Kunne ikke lagre vakt." };
    }

    insertedShiftId = (gateResult.result as { ok: true; shiftId: string }).shiftId;
  } catch (err) {
    if (err instanceof MutateWithGateDenied) {
      return { ok: false, error: `Ikke autorisert: ${err.message}` };
    }
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Kunne ikke lagre vakt.",
    };
  }

  if (!insertedShiftId) {
    return { ok: false, error: "Intern feil: mangler vakt-ID etter insert." };
  }

  const override = parsed.data.overrideReason;
  await emit({
    event: "shift added_manual",
    workspace_id: nonEmpty(profile.workspaceId, "workspace_id"),
    actor_id: nonEmpty(profile.profileId, "actor_id"),
    properties: {
      entity_type: "shift",
      entity_id: insertedShiftId,
      data: {
        assigned_to: parsed.data.profileId,
        date,
        start_time: startTime,
        end_time: endTime,
        role: parsed.data.role,
        source: "manual_admin",
        manual: true,
        reason: parsed.data.reason,
        // ADR-0430 Rule 6b: zone_ids recorded in telemetry for audit reconstruction.
        ...(parsed.data.zone_ids.length > 0 ? { zone_ids: parsed.data.zone_ids } : {}),
        // Cascade D1 location scope — present when admin set a location.
        ...(parsed.data.locationId ? { location_id: parsed.data.locationId } : {}),
        // Availability-override context — present only when the admin
        // assigned a profile flagged `unavailable` / `absent` on the
        // shift date. Lands in `activity_trail.data` via the telemetry
        // engine's activity_trail destination (ADR-0175 — four
        // destinations, one emit).
        ...(override ? { override: true, override_reason: override } : {}),
      },
    },
  });

  return {
    ok: true,
    shiftId: insertedShiftId,
    ...(warnings.length > 0 ? { warnings } : {}),
  };
}
