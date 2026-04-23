/**
 * Composition Orchestrator (ADR-0204)
 *
 * One function, one path. Every DB mutation in the Smartout agent/capability
 * layer flows through `gatedMutation()` so both orthogonal policies run in
 * the right order with a correlated audit trail:
 *
 *   1. Pathway A — `gate_action` RPC (ADR-0099): capability authority.
 *                  Channel guard (ADR-0078), four-eyes (ADR-0101),
 *                  min_role downgrade.
 *   2. Pathway B — `cascade_gate_write` RPC (ADR-0091): cascade data-rule.
 *                  Framework triggers, change_proposal materialisation.
 *   3. Domain write — the caller's `execute(client)` callback. Runs ONLY
 *                     when both policies returned `applied`.
 *
 * Authority is evaluated FIRST, non-negotiably (ADR-0204 §4). Channel guard
 * and four-eyes live in `gate_action`; running data-rule first would leak
 * intent via `change_proposal` rows on a policy the actor was never
 * authorised to invoke.
 *
 * Both gate_evaluation rows are stamped post-RPC with a shared
 * `correlation_id` (flat join key) and `parent_evaluation_id` (causal
 * link). The RPC bodies themselves are unchanged — see
 * `supabase/migrations/20260519000000_gate_evaluation_correlation_chain.sql`
 * for the schema addition.
 *
 * SS-3 SCAFFOLD NOTES (temporary, until SS-4/SS-5):
 *
 *  - Feature-flagged OFF by default via
 *    `SMARTOUT_COMPOSITION_ORCHESTRATOR_ENABLED`. When OFF the function
 *    throws an Error whose message starts `not_implemented:` — this keeps
 *    ADR-0196 Invariant 11 true for SS-3 (no emit, no DB row, no partial
 *    work). Flip the flag when SS-4 wires the first real call site.
 *
 *  - `gate_evaluated` emit is NOT wired in SS-3. The brief narrows SS-3
 *    scope to the orchestrator scaffold + schema + tests. Emit requires a
 *    registry entry in `packages/telemetry/src/registry.ts` and is tracked
 *    for SS-4.
 *
 *  - CI grep (`scripts/ci/no-inline-gate-rpc.sh`) is ADR-0204 §3 and also
 *    tracked for SS-4 — it cannot fire until call sites are migrated.
 *
 * ADR-0138 alignment: the return shape is a superset of `CapabilityToolResult`.
 * Capability `execute()` wrappers forward the result directly; on
 * `{ok:false, denied_by}` the tool returns `{ok:false, reason, code:denied_by}`.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Json } from "@smartout/supabase";
import type { SessionChannel } from "../capabilities/types.js";

// ─────────────────────────────────────────────────────────────────────────
// Feature flag
// ─────────────────────────────────────────────────────────────────────────

/**
 * Gate the orchestrator behind an env flag so SS-3 can ship without any
 * call site depending on an unmigrated shape. Default OFF — when OFF the
 * function throws immediately, NEVER emits, NEVER writes a DB row.
 *
 * Flip ON (set env var to "true" / "1") when SS-4 migrates the first
 * per-capability `gate.ts` to delegate here.
 */
function isOrchestratorEnabled(): boolean {
  const raw = process.env.SMARTOUT_COMPOSITION_ORCHESTRATOR_ENABLED;
  if (raw === undefined) return false;
  const normalised = raw.trim().toLowerCase();
  return normalised === "true" || normalised === "1" || normalised === "yes";
}

// ─────────────────────────────────────────────────────────────────────────
// Public types
// ─────────────────────────────────────────────────────────────────────────

/**
 * Why the orchestrator returned `ok:false`.
 *
 *  - `capability`       — Pathway A denied (authority, channel guard,
 *                         four-eyes, downgrade-to-suggest).
 *  - `data_rule`        — Pathway B denied (framework trigger matched,
 *                         change_proposal materialised).
 *  - `not_implemented`  — orchestrator pre-check failed, RPC transport
 *                         failed, or RPC returned an unrecognised shape.
 *                         ADR-0196 Invariant 11: no `gate_evaluated` emit
 *                         on this path.
 */
export type DeniedBy = "capability" | "data_rule" | "not_implemented";

