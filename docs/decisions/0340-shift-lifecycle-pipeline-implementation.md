---
title: "Shift Lifecycle Pipeline — V2 Implementation"
id: ADR_0340
status: proposed
layer: decision
created: 2026-05-16
updated: 2026-05-16
supersedes:
  - ADR_0321
---

# ADR-0340: Shift Lifecycle Pipeline — V2 Implementation

## Context and Problem Statement

ADR-0321 (accepted 2026-05-14) sketched a V2 convergence path for `shift-swap` +
`shift_marketplace`. It proposed a new `engine_authority_pipeline` table and a new
`engine_authority_pipeline_instance` table, deferred cross-workspace profile policy
to V2, and conditioned V2 ship on either of two future triggers (workspace request
for multi-stage approval, or a second `adr-contract-audit` ADR-0173 finding).

Pontus opened the **swap-marketplace-convergence-v2** sortie before either V2 trigger
fired. Driver: anticipated reuse of the authority-pipeline definition across `lønn`
and `contracts` capabilities in coming sub-sorties. Building two tables now means
not building (and not migrating) two tables later.

Phase 5 of that sortie (council 2026-05-16 — chair `system-steward` reversed initial
Q1 vote per L-0147 "verify against existing infrastructure before proposing new
infrastructure", `supervisor`, `system-agent-coordinator`, `botsson-harness-builder`)
synthesized five decisions that REPLACE the ADR-0321 V2 sketch. Two of those
decisions invalidate parts of the ADR-0321 schema sketch directly:

- ADR-0321 §V2 Schema Sketch proposed `engine_authority_pipeline_instance`. Council
  Q1 found this DUPLICATES existing `engine_state` (ADR-0067), which `shift-swap`
  already uses to store swap state in `context JSONB`.
- ADR-0321 §V2 Capability Convergence proposed collapsing `shift-swap` +
  `shift_marketplace` → `shift_lifecycle_marketplace`. Council Q4 found this is
  a capability-merge under ADR-0173 frozen-4 boundaries, requires its own ADR, and
  cascades on the Q2 cross-workspace deferral. DEFERRED to a follow-on sortie.

This ADR records the five Phase 5 decisions, amends ADR-0321's V2 Trigger Conditions
to admit "anticipated cross-capability reuse", and locks the V2 implementation
shape for the rest of the sortie.

## Decision Drivers

- ADR-0067 (`engine_state` is the canonical pipeline-instance state surface) — already
  used by `shift-swap` for swap-state storage. Building a parallel
  `engine_authority_pipeline_instance` would split the active-process index across
  two tables.
- ADR-0099 (gate_action atomic write) + ADR-0287 (mutateWithGate adoption) — the
  per-stage atomic-write contract must NOT regress. The 2-writes-1-gate pattern at
  `shift_marketplace/tools.ts:494-518` (`approve_claim`) is canonical and must
  survive verbatim into V2.
- ADR-0151 (forgeable-ID class — fail loud on missing context) + L-0177 (silent
  JWT-workspace fallback is the same class). Cross-workspace pipeline instances
  without an explicit policy are L-0177-class bugs; constraint-level fail-loud is
  required.
- ADR-0173 (frozen-4 capability boundaries) — capability-merge requires its own ADR.
- ADR-0204 (correlation_id chains audit rows) — pipeline_instance_id + per-stage
  gate_evaluation_id must chain.
- ADR-0240 (no cross-namespace writes from a capability tool) — pipeline orchestration
  must delegate via existing capability tools, not write to swap/marketplace tables
  from a new pipeline tool.
- ADR-0078 + ADR-0163 + ADR-0288 (pending) — channel-restriction is a 3-layer
  defense-in-depth model. Pipeline-level + tool-level guards both required.
- ADR-0306 (`shift_marketplace`) + ADR-0287:112 (grandfathered `callGateAction` for
  `shift-swap`) — V1 tools are ADR-compliant; pipeline wraps without rewriting.

## Considered Options

For each council question, the alternatives surfaced in Phase 5 review:

**Q1 — Pipeline instance state:**
1. New `engine_authority_pipeline_instance` table (per ADR-0321 sketch).
2. Reuse `engine_state` with `process_id` referencing new
   `engine_process` blueprints `shift_swap_lifecycle` + `marketplace_lifecycle`.
3. Hybrid (instance row + denormalized cache).

**Q2 — Cross-workspace profile policy:**
1. Ship source-workspace policy now (one of three deferred options).
2. Ship home-workspace policy now.
3. Ship intersection policy now.
4. DEFER all three; enforce single-workspace via DB constraint until V2.1 ADR
   decides.

**Q3 — Multi-stage gate:**
1. Single gate covers all stages (one `gate_action` call per pipeline run).
2. Per-stage `gate_action` calls (one per stage advancement).
3. Stage-0 gate + downstream stage trust delegation.

**Q4 — Capability rename:**
1. Collapse to `shift_lifecycle_marketplace` in this ADR (per ADR-0321 sketch).
2. DEFER to a follow-on sortie; preserve V1 names `shift-swap` + `shift_marketplace`.
3. Rename only one surface.

**Q5 — Channel restriction:**
1. Pipeline-level only (`engine_process.allowed_channels`).
2. Tool-level only (per-tool inline guards as today).
3. Both layers (3-layer defense-in-depth: gateway + pipeline + tool).

## Decision Outcome

**Q1 — Reuse `engine_state`.** Option 2.
ADR-0321 §V2 Schema Sketch `engine_authority_pipeline_instance` is **SUPERSEDED**.
`engine_state` (`process_id`, `status`, `current_step`, `context`, `entity_type`,
`entity_id`, `parent_state_id`, RLS, UNIQUE partial active-index — all per ADR-0067)
already provides the full surface. `shift-swap` already stores swap state in
`engine_state.context`. Seed two new `engine_process` blueprints:
`shift_swap_lifecycle` + `marketplace_lifecycle`.

The `engine_authority_pipeline` workflow-DEFINITION table from ADR-0321 §V2 Schema
Sketch IS RETAINED — it is the blueprint store, not the instance store:
`(workspace_id, capability, action_type, stage_index, required_role,
max_wait_minutes, escalation_action)` with `UNIQUE (workspace_id, capability,
action_type, stage_index)`.

**Q2 — Defer + scope-bound single-workspace + CHECK constraint.** Option 4.
For V2 ship: pipeline_instance.workspace_id MUST equal source-shift workspace_id.
Enforce at constraint level — CHECK on the relevant `engine_state.context` shape or
on the join from `engine_state.entity_id` (shift_id) to `schedule_shift.workspace_id`.
If cross-workspace is attempted, fail loud (L-0177 class, ADR-0151 invariant).

The three substantive options (source-ws / home-ws / intersection) are deferred to
**V2.1 ADR**, to be written AFTER pipeline stabilizes. Pontus decides.

**Q3 — Per-stage `gate_action` calls.** Option 2.
Each stage advancement is its own atomic write with its own `mutateWithGate` or
`callGateAction`. `action_type` encodes the stage:
`shift_lifecycle_marketplace.stage_0`, `.stage_1`, `.stage_2`, `.override`.

The `gate_action` RPC signature is **UNCHANGED**. Per ADR-0099 the RPC already takes
`engine_process_id` + `engine_state_id`. `pipeline_instance_id` (== `engine_state.id`)
correlates stages across writes. `gate_evaluation_id` correlates atomic writes within
a stage (preserves ADR-0204 chain).

The `approve_claim` 2-writes-1-gate atomic pattern at
`shift_marketplace/tools.ts:494-518` (two writes inside one `exec` callback = ONE
gate evaluation) **MUST NOT REGRESS**. Pipeline orchestration calls the existing
tool; the existing tool keeps its atomic semantics.

**Q4 — Defer capability rename.** Option 2.
`shift-swap` + `shift_marketplace` V1 capability names PRESERVED for this sortie.
Capability collapse to `shift_lifecycle_marketplace` is a capability-merge under
ADR-0173 frozen-4 boundaries; it requires its own ADR. That ADR is BLOCKED on Q2
(cross-workspace policy must be filled in first — Q2 deferral cascades).

Pipeline plumbing in this sortie wraps EXISTING capabilities; orchestration delegates
via existing tools per ADR-0240 (no cross-namespace writes from the pipeline tool).
ADR-0321 §V2 Capability Convergence (capability collapse + legacy aliases + naming
convention §V2) is SUPERSEDED-PENDING — to be re-stated in the future capability-merge
ADR.

**Q5 — Chat-only at pipeline level + per-tool inline guards retained.** Option 3.
`engine_process.allowed_channels = ARRAY['chat']` for both `shift_swap_lifecycle` +
`marketplace_lifecycle` blueprints. Per-tool ADR-0288 inline channel guards at
`shift-swap/tools.ts:157,228,299` and `shift_marketplace/tools.ts:158,301,456` are
RETAINED as Layer 3 defense-in-depth (3-layer model per ADR-0078 + ADR-0163).

ADR-0288 status: separate Phase 0 task (P0.5) decides accept-or-remove. This ADR
cites ADR-0288 as **pending acceptance**; the guards stay either way (if 0288
accepted: required; if 0288 rejected: redundant but harmless).

**V2 Trigger Justification (ADR-0321 §V2 Trigger Conditions amendment):**
- Trigger 1 (workspace requests multi-stage approval): NOT FIRED.
- Trigger 2 (second `adr-contract-audit` ADR-0173 capability-overlap finding):
  NOT FIRED.
- **This sortie IS the proactive V2 trigger** — driven by anticipated `lønn` +
  `contracts` pipeline reuse (one authority-pipeline definition table reused across
  3+ capabilities). Pontus's call.

ADR-0321 §V2 Trigger Conditions is hereby **AMENDED** to include a third trigger:
"Anticipated cross-capability reuse of authority pipeline definition (e.g.,
contracts, payroll) — proactive build when reuse window is open."

