"use server";

/**
 * update-deviation-action.ts — Server Actions for deviation status transitions
 * fired from the day-control EventDetailPanel widget.
 *
 * WHY: `EventDetailPanel.tsx:299,319` previously called
 * `supabase.from("deviation").update(...)` directly from a client-side
 * `startTransition`. ADR-0156 forbids day-control widgets from owning
 * Supabase access; ADR-0204 captures the gated-mutation backlog. Both
 * call sites closed by this module per audit 2026-05-13 F-SC-04-15.
 *
 * Two distinct actions (instead of one polymorphic action):
 *   1. resolveDeviationAction({ deviation_id, resolution_notes })
 *        → moves status `open|acknowledged → resolved`, stores notes,
 *          stamps resolved_at + resolved_by from the server-resolved
 *          actor (L-0177 — never trust body IDs, ADR-0151).
 *   2. acknowledgeDeviationAction({ deviation_id })
 *        → moves status `open → acknowledged`. NB: public.deviation has
 *          no acknowledged_at/by columns — `updated_at` is the only
 *          temporal evidence; the audit_trail entry from the emit() carries
 *          the actor identity.
 *
 * Both gate via gate_action() with distinct capability literals (seeded
 * in `20260610100000_seed_day_control_action_authority.sql`) and emit
 * canonical events from the telemetry registry. Idempotent — if the
 * deviation is already in the terminal status, the action returns
 * ok=true without re-emitting (prevents phantom-emit per L-0094 spirit).
 *
 * ADR refs: 0099, 0114, 0134, 0151, 0156, 0189, 0204.
 */

import { z } from "zod";
import { createAdminClient } from "@smartout/supabase/admin";
import { emit, nonEmpty } from "@smartout/telemetry";

import { resolveCurrentProfile, gateAction } from "./_shared";

// ── Input schemas ─────────────────────────────────────────────────────────────

const ResolveDeviationInput = z.object({
  deviation_id: z.string().uuid(),
  resolution_notes: z.string().min(5, "Skriv en kort oppsummering før du løser avviket."),
  channel: z.enum(["chat", "voice", "system"]).optional().default("chat"),
});

const AcknowledgeDeviationInput = z.object({
  deviation_id: z.string().uuid(),
  channel: z.enum(["chat", "voice", "system"]).optional().default("chat"),
});

const EscalateDeviationInput = z.object({
  deviation_id: z.string().uuid(),
  channel: z.enum(["chat", "voice", "system"]).optional().default("chat"),
});

// z.input (not z.infer) so callers can omit `channel` — schema defaults to "chat".
export type ResolveDeviationInput = z.input<typeof ResolveDeviationInput>;
export type AcknowledgeDeviationInput = z.input<typeof AcknowledgeDeviationInput>;
export type EscalateDeviationInput = z.input<typeof EscalateDeviationInput>;

export type DeviationActionResult =
  | { ok: true; deviationId: string; status: "resolved" | "acknowledged" | "escalated" }
  | { ok: false; error: string };

// ── Helpers ───────────────────────────────────────────────────────────────────

type LoadedDeviation = {
  deviation_id: string;
  workspace_id: string;
  status: string;
  title: string;
  domain: string;
};

/**
 * Load + cross-workspace guard. Fail-fast on missing row OR wrong workspace
 * (L-0177 — no silent fallback to JWT-default workspace). Returns the row
 * data so the caller can short-circuit on idempotent state.
 */
async function loadDeviation(
  admin: ReturnType<typeof createAdminClient>,
  deviationId: string,
  expectedWorkspaceId: string,
): Promise<{ ok: true; row: LoadedDeviation } | { ok: false; error: string }> {
  const { data: row, error } = await admin
    .from("deviation")
    .select("deviation_id, workspace_id, status, title, domain")
    .eq("deviation_id", deviationId)
    .maybeSingle();

  if (error) {
    return { ok: false, error: `Kunne ikke laste avviket: ${error.message}` };
  }
  if (!row) {
    return { ok: false, error: "Avviket finnes ikke." };
  }
  if (row.workspace_id !== expectedWorkspaceId) {
    return { ok: false, error: "Avviket tilhører et annet arbeidsrom." };
  }
  return { ok: true, row: row as LoadedDeviation };
}