/**
 * Discriminated union aligned with ADR-0138 `CapabilityToolResult`. A
 * capability tool wrapping `gatedMutation()` forwards this shape unchanged,
 * remapping `denied_by` to its `code` field on the deny path.
 *
 *  - `ok:true`                — composition fully allowed. When a
 *                                `proposal_id` is present, the domain
 *                                `execute()` callback was NOT invoked (the
 *                                data-rule created a proposal instead of
 *                                permitting the write). When absent, the
 *                                domain write ran.
 *  - `ok:false`               — one of the two policies denied, or a
 *                                transport/shape failure prevented the
 *                                composition from completing.
 */
export type ComposedGateOutcome =
  | {
      ok: true;
      /** Row id of the audit row that finalised the decision — row 2 when
       *  both policies ran, row 1 when Pathway B was skipped (never today,
       *  but reserved for future internal short-circuits). */
      gate_evaluation_id: string;
      /** Correlation id shared by both audit rows. Present on every
       *  orchestrator success so callers can link domain-write telemetry
       *  to the gate chain. */
      correlation_id: string;
      /** Populated ONLY when Pathway B returned outcome=proposed. In that
       *  case the caller's `execute` was NOT invoked; a change_proposal
       *  was materialised for admin review instead. */
      proposal_id?: string;
      /** Populated when Pathway A returned a downgrade. The caller may
       *  choose to surface "confirmation required" UX. */
      downgrade_to?: string;
      /** Propagated from `cascade_gate_write` for success-path telemetry
       *  (ADR-0190 Control 3a — distinguishes `no-active-framework` from
       *  `no-trigger-match` from policy-matched permits). */
      reason?: string | null;
    }
  | {
      ok: false;
      denied_by: DeniedBy;
      reason: string;
      /** Present when a gate_evaluation row was written before denial.
       *  Absent on `not_implemented` (ADR-0196 Invariant 11: we never
       *  fabricate an id that doesn't correspond to a real row). */
      gate_evaluation_id?: string;
      /** Correlation id when one was generated (every code path that
       *  writes row 1 generates it). Absent on very-early failures
       *  (feature flag off, missing args) before row 1 was attempted. */
      correlation_id?: string;
      /** ADR-0101 four-eyes passthrough: UI may surface an approver
       *  selector rather than a hard deny. Only present when Pathway A
       *  denied for `four_eyes_required`. */
      four_eyes_required?: boolean;
      approvers_needed?: number;
      approvers_present?: string[];
    };

/** The caller's domain write. Runs ONLY when both policies returned
 *  `applied`. The callback receives the same client the orchestrator used
 *  so the domain write can transact against the same session. */
export type MutationExecute = (
  client: SupabaseClient,
) => Promise<{ ok: true } | { ok: false; reason: string }>;

/** Orchestrator arguments. Mirrors ADR-0204 §1 with one deliberate
 *  deviation: `channel` uses the repo's `SessionChannel` (which includes
 *  `sms`/`email`/`telegram`/`autonomous`) rather than the ADR's narrower
 *  illustrative list. The wider union is what `gate_action` actually
 *  accepts today. */
export type GatedMutationArgs = {
  /** Workspace scope for RLS + authority lookup. Required. */
  workspace_id: string;
  /** Actor profile. Required — Pathway A refuses to evaluate four-eyes
   *  without an actor, and Pathway B's `assert_gate_caller` raises on
   *  mismatch. */
  actor_profile_id: string;
  /** Capability name (must match a row in `engine_authority_config`, or
   *  hit the ADR-0189-warned default-allow branch). */
  capability: string;
  /** Originating channel. Drives ADR-0078 voice-to-PII guard and
   *  engine_process.allowed_channels matching. */
  channel: SessionChannel;
  /** Action_type recorded on the authority audit row (e.g. "save",
   *  "submit_own_pii"). Distinct from Pathway B's `action`. */
  action_type: string;
  /** Optional entity id — required by four-eyes to scope approvals
   *  per-entity (ADR-0101). Null on inserts before the row exists. */
  entity_id: string | null;
  /** Logical entity type for Pathway B (e.g. "engine_memory",
   *  "schedule_shift"). Drives framework_trigger matching. */
  entity_type: string;
  /** Pathway B action verb. Distinct from `action_type` on Pathway A —
   *  authority reasons about capability verbs ("save"), data-rule reasons
   *  about DML verbs ("create"|"update"|"delete"). */
  action: "create" | "update" | "delete";
  /** The proposed new state (for create/update). `null` on delete. */
  proposed_data: Json;
  /** The current row state (for update/delete diffing). `null` on
   *  create. */
  current_data?: Json | null;
  /** Optional approver list passed into `gate_action` for ADR-0101
   *  four-eyes. Defaults to `[actor_profile_id]` inside the RPC. */
  approvers_present?: string[];
  /** Engine-process context — when set, `gate_action` checks
   *  `engine_process.allowed_channels` against `channel`. */
  engine_process_id?: string | null;
  engine_state_id?: string | null;
  /** The domain write. Runs only when both policies return `applied`. */
  execute: MutationExecute;
};