## Rules & Consequences

- **Good, because** zero new instance-state tables. ADR-0067 `engine_state` is the
  single active-process index. UNIQUE partial active-index works across all
  capability lifecycles without per-table duplication.
- **Good, because** the `engine_authority_pipeline` blueprint table is genuinely
  reusable — `contracts.sign`, `payroll.lock_period`, `deviation.approve` can all
  define their own stage chains by inserting rows, not by adding tables.
- **Good, because** per-stage `gate_action` calls preserve the ADR-0099 atomic-write
  contract and the ADR-0204 correlation chain. No new gate-evaluation semantics.
- **Good, because** chat-only restriction at pipeline AND tool layer means the
  pipeline tool cannot accidentally route via voice/page even if the per-tool guard
  is removed by a future refactor.
- **Good, because** capability-merge deferral keeps ADR-0173 frozen-4 invariants
  intact. Two capabilities stay two capabilities until the rename ADR ships.
- **Bad, because** two parallel audit trails (`shift_swap.*` vs `shift_offer.*`)
  persist for the duration of this sortie + the deferred capability-merge sortie.
  Cross-surface reporting still requires UNION (carried over from ADR-0321 V1
  consequence).
- **Bad, because** Q2 deferral means cross-workspace profile policy remains an open
  question. Some workspaces will hit the CHECK constraint and need workarounds
  (manual reassignment outside the pipeline) until V2.1 ADR ships.
