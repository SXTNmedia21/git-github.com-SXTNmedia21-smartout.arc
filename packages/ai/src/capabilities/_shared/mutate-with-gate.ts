/**
 * mutateWithGate — ergonomic wrapper around `gatedMutation()` (ADR-0204)
 * that implements the helper contract named by ADR-0287
 * ("`mutateWithGate()` typed wrapper").
 *
 * Why this exists:
 *   ADR-0287 promotes "every capability mutation tool calls gate_action
 *   before any DB write" from convention to enforced rule after three
 *   independent occurrences of the omission (shift_swap, contract_intake,
 *   helpdesk Phase 0). The companion CI lint `scripts/gate-action-coverage.ts`
 *   walks every capability tool body and rejects mutations not preceded by a
 *   gate call. This file gives authors the ergonomic default the rule
 *   recommends: one call, one return, atomic gate + write + emit.
 *
 * Relationship to existing primitives:
 *   - `gatedMutation()` (packages/ai/src/gate/gatedMutation.ts) is the
 *     canonical composition orchestrator (ADR-0204 §3). It runs Pathway A
 *     (`gate_action`) + Pathway B (`cascade_gate_write`) + the domain
 *     write inside a correlated audit chain. This wrapper delegates to it
 *     unchanged.
 *   - Per-capability `gate.ts` thin wrappers (journey/, shift-lifecycle/,
 *     communication/ etc.) wrap `gatedMutation()` for the legacy
 *     `callGateAction` shape. They survive — `mutateWithGate` is the
 *     forward-looking default that ADR-0287 §"Considered Options 3" names.
 *
 * What this adds over calling `gatedMutation()` directly:
 *   1. **L-0177 fail-fast guards.** Throws `MutateWithGateError` with code
 *      `missing_workspace_id` / `missing_profile_id` / `missing_capability`
 *      BEFORE any RPC call. Silent fallback to JWT-default workspace_id is
 *      a documented bug class (L-0177 + ADR-0151). Hard-error here so the
 *      caller cannot ship the same shape again.
 *   2. **Emit gate_evaluated** on every resolution path. ADR-0204 SS-3
 *      narrowed scope to "no emit" in the orchestrator itself; the wrapper
 *      is the SS-4+ wiring point. Routes posthog + logger + activity_trail
 *      per `gate_evaluated` registry entry (ADR-0204 M-02).
 *   3. **Smaller surface.** Common case (capability authority only, no
 *      cascade data-rule) uses sensible defaults for `entity_type` /
 *      `action` / `proposed_data` so call sites read like
 *      `mutateWithGate({ capability, action_type, workspaceId, profileId,
 *      exec })`. Authors who DO need cascade still drop down to
 *      `gatedMutation()` directly.
 *   4. **Explicit return shape.** `{ ok: true, result }` on success,
 *      throws `MutateWithGateDenied` on capability/data_rule deny. Tools
 *      catch the typed deny and map to `CapabilityToolResult` (ADR-0138)
 *      without pattern-matching reason strings (L-0133).
 *
 * Fail CLOSED on RPC error — never default-allow (L-0066 / L-0097).
 *
 * @gate-action-helper — this file IS the gate. The lint
 *   `scripts/gate-action-coverage.ts` treats any `execute` body containing
 *   `mutateWithGate(` as compliant.
 *
 * References:
 *   ADR-0099 — unified authority gate (gate_action RPC contract).
 *   ADR-0138 — CapabilityToolResult discriminated union.
 *   ADR-0151 — workspace_id is server-derived, never body-supplied.
 *   ADR-0173 — capability model + tool contract.
 *   ADR-0196 Invariant 11 — no partial work on gate failure.
 *   ADR-0204 — composition orchestrator (Pathway A + B + correlation).
 *   ADR-0287 — gate_action mandatory on mutation capability tools.
 *   L-0066   — default-allow capability authority = CVE-class trap.
 *   L-0133   — discriminate gate outcomes on dedicated fields, not reason.
 *   L-0177   — fail-fast on missing workspace_id / profile_id, never silent.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Json } from "@smartout/supabase";
import { emit, nonEmpty } from "@smartout/telemetry";
import { gatedMutation, type ComposedGateOutcome } from "../../gate/gatedMutation.js";
import type { SessionChannel } from "../types.js";

// ─────────────────────────────────────────────────────────────────────────
// Error types
// ─────────────────────────────────────────────────────────────────────────

/**
 * Base error raised by mutateWithGate. Discriminated on `code` so callers
 * can branch on the failure class without pattern-matching messages
 * (L-0133).
 */