// ─────────────────────────────────────────────────────────────────────────
// Internal — correlation id
// ─────────────────────────────────────────────────────────────────────────

/** Cheap v4-ish UUID generator for the correlation chain. The DB column
 *  is `uuid` and the orchestrator never interprets the value beyond
 *  `.eq()` lookups — any RFC-4122-shaped string is sufficient. Falls back
 *  to `crypto.randomUUID()` when available (Node >= 19, Deno, browsers)
 *  and to a manual construction otherwise so the orchestrator has no hard
 *  dependency on a specific runtime. */
function newCorrelationId(): string {
  const c = (globalThis as unknown as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c && typeof c.randomUUID === "function") {
    return c.randomUUID();
  }
  // Fallback — 32 hex chars in 8-4-4-4-12 UUID v4 layout.
  const hex = (n: number) =>
    Math.floor(Math.random() * 16 ** n)
      .toString(16)
      .padStart(n, "0");
  return `${hex(8)}-${hex(4)}-4${hex(3)}-${((Math.random() * 4) | 8).toString(16)}${hex(3)}-${hex(12)}`;
}

// ─────────────────────────────────────────────────────────────────────────
// Internal — RPC shapes
// ─────────────────────────────────────────────────────────────────────────

/** Mirror of `gate_action` RPC return jsonb. Fields marked `undefined` on
 *  legacy deployments (pre-ADR-0099 Phase 1) are tolerated — the
 *  orchestrator treats absence as the fail-closed default. */
type GateActionRow = {
  allow?: unknown;
  reason?: unknown;
  channel_allowed?: unknown;
  downgrade_to?: unknown;
  min_role_required?: unknown;
  gate_evaluation_id?: unknown;
  four_eyes_required?: unknown;
  approvers_needed?: unknown;
  approvers_present?: unknown;
  entity_id?: unknown;
  unseeded?: unknown;
};

/** Mirror of `cascade_gate_write` RPC return jsonb. */
type CascadeGateRow = {
  allowed?: unknown;
  outcome?: unknown;
  proposal_id?: unknown;
  reason?: unknown;
  exception_reason?: unknown;
  gate_evaluation_id?: unknown;
};

