/**
 * Gate Client — thin wrapper that routes writes through `cascade_gate_write()` RPC
 * before executing the underlying Supabase mutation.
 *
 * ADR-0091 WP3 — unblocks ADR-0114 R3 enforcement.
 *
 * Every caller (Server Action, capability tool, service-role script) MUST use
 * `gatedInsert` / `gatedUpdate` / `gatedDelete` when writing to a governance-gated
 * entity (see `isGovernanceGated()` in `@smartout/data`).
 *
 * Wire protocol: the RPC returns a JSON outcome. We translate its three shapes
 * into a single canonical `GatedWriteResult<T>`:
 *   - `{ allowed: true }`                  → proceed with the write, return rows
 *   - `{ allowed: true, exception: ... }`  → proceed, bubble exception reason up
 *   - `{ allowed: false, proposal_id }`    → throw GateDeniedError ("proposed")
 *   - `{ allowed: false, reason }`         → throw GateDeniedError ("blocked")
 *
 * Callers that need to render "review required" as a first-class UI state
 * should catch `GateDeniedError` and inspect `err.outcome`.
 *
 * NOTE: call-site migration is intentionally deferred to a follow-up PR.
 * This file only exposes the primitive; existing `.from().insert()` call sites
 * remain unchanged and are flagged at `warn` severity by the accompanying
 * `smartout/no-direct-supabase-write` ESLint rule.
 */

/**
 * Structural type for any Supabase client that supports `.from()` and `.rpc()`.
 * Matches the pattern used in `vault.ts` — structural typing avoids version
 * mismatches across the monorepo (app can pass anon client, service client, etc.).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyBuilder = any;

/**
 * Structural type for the `cascade_gate_write` RPC overload.
 *
 * The generated `Database` types in `database.types.ts` have not been
 * regenerated since the RPC migration shipped, so the typed
 * `SupabaseClient<Database>.rpc()` signature (which whitelists names from
 * `Database["public"]["Functions"]`) rejects `"cascade_gate_write"`. We
 * widen the signature here so any client whose `.rpc()` can accept both
 * known RPCs AND our RPC name is structurally assignable to
 * `SupabaseGateClient`. Remove once `db:gen-types` regenerates the types
 * and `cascade_gate_write` appears in the generated `Functions` map.
 *
 * The overload union is intentional: it preserves callability from callers
 * that still have the strict generated type (they satisfy the first overload
 * via structural assignability on the arg shape) while permitting us to
 * invoke with the literal `"cascade_gate_write"` in this file.
 */
export type SupabaseGateClient = {
  rpc: {
    (
      fn: "cascade_gate_write",
      args: CascadeGateRpcArgs,
    ): PromiseLike<{ data: unknown; error: { message: string } | null }>;
    (
      fn: string,
      args?: Record<string, unknown>,
    ): PromiseLike<{ data: unknown; error: { message: string } | null }>;
  };
  from: (table: string) => AnyBuilder;
};

/**
 * Context passed to every gated write. All fields are forwarded to the RPC
 * so the gate can evaluate framework rules, authority, and audit the decision.
 *
 * `actorProfileId` is optional — the gate will fall back to `auth.uid()` when
 * absent. Service-role callers (stage-engine, cron jobs) MUST supply it,
 * otherwise `assert_gate_caller()` inside the RPC will raise SQLSTATE 42501.
 */
export type GateContext = {
  entityType: string;
  entityId?: string | null;
  workspaceId: string;
  capability?: string | null;
  actorProfileId?: string | null;
  /** Current row data — required for UPDATE/DELETE so the gate can diff. */
  currentData?: Record<string, unknown> | null;
  /**
   * Column name for the WHERE clause on update/delete. Defaults to `"id"`.
   * Use `"{table}_id"` for Smartout convention tables (e.g. `"profile_id"`,
   * `"schedule_shift_id"`). Without this, `gatedUpdate`/`gatedDelete` will
   * silently match zero rows on tables whose PK is not literally `id`.
   */
  entityIdColumn?: string;
};

