"use server";

/**
 * set-schedule-density.ts
 *
 * WHY: Persists the user's chosen schedule card density to `user_view_preference`
 * so it survives page reload and can be read server-side on next visit (avoids
 * client-side flash from "default" → persisted value).
 *
 * Design rules honored:
 *   ADR-0151 — profile_id + workspace_id server-derived from JWT, never body.
 *   ADR-0287 — gateAction (gate_action RPC) gates the mutation.
 *   L-0177   — fail-fast 4xx on unauthenticated; no silent fallback.
 *   ADR-0094 — schedule.density_changed registered in telemetry/src/registry.ts
 *              BEFORE this emit() call (Phase B completed in 55bbe8566).
 */

import { z } from "zod";
import { createAdminClient } from "@smartout/supabase/admin";
import { emit, nonEmpty } from "@smartout/telemetry";
import { gateAction, resolveCurrentProfile } from "../../_actions/_shared";
// ScheduleDensity is the single source of truth — exported from Phase D component.
// Re-exported here so Server Action callers can import type without depending
// on a UI component path.
export type { ScheduleDensity } from "../_components/density-selector";

const DensitySchema = z.enum(["cozy", "default", "compact", "pulse"]);

const InputSchema = z.object({
  density: DensitySchema,
});

export type SetScheduleDensityInput = z.infer<typeof InputSchema>;
export type SetScheduleDensityResult =
  | { ok: true; density: "cozy" | "default" | "compact" | "pulse" }
  | { ok: false; error: string };

/**
 * setScheduleDensityAction — upserts the calling user's schedule density
 * preference in `user_view_preference`.
 *
 * Gated at roleFloor "employee": any authenticated user may own their own
 * view-state. The gate_action RPC uses default-allow when no
 * engine_authority_config row exists for the capability.
 *
 * Idempotent: UPSERT on unique (profile_id, workspace_id, surface,
 * preference_key) — repeated identical writes are safe and silent.
 */
export async function setScheduleDensityAction(
  input: SetScheduleDensityInput,
): Promise<SetScheduleDensityResult> {
  const parsed = InputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Ugyldig tetthet." };
  }

  // ADR-0151 + L-0177: server-derive identity from JWT, fail-fast on miss.
  const profile = await resolveCurrentProfile();
  if (!profile) {
    return { ok: false, error: "Ikke autentisert." };
  }
  if (!profile.profileId.trim() || !profile.workspaceId.trim()) {
    return { ok: false, error: "Ugyldig aktør-identitet." };
  }

  // ADR-0287: gate via gate_action RPC before any mutation.
  // capability: "schedule.view_preference.write" — default-allow applies
  // (no authority_config row needed for employee-owned view-state).
  const gate = await gateAction({
    workspaceId: profile.workspaceId,
    capability: "schedule.view_preference.write",
    channel: "chat",
    actorProfileId: profile.profileId,
    actionType: "update",
  });
  if (!gate.allow) {
    return { ok: false, error: gate.reason ?? "Ikke autorisert." };
  }

  const admin = createAdminClient();

  const { error: upsertError } = await admin.from("user_view_preference").upsert(
    {
      profile_id: profile.profileId,
      workspace_id: profile.workspaceId,
      surface: "schedule",
      preference_key: "density",
      preference_value: parsed.data.density,
    },
    { onConflict: "profile_id,workspace_id,surface,preference_key" },
  );

  if (upsertError) {
    return { ok: false, error: upsertError.message };
  }

  // Telemetry AFTER successful upsert (ADR-0094 + L-0177 sequencing).
  await emit({
    event: "schedule.density_changed",
    workspace_id: nonEmpty(profile.workspaceId, "workspace_id"),
    actor_id: nonEmpty(profile.profileId, "actor_id"),
    properties: {
      entity: {
        entity_type: "profile",
        entity_id: profile.profileId,
      },
      data: {
        density: parsed.data.density,
        source: "ui",
      },
    },
  });

  return { ok: true, density: parsed.data.density };
}