- **Bad, because** ADR-0321 readers must follow a supersession chain
  (0321 → 0340 → future-capability-merge-ADR → future V2.1 cross-workspace ADR).
  Mitigated by clear `supersedes:` frontmatter and an entry in the decision log.
- **Agent Impact:**
  - Agents writing pipeline orchestration code MUST use `engine_state` (via
    `engine_process` dispatch) — NOT a new instance table. ADR-0321 schema sketch is
    no longer authoritative.
  - Agents writing the `override_pipeline` tool MUST FAIL today and PASS only after
    T0.5 seeds `<cap>.override` rows in `engine_authority_config`. CI gate enforces.
  - Agents proposing capability renames or merges MUST write their own ADR — not in
    this sortie.
  - Agents proposing new pipeline-capable capabilities MUST insert rows in
    `engine_authority_pipeline` AND seed `<cap>.override` in `engine_authority_config`
    (CI gate-action-coverage check rejects otherwise).
  - Agents touching `approve_claim` (`shift_marketplace/tools.ts:494-518`) MUST
    preserve the 2-writes-1-gate exec-callback pattern verbatim — pipeline
    orchestration calls the tool, does not inline its body.

## Implementation Plan

Phased after Pontus's Phase 0 exit-gate sign-off.

**Phase 0 — Exit gates (this ADR + sibling tasks)**
- P0.1 — This ADR (accepted).
- P0.2 — B1 dual-gate (G13) reconciliation: document independence of this ADR from
  G13 OR fold the reconciliation in. Default: independence — G13 is auth-layer, this
  ADR is pipeline-layer. Cross-ref only.
