---
title: "Cascade-namespace delegation pattern for cross-namespace capability writes"
id: ADR_0356
status: proposed
date: 2026-05-17
layer: decision
created: 2026-05-17
updated: 2026-05-17
module: MODULE_AGENT_SDK
tags: [capability, cascade, namespace, delegation, frozen-4, adr-0173, adr-0240, phase-7d]
related_adrs: [ADR-0173, ADR-0204, ADR-0240, ADR-0355]
amends: []
supersedes: []
---

# ADR-0356: Cascade-namespace delegation pattern for cross-namespace capability writes

## Context and Problem Statement

ADR-0240 established a delegation pattern after `journey_authoring` was found writing
directly to `journey` / `journey_version` tables owned by `journey.publish_mission` — an
ADR-0173 frozen-4 capability boundary violation. The resolution was: the caller capability
delegates to the owning capability's tool rather than writing across namespace boundaries.

Council 2026-05-17 Phase 7d-followup review found that Phase 7f payroll capability tools
(`setup_workspace_tariff`, `change_workspace_tariff`, `add_supplement_override`) were
about to replicate the SAME anti-pattern: writing to `public.workspace_union_binding`
(a cascade-namespace table per ADR-0355) and `public.supplement_rule` (a cascade-owned
table) directly from the payroll capability.

ADR-0240 was scoped to the journey domain, creating a precedent without a general rule.
Without a general rule, every new capability domain that needs to write across namespace
boundaries faces the same decision from scratch — and risks the same L-0176
docstring-vs-body drift where the tool claims compliance but the body bypasses the gate.

This ADR generalizes the ADR-0240 pattern across all capability domains so the resolution
is documented once, not rediscovered per capability.

---

## Decision Drivers

1. **ADR-0173 frozen-4 capability boundaries** — each capability owns its namespace.
   Cross-namespace writes directly from a capability tool violate the frozen contract.
   Frozen-4 must be structurally enforced, not paper-only.
2. **ADR-0240 prior precedent** — delegation was already resolved as the correct pattern
   for the journey domain. Generalizing prevents the same argument being relitigated.
3. **ADR-0204 gatedMutation per-tool authority gating** — every mutation in a capability
   tool must go through `gatedMutation`. Cross-namespace writes without delegation bypass
   the owning namespace's gate entirely.
4. **Avoid one-off ADRs per capability domain** — without a general rule, each new
   cross-namespace write generates a new scoped ADR. ADR-0173 frozen-4 becomes effective
   only in domains where it has been explicitly re-invoked.
5. **Audit trail symmetry** — the owning namespace's delegation tool must own the gate,
   `emit()`, and audit row for the cross-namespace write. Caller-side audit alone is
   insufficient (L-0177: silent-fallback workspace_id class of bug).
6. **L-0176 defense** — docstring-vs-body drift (capability tool docstring claims ADR
   compliance while body bypasses gatedMutation) is most likely to occur at cross-namespace
   write sites. Delegation makes compliance structural rather than docstring-asserted.

---

## Considered Options

### Option A — New cross-namespace ADR per new capability domain

Each time a capability needs to write to another namespace's table, author a scoped ADR
(as ADR-0240 did for journey).

**Rejected:** One-off ADRs accumulate without a general rule. ADR-0173 frozen-4 freeze
becomes paper-only: it only holds in domains that have explicitly authored a scoped ADR,
not in domains where the question hasn't arisen yet. Council 2026-05-17 caught this
failure mode in Phase 7d payroll tools before ship — if the payroll tooling had shipped
without council review, the violation would have been a production bug.

### Option B — Loosen ADR-0173 frozen-4

Permit cross-namespace writes with additional audit instrumentation. ADR-0173 amended to
allow direct writes when the caller performs gate + emit.

**Rejected:** ADR-0173 is frozen-4 by design. Loosening it invalidates the entire
ownership model for `packages/ai/src/capabilities/`. The frozen-4 contract is load-bearing
for the agent router's authority resolution (ADR-0099: gate_action chain requires knowing
which namespace owns the action). Loosening collapses boundary clarity for all future
capability authors.

### Option C — Direct cross-namespace writes with audit log only

Permit direct writes if the calling capability adds an audit row documenting the
cross-namespace intent. No delegation, no second gate.

