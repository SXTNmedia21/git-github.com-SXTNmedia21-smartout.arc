---
title: "Authority parity for cascade_gate_write (pathway B) via orthogonal controls"
id: ADR_0190
status: accepted
layer: decision
created: 2026-04-22
updated: 2026-04-23
supersedes: []
amends: [ADR_0091]
related: [ADR_0099, ADR_0137, ADR_0189, LEARNING_0107, LEARNING_0112, LEARNING_0113, LEARNING_0114]
---

# ADR-0190: Authority parity for cascade_gate_write (pathway B) via orthogonal controls

## Context and Problem Statement

Smartout has two structurally distinct write-authority pathways:

- **Pathway A** (ADR-0099) — `gate_action` RPC + `gateAction` TS helper. Evaluates against `engine_authority_config` row per `(workspace_id, capability)`. ADR-0189 ships `scripts/authority-seed-parity.ts` as the CI parity gate for this pathway.
- **Pathway B** (ADR-0091) — `cascade_gate_write` RPC + `gatedInsert/gatedUpdate/gatedDelete` TS helpers in `packages/supabase/src/gate-client.ts`. Evaluates against `workspace_framework_binding → framework_trigger` (policy-tree-shaped). **No parity gate exists.**

L-0112 (2026-04-22) surfaced that seven capability strings in profile/season Server Actions route through pathway B and are therefore invisible to ADR-0189's CI check. The natural question — "extend `authority-seed-parity.ts` to cover pathway B" — has a seductively simple shape but fails on code-trace: pathway B has no single-table seed analogous to `engine_authority_config`, and its default-allow surface includes TWO branches (no-active-framework + no-trigger-match) that a parity-clone would silently miss.

Phase 2.5 fact-check + Supervisor code-trace (Phase 3) revealed that the actual exposure is narrower and structurally different than the naïve framing suggests. This ADR specifies the orthogonal controls that address the real failure modes without compounding the four-permission-mechanism ontology smell (L-0029).

## Decision Drivers

- **L-0107 — "Authority appearance ≠ authority presence."** Seeding pathway-B capabilities into `engine_authority_config` is performative (no code reads those rows for pathway B). A CI gate that *looks* like ADR-0189 but cannot enforce pathway-B defaults would be textbook false security — same failure mode, new clothes.
- **Code-traced scope (L-0113):** 7 production call sites across 2 files (`apps/web/src/app/dashboard/people/_actions/people-actions.ts` × 6, `setup/_actions/season-actions.ts` × 1). Not 43. Not 108. Migration surface is trivial; the risk is structural, not volumetric.
- **Bootstrap-single-writer defect (L-0114):** `bootstrap-cascade` Edge Function is the sole writer of `workspace_framework_binding`. Its failure does not block workspace creation (`finalize-workspace/index.ts:89-105`). Only `hospitality.no.default.v1` is seeded. **Every non-hospitality workspace today is silently unbound** → permanent default-permit. Default-permit rows DO land in `gate_evaluation`, but zero consumers exist (no UI, no dashboard, no alert, no telemetry emit).
- **ADR-0137 stacking is draft.** Grep confirms no file imports both `gateAction` and `gatedInsert/Update/Delete`. Controls must operate independently of pathway A; convergence is a future concern, not a current one.
- **Capability seam is undefended.** Zero capability tools touch pathway B today (`packages/ai/src/tools/**` + `packages/ai/src/capabilities/**`). Nothing type-level prevents a future tool from importing `gatedInsert` and firing pathway B from the agent loop without agent-loop safeguards.
- **L-0029 — four parallel permission mechanisms is ontology smell.** Two CI gates is the honest response to a load-bearing ontological split (capability-gate vs diff-gate answer different questions). A *third* gate would compound; a second gate does not.

## Considered Options

1. **Extend `scripts/authority-seed-parity.ts` to cover pathway B** — add `cascade_gate_write` call-matching + diff against `engine_authority_config` seed. REJECTED. Seeding pathway-B capabilities is a no-op (no code reads them); green CI would hide the real failure modes (no-active-framework, no-trigger-match). L-0107 violation in its purest form.
2. **Unify `gate_action` + `cascade_gate_write` into one RPC** — REJECTED. Different arity, different storage, different outcomes, different invocation surfaces (ADR-0091 §40 explicitly preserves the split). Any "unified gate" degrades to dispatch-by-input-shape — cosmetic unification, architectural drift.
3. **Four orthogonal controls** — one runtime invariant (binding provisioning), one CI coverage check (entity-type × operation), two runtime observability upgrades (`reason` propagation + RPC telemetry emit), plus an ESLint rule defending the capability seam. Each answers one question; none duplicates another.

## Decision Outcome

Chosen option: **"Four orthogonal controls"**, because (a) pathway B's authority contract is underdefined at three layers simultaneously (provisioning, coverage, observability), (b) the shapes of A and B genuinely differ so one gate cannot fit both, and (c) the controls are independently shippable and their composition preserves the two-gate ontology without adding a third.