/**
 * Canonical outcome — mirrors the `GateResponse` shape from ADR-0091.
 *
 * The SQL function (`cascade_gate_write`, migration 20260512100000 + the
 * assert-caller patch in 20260512100200) currently emits only `"applied"`
 * or `"proposed"`. `"blocked"` and `"applied_with_exception"` are reserved
 * for future RPC iterations — specifically WP1's deep rule evaluation
 * (`evaluate_framework_rules`), which will introduce hard blocks and
 * exception-carrying allows.
 *
 * The client is tolerant of all four values so callers can begin handling
 * them today; callers MAY start receiving `"blocked"` once WP1 ships.
 */
export type GateOutcome = "applied" | "applied_with_exception" | "proposed" | "blocked";

/**
 * Raised when the gate denies a write. Callers render this as a first-class
 * state (proposal toast, blocked banner) — NOT as a generic mutation failure.
 */
export class GateDeniedError extends Error {
  public readonly outcome: Extract<GateOutcome, "proposed" | "blocked">;
  public readonly proposalId: string | null;
  public readonly reason: string | null;

  constructor(args: {
    outcome: Extract<GateOutcome, "proposed" | "blocked">;
    proposalId?: string | null;
    reason?: string | null;
  }) {
    super(args.reason ?? `gate_${args.outcome}`);
    this.name = "GateDeniedError";
    this.outcome = args.outcome;
    this.proposalId = args.proposalId ?? null;
    this.reason = args.reason ?? null;
  }
}

/**
 * Result of a successful gated write. `exceptionReason` is populated only
 * when the gate returned `allowed_with_exception` — the write proceeded, but
 * the audit trail carries the reason.
 */
export type GatedWriteResult<T> = {
  data: T[];
  outcome: Extract<GateOutcome, "applied" | "applied_with_exception">;
  exceptionReason: string | null;
};

type CascadeGateRpcArgs = {
  p_entity_type: string;
  p_entity_id: string | null;
  p_action: "create" | "update" | "delete";
  p_workspace_id: string;
  p_proposed_data: Record<string, unknown> | Record<string, unknown>[] | null;
  p_current_data: Record<string, unknown> | null;
  p_actor_profile_id: string | null;
  p_capability: string | null;
};

type GateRpcResponse = {
  allowed: boolean;
  outcome?: GateOutcome;
  proposal_id?: string | null;
  reason?: string | null;
  exception_reason?: string | null;
};

/**
 * Invokes `cascade_gate_write()` and translates the JSON response into
 * either a success outcome or a `GateDeniedError`. Always called BEFORE
 * the underlying mutation so the gate and the write share a transaction
 * boundary at the DB level (RPC inserts audit row + optional proposal).
 */
async function callGate(
  client: SupabaseGateClient,
  action: "create" | "update" | "delete",
  proposedData: Record<string, unknown> | Record<string, unknown>[] | null,
  ctx: GateContext,
): Promise<{
  outcome: Extract<GateOutcome, "applied" | "applied_with_exception">;
  exceptionReason: string | null;
}> {
  const { data, error } = await client.rpc("cascade_gate_write", {
    p_entity_type: ctx.entityType,
    p_entity_id: ctx.entityId ?? null,
    p_action: action,
    p_workspace_id: ctx.workspaceId,
    p_proposed_data: proposedData,
    p_current_data: ctx.currentData ?? null,
    p_actor_profile_id: ctx.actorProfileId ?? null,
    p_capability: ctx.capability ?? null,
  });

  if (error) {
    throw new Error(`cascade_gate_write failed: ${error.message}`);
  }

  const response = (data ?? {}) as GateRpcResponse;

  if (response.allowed) {
    const outcome: Extract<GateOutcome, "applied" | "applied_with_exception"> =
      response.outcome === "applied_with_exception" ? "applied_with_exception" : "applied";
    return {
      outcome,
      exceptionReason: response.exception_reason ?? null,
    };
  }

  const deniedOutcome: Extract<GateOutcome, "proposed" | "blocked"> =
    response.outcome === "proposed" ? "proposed" : "blocked";

  throw new GateDeniedError({
    outcome: deniedOutcome,
    proposalId: response.proposal_id ?? null,
    reason: response.reason ?? null,
  });
}