**Rejected:** Audit log without gate violates ADR-0204 (all mutations through gatedMutation).
Invites exactly the L-0176 anti-pattern where the docstring says "audited cross-namespace
write per ADR-0356" while the body has a direct `supabase.from("workspace_union_binding")
.insert(...)` with no gate. The audit row doesn't run the owner's business logic or
authority check — it only records that the bypass happened.

### Option D — Cascade-namespace delegation pattern (chosen)

Generalize ADR-0240: any capability that needs to write to a table owned by another
namespace's capability must call a delegation tool defined in the owning capability's scope.
The owning capability's tool handles gate, gatedMutation, emit, and audit row.

**Chosen:** Structurally enforces ADR-0173 frozen-4 without requiring individual ADRs per
domain. Caller capability cannot bypass the owner's authority check — both gates fire
independently. Audit trail preserves both caller and delegate provenance. Consistent with
the resolution already accepted for the journey domain (ADR-0240).

---

## Decision Outcome

Chosen option: **Option D — Cascade-namespace delegation pattern.**

---

### Pattern definition

When capability **A** needs to write to a table owned by capability **B**'s namespace,
capability A MUST call a delegation tool defined in capability B's scope. The delegation
tool is a first-class capability tool in B's registry: it owns the `gate_action`,
`gatedMutation` wrapper, telemetry `emit()`, and audit row for the write. Capability A
receives a typed response: `{ success: true, ...result }` or a structured error per
ADR-0152 error envelope.

Capability A MUST NOT:
- Write directly to B's tables via `supabase.from("owned_by_b").insert(...)`.
- Wrap B's table writes in A's own `gatedMutation` while bypassing B's gate.
- Import B's internal write helpers as Node module imports (keeps the boundary explicit).

---

### Naming convention

Delegation tools are named `{owning-capability}.{action}_{entity}`, using the same
`{namespace}.{verb}` format as all other capability tools:

- `cascade.bind_workspace_union` — writes `public.workspace_union_binding`
- `cascade.add_supplement_rule` — writes `public.supplement_rule` (workspace-scoped)
- `journey.publish_mission` — existing precedent (ADR-0240)

Callers invoke via standard capability dispatch (not Node `import`). The dispatch call
crosses the capability boundary explicitly; type-checker will surface any drift in the
delegation contract.

---

### Gate convention

The delegation tool's authority is **independent** of the caller's authority. Both gates
must approve for the write to proceed:

1. **Caller gate fires first** (e.g. `gate_action('payroll.setup_workspace_tariff')`) —
   confirms the caller has authority to initiate the flow.
2. **Delegation tool gate fires second** (e.g. `gate_action('cascade.bind_workspace_union')`) —
   confirms the write is permitted in the target namespace.

If either gate denies, the entire operation fails. The delegation tool's gate is not a
rubber stamp of the caller's authority — it is an independent authority check scoped to
the write operation.

---

### Audit trail symmetry

The delegation tool writes to `activity_trail` with:

- `actor_capability = caller_capability_id` — which capability initiated the request
- `delegated_via = owning_capability_id` — which capability performed the write

This preserves full provenance. Auditors can query `activity_trail WHERE delegated_via IS
NOT NULL` to enumerate all cross-namespace writes and trace both the initiator and the
authorizing delegation.

---

### Transaction shape

The delegation tool body runs in the same Supabase RPC transaction as the caller where
possible (Supabase RPC pattern). If the delegation tool fails, the caller's writes are
rolled back. This provides atomicity across the namespace boundary without requiring a
distributed transaction.

---

### Required delegations for Phase 7f payroll tools (Sortie 3 scope)

Two delegation tools must be authored in Sortie 3 before any Phase 7f payroll capability
tool ships:

**`cascade.bind_workspace_union(workspace_id, union_id, law_version, effective_from, amendment_classifier)`**

- Called by: `payroll.setup_workspace_tariff` + `payroll.change_workspace_tariff`
- Writes: `public.workspace_union_binding` row per ADR-0355 contract
- Steps:
  1. `gate_action('cascade.bind_workspace_union')` — cascade namespace authority
  2. Close previous active binding: `UPDATE workspace_union_binding SET effective_to = effective_from - 1 WHERE workspace_id = $1 AND effective_to IS NULL`
  3. INSERT new binding row per ADR-0355 §A schema
  4. Cache trigger (`trg_sync_workspace_settings_union_cache`) fires automatically
  5. `emit('workspace.union_binding_created', { workspace_id, union_id, delegated_by: caller })` with all four destinations (ADR-0164)
  6. Return typed result `{ workspace_union_binding_id, union_id, effective_from }`

**`cascade.add_supplement_rule(workspace_id, supplement_type, rate_value_ore, paragraph_ref, ...)`**

- Called by: `payroll.add_supplement_override`
- Writes: `public.supplement_rule` row with `workspace_id IS NOT NULL` (workspace-scoped
  override, distinct from platform template rows where `workspace_id IS NULL`)
- The delegation tool MUST enforce `workspace_id IS NOT NULL` at its own gate level even
  though the schema allows NULL (NULL = platform template; workspace capability writes
  always target workspace-scoped rows only)
- Steps follow the same gate → write → emit → return pattern as `cascade.bind_workspace_union`

Reference implementation for the delegation tool pattern:
`packages/ai/src/capabilities/journey/` (existing `journey.publish_mission` tool, ADR-0240).

---

### Out of scope

- Implementation bodies for `cascade.bind_workspace_union` and `cascade.add_supplement_rule`
  (Sortie 3 scope; this ADR specifies the contract only).
- Existing capabilities that already cross namespaces are grandfathered (audit follows
  per L-0176 docstring-vs-body; remediation is a separate sortie per existing ADR remediation
  pattern).
- This pattern is enforced for all NEW cross-namespace writes from Phase 7f forward. Legacy
  violations are tracked under the L-0166 class (direct-write capability tools) and remediated
  on a priority basis, not as a blocker to Phase 7f.

---

## Rules & Consequences

- **Good, because** ADR-0173 frozen-4 is preserved structurally, not just on paper. The
  delegation tool boundary is enforced at the capability dispatch layer — a build-time
  boundary, not a code-review-time hope.
- **Good, because** ADR-0240 pattern is documented as general. Future capability authors
  consult this ADR, not a per-domain precedent that may not exist in their area.
- **Good, because** delegation tool gates are independent. Caller cannot unilaterally
  authorize a cross-namespace write by passing its own gate — the owning namespace's gate
  fires separately.
- **Good, because** audit trail preserves both caller and delegate provenance.
  `activity_trail.delegated_via != NULL` is a queryable signal for compliance audits.
- **Bad, because** 2 gates fire per cross-namespace write (performance cost). Negligible
  for admin-authored flows (wizard steps, settings UI) — these are not hot-path operations.
  If a delegation tool is ever needed in a high-frequency path, that is a signal the table
  ownership model needs revisiting, not that the gate should be skipped.
- **Bad, because** ADR-0173 and ADR-0356 reference each other. If ADR-0173 frozen-4
  semantics change, ADR-0356 must be updated in the same sortie.

### Agent Impact

- **(a) Phase 7f tool agents** implementing `setup_workspace_tariff`, `change_workspace_tariff`,
  and `add_supplement_override` MUST call `cascade.bind_workspace_union` /
  `cascade.add_supplement_rule` respectively. Direct writes to `workspace_union_binding`
  or `supplement_rule` from the payroll capability body are ADR violations.
- **(b) Sortie 3 must ship `cascade.bind_workspace_union` + `cascade.add_supplement_rule`**
  before any Phase 7f tool can ship. No Phase 7f payroll capability tool is production-ready
  until both delegation tools exist.
- **(c) Future capability authors** must consult this ADR before authoring any tool that
  touches a table outside their capability's namespace. The check is: "Does this table belong
  to my capability's namespace? If not → I need a delegation tool in the owning capability."
- **(d) Auditors** (per ADR-0186 audit contract) verify delegation pattern via
  `SELECT * FROM activity_trail WHERE delegated_via IS NOT NULL` queries.
  Any cross-namespace write that does NOT appear in this query is a violation.

---

## References

- ADR-0173 (`docs/decisions/0173-journey-capability-model.md`) — frozen-4 capability
  boundaries; capability namespace ownership model (generalized by this ADR)
- ADR-0204 — `gatedMutation` as canonical mutation primitive; all agent-layer mutations
  must route through it
- ADR-0240 (`docs/decisions/0240-journey-authoring-tool-boundary.md`) — precedent:
  `publishDraftTool` delegates to `journey.publish_mission`; this ADR generalizes that
  resolution
- ADR-0355 — consumer of `cascade.bind_workspace_union` delegation; specifies the
  `workspace_union_binding` table contract that the delegation tool writes to
- L-0176 — docstring-vs-body anti-pattern this delegation pattern defends against
  (claimed ADR compliance in docstring, bypassed gate in body)
- L-0177 — workspace_id silent-fallback anti-pattern; delegation tool gate prevents
  silent fallback to caller's workspace_id when target row lookup fails
- `packages/ai/src/capabilities/journey/` — reference implementation of the delegation
  tool pattern (`journey.publish_mission`, ADR-0240)

---

> After writing: register in `docs/decisions/0000-decision-log.md`.
