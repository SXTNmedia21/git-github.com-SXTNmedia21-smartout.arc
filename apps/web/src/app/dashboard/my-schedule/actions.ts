"use server";

// Server Actions for the Journey Harness PoC (Journey 03 — Sjekke vakter).
//
// Why Server Actions and not direct emit() from the client component?
// `packages/telemetry/src/providers/engine-event.ts` line 78 short-circuits
// any client-side emit when NODE_ENV === "development" — without going
// through a server entry point, the engine_event row is never written and
// the entire Journey 03 chain dies silently in local Supabase development.
// Spec C6 mandates these emits originate server-side.
//
// See: docs/superpowers/specs/2026-04-06-journey-harness-poc-instruction.md (C6)
// See: apps/e2e/HANDOFF-journey-harness-poc.md (Task 0 step 0.5 finding)

import { emit } from "@smartout/telemetry";
import { createClient } from "@smartout/supabase/server";

/**
 * Resolves the active profile for the currently-authenticated user inside
 * the workspace they are viewing. Returns null if the user is not signed in
 * or has no active profile in the workspace — callers should silently noop
 * in that case rather than throw, because telemetry must never break the UI.
 */
async function resolveCurrentProfile(): Promise<{
  profileId: string;
  workspaceId: string;
} | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // The `is_active` boolean column is the canonical "currently in this
  // workspace" flag (verified against profile schema). The `status` column
  // is a separate ENUM (trainee/active/inactive/offboarding) that we don't
  // filter on here — even trainees should generate journey telemetry.
  const { data: profile } = await supabase
    .from("profile")
    .select("profile_id, workspace_id")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (!profile) return null;
  return {
    profileId: profile.profile_id,
    workspaceId: profile.workspace_id,
  };
}

/**
 * Records that the employee opened their shifts list page. Called once on
 * mount of MyWeekView and again whenever the visible week changes.
 *
 * The emitted event flows: telemetry -> engine_event table -> engine-dispatch
 * picks it up -> matches the `journey_03_check_shifts` trigger -> creates an
 * engine_state for this profile -> step 1's wait_for_event matches the same
 * incoming event and advances to step 2 (waiting for shift.detail_viewed).
 */
export async function markShiftListViewed(weekStart?: string): Promise<void> {
  const profile = await resolveCurrentProfile();
  if (!profile) return;

  await emit({
    event: "shift list_viewed",
    workspace_id: profile.workspaceId,
    actor_id: profile.profileId,
    properties: {
      entity_type: "profile",
      entity_id: profile.profileId,
      week_start: weekStart,
    },
  });
}

/**
 * Records that the employee opened a specific shift's detail. Called from
 * the click handler on each shift card in MyWeekView.
 *
 * This advances the existing engine_state from step 2 (waiting) to complete
 * — engine-dispatch finds the in-flight state for this profile because we
 * pass the same entity_id, then matches step 2's wait_for_event payload.
 */
export async function markShiftDetailViewed(shiftId: string): Promise<void> {
  const profile = await resolveCurrentProfile();
  if (!profile) return;

  await emit({
    event: "shift detail_viewed",
    workspace_id: profile.workspaceId,
    actor_id: profile.profileId,
    properties: {
      entity_type: "profile",
      entity_id: profile.profileId,
      shift_id: shiftId,
    },
  });
}
