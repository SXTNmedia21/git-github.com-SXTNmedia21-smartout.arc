---
title: "Contract Draft Proposals Flow Through Unified apply_cascade()"
id: ADR_0093
status: accepted
layer: decision
created: 2026-04-14
updated: 2026-04-14
module: cascade
tags: [adr, cascade, c4-governance, contract, adr-0076-amendment, phase-e]
---

# ADR-0093: Contract Draft Proposals Flow Through Unified apply_cascade()

> Amends ADR-0076 (Contract Composition as Cascade Derivation).

## Context and Problem Statement

ADR-0076 established that contract composition produces a `change_proposal` of type `contract_draft` — compliance enters the same review flow as any other cascade-derived change. But ADR-0076 was written before Phase E committed to a single `apply_cascade()` dispatch table as the canonical execution path for proposal application (Phase E WP2).

That commitment creates a decision point the original ADR deferred: does `contract_draft` application run through `apply_cascade()` like every other proposal type, or does it keep the ad-hoc branch currently living in `supabase/functions/apply-change-proposal/index.ts`? Two different execution paths for "apply a proposal" would fork the cascade pipeline invariant — the thing Phase E is specifically trying to prevent.

A secondary concern: `contract_intake` as a capability is explicitly chat-only per ADR-0078 (voice is forbidden for PII). The unified application path must preserve that channel restriction at the point where the proposal is generated **and** at the point where notifications about its lifecycle are emitted, not only at tool invocation time.

## Decision Drivers

- **Canonical pipeline invariant:** `apply_cascade()` MUST be the single path for materialising every `change_proposal.status = 'approved'` into concrete rows. One dispatch table, one audit pattern, one set of telemetry events.
- **No hidden execution paths:** the current if/else in `apply-change-proposal/index.ts` (workspace_hours, department_hours, department_type) is explicitly called out by ADR-0056 as "to be replaced". `contract_draft` must not become the fourth if-branch.
- **PII channel restriction is end-to-end:** ADR-0078's chat-only guarantee is worth nothing if `contract_draft`'s notification emitter defaults to SMS or voice for "your contract is ready to sign."
- **Provenance preservation:** ADR-0076 records compliance overrides as JSONB provenance on `employment_contract`. The unified handler must write that provenance from the proposal payload, not reconstruct it.

## Considered Options

1. **Unified — `apply_cascade()` dispatch table with a `contract_draft` handler (chosen).** A single SQL/TS dispatch map routes by `change_proposal.change_type`. The `contract_draft` entry points at a handler in `packages/data/src/cascade/handlers/contract-draft.ts` that materialises the `employment_contract` row, writes ADR-0076 provenance, and emits channel-restricted notifications.
2. **Separate cascade derivation path.** Contract drafts get their own `compose_contract_draft()` / `apply_contract_draft()` pair outside `apply_cascade()`. The dispatch table only covers "native cascade" changes.
3. **Keep the Edge Function if/else.** Add a fourth branch for `contract_draft` and defer unification.

## Decision Outcome

Chosen option: **"Unified — `apply_cascade()` dispatch table with a `contract_draft` handler"**, because it is the only option that preserves the canonical pipeline invariant Phase E is built on. Two execution paths would mean two audit patterns, two telemetry registries, two test surfaces, and eventually two sources of drift. The dispatch table was the central idea of ADR-0056; carving out contract_draft would invalidate its premise on day one of its existence.

Option 2 was rejected because "contract composition is a special kind of cascade" is exactly the conclusion ADR-0076 pushed back against. ADR-0076's whole claim is that composition IS cascade derivation. Option 3 was rejected because it extends a pattern that ADR-0056 already flagged for replacement.

### Handler contract (`contract_draft`)

The `apply_cascade()` dispatch maps `change_type = 'contract_draft'` to a handler with the signature:

```ts
type ApplyHandler = (args: {
  proposal: ChangeProposal;          // row from change_proposal
  workspace_id: string;
  actor_profile_id: string;
  tx: SupabaseClient;                // caller's transactional client
}) => Promise<ApplyResult>;
```

The `contract_draft` handler:

1. Reads `proposal.changes` (which conforms to a Zod `ContractDraftPayload` schema defined in `@smartout/data/cascade/handlers/contract-draft.ts`).
2. Inserts the `employment_contract` row.
3. Writes the ADR-0076 overrides-as-JSONB-provenance block into `employment_contract.compliance_provenance`.
4. Enqueues notifications via `@smartout/notifications`, **forcing `allowed_channels = ['chat']`** (per ADR-0078) regardless of the recipient's channel preferences. The handler does not read preferences; the restriction is encoded at the handler.
5. Emits a `change_proposal.applied` telemetry event (registry entry added in WP2).

### Agent invocation path

When the `contract_intake` capability creates the proposal (via a `create_contract_draft` tool), the tool runs under the chat-only guard from ADR-0078 at invocation time (`ctx.channel === 'chat'` assertion). ADR-0091's governance gate then runs; it returns `outcome: 'proposed'` with the `proposal_id`. When an admin later approves the proposal, `apply_cascade()` dispatches to the unified handler, which re-applies the chat-only restriction at notification time. The channel restriction therefore holds at three layers: capability `allowedChannels`, runtime `ctx.channel` guard, handler-forced notification channels. This matches the three-layer defence model referenced in project memory (ADR-0077 + ADR-0078).

## Rules & Consequences

- **Good, because** there is one dispatch table. Every new proposal type adds one handler entry, with the same shape, same telemetry, same audit row.
- **Good, because** ADR-0078's channel restriction is preserved end-to-end: tool → gate → apply handler all enforce chat-only. The notification emitter cannot accidentally reach for SMS when signing urls travel through PII-adjacent payloads.
- **Good, because** ADR-0076's JSONB provenance model doesn't move — the handler is the single writer, provenance stays on the row.
- **Bad, because** the handler must duplicate some logic that today lives in the `contract-service` (Fastify, port 5012). Either the handler calls out to `contract-service` (adding a network hop inside `apply_cascade()`), or contract-service's composition logic moves into `@smartout/data`. Phase E WP2 resolves this — the preferred direction is the latter (composition is cascade derivation, so it belongs in `packages/data`, not a service).
- **Bad, because** the handler is now responsible for notification channel policy. This is slight scope creep vs "handlers only write rows" — mitigated by keeping the `allowed_channels` override as a single line in the handler and the policy rationale pointed at ADR-0078.
- **Agent Impact:**
  - `contract-service` owners: composition logic that produces `change_proposal.changes` for `contract_draft` must be published through `@smartout/data` (either imported or called via stable RPC). WP2 will stage the move.
  - Agent tool authors: `create_contract_draft` and related tools continue to be chat-only; verify `ctx.channel` at tool entry. The gate's `proposed` outcome is the success case for these tools, not an error.
  - Notification authors: never add a fallback channel to contract notifications. The handler hard-codes chat; respect it.

---

> Amends ADR-0076. Registered in `docs/decisions/0000-decision-log.md`.
