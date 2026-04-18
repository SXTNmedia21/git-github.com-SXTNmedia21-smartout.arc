"use server";

/**
 * season-actions.ts — Gatedwrite Wave 2A call-site migration.
 *
 * Mirrors the pilot pattern in `apps/web/src/app/dashboard/people/_actions/people-actions.ts`.
 * Season is a D4 entity under the cascade model — writes must route through
 * `cascade_gate_write()` even though no `framework_trigger` currently targets
 * `entity_type = 'season'`. The gate falls back to `allowed: true / applied`
 * for tables with no matching trigger, so this is future-proofing: when the
 * first season-scoped trigger lands (e.g. "blocks overlapping seasons"), the
 * call sites already honour it.
 *
 * Return-shape contract (shared with `people-actions`):
 *   { ok: true }                          — applied, no governance review
 *   { ok: true, pendingProposal: <uuid> } — a change_proposal was created
 *   { ok: false, error: <reason> }        — gate blocked OR non-gate error
 *
 * Telemetry: emits the REGISTERED `"season created"` / `"season updated"`
 * events (see `packages/telemetry/src/registry.ts` at lines 1046 and 1085).
 * The previous wizard-level `emit({event: "button clicked", trackingId: "season-created"})`
 * was a registry miss — the schemas below supersede it.
 *
 * PK column: `season` uses the Smartout `{table}_id` convention
 * (`season_id`). Every `GateContext` sets `entityIdColumn: "season_id"`
 * — post-Wave-2A this is required at the type level.
 */

import { createClient } from "@smartout/supabase/server";
import type { Database, TablesUpdate } from "@smartout/supabase";
import {
  gatedInsert,
  gatedUpdate,
  GateDeniedError,
  type GateContext,
} from "@smartout/supabase/gate-client";
import type { SupabaseClient } from "@supabase/supabase-js";
import { emit } from "@smartout/telemetry";

/** Shared return shape for gated season mutations. */
type GatedResult = { ok: true; pendingProposal?: string } | { ok: false; error: string };

/** Typed helper to get a server client with proper Database generics. */
async function getClient(): Promise<SupabaseClient<Database>> {
  return createClient();
}

/**
 * Resolve the current user's `profile_id` for telemetry `actor_id` +
 * gate `actorProfileId`. Mirrors `resolveActorId` from people-actions.
 * Returns the literal `"unknown"` when the session has no user — the gate
 * then falls back to `auth.uid()` server-side; telemetry tolerates the
 * sentinel (no crash, it just shows up as an unattributed actor).
 */
async function resolveActorId(supabase: SupabaseClient<Database>): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return "unknown";
  const { data } = await supabase
    .from("profile")
    .select("profile_id")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();
  return data?.profile_id ?? "unknown";
}

/**
 * Fetches the current season row for gate-context diffing on UPDATE.
 * Returns `null` when the season is not found; callers surface
 * `{ ok: false, error: "Season not found" }`.
 */
async function fetchCurrentSeason(
  supabase: SupabaseClient<Database>,
  seasonId: string,
): Promise<Record<string, unknown> | null> {
  const { data, error } = await supabase
    .from("season")
    .select("*")
    .eq("season_id", seasonId)
    .single();
  if (error || !data) return null;
  return data as unknown as Record<string, unknown>;
}

/**
 * Create a season (status = "draft"). Input is flat so callers don't have
 * to build a full Insert row — slug is optional and defaults to a
 * Norwegian-safe slugification of the name.
 */