function isObjectLike(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

// ─────────────────────────────────────────────────────────────────────────
// Public — gatedMutation()
// ─────────────────────────────────────────────────────────────────────────

/**
 * Compose Pathway A (capability authority) and Pathway B (cascade data-rule)
 * around a domain write. See module docstring and ADR-0204 for the full
 * contract.
 *
 * @throws Error whose message starts `not_implemented:` when the feature
 *         flag is OFF. This keeps ADR-0196 Invariant 11 true for SS-3 —
 *         no emit, no DB write, no partial work.
 */
export async function gatedMutation(
  client: SupabaseClient,
  args: GatedMutationArgs,
): Promise<ComposedGateOutcome> {
  // ── Feature flag — ADR-0196 Invariant 11 hatch ───────────────────────
  // When disabled the orchestrator makes NO side effects: no RPC call,
  // no `emit()`, no DB row. Callers that accidentally wire this up
  // before SS-4 ships get a loud, synchronous failure.
  if (!isOrchestratorEnabled()) {
    throw new Error(
      "not_implemented: composition orchestrator disabled (SMARTOUT_COMPOSITION_ORCHESTRATOR_ENABLED)",
    );
  }

  const correlationId = newCorrelationId();

  // ── 1. Pathway A — capability authority ─────────────────────────────
  let row1Id: string | null = null;
  let gateActionRow: GateActionRow;
  try {
    const rpcArgs: Record<string, unknown> = {
      p_workspace_id: args.workspace_id,
      p_capability: args.capability,
      p_channel: args.channel,
      p_actor_profile_id: args.actor_profile_id,
      p_action_type: args.action_type,
      p_approvers_present: args.approvers_present ?? [args.actor_profile_id],
    };
    if (args.entity_id !== null && args.entity_id !== undefined) {
      rpcArgs.p_entity_id = args.entity_id;
    }
    if (args.engine_process_id) {
      rpcArgs.p_engine_process_id = args.engine_process_id;
    }
    if (args.engine_state_id) {
      rpcArgs.p_engine_state_id = args.engine_state_id;
    }
    /* @authority-gate-ungated — orchestrator is the intentional Pathway A
       call site (ADR-0204 §3). Capability is threaded through from caller. */
    const { data, error } = await client.rpc("gate_action", rpcArgs);
    if (error || !isObjectLike(data)) {
      return {
        ok: false,
        denied_by: "not_implemented",
        reason: `gate_rpc_failure:gate_action:${error?.message ?? "invalid_shape"}`,
      };
    }
    gateActionRow = data as GateActionRow;
    row1Id =
      typeof gateActionRow.gate_evaluation_id === "string"
        ? gateActionRow.gate_evaluation_id
        : null;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      denied_by: "not_implemented",
      reason: `gate_rpc_failure:gate_action:throw:${message}`,
    };
  }

  // Stamp correlation on row 1. Best-effort — a stamp failure does NOT
  // invalidate the authority decision; we proceed but surface the row id
  // we have so downstream audit can still reconstruct manually if needed.
  if (row1Id) {
    await stampCorrelation(client, row1Id, {
      correlation_id: correlationId,
      parent_evaluation_id: null,
    });
  }

  const row1Allowed = gateActionRow.allow === true;
  const row1Reason = typeof gateActionRow.reason === "string" ? gateActionRow.reason : null;

  // Deny path — capability. Short-circuit BEFORE Pathway B so channel
  // guard + four-eyes never leak intent via change_proposal.
  if (!row1Allowed) {
    return {
      ok: false,
      denied_by: "capability",
      reason: row1Reason ?? "capability_denied",
      gate_evaluation_id: row1Id ?? undefined,
      correlation_id: correlationId,
      four_eyes_required: gateActionRow.four_eyes_required === true,
      approvers_needed:
        typeof gateActionRow.approvers_needed === "number"
          ? gateActionRow.approvers_needed
          : undefined,
      approvers_present: Array.isArray(gateActionRow.approvers_present)
        ? (gateActionRow.approvers_present as string[])
        : undefined,
    };
  }

  // ADR-0099 downgrade_to='suggest' — authority allowed, but with a
  // downgrade. Policy: surface this as a non-blocking "confirmation
  // required" signal WITHOUT running Pathway B. The capability tool
  // chooses whether to re-prompt or refuse. (Chosen over proceeding-
  // with-downgrade because the caller has no consent surface at this
  // layer; SS-4 may introduce an explicit `allow_downgrade_through` arg.)
  const downgradeTo =
    typeof gateActionRow.downgrade_to === "string" ? gateActionRow.downgrade_to : null;
  if (downgradeTo) {
    return {
      ok: false,
      denied_by: "capability",
      reason: row1Reason ?? "downgraded_to_suggest",
      gate_evaluation_id: row1Id ?? undefined,
      correlation_id: correlationId,
    };
  }

  // ── 2. Pathway B — cascade data-rule ────────────────────────────────
  let row2Id: string | null = null;
  let cascadeRow: CascadeGateRow;
  try {
    const { data, error } = await client.rpc("cascade_gate_write", {
      p_entity_type: args.entity_type,
      p_entity_id: args.entity_id,
      p_action: args.action,
      p_workspace_id: args.workspace_id,
      p_proposed_data: args.proposed_data,
      p_current_data: args.current_data ?? null,
      p_actor_profile_id: args.actor_profile_id,
      p_capability: args.capability,
    });
    if (error || !isObjectLike(data)) {
      return {
        ok: false,
        denied_by: "not_implemented",
        reason: `gate_rpc_failure:cascade_gate_write:${error?.message ?? "invalid_shape"}`,
        correlation_id: correlationId,
        // row1 succeeded; surface its id so auditors can join the chain
        // manually even though row 2 never wrote.
        gate_evaluation_id: row1Id ?? undefined,
      };
    }
    cascadeRow = data as CascadeGateRow;
    row2Id =
      typeof cascadeRow.gate_evaluation_id === "string" ? cascadeRow.gate_evaluation_id : null;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      denied_by: "not_implemented",
      reason: `gate_rpc_failure:cascade_gate_write:throw:${message}`,
      correlation_id: correlationId,
      gate_evaluation_id: row1Id ?? undefined,
    };
  }

  if (row2Id) {
    await stampCorrelation(client, row2Id, {
      correlation_id: correlationId,
      parent_evaluation_id: row1Id,
    });
  }

  const outcomeRaw = typeof cascadeRow.outcome === "string" ? cascadeRow.outcome : null;
  const cascadeAllowed = cascadeRow.allowed === true;
  const cascadeReason = typeof cascadeRow.reason === "string" ? cascadeRow.reason : null;

  // Deny path — data-rule. `allowed=false, outcome=blocked`. The proposal
  // path is its OWN branch below (allowed=false, outcome=proposed).
  if (!cascadeAllowed && outcomeRaw === "blocked") {
    return {
      ok: false,
      denied_by: "data_rule",
      reason: cascadeReason ?? "data_rule_blocked",
      gate_evaluation_id: row2Id ?? undefined,
      correlation_id: correlationId,
    };
  }

  // Proposal path — data-rule converted the write into a
  // change_proposal. Semantically the caller did NOT perform a write;
  // we return ok:true with a proposal_id so the UI can surface "under
  // review" without the caller having to special-case the deny
  // shape. `execute` is NOT invoked.
  const proposalId = typeof cascadeRow.proposal_id === "string" ? cascadeRow.proposal_id : null;
  if (outcomeRaw === "proposed" && proposalId) {
    return {
      ok: true,
      gate_evaluation_id: row2Id ?? "",
      correlation_id: correlationId,
      proposal_id: proposalId,
      reason: cascadeReason,
    };
  }

  // Belt-and-braces for future RPC expansions — if allowed is false AND
  // outcome is neither 'blocked' nor 'proposed' we treat it as a bad
  // shape rather than silently permitting.
  if (!cascadeAllowed) {
    return {
      ok: false,
      denied_by: "not_implemented",
      reason: `gate_rpc_failure:cascade_gate_write:unknown_deny_outcome:${outcomeRaw ?? "null"}`,
      gate_evaluation_id: row2Id ?? undefined,
      correlation_id: correlationId,
    };
  }

  // ── 3. Domain write ────────────────────────────────────────────────
  //
  // Both policies returned `applied`. Run the caller's execute inside
  // our try/catch so that a throw becomes a structured
  // `not_implemented` deny rather than bubbling out.
  try {
    const result = await args.execute(client);
    if (!result.ok) {
      return {
        ok: false,
        denied_by: "not_implemented",
        reason: `execute_failed:${result.reason}`,
        gate_evaluation_id: row2Id ?? undefined,
        correlation_id: correlationId,
      };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      denied_by: "not_implemented",
      reason: `execute_throw:${message}`,
      gate_evaluation_id: row2Id ?? undefined,
      correlation_id: correlationId,
    };
  }

  return {
    ok: true,
    gate_evaluation_id: row2Id ?? "",
    correlation_id: correlationId,
    reason: cascadeReason,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Internal — stamp correlation on a gate_evaluation row
// ─────────────────────────────────────────────────────────────────────────

async function stampCorrelation(
  client: SupabaseClient,
  rowId: string,
  stamp: { correlation_id: string; parent_evaluation_id: string | null },
): Promise<void> {
  // Best-effort. If the UPDATE fails (RLS edge case, service role
  // downgrade, transient) we swallow the error — the decision rows
  // themselves are written by the RPC and are the primary audit.
  // correlation_id is a convenience for dashboard queries, not the
  // decision of record.
  //
  // ESLint suppression: gate_evaluation is an audit-only table. Stamping
  // it via gatedUpdate would require gate_evaluation to be governance-
  // gated, which would create a circular dependency (the orchestrator
  // would call itself). This is the one legal direct-write on this
  // table; ADR-0204 §3 names gatedMutation.ts as an allowed internal
  // call site for gate_evaluation writes.
  try {
    /* eslint-disable-next-line smartout/no-direct-supabase-write --
       gate_evaluation is audit-only; gatedMutation is the one legal
       direct-write site per ADR-0204 §3 (stamping correlation chain). */
    await client
      .from("gate_evaluation")
      .update({
        correlation_id: stamp.correlation_id,
        parent_evaluation_id: stamp.parent_evaluation_id,
      })
      .eq("id", rowId);
  } catch {
    // Swallow — see comment above.
  }
}