- P0.3 — `authority.ts` dual-gate divergence: same disposition as P0.2; cross-ref
  only.
- P0.4 — `engine_state` vs `engine_sessions` ontology: confirm `engine_state` is the
  right table. Phase 5 Q1 council outcome already names `engine_state`.
- P0.5 — ADR-0288 accept-or-remove: separate ADR. Cite as pending in this ADR's
  §Q5.
- P0.6 — `schedule_shift` lock column design (NOT migration): appendix to this ADR
  OR separate concern note. Default: separate concern — `schedule_shift.lock` is a
  D6 mutation gate, not an authority-pipeline concern.

**T0 — Blueprint seed migrations**
1. Create `engine_authority_pipeline` table (DDL per ADR-0321 §V2 Schema Sketch,
   blueprint-only fields).
2. Seed rows for `shift_swap_lifecycle.stage_0` + `.stage_1` + `.stage_2`.
3. Seed rows for `marketplace_lifecycle.stage_0` + `.stage_1` + `.stage_2`.
4. Insert `engine_process` blueprints `shift_swap_lifecycle` + `marketplace_lifecycle`
   with `allowed_channels = ARRAY['chat']`.

**T0.5 — Authority seed for override**
1. Seed `<cap>.override` rows in `engine_authority_config` for both capabilities
   (`min_role=admin`, `level=autonomous`).
2. Extend `scripts/gate-action-coverage.ts` to flag any pipeline-defining capability
   lacking a sibling `.override` row (same shape as ADR-0189 authority-seed-parity).
3. CI runs the extended check on pre-push.

**T1-T9 — Pipeline tool wiring (per follow-on sortie tasks)**
- T1 — `start_pipeline` tool: creates `engine_state` row, sets `context.shift_id`,
  fires stage_0 emit. Delegates entity-mutation to existing capability tool.
- T2 — `advance_stage` tool: per-stage `mutateWithGate` call, advances
  `engine_state.current_step`. Delegates entity-mutation to existing capability tool.
- T3 — `override_pipeline` tool: admin-only, calls `<cap>.override`. Gated by T0.5
  seed.
- T4 — Channel guard verification: `allowed_channels` at dispatch + per-tool inline
  guard (Layer 2 + Layer 3) trace test.
- T5 — Cross-workspace CHECK constraint migration.
- T6 — `pipeline.stage_*` telemetry events added (additive — see Preservation §3).
- T7 — `approve_claim` atomic pattern regression test (CI guard against future inline
  refactor).
- T8 — Documentation: capability READMEs cross-link this ADR + 0321 supersession.
- T9 — Sortie close: HANDOFF logs preservation-clause compliance.

## Trust Gate

Mandatory before promotion of any tool out of this ADR's plumbing.

- `override_pipeline` tool: FAIL today (no authority rows), PASS only after T0.5
  seeds `<cap>.override` rows.
- CI extension `scripts/gate-action-coverage.ts`: MUST flag any pipeline-defining
  capability lacking a sibling `.override` row in `engine_authority_config`.
  Same shape as ADR-0189 authority-seed-parity check.
- `approve_claim` atomic pattern at `shift_marketplace/tools.ts:494-518`: PASS
  unchanged. Regression test asserts two writes inside one `exec` callback = ONE
  `gate_evaluation` row.
- Nine existing V1 tools (5 `shift-swap` + 4 `shift_marketplace` non-`approve_claim`):
  PASS unchanged (all ADR-0287 compliant per code-trace; ADR-0287:112 grandfathers
  `callGateAction` for `shift-swap`).

## Preservation Clauses (non-negotiable)

1. `shift_swap.*` telemetry events (registry lines 5341-5397) — KEEP.
2. `shift_offer.*` telemetry events (registry lines 8610-8666) — KEEP.
3. `pipeline.stage_*` telemetry events — ADDED as additive envelope; NOT a replacement
   for §1 + §2. Existing dashboards and reports must continue to function without
   schema changes.
4. ADR-0240 cross-namespace write-ban — HONORED. Pipeline orchestration delegates
   via existing capability tools (`propose_swap`, `accept_swap`, `reject_swap`,
   `cancel_swap`, `post_open`, `claim`, `approve_claim`, `cancel_offer`). The
   pipeline tool MUST NOT write to swap-owned or marketplace-owned tables directly.