export class MutateWithGateError extends Error {
  public readonly code:
    | "missing_workspace_id"
    | "missing_profile_id"
    | "missing_capability"
    | "missing_action_type"
    | "gate_unavailable"
    | "execute_failed";

  constructor(code: MutateWithGateError["code"], message: string) {
    super(message);
    this.name = "MutateWithGateError";
    this.code = code;
  }
}

/**
 * Deny surfaced as a typed exception so tools can `catch (err) { if (err
 * instanceof MutateWithGateDenied) … }` and map to ADR-0138
 * `CapabilityToolResult` without inspecting reason strings.
 *
 * Why throw rather than return: keeps the happy-path body in capability
 * tools shaped like normal procedural code — no `if (result.ok === false)
 * return …` boilerplate before the domain logic. Mirrors L-0133's
 * "discriminate on dedicated fields" by putting the field on the error
 * subclass instead of a union return.
 */
export class MutateWithGateDenied extends Error {
  public readonly deniedBy: "capability" | "data_rule";
  public readonly correlationId: string | undefined;
  public readonly gateEvaluationId: string | undefined;
  /** Set only on capability-deny via ADR-0099 downgrade_to='suggest'. */
  public readonly downgradedTo: string | undefined;
  /** Set only on capability-deny via ADR-0101 four-eyes. */
  public readonly fourEyesRequired: boolean;
  public readonly approversNeeded: number | undefined;
  public readonly approversPresent: string[] | undefined;
  /** Pathway B proposal id — set when cascade_gate_write turned the
   *  write into a change_proposal (this is a "soft deny"; the row was
   *  not written but a proposal exists). */
  public readonly proposalId: string | undefined;

