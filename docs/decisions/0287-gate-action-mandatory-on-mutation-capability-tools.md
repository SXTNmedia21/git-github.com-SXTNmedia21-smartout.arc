---
title: "gate_action mandatory on all mutation capability tools"
id: ADR-0287
status: proposed
layer: decision
created: 2026-04-23
updated: 2026-04-23
supersedes: []
amends: [ADR_0099, ADR_0173]
related: [ADR_0078, ADR_0099, ADR_0173, ADR_0189, ADR_0191, ADR_0196, LEARNING_0066, LEARNING_0097, LEARNING_0126, LEARNING_0130]
---

# ADR-0287: gate_action mandatory on all mutation capability tools

## Context and Problem Statement

Hospitality gap analysis (Council 2026-04-23) found the `shift_swap` capability tool mutating `schedule_shift` + `shift_swap_request` tables without a `gate_action` call. The tool relied on the target RPC's `SECURITY DEFINER` + RLS to enforce authorization. This is the **third observed occurrence** of the same pattern:

1. `contract_intake` Gap A1 (earlier, tracked in contract-intake audits) — capability tool invoked RPC, RPC had admin-gated `SECURITY DEFINER`, no `gate_action` in the tool. Authority ladder invisible at capability layer.
2. `shift_swap` (this council) — capability tool invoked Server Action, Server Action wrote direct SQL with RLS on the target table, no `gate_action` in the tool.
3. `helpdesk` Phase 0 — similar shape before ADR-0163 fail-closed amendment forced `allowedChannels` at registration.

The recurring pattern: developers read "RPC is SECURITY DEFINER + RLS covers it" as sufficient. It is not. `gate_action` is the *capability-level* authority contract (ADR-0099) — it evaluates `engine_authority_config` rows per `(workspace_id, capability)` and returns an `authority_level` (`read_only` / `suggest` / `confirm` / `autonomous`) that downstream code (tool-selector, agent-router, emit routing) uses to decide whether the tool is visible, whether the agent can call it, whether four-eyes is required, and whether the action emits audit events. SQL-level RLS enforces "can this session touch this row"; `gate_action` enforces "can this capability execute at this authority level in this workspace right now". They answer different questions. L-0066 / L-0097 named the CVE-class trap (default-allow on missing seed); ADR-0189 closed the *seed-parity* hole; this ADR closes the *call-site* hole.

L-0130 surfaced that soft rules ("remember to call gate_action") do not survive three concurrent authors. Every subsequent capability merging without a `gate_action` call reinforces the broken precedent (L-0131), making the next author's shortcut easier.

## Decision Drivers

- **Recurrence threshold crossed.** Three independent capability tools have shipped with this exact omission. Per Smartout's promotion rule (3 occurrences → enforced rule), this becomes a hard invariant, not a convention.
- **L-0066 / L-0097 are about defaults; this ADR is about call sites.** ADR-0189 enforces that every registered capability has a seed row. But a seed row cannot save a capability whose tool code never calls `gate_action` in the first place. The two controls are orthogonal.
- **Authority shape is a capability-level contract (ADR-0099 / ADR-0173).** Capability = intent + authority + channel. A tool that mutates without evaluating its own authority is a tool that has forgotten what capability it implements.
- **Seamless with pathway-A infrastructure.** `gate_action` helper already exists (`packages/ai/src/capabilities/gate.ts` — or equivalent), already wraps the RPC, already throws typed errors. No new primitive required; the rule is "call the helper in every mutation tool's `execute()` before DB writes".
- **CI enforcement is cheap.** AST-walk every tool under `packages/ai/src/capabilities/**/*.ts` (and `packages/ai/src/tools/**/*.ts` per the current layout), flag any `execute()` function that contains a supabase mutation (`.insert()` / `.update()` / `.delete()` / `.rpc()` to known-mutation RPCs) but does not contain a `gate_action` / `gateAction` call upstream of the mutation. Script pattern mirrors ADR-0189's `authority-seed-parity.ts` and ADR-0190's `cascade-gate-entity-type-coverage.ts`.
- **ADR-0196 Invariant #13 is the campaign-local cousin.** Journey Engine's ADR-0196 asserts "every mutation capability calls `callGateAction`". This ADR generalizes Invariant #13 to every capability, not only journey — same rule, wider scope.