// ── resolveDeviationAction ────────────────────────────────────────────────────

/**
 * Resolves a deviation. Sets status='resolved', stores resolution_notes,
 * stamps resolved_at + resolved_by from server-resolved actor.
 *
 * Idempotent: if status is already 'resolved' returns ok=true without
 * re-emitting `deviation resolved`.
 */
export async function resolveDeviationAction(
  input: ResolveDeviationInput,
): Promise<DeviationActionResult> {
  const parsed = ResolveDeviationInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Ugyldig input." };
  }

  const profile = await resolveCurrentProfile();
  if (!profile) return { ok: false, error: "Ikke autentisert." };

  const admin = createAdminClient();

  const loaded = await loadDeviation(admin, parsed.data.deviation_id, profile.workspaceId);
  if (!loaded.ok) return loaded;

  // Idempotency — already resolved, short-circuit (no gate call, no emit).
  if (loaded.row.status === "resolved") {
    return { ok: true, deviationId: loaded.row.deviation_id, status: "resolved" };
  }

  /* @authority-gate: capability='hms.resolve_deviation' level='confirm' seed='20260610100000_seed_day_control_action_authority.sql' */
  const gate = await gateAction({
    workspaceId: profile.workspaceId,
    capability: "hms.resolve_deviation",
    channel: parsed.data.channel,
    actorProfileId: profile.profileId,
    actionType: "resolve",
    entityId: parsed.data.deviation_id,
  });
  if (!gate.allow) {
    return { ok: false, error: gate.reason ?? "Ikke autorisert." };
  }

  const nowIso = new Date().toISOString();
  const { error: updateError } = await admin
    .from("deviation")
    .update({
      status: "resolved",
      resolution_notes: parsed.data.resolution_notes,
      resolved_at: nowIso,
      resolved_by: profile.profileId,
    })
    .eq("deviation_id", parsed.data.deviation_id);

  if (updateError) {
    return { ok: false, error: `Kunne ikke lagre avviket: ${updateError.message}` };
  }

  await emit({
    event: "deviation resolved",
    workspace_id: nonEmpty(profile.workspaceId, "workspace_id"),
    actor_id: nonEmpty(profile.profileId, "actor_id"),
    properties: {
      entity: {
        entity_type: "deviation",
        entity_id: parsed.data.deviation_id,
        entity_label: loaded.row.title,
      },
      data: {
        resolution_notes: parsed.data.resolution_notes,
      },
    },
  });

  return { ok: true, deviationId: parsed.data.deviation_id, status: "resolved" };
}

// ── acknowledgeDeviationAction ────────────────────────────────────────────────

/**
 * Acknowledges a deviation. Sets status='acknowledged', stamps
 * acknowledged_at + acknowledged_by from server-resolved actor.
 *
 * Idempotent: if status is already 'acknowledged' or 'resolved', returns
 * ok=true without re-emitting.
 */