  constructor(opts: {
    deniedBy: "capability" | "data_rule";
    reason: string;
    correlationId?: string;
    gateEvaluationId?: string;
    downgradedTo?: string;
    fourEyesRequired?: boolean;
    approversNeeded?: number;
    approversPresent?: string[];
    proposalId?: string;
  }) {
    super(opts.reason);
    this.name = "MutateWithGateDenied";
    this.deniedBy = opts.deniedBy;
    this.correlationId = opts.correlationId;
    this.gateEvaluationId = opts.gateEvaluationId;
    this.downgradedTo = opts.downgradedTo;
    this.fourEyesRequired = opts.fourEyesRequired ?? false;
    this.approversNeeded = opts.approversNeeded;
    this.approversPresent = opts.approversPresent;
    this.proposalId = opts.proposalId;
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Public args + return
// ─────────────────────────────────────────────────────────────────────────

/**
 * Caller signature for the wrapper. Required fields are everything the
 * authority gate needs to evaluate (workspace + actor + capability +
 * action_type + channel). The cascade-data-rule (Pathway B) inputs are
 * optional — when omitted the wrapper uses a `__authority_shadow_<cap>__`
 * sentinel `entity_type` that cannot match any framework_trigger row, so
 * Pathway B short-circuits `applied` and the domain write runs. This
 * preserves backward compatibility with capabilities that don't have
 * cascade rules yet.
 *
 * @template T — payload returned by `exec`. Forwarded to the caller as
 * `{ ok: true, result }`.
 */
export type MutateWithGateArgs<T> = {
  /** Workspace scope. Required. Hard-error on falsy. */
  workspaceId: string;
  /** Actor profile. Required. Hard-error on falsy. */
  profileId: string;
  /** Capability slug — must match an engine_authority_config row (or hit
   *  the ADR-0189-warned default-allow branch). Required. */
  capability: string;
  /** Action verb recorded on the audit row (e.g. "save", "complete",
   *  "submit_own_pii"). Required. */
  actionType: string;
  /** Originating channel. Drives ADR-0078 voice-to-PII guard. Defaults to
   *  "chat" when omitted — capability tools that may run on voice MUST
   *  pass the actual channel. */
  channel?: SessionChannel;
  /** Optional entity id — required by four-eyes (ADR-0101) to scope
   *  approvals per-entity. */
  targetId?: string | null;
  /** Optional ADR-0101 approver list. Defaults to `[profileId]` in the
   *  RPC. */
  approversPresent?: string[];
  /** Engine-process context. When set, gate_action checks
   *  `engine_process.allowed_channels` against `channel`. */
  engineProcessId?: string | null;
  engineStateId?: string | null;
  /**
   * Cascade data-rule (Pathway B) inputs. Omit when the capability has
   * no cascade rules — the wrapper substitutes a sentinel entity_type
   * that short-circuits to `applied` so the domain write runs.
   */
  cascade?: {
    /** Logical entity type (e.g. "schedule_shift", "engine_memory").
     *  Drives framework_trigger matching. */
    entityType: string;
    /** DML verb (distinct from `actionType` on Pathway A). */
    action: "create" | "update" | "delete";
    /** Proposed new state. `null` on delete. */
    proposedData: Json;
    /** Current row state for update/delete diffing. `null` on create. */
    currentData?: Json | null;
  };
  /** Domain write callback. Runs ONLY when both pathways allow. The
   *  return value is forwarded to the caller as
   *  `{ ok: true, result }`. */
  exec: (client: SupabaseClient) => Promise<T>;
};

/** Wrapper return on the success path. Throws on deny / error. */
export type MutateWithGateOk<T> = {
  ok: true;
  result: T;
  gateEvaluationId: string;
  correlationId: string;
  /** Set when cascade_gate_write returned outcome=proposed — write was
   *  converted to a change_proposal; `exec` did NOT run. `result` is
   *  whatever the caller's exec WOULD have returned, but is undefined-
   *  shaped here because exec was skipped. Callers should branch on
   *  proposalId being set. */
  proposalId?: string;
};

// ─────────────────────────────────────────────────────────────────────────
// Helper
// ─────────────────────────────────────────────────────────────────────────

const SENTINEL_ENTITY_TYPE = (capability: string): string => `__authority_shadow_${capability}__`;

/**
 * Gate + write + emit. One call, one decision, one audit chain.
 *
 * Behaviour:
 *   1. L-0177 fail-fast — throws MutateWithGateError on missing
 *      workspaceId / profileId / capability / actionType.
 *   2. Delegates to gatedMutation() with either the caller's cascade
 *      args or the sentinel shadow that short-circuits Pathway B.
 *   3. On capability/data_rule deny — emits gate_evaluated(deny) and
 *      throws MutateWithGateDenied with all ADR-0101/0099 metadata
 *      attached.
 *   4. On allow — runs exec (already inside gatedMutation), emits
 *      gate_evaluated(allow), returns { ok: true, result, correlation_id }.
 *   5. On not_implemented / gate transport failure — emits
 *      gate_evaluated(deny, denied_by=not_implemented) and throws
 *      MutateWithGateError(code=gate_unavailable). Fail CLOSED.
 *
 * Exec contract: the callback receives the same SupabaseClient the
 * orchestrator uses so domain writes transact against the same session.
 * Throwing from exec is translated by gatedMutation into a
 * `not_implemented` deny; we re-throw as
 * MutateWithGateError(execute_failed) so callers can branch on the
 * write-failure class distinctly from gate-failure.
 */
export async function mutateWithGate<T>(
  client: SupabaseClient,
  args: MutateWithGateArgs<T>,
): Promise<MutateWithGateOk<T>> {
  // ─── L-0177 fail-fast guards ─────────────────────────────────────────
  // Silent fallback to JWT-default workspace_id is a documented bug class
  // (L-0177 + ADR-0151). Refuse to evaluate the gate with falsy inputs.
  if (!args.workspaceId || args.workspaceId.trim() === "") {
    throw new MutateWithGateError(
      "missing_workspace_id",
      "mutateWithGate: workspaceId is required and must be non-empty (L-0177)",
    );
  }
  if (!args.profileId || args.profileId.trim() === "") {
    throw new MutateWithGateError(
      "missing_profile_id",
      "mutateWithGate: profileId is required and must be non-empty (L-0177)",
    );
  }
  if (!args.capability || args.capability.trim() === "") {
    throw new MutateWithGateError(
      "missing_capability",
      "mutateWithGate: capability is required (ADR-0287)",
    );
  }
  if (!args.actionType || args.actionType.trim() === "") {
    throw new MutateWithGateError(
      "missing_action_type",
      "mutateWithGate: actionType is required (ADR-0099)",
    );
  }

  const channel: SessionChannel = args.channel ?? "chat";
  let execResult: T | undefined = undefined;
  let execThrewMessage: string | null = null;

  // ─── gatedMutation delegation ────────────────────────────────────────
  // Capture the caller's exec return so we can forward it on the
  // success path. gatedMutation's MutationExecute return type is
  // { ok: true } | { ok: false; reason }, so we wrap the caller's
  // callback to capture T while still satisfying the orchestrator
  // contract.
  const useCascade = args.cascade !== undefined;
  const entityType = useCascade ? args.cascade!.entityType : SENTINEL_ENTITY_TYPE(args.capability);
  const action = useCascade ? args.cascade!.action : "create";
  const proposedData: Json = useCascade ? args.cascade!.proposedData : ({} as Json);
  const currentData: Json | null = useCascade ? (args.cascade!.currentData ?? null) : null;

  const outcome: ComposedGateOutcome = await gatedMutation(client, {
    workspace_id: args.workspaceId,
    actor_profile_id: args.profileId,
    capability: args.capability,
    channel,
    action_type: args.actionType,
    entity_id: args.targetId ?? null,
    entity_type: entityType,
    action,
    proposed_data: proposedData,
    current_data: currentData,
    approvers_present: args.approversPresent,
    engine_process_id: args.engineProcessId ?? null,
    engine_state_id: args.engineStateId ?? null,
    execute: async (db) => {
      try {
        execResult = await args.exec(db);
        return { ok: true };
      } catch (err) {
        execThrewMessage = err instanceof Error ? err.message : String(err);
        return { ok: false, reason: execThrewMessage };
      }
    },
  });

  // ─── Emit + branch on outcome ────────────────────────────────────────
  if (outcome.ok === true) {
    // Success path. Note: when proposalId is set the orchestrator did NOT
    // invoke exec — Pathway B materialised a change_proposal instead.
    // Emit allow with proposal_id; return ok:true with the proposal id
    // surfaced so callers can branch on it.
    await safeEmit({
      capability: args.capability,
      actionType: args.actionType,
      channel,
      allow: true,
      deniedBy: null,
      correlationId: outcome.correlation_id,
      gateEvaluationId: outcome.gate_evaluation_id || null,
      proposalId: outcome.proposal_id ?? null,
      workspaceId: args.workspaceId,
      profileId: args.profileId,
    });

    // exec was skipped because of proposal — surface that explicitly.
    if (outcome.proposal_id) {
      return {
        ok: true,
        result: execResult as T, // undefined here; caller branches on proposalId
        gateEvaluationId: outcome.gate_evaluation_id,
        correlationId: outcome.correlation_id,
        proposalId: outcome.proposal_id,
      };
    }

    // exec failed inside the callback. Surface as a typed write-failure
    // rather than a gate failure so the caller can distinguish.
    if (execThrewMessage !== null) {
      throw new MutateWithGateError(
        "execute_failed",
        `mutateWithGate: exec callback threw: ${execThrewMessage}`,
      );
    }

    return {
      ok: true,
      result: execResult as T,
      gateEvaluationId: outcome.gate_evaluation_id,
      correlationId: outcome.correlation_id,
    };
  }

  // Deny path. Emit gate_evaluated(allow=false) regardless of class.
  await safeEmit({
    capability: args.capability,
    actionType: args.actionType,
    channel,
    allow: false,
    deniedBy: outcome.denied_by,
    correlationId: outcome.correlation_id ?? "",
    gateEvaluationId: outcome.gate_evaluation_id ?? null,
    proposalId: null,
    workspaceId: args.workspaceId,
    profileId: args.profileId,
  });

  if (outcome.denied_by === "not_implemented") {
    // RPC transport failure or feature flag OFF — fail closed.
    throw new MutateWithGateError(
      "gate_unavailable",
      `mutateWithGate: gate unavailable: ${outcome.reason}`,
    );
  }

  // capability or data_rule deny — typed exception with metadata.
  throw new MutateWithGateDenied({
    deniedBy: outcome.denied_by,
    reason: outcome.reason,
    correlationId: outcome.correlation_id,
    gateEvaluationId: outcome.gate_evaluation_id,
    downgradedTo:
      outcome.denied_by === "capability" && outcome.downgraded ? outcome.downgrade_to : undefined,
    fourEyesRequired: outcome.denied_by === "capability" ? outcome.four_eyes_required : undefined,
    approversNeeded: outcome.denied_by === "capability" ? outcome.approvers_needed : undefined,
    approversPresent: outcome.denied_by === "capability" ? outcome.approvers_present : undefined,
  });
}

// ─────────────────────────────────────────────────────────────────────────
// Internal — emit
// ─────────────────────────────────────────────────────────────────────────

/**
 * Emit `gate_evaluated` without ever throwing back into the caller's
 * happy path. Telemetry is observability; a failure to emit must not
 * surface as a gate failure (would invert ADR-0204 §5 "audit is
 * post-decision").
 *
 * Registry routing: posthog + logger + activity_trail (declared in
 * packages/telemetry/src/registry.ts at the `gate_evaluated` entry).
 */
async function safeEmit(opts: {
  capability: string;
  actionType: string;
  channel: SessionChannel;
  allow: boolean;
  deniedBy: "capability" | "data_rule" | "not_implemented" | null;
  correlationId: string;
  gateEvaluationId: string | null;
  proposalId: string | null;
  workspaceId: string;
  profileId: string;
}): Promise<void> {
  try {
    // NonEmptyString brand — wrap via nonEmpty() which is a no-op brand
    // cast when the value is non-empty (it throws on empty in dev/test,
    // returns sentinel in prod). We already passed the L-0177 fail-fast
    // guards at function entry so this is the safe path.
    await emit({
      event: "gate_evaluated",
      workspace_id: nonEmpty(opts.workspaceId, "workspace_id"),
      actor_id: nonEmpty(opts.profileId, "actor_id"),
      correlation_id: opts.correlationId || undefined,
      properties: {
        data: {
          capability: opts.capability,
          action_type: opts.actionType,
          channel: opts.channel,
          allow: opts.allow,
          denied_by: opts.deniedBy,
          correlation_id: opts.correlationId,
          gate_evaluation_id: opts.gateEvaluationId,
          proposal_id: opts.proposalId,
        },
      },
    });
  } catch {
    // Swallow — emit failure must not invert a gate decision.
  }
}