### Controls

**Control 1 — Atomic workspace-framework binding in `finalize_onboarding_workspace` RPC (runtime, load-bearing).**
Move binding creation INTO the canonical workspace-finalize RPC. The RPC's 10 existing sections (company, workspace, season, departments, teams, locations, zones, procedures, professions, agent profile) become 11 with `workspace_framework_binding` insert. Atomic with workspace creation — no workspace row exists without exactly one active binding row. The non-blocking `bootstrap-cascade` invocation in `finalize-workspace/index.ts` is removed; bootstrap-cascade keeps its other responsibilities (framework-template copy, operating-hours seed) minus binding creation.

**Control 2 — CI entity-type coverage check (`scripts/cascade-gate-entity-type-coverage.ts`).**
New script — NOT an extension of ADR-0189's script. AST-walks every `gatedInsert|gatedUpdate|gatedDelete` call in `apps/web/src/**/*.{ts,tsx}` + `packages/**/*.{ts,tsx}` (excluding `**/*.test.ts`, `**/*.spec.ts`, `apps/e2e/**`). Extracts `(entityType, operation)` tuples. Diffs against `framework_trigger` seed rows for every active framework (Stage 1: hospitality only; Stage 2 on 2nd framework seed: per-framework coverage required). Unmatched tuples must either have a matching seed row OR appear in an inline typed constant `EXEMPT_ENTITY_TYPES` with JSDoc fields `{ entityType, operation, reason, adr_or_ticket, expires_at }`. Dynamic-dispatch sites use marker `@cascade-gate-dynamic-entity` to suppress scanning. Wired into CI alongside `authority-seed-parity` (same workflow job, sequential).

**Control 3a — Widen `GatedWriteResult.reason` (runtime, information propagation).**
`packages/supabase/src/gate-client.ts` adds optional `reason?: string | null` to the `GatedWriteResult<T>` type and stops discarding the RPC's returned `reason` on the success path (previously dropped in `callGate`'s `response.allowed` branch — only the denied-path `GateDeniedError` surfaced it). Existing callers ignore the field until they surface it in UI; no forced migration. Zero telemetry coupling — lives entirely inside `packages/supabase`. This is the smallest change with the highest information gain (distinguishes working-as-designed from provisioning-failure from policy-incompleteness at the call site).

**Control 3b — RPC-side telemetry emit (`gate.default_permitted`).**
`cascade_gate_write` RPC modified to INSERT into `activity_trail` atomically with `gate_evaluation` whenever either default-permit branch fires. Event: `gate.default_permitted` with `reason` ∈ {`no-active-framework`, `no-trigger-match`}, `workspace_id`, `actor_profile_id`, `entity_type`, `operation`, `gate_evaluation_id`. Registered in `packages/telemetry/src/registry.ts`. Emission is in the RPC (not a TS wrapper) because (a) atomic with `gate_evaluation`, (b) unbypassable — fires even if a capability tool imports `gatedInsert` directly, (c) not dependent on TS deploy cadence. Ships LAST in the order; backfill of currently-unbound workspaces is a gating ops task before 3b merges to avoid alarm fatigue.

**Control 4 — ESLint rule `no-gated-write-in-capabilities` (capability seam defense).**
`packages/eslint-config/rules/no-gated-write-in-capabilities.js` forbids the IDENTIFIERS `gatedInsert|gatedUpdate|gatedDelete` anywhere in `packages/ai/src/tools/**` and `packages/ai/src/capabilities/**` (match by identifier, not import path, to defeat re-export bypass). Error message: `"gatedInsert/Update/Delete is forbidden in capability tools. Capability authority flows through gate-action (pathway A). See ADR-0091, ADR-0190."` Upgrades convention-to-contract at zero runtime cost.

### Ship order (non-negotiable)

```
1. Control 1 (atomic binding in RPC)
2. Ops: backfill unbound non-hospitality workspaces (manual ops task, gates 3b)
3. Control 3a (widen GatedWriteResult.reason)
4. Control 4 (ESLint rule)
5. Control 2 Stage 1 (CI coverage check)
6. Control 3b (RPC emits gate.default_permitted) — gated on backfill complete
```

Rationale: 3b last because it emits one `activity_trail` row per default-permitted write. Shipping 3b against current production (N silently-unbound workspaces) floods `activity_trail` and creates alarm fatigue without corresponding signal. 3b becomes useful only after 3a exposes `reason` to callers (so the data has a consumer) and Control 1 + backfill ensure unbound-by-design is eliminated.

### Named anti-pattern (promoted from L-0107)

**"Authority appearance ≠ authority presence."** Any system where a mutation surface *appears* to be gated (capability string passed, audit row written, helper named `gated*`) but the actual authority evaluation short-circuits to permit on a common production configuration is **audit theater**. Recorded manifestations:

1. ADR-0099 pathway-A unseeded-capability default-allow (addressed by ADR-0189).
2. ADR-0091 pathway-B workspace-binding default-allow (addressed by this ADR).
3. `gate_evaluation` rows written with zero consumers — applies to BOTH pathways (named debt below).