export async function createSeason(input: {
  workspaceId: string;
  name: string;
  slug?: string;
  startDate: string;
  endDate: string;
}): Promise<GatedResult> {
  const supabase = await getClient();
  const actorId = await resolveActorId(supabase);

  const trimmedName = input.name.trim();
  if (!trimmedName) return { ok: false, error: "Sesongen trenger et navn" };
  if (!input.startDate || !input.endDate) {
    return { ok: false, error: "Velg start- og sluttdato" };
  }
  if (input.startDate >= input.endDate) {
    return { ok: false, error: "Sluttdato må være etter startdato" };
  }

  const slug = (input.slug ?? defaultSlug(trimmedName)).trim();

  const row = {
    name: trimmedName,
    slug,
    start_date: input.startDate,
    end_date: input.endDate,
    status: "draft" as const,
    workspace_id: input.workspaceId,
    // created_by is optional in the Insert schema — gate accepts NULL and
    // RLS fills auth.uid() via the default when not supplied. Explicit
    // value avoids relying on that fallback for service-role callers.
    created_by: actorId === "unknown" ? null : actorId,
  };

  const ctx: GateContext = {
    entityType: "season",
    entityId: null,
    workspaceId: input.workspaceId,
    capability: "season:create",
    actorProfileId: actorId,
    entityIdColumn: "season_id",
  };

  try {
    const result = await gatedInsert<{ season_id: string }>(supabase, "season", row, ctx);
    const createdSeasonId = result.data[0]?.season_id;

    void emit({
      event: "season created",
      workspace_id: input.workspaceId,
      actor_id: actorId,
      properties: {
        entity: { entity_type: "season", entity_id: createdSeasonId ?? "" },
        data: { name: trimmedName, status: "draft" },
      },
    });

    return { ok: true };
  } catch (err) {
    if (err instanceof GateDeniedError) {
      if (err.outcome === "proposed") {
        return { ok: true, pendingProposal: err.proposalId ?? undefined };
      }
      return { ok: false, error: err.reason ?? "Governance denied" };
    }
    return { ok: false, error: (err as Error).message };
  }
}

/**
 * Update a season. The caller supplies the season_id + workspace_id +
 * the subset of columns being changed. Current row is fetched so the
 * gate can diff; `entityIdColumn: "season_id"` routes the post-gate
 * UPDATE to the correct PK.
 */
export async function updateSeason(
  seasonId: string,
  workspaceId: string,
  patch: TablesUpdate<"season">,
): Promise<GatedResult> {
  const supabase = await getClient();
  const actorId = await resolveActorId(supabase);

  const currentSeason = await fetchCurrentSeason(supabase, seasonId);
  if (!currentSeason) return { ok: false, error: "Season not found" };

  const ctx: GateContext = {
    entityType: "season",
    entityId: seasonId,
    workspaceId,
    capability: "season:update",
    actorProfileId: actorId,
    currentData: currentSeason,
    entityIdColumn: "season_id",
  };

  try {
    await gatedUpdate(supabase, "season", patch as Record<string, unknown>, ctx);

    // The registered `"season updated"` schema wants start_date / end_date
    // (nullable). Pull them out of the patch when present; fall back to
    // the previous values from `currentSeason` so telemetry always carries
    // a non-undefined snapshot.
    const startDate =
      (patch.start_date as string | null | undefined) ??
      (currentSeason.start_date as string | null | undefined) ??
      null;
    const endDate =
      (patch.end_date as string | null | undefined) ??
      (currentSeason.end_date as string | null | undefined) ??
      null;

    void emit({
      event: "season updated",
      workspace_id: workspaceId,
      actor_id: actorId,
      properties: {
        entity: { entity_type: "season", entity_id: seasonId },
        data: { start_date: startDate, end_date: endDate },
      },
    });

    return { ok: true };
  } catch (err) {
    if (err instanceof GateDeniedError) {
      if (err.outcome === "proposed") {
        return { ok: true, pendingProposal: err.proposalId ?? undefined };
      }
      return { ok: false, error: err.reason ?? "Governance denied" };
    }
    return { ok: false, error: (err as Error).message };
  }
}

/**
 * Norwegian-safe slugification used when the caller doesn't supply a slug.
 * Matches the lowercasing + char whitelist previously inlined in
 * `SeasonSetupStep.handleSave`.
 */
function defaultSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-\u00e6\u00f8\u00e5]/g, "");
}