5. `approve_claim` 2-writes-1-gate at `shift_marketplace/tools.ts:494-518` —
   PRESERVED VERBATIM. Pipeline orchestration calls the tool; does not inline its
   body. CI regression test (T7) enforces.

## Migration Notes

Three migration concerns surface from this ADR.

**1. `engine_process` blueprint seeds (T0)**
- Two new `engine_process` rows: `shift_swap_lifecycle` + `marketplace_lifecycle`.
- `allowed_channels = ARRAY['chat']` per §Q5.
- Steps reference `engine_authority_pipeline.stage_index`.

**2. `engine_authority_pipeline` blueprint table (T0)**
- DDL per ADR-0321 §V2 Schema Sketch (retained verbatim — blueprint store only).
- Seed rows for both capabilities × 3 stages = 6 blueprint rows minimum (each
  workspace_id × 6, on workspace bootstrap).
- Bootstrap path: workspace_init hook seeds default rows; workspace admin may
  override via future authoring UI (NOT in this sortie).

**3. `schedule_shift` lock column design (P0.6, NOT migration)**
- Out of scope for this ADR. Design lives in a separate concern note. The lock is
  a D6 mutation gate; the pipeline is the authority orchestrator. They cross only
  at T2 (`advance_stage`) when stage advancement requires shift lock — handled by
  delegation to the existing capability tool, which already owns shift-locking
  semantics via its `mutateWithGate` wrapper.

**Cross-workspace CHECK constraint (T5)**
- Single CHECK on the appropriate constraint surface (TBD between
  `engine_state.context` shape and a derived view) enforcing
  `source_workspace_id = target_workspace_id` until V2.1 ADR ships.
- Fail-loud on violation — L-0177 class invariant.

---

> Register in `docs/decisions/0000-decision-log.md`. Supersedes ADR-0321 §V2 Schema
> Sketch + §V2 Capability Convergence. Amends ADR-0321 §V2 Trigger Conditions.
> Council reviewers: `system-steward` (chair, reversed Q1 vote per L-0147),
> `supervisor`, `system-agent-coordinator`, `botsson-harness-builder`.
> Phase 5 session: 2026-05-16 swap-marketplace-convergence-v2 schema decisions.
> Siblings: ADR-0067 (engine_state), ADR-0099 (gate_action atomic write), ADR-0151
> (forgeable-ID class), ADR-0173 (frozen-4 capability boundaries), ADR-0204
> (correlation chain), ADR-0240 (no cross-namespace writes), ADR-0287
> (mutateWithGate adoption), ADR-0288 (channel-guard inline — pending),
> ADR-0306 (shift_marketplace), ADR-0321 (this ADR supersedes).

---

## Phase 0 Resolutions (2026-05-16, post-Council)

### P0.2 — B1 dual-gate (G13): **INDEPENDENCE**

G13 is auth-layer debt on the **Server Actions side** (`people-actions.ts`, `season-actions.ts`, `payroll/derive-shift-hours/route.ts` call `cascade_gate_write` directly without correlation chaining). Pipeline orchestration here is layered above the gate: T1–T3 tools call `mutateWithGate` / `callGateAction` (capability-tool side, already on SS-4 orchestrator path per `_shared/mutate-with-gate.ts:303` + `shift-lifecycle/gate.ts:73`). Pipeline never invokes Server Actions. Future G13 closure swaps the RPC behind `mutateWithGate` without touching pipeline contract. **No ADR-0340 revision required if G13 closes during sortie.**

### P0.3 — authority.ts divergence: **FOLD (narrow scope into T2)**

Two per-capability gate.ts wrappers (`shift-swap/gate.ts:49,54` direct-RPC, `shift_marketplace` via same shape per ADR-0287:112 grandfather) are NOT on the SS-4 `gatedMutation` orchestrator path. ADR-0340 §Preservation 4 delegates entity writes to these existing tools; §Q3 + §Decision-Drivers ADR-0204 require per-stage correlation chains in `pipeline.stage_*` audit rows.

**Resolution:** T2 `advance_stage` MUST migrate `shift-swap/gate.ts` + `shift_marketplace` gate path to SS-4 shape (delegate to `gatedMutation`) as part of pipeline wiring. Template = `shift-lifecycle/gate.ts:39,73`. One-file-per-capability of mechanical adapter work. Shape preserved at `GateActionResult` boundary → caller-side `tools.ts` unchanged.