## Considered Options

1. **Continue relying on convention + reviewer vigilance.** REJECTED. Three occurrences in three different campaigns over ~60 days prove convention does not hold. L-0117 pattern (grep counts without code-trace catch nothing at review time).
2. **Promote to ESLint rule only.** REJECTED on its own — an ESLint rule detects identifier presence but not ordering (did `gate_action` run *before* the mutation?). Also bypassable via re-export or dynamic dispatch. ESLint as a *secondary* control alongside AST CI check is fine; as the primary control, insufficient.
3. **AST CI check + typed wrapper.** CHOSEN. Two complementary controls:
   - **Primary: AST CI check** — `scripts/gate-action-coverage.ts` walks all capability tool files, extracts `execute()` functions, scans for mutation calls, and fails build on any tool where a mutation exists but no `gate_action` call precedes it. Inline allow-list with `reason` + `adr_or_ticket` for narrow exceptions (e.g., intentionally-unauthenticated read-only query tools). Wired into CI alongside `authority-seed-parity` and `cascade-gate-entity-type-coverage`.
   - **Secondary: typed wrapper `mutateWithGate()`** — optional ergonomic helper in `packages/ai/src/capabilities/gate.ts` that accepts `(capability, context, mutationFn)` and calls `gate_action` + emits the `gate.*` audit event + runs the mutation. Not mandatory (tools may call `gate_action` directly if they need fine-grained control), but the default path. Adopting the helper moves CI coverage from "did the tool call gate_action?" to "did the tool call the helper?" — cheaper to maintain, harder to bypass.

## Decision Outcome

Chosen option: **"AST CI check + typed wrapper"**, because (a) it closes the call-site hole orthogonally to ADR-0189's seed-parity hole, (b) it generalizes ADR-0196 Invariant #13 from campaign-scoped to repo-scoped without duplicating mechanism, and (c) it promotes L-0066 / L-0097 from canonical learnings to enforced rule after the third occurrence triggered the promotion threshold.

### Rule (enforced)

> **Every capability tool whose `execute()` performs a state mutation (INSERT / UPDATE / DELETE / mutation-RPC) MUST call `gate_action` (directly or via `mutateWithGate()`) BEFORE the mutation. Reading data does not require `gate_action`.**

Exceptions allowed only via inline allow-list in the CI script with `{ file, capability, reason, adr_or_ticket, expires_at }`. Allow-list entries reviewed quarterly.

### CI check shape

Script `scripts/gate-action-coverage.ts`:

1. Glob `packages/ai/src/capabilities/**/*.ts` + `packages/ai/src/tools/**/*.ts` (exclude `*.test.ts`, `*.spec.ts`).
2. Parse each file via `ts-morph`.
3. For each exported object with a `SmartoutTool`-shape signature (detected by type or convention), walk the `execute` method body.
4. Collect mutation call sites: `.insert(`, `.update(`, `.delete(`, `.rpc(<known-mutation-rpc>)`. The mutation-RPC allow-list is maintained alongside the script.
5. Collect `gate_action` / `gateAction` / `mutateWithGate` call sites in the same `execute()`.
6. Fail build if any mutation call exists with no `gate_action` call preceding it (AST-order, not textual-order, where practical; in practice: gate call must appear in the same function scope before the mutation call).
7. Emit a structured error: `capability=X, file=Y, line=Z, mutation=\`method\`, gate_action=missing`.

### Ship order