export async function acknowledgeDeviationAction(
  input: AcknowledgeDeviationInput,
): Promise<DeviationActionResult> {
  const parsed = AcknowledgeDeviationInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Ugyldig input." };
  }

  const profile = await resolveCurrentProfile();
  if (!profile) return { ok: false, error: "Ikke autentisert." };

  const admin = createAdminClient();

  const loaded = await loadDeviation(admin, parsed.data.deviation_id, profile.workspaceId);
  if (!loaded.ok) return loaded;

  // Idempotency — already past 'open', short-circuit. resolved trumps
  // acknowledged so we return the current terminal status.
  if (loaded.row.status === "acknowledged" || loaded.row.status === "resolved") {
    return {
      ok: true,
      deviationId: loaded.row.deviation_id,
      status: loaded.row.status as "acknowledged" | "resolved",
    };
  }

  /* @authority-gate: capability='hms.acknowledge_deviation' level='confirm' seed='20260610100000_seed_day_control_action_authority.sql' */
  const gate = await gateAction({
    workspaceId: profile.workspaceId,
    capability: "hms.acknowledge_deviation",
    channel: parsed.data.channel,
    actorProfileId: profile.profileId,
    actionType: "acknowledge",
    entityId: parsed.data.deviation_id,
  });
  if (!gate.allow) {
    return { ok: false, error: gate.reason ?? "Ikke autorisert." };
  }

  const { error: updateError } = await admin
    .from("deviation")
    .update({
      status: "acknowledged",
    })
    .eq("deviation_id", parsed.data.deviation_id);

  if (updateError) {
    return { ok: false, error: `Kunne ikke bekrefte avviket: ${updateError.message}` };
  }

  await emit({
    event: "deviation updated",
    workspace_id: nonEmpty(profile.workspaceId, "workspace_id"),
    actor_id: nonEmpty(profile.profileId, "actor_id"),
    properties: {
      entity: {
        entity_type: "deviation",
        entity_id: parsed.data.deviation_id,
        entity_label: loaded.row.title,
      },
      data: {
        status: "acknowledged",
      },
    },
  });

  return { ok: true, deviationId: parsed.data.deviation_id, status: "acknowledged" };
}

// ── escalateDeviationAction ───────────────────────────────────────────────────

/**
 * Escalates a deviation. Sets status='escalated', stamps updated_at from
 * server-resolved actor.
 *
 * Idempotent: if status is already 'escalated' or 'resolved', returns
 * ok=true without re-emitting.
 */
export async function escalateDeviationAction(
  input: EscalateDeviationInput,
): Promise<DeviationActionResult> {
  const parsed = EscalateDeviationInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Ugyldig input." };
  }

  const profile = await resolveCurrentProfile();
  if (!profile) return { ok: false, error: "Ikke autentisert." };

  const admin = createAdminClient();

  const loaded = await loadDeviation(admin, parsed.data.deviation_id, profile.workspaceId);
  if (!loaded.ok) return loaded;

  // Idempotency — already escalated or resolved, short-circuit.
  if (loaded.row.status === "escalated" || loaded.row.status === "resolved") {
    return {
      ok: true,
      deviationId: loaded.row.deviation_id,
      status: loaded.row.status as "escalated" | "resolved",
    };
  }

  /* @authority-gate: capability='hms.escalate_deviation' level='confirm' min_role='manager'
     seed='20260620100300_policy_create_manual_capability_seed.sql' */
  const gate = await gateAction({
    workspaceId: profile.workspaceId,
    capability: "hms.escalate_deviation",
    channel: parsed.data.channel,
    actorProfileId: profile.profileId,
    actionType: "escalate",
    entityId: parsed.data.deviation_id,
  });
  if (!gate.allow) {
    return { ok: false, error: gate.reason ?? "Ikke autorisert." };
  }

  const { error: updateError } = await admin
    .from("deviation")
    .update({
      status: "escalated",
    })
    .eq("deviation_id", parsed.data.deviation_id);

  if (updateError) {
    return { ok: false, error: `Kunne ikke eskalere avviket: ${updateError.message}` };
  }

  await emit({
    event: "deviation updated",
    workspace_id: nonEmpty(profile.workspaceId, "workspace_id"),
    actor_id: nonEmpty(profile.profileId, "actor_id"),
    properties: {
      entity: {
        entity_type: "deviation",
        entity_id: parsed.data.deviation_id,
        entity_label: loaded.row.title,
      },
      data: {
        status: "escalated",
      },
    },
  });

  return { ok: true, deviationId: parsed.data.deviation_id, status: "escalated" };
}