**Trust Gate addition:** Regression test asserts each pipeline-delegated capability tool produces `gate_evaluation.correlation_id` matching the pipeline `engine_state.id` correlation thread.

**Scope:** Other 17 `gate.ts` files (availability, communication, contract, contract-intake, guardian, helpdesk_query, journey, legal, memory, onboarding, operations, operations-intelligence, payroll, personal, season, task, tips) stay out of scope.

### P0.4 — engine_state vs engine_sessions ontology: **CONFIRMED**

- `engine_state` (`20260304100000_engine_process_tables.sql:129`) = pipeline INSTANCES (process_id, entity_type, entity_id, current_step, status, unique-active index)
- `engine_sessions` (`20260301200000_engine_tables.sql:109`) = agent CONVERSATION SESSIONS (mission_id, channel, stage_index, collected_data, expires_at)
- Stage-engine writes ONLY to `engine_sessions` for its own state; reads `engine_state` advisory at `mission-summary.ts:62` for prompt injection
- shift-swap already writes to `engine_state` via RPCs; Q1=B confirmed structurally sound

### P0.6 — schedule_shift lock column design

**Column shape:**

```sql
ALTER TABLE public.schedule_shift
  ADD COLUMN pipeline_lock_state_id uuid NULL
    REFERENCES public.engine_state(id) ON DELETE SET NULL;

CREATE INDEX idx_schedule_shift_pipeline_lock
  ON public.schedule_shift (pipeline_lock_state_id)
  WHERE pipeline_lock_state_id IS NOT NULL;
```

Name `pipeline_lock_state_id` (not `pipeline_locked_by`) — points at process instance, not actor.

**Lifecycle:**
- **Acquire:** CAS-style `UPDATE schedule_shift SET pipeline_lock_state_id = $1 WHERE schedule_shift_id = $2 AND pipeline_lock_state_id IS NULL`. Inside same `exec` callback as stage-0 entry. 0 rows updated = 409.
- **Release:** `SET pipeline_lock_state_id = NULL` inside terminal-state `exec` callback (status IN complete|failed|cancelled|escalated). Same gate-evaluation audit chain.
- **Stale cleanup:** `ON DELETE SET NULL` handles hard-delete (tests); implicit reaper via pre-flight check at stage-0 entry.

**FK:** `ON DELETE SET NULL` (CASCADE deletes shift → catastrophic; NO ACTION blocks engine_state archive; SET NULL self-heals).

**RLS:** No change. Locked shift readable by workspace members. Mutations fail-fast 409 at pipeline-engine application layer, NOT via DB trigger.

**Coexistence with `schedule_shift_offer` UNIQUE partial:** complementary. UNIQUE prevents double-claim WITHIN marketplace; pipeline lock prevents concurrent pipeline entry across capabilities.

**🚨 CRITICAL trap for T0:** `enforce_schedule_shift_temporal_lock` trigger fires on every UPDATE. Setting `pipeline_lock_state_id` triggers `schedule_shift_is_temporally_locked()` check. Carve-out list currently does NOT include `pipeline_lock_state_id`. **T0 must extend trigger allow-list to permit pipeline lock/unlock writes within temporal window.**

**5 open questions for T0 author:**
1. Atomicity in existing RPCs — extend `initiate_shift_swap` + `post_open` in place, or acquire after RPC return (race window)?
2. Temporal-lock trigger carve-out (above).
3. Swap = 2 shifts (requester + target). Lock BOTH at stage-0 or only initiator?
4. Mobile UI surface — `pipeline_lock_state_id IS NOT NULL` as pending-pipeline indicator, or derive from `schedule_shift_offer.status`?
5. `override_pipeline` (T5) — does it clear pipeline lock as part of exec? Confirm before T0.5 author writes seed.

### Phase 0 Status

- ✅ P0.1 ADR-0340 drafted (this document)
- ✅ P0.2 INDEPENDENCE
- ✅ P0.3 FOLD into T2 (2-file SS-4 adapter; Trust Gate regression test added)
- ✅ P0.4 engine_state CONFIRMED
- ⏳ P0.5 ADR-0288 accept-or-remove — Pontus decision pending
- ✅ P0.6 lock column design captured + 5 open questions for T0 author

**Phase 0 exit gate:** P0.5 only remaining. Once Pontus decides ADR-0288 status, Phase 0 closes and T0 unblocks.
