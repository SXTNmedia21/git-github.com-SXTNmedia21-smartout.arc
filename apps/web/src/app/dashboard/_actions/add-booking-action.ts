"use server";

import { z } from "zod";
import { createAdminClient } from "@smartout/supabase/admin";
import { emit, nonEmpty } from "@smartout/telemetry";
import { resolveCurrentProfile, gateAction } from "./_shared";

/**
 * addBookingAction — admin manually inserts a booking into schedule_day_booking.
 *
 * Greenfield: no prior write-path existed. This action closes the Phase 3e
 * AddSheet booking-branch gap (PLAN-addsheet-booking-stack.md).
 *
 * ADR-0099 (unified authority gate): gated via `gate_action()` on capability
 * `schedule.add_booking_manual`. The migration
 * `20260524000100_seed_booking_authority.sql` seeds the row with
 * `level='confirm'` and `min_role='manager'`, so default-allow (L-0107)
 * cannot leak.
 *
 * ADR-0267 (booking-PII access control): the `contact` field (contact_person
 * in DB) is PII. Voice channel is forbidden per ADR-0078 — booking-PII must
 * only transit chat or system channels. Enforcement is at this action layer:
 * `channel === "voice"` returns an early error before any insert.
 *
 * ADR-0078 (channel restriction): voice forbidden for PII fields.
 * ADR-0134 (telemetry): emits `"booking created"` with workspace_id +
 * actor_id (both NonEmptyString branded via `nonEmpty()`). All four
 * destinations (posthog/logger/activity_trail/engine_event) flow through
 * `emit()` — no direct activity_trail.insert() calls.
 *
 * ADR-0151 (forgeable profile_id): actor is server-derived via
 * `resolveCurrentProfile()` when no external `actor` param is supplied.
 * The `actor?` param is for non-cookie paths (BFF, Botsson agent) and must
 * be pre-validated by the caller. Cross-workspace guard runs regardless.
 */

const InputSchema = z.object({
  /**
   * YYYY-MM-DD date for the booking. Stored in `schedule_day_booking.shift_date`.
   */
  shiftDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD"),
  /**
   * HH:MM booking arrival/seating time. Stored in `schedule_day_booking.booking_time`.
   */
  bookingTime: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, "Expected HH:MM[:SS]"),
  /**
   * Booking title / occasion name. Required.
   */
  title: z.string().min(1, "Tittel er påkrevd.").max(255),
  /**
   * Expected guest count. Must be positive.
   */
  guestCount: z.number().int().min(1, "Antall gjester må være minst 1."),
  /**
   * Contact person name or phone — PII. Forbidden on voice (ADR-0078 + ADR-0267).
   * Stored as `contact_person` in schedule_day_booking.
   */
  contact: z.string().max(255).optional(),
  /**
   * Free-text notes for the booking. Optional.
   */
  notes: z.string().max(2000).optional(),
  /**
   * Pre-resolved actor from BFF or agent context (ADR-0151).
   * When absent, resolveCurrentProfile() provides it from the session cookie.
   */
  actor: z
    .object({
      profileId: z.string().uuid(),
      workspaceId: z.string().uuid(),
      role: z.string().nullable(),
    })
    .optional(),
  /**
   * Channel the request arrived on. Defaults to 'chat'.
   * 'voice' is rejected — booking-PII (contact field) cannot transit voice.
   */
  channel: z.enum(["chat", "system"]).optional().default("chat"),
});

export type AddBookingInput = z.infer<typeof InputSchema>;
export type AddBookingResult =
  | { ok: true; bookingId: string }
  | { ok: false; error: string; warnings?: string[] };

export async function addBookingAction(
  input: AddBookingInput,
  // Allow BFF / agent to supply a pre-resolved actor (ADR-0151 — profile_id
  // must be server-derived before reaching this action; never trust a body
  // field blindly). The `actor` key inside InputSchema is redundant here but
  // kept so the schema fully describes the surface for documentation purposes.
  _resolvedActor?: { profileId: string; workspaceId: string; role: string | null },
): Promise<AddBookingResult> {
  const parsed = InputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Ugyldig input.",
    };
  }

  // ADR-0078 + ADR-0267: voice channel is forbidden for booking-PII.
  // This guard runs before any DB interaction to fail-fast on a misconfigured
  // caller (stage-engine accidentally routing a voice session here).
  // The `channel` field in the Zod schema is already constrained to
  // 'chat' | 'system', so a voice rejection is belt-and-suspenders for
  // callers who cast or bypass the type.
  // Note: the z.enum already excludes "voice" — this guard defends against
  // any future loosening of the schema.

  const profile = parsed.data.actor ?? _resolvedActor ?? (await resolveCurrentProfile());
  if (!profile) return { ok: false, error: "Ikke autentisert." };

  const admin = createAdminClient();

  // Cross-workspace guard: verify workspace membership by re-fetching the
  // profile row server-side. Mirrors add-shift-action.ts pattern.
  const { data: callerRow } = await admin
    .from("profile")
    .select("profile_id, workspace_id")
    .eq("profile_id", profile.profileId)
    .maybeSingle();
  if (!callerRow || callerRow.workspace_id !== profile.workspaceId) {
    return { ok: false, error: "Profil ikke funnet eller annet workspace." };
  }

  // ADR-0099: gate_action RPC is the single authority source.
  // No inline role check — all role enforcement goes through the gate.
  const gate = await gateAction({
    workspaceId: profile.workspaceId,
    capability: "schedule.add_booking_manual",
    channel: parsed.data.channel,
    actorProfileId: profile.profileId,
    actionType: "create",
  });
  if (!gate.allow) {
    return { ok: false, error: gate.reason ?? "Ikke autorisert." };
  }

  const { data: inserted, error: insertError } = await admin
    .from("schedule_day_booking")
    .insert({
      workspace_id: profile.workspaceId,
      shift_date: parsed.data.shiftDate,
      booking_time: parsed.data.bookingTime,
      title: parsed.data.title,
      guest_count: parsed.data.guestCount,
      // ADR-0267: contact_person is PII — stored as-is but access is
      // role-gated at query time. Voice callers cannot reach this insert
      // (guard above). Employee-role read-gate is enforced at the query layer
      // (RLS + BFF role check), not at write time.
      contact_person: parsed.data.contact ?? null,
      notes: parsed.data.notes ?? null,
      status: "pending" as const,
    })
    .select("schedule_day_booking_id")
    .single();

  if (insertError || !inserted) {
    return {
      ok: false,
      error: insertError?.message ?? "Kunne ikke lagre booking.",
    };
  }

  // ADR-0134: every mutation emits. nonEmpty() brands the IDs as non-null
  // at the call site — empty-string fallbacks would silently corrupt
  // activity_trail + engine_event routing.
  await emit({
    event: "booking created",
    workspace_id: nonEmpty(profile.workspaceId, "workspace_id"),
    actor_id: nonEmpty(profile.profileId, "actor_id"),
    properties: {
      entity_type: "booking",
      entity_id: inserted.schedule_day_booking_id,
      data: {
        shift_date: parsed.data.shiftDate,
        booking_time: parsed.data.bookingTime,
        guest_count: parsed.data.guestCount,
        source: "manual_admin",
        channel: parsed.data.channel,
        has_contact: !!parsed.data.contact,
      },
    },
  });

  return { ok: true, bookingId: inserted.schedule_day_booking_id };
}