Future architectural reviews MUST ask, for every new authority surface: *"Where does this default-permit today, and is that default observable?"*

### Named tech debt (out of campaign scope)

**"Audit consumption convergence."** `gate_evaluation` rows are written by both `gate_action` and `cascade_gate_write` RPCs. No UI, dashboard, alert, or telemetry emit consumes them today. Forensic-only. This is not a pathway-B-specific defect — it applies equally to ADR-0099's authority-gate. Correct fix is converging all authority decisions to `activity_trail` emits with typed evidence fields, with `gate_evaluation` becoming a secondary index rather than the primary record. Out of this campaign. Blocks: nothing urgent. Trigger: next council on authority observability, OR first production incident requiring audit-trail reconstruction.

### Amendment to ADR-0091

Add to ADR-0091 §Rules: `cascade_gate_write` requires that every production workspace have exactly one `workspace_framework_binding` row with `is_active=true`. This is enforced atomically in `finalize_onboarding_workspace` (Control 1 of this ADR). Default-permit branches (`no-active-framework`, `no-trigger-match`) emit `gate.default_permitted` to `activity_trail` per Control 3b.

## Rules & Consequences

- **Good, because** authority-claim becomes honest at ship: unbound workspaces are unreachable for new workspace creation; default-permit branches are observable in real time; code-level coverage of entity-type × operation tuples is CI-enforced; capability seam is defended at type-level; the two-gate ontology is preserved without adding a third mechanism.
- **Good, because** each control is independently shippable and independently valuable. 3a alone ships `reason` to Server Actions. Control 4 alone closes the capability seam. Failure to ship any one does not invalidate the others.
- **Bad, because** the full ship sequence has a hard ordering constraint — 3b cannot merge before backfill, and Control 1 cannot ship without verifying every value in the industry-selection enum resolves to a seeded framework (else workspace creation breaks for new industries).
- **Bad, because** Control 2 Stage 1 only validates hospitality coverage. When a second regulatory framework is seeded (retail, healthcare, construction), Stage 2 must trigger — otherwise Stage 1 silently validates every call site against the new framework by accident. The trigger condition is documented; enforcement of the trigger is by convention until the second framework PR.
- **Bad, because** four controls is a high line-count per unit of authority improvement. The alternative (one clone-parity-gate) would be cheaper line-wise and catastrophically wrong semantically. The line-count is the cost of not papering over the ontology split.
- **Agent Impact:**
  - Developers writing new Server Actions that mutate governance-gated entities MUST use `gatedInsert/gatedUpdate/gatedDelete` from `packages/supabase/src/gate-client.ts`. New entityType values without seed coverage will fail CI (Control 2).
  - Capability tool authors MUST NOT import `gatedInsert/gatedUpdate/gatedDelete`. Capability authority flows through `gateAction` (pathway A). Control 4 (ESLint) enforces.
  - Workspace-creation code paths MUST go through `finalize_onboarding_workspace` RPC. Direct INSERTs into `workspace` or `workspace_framework_binding` outside the RPC or bootstrap-cascade are a regression.
  - Observability: `gate.default_permitted` activity-trail events on a production workspace are a real-time signal of provisioning gaps. Ops dashboard should surface these per workspace per day.

## Risk register

See council Phase 5 synthesis §6 for full risk table. Key mitigations:

- **Backfill omission** → Control 3b merge is explicitly gated on an ops verification query (zero workspaces with `created_at > T_control_1_deploy` AND no active binding).
- **Control 1 stricter-creation regression** → every value in the industry-selection enum must resolve to a seeded framework before Control 1 merges. If any don't, add framework seed first or narrow enum.
- **Control 4 re-export bypass** → rule matches IDENTIFIER, not import path. Any module under `packages/ai/src/{tools,capabilities}/**` referencing `gatedInsert|Update|Delete` fails, regardless of import origin.

## References

- ADR-0091 — `cascade_gate_write` RPC, pathway-B foundation (amended by this ADR).
- ADR-0099 — unified authority gate, pathway-A foundation.
- ADR-0137 — gate-action stacking semantics (draft; future convergence reference).
- ADR-0189 — authority-seed-parity CI check, pathway-A coverage (sister-gate to this ADR's Control 2).
- L-0029 — four-parallel-permission-mechanisms ontology smell (constraint satisfied: this ADR keeps count at 2, not 3).
- L-0107 — authority appearance ≠ authority presence (promoted into named anti-pattern in this ADR body).
- L-0112 — two gate pathways — parity gate covers one (the discovery that triggered this council).
- L-0113 — grep-count audit inflation recurrence (council Phase 3 claim vs code-trace: 43 → 7).
- L-0114 — bootstrap-cascade single-writer silent default (the provisioning defect Control 1 addresses).

---

> After writing: register in `docs/decisions/0000-decision-log.md` and update the ADR table in `CLAUDE.md`.