1. Write `scripts/gate-action-coverage.ts` + unit tests for its AST walk.
2. Run it locally against current `packages/ai/src/capabilities/**` — expect failures (shift_swap at minimum; contract_intake if not already remediated; any other hits).
3. Remediate failures (add `gate_action` call) OR add allow-list entries with ADR justification.
4. Wire into CI as required job.
5. Add `mutateWithGate()` helper, migrate shift_swap + 2–3 others as the pattern template, then let new capabilities opt in.

### Amendment to ADR-0099

Add to ADR-0099 §Rules: Every capability tool performing a state mutation MUST call `gate_action` before the mutation. Seed-parity (ADR-0189) covers the *existence* of an authority row; call-site coverage (this ADR) covers the *use* of that row. Both are required; neither is sufficient alone.

### Amendment to ADR-0173

Add to ADR-0173 §Capability Tool Contract: Any tool registered as a mutation capability (non-read_only) must call `gate_action` in `execute()`. Tools declared as read-only (e.g., `CapabilityName.query`) are exempt.

## Rules & Consequences

- **Good, because** the authority contract becomes honest at ship time: no capability tool can mutate state invisibly to the authority-level machinery. The three observed occurrences are closed and cannot regress without an allow-list exception that itself requires an ADR.
- **Good, because** promotion from canonical learning (L-0066 / L-0097) to enforced rule is proportionate to the recurrence data. Three occurrences in ~60 days crosses the promotion threshold; rule-not-convention is the right response.
- **Good, because** the check runs alongside ADR-0189 and ADR-0190 Control 2 in the same CI workflow job, reusing AST infra and maintainer muscle memory. Marginal CI cost is near-zero.
- **Bad, because** AST coverage is fragile to re-exports and dynamic dispatch. Mitigation: the check walks by *identifier* `gate_action` / `gateAction` / `mutateWithGate` regardless of import path (same mitigation as ADR-0190 Control 4 ESLint rule).
- **Bad, because** the allow-list is a governance burden — every entry needs an ADR-or-ticket reference and an expiration. Quarterly review required. The burden is intentional: allow-list growth without review is a signal the rule is being eroded.
- **Agent Impact:**
  - Authors of new capability tools MUST call `gate_action` before any mutation. `mutateWithGate()` helper is the ergonomic default.
  - `run-council` Phase 2.5 fact-check gains a grep: for every capability tool named in a briefing, verify `gate_action` is called in the tool's `execute()`. Missing call = merge blocker regardless of other signals.
  - `close-feature.sh` gains a pre-merge hook invoking `scripts/gate-action-coverage.ts` — failures block merge, matching ADR-0189's pattern.
  - Tools declared as read-only via `CapabilityName` / tool-selector convention are exempt (no mutation to gate); the CI check validates the exemption by confirming no mutation calls exist.

## References

- ADR-0078 — channel restriction on capability processes (sister rule — channel as authority contract).
- ADR-0099 — unified authority gate (pathway A — the contract this ADR enforces at call sites, amended here).
- ADR-0173 — capability model (amended to require `gate_action` on mutation tools).
- ADR-0189 — authority seed parity CI check (sister gate — enforces row *existence*; this ADR enforces row *use*).
- ADR-0191 — agent capability tool auth-passing pattern (the two pathways either of which require `gate_action`).
- ADR-0196 — journey engine invariants 11/12/13 (Invariant #13 is the campaign-local analogue this ADR generalizes).
- L-0066 — default-allow capability authority = CVE-class trap (original canonical learning).
- L-0097 — C4 authority defaults are not free (2nd occurrence, pre-promotion).
- L-0126 (new, this council) — ontology gap is an ADR, not effort (applied here: the gap between "tool exists" and "tool is gated" is an ADR).
- L-0130 (new, this council) — cascade layer separation forces table count (related: both ADRs surface from the 2026-04-23 hospitality council).

---

> After writing: register in `docs/decisions/0000-decision-log.md` and update the ADR table in `CLAUDE.md`.