/**
 * Gated INSERT. Calls the gate first; if allowed, executes the insert and
 * returns the inserted rows alongside the gate outcome.
 *
 * NOTE: `ctx.entityId` (when supplied) is forwarded to the gate RPC only —
 * this helper does NOT filter inserted rows by PK. The write always inserts
 * exactly `rows` and returns the resulting rows via `.select()`. Callers
 * that pre-generate PKs client-side should still pass `ctx.entityId` so the
 * gate can audit the intended key. `ctx.entityIdColumn` is ignored for
 * inserts.
 *
 * @throws GateDeniedError when the gate returns `{ allowed: false }`.
 */
export async function gatedInsert<T = unknown>(
  client: SupabaseGateClient,
  table: string,
  rows: Record<string, unknown> | Record<string, unknown>[],
  ctx: GateContext,
): Promise<GatedWriteResult<T>> {
  const gateResult = await callGate(client, "create", rows, ctx);

  const { data, error } = await client.from(table).insert(rows).select();

  if (error) {
    throw new Error(`gatedInsert(${table}) write failed after gate allowed: ${error.message}`);
  }

  return {
    data: (data ?? []) as T[],
    outcome: gateResult.outcome,
    exceptionReason: gateResult.exceptionReason,
  };
}

/**
 * Gated UPDATE. The caller must supply `ctx.entityId` so the gate can diff
 * old vs proposed state. Pass matching filters via the returned builder is
 * NOT supported — this wrapper assumes you're updating by primary key and
 * applies `.eq(ctx.entityIdColumn ?? 'id', ctx.entityId)` for you.
 *
 * PK column default is `'id'` for back-compat. Set `ctx.entityIdColumn` to
 * `'{table}_id'` for Smartout convention tables (e.g. `'profile_id'`).
 *
 * For more complex updates, use the RPC directly and bypass this helper.
 *
 * @throws GateDeniedError when the gate returns `{ allowed: false }`.
 */
export async function gatedUpdate<T = unknown>(
  client: SupabaseGateClient,
  table: string,
  patch: Record<string, unknown>,
  ctx: GateContext,
): Promise<GatedWriteResult<T>> {
  if (!ctx.entityId) {
    throw new Error(
      `gatedUpdate(${table}) requires ctx.entityId — UPDATE without a PK target is ambiguous for the gate.`,
    );
  }

  const gateResult = await callGate(client, "update", patch, ctx);

  const pkColumn = ctx.entityIdColumn ?? "id";
  const { data, error } = await client
    .from(table)
    .update(patch)
    .eq(pkColumn, ctx.entityId)
    .select();

  if (error) {
    throw new Error(`gatedUpdate(${table}) write failed after gate allowed: ${error.message}`);
  }

  return {
    data: (data ?? []) as T[],
    outcome: gateResult.outcome,
    exceptionReason: gateResult.exceptionReason,
  };
}

/**
 * Gated DELETE. The caller must supply `ctx.entityId`. The gate sees the
 * current row (via `ctx.currentData` if supplied) and can convert the delete
 * into a `change_proposal` when policy requires review.
 *
 * PK column resolution mirrors `gatedUpdate`: defaults to `'id'`, override
 * via `ctx.entityIdColumn` for Smartout-convention tables.
 *
 * @throws GateDeniedError when the gate returns `{ allowed: false }`.
 */
export async function gatedDelete<T = unknown>(
  client: SupabaseGateClient,
  table: string,
  ctx: GateContext,
): Promise<GatedWriteResult<T>> {
  if (!ctx.entityId) {
    throw new Error(
      `gatedDelete(${table}) requires ctx.entityId — DELETE without a PK target is ambiguous for the gate.`,
    );
  }

  const gateResult = await callGate(client, "delete", null, ctx);

  const pkColumn = ctx.entityIdColumn ?? "id";
  const { data, error } = await client.from(table).delete().eq(pkColumn, ctx.entityId).select();

  if (error) {
    throw new Error(`gatedDelete(${table}) write failed after gate allowed: ${error.message}`);
  }

  return {
    data: (data ?? []) as T[],
    outcome: gateResult.outcome,
    exceptionReason: gateResult.exceptionReason,
  };
}
