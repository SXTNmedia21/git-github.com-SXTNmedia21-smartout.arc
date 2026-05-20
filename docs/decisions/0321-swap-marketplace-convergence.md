---
title: "Swap↔Marketplace Convergence: V2 Authority Pipeline"
id: ADR_0321
status: superseded
layer: decision
created: 2026-05-14
updated: 2026-05-16
superseded_by:
  - ADR_0340
---

> **Superseded 2026-05-16 by ADR-0340** — §V2 Schema Sketch and §V2 Capability
> Convergence are superseded. §V2 Trigger Conditions is amended (third trigger
> added: anticipated cross-capability reuse). See ADR-0340 for the V2 implementation
> shape adopted by the swap-marketplace-convergence-v2 sortie.

# ADR-0321: Swap↔Marketplace Convergence — V2 Authority Pipeline

## Context and Problem Statement

Two shift-reassignment surfaces exist post-Phase 2:

**Surface A — `shift-swap` capability** (on `development` since 2026-04-13):
- 5 tools: `propose_swap`, `accept_swap`, `reject_swap`, `cancel_swap`, `list_swaps`.
- Flow: employee A proposes ↔ employee B, manager approves.
- Two-sided consent model.
- Audit trail: `shift_swap.*` telemetry events.

**Surface B — `shift_marketplace` capability** (ADR-0306):
- 5 tools: `list_open_offers`, `post_open`, `claim`, `approve_claim`, `cancel_offer`.
- Flow: manager posts open → employee claims → manager approves.
- One-sided: manager initiates, employee responds.
- Audit trail: `shift_offer.*` telemetry events.

Both surfaces:
- Gate via C4 (`mutateWithGate` per ADR-0287).
- Touch `schedule_shift.profile_id` as their terminal write.
- Have different approval-stage counts (swap = 2 consent + 1 approval, marketplace = 1 claim + 1 approval).
- Use different naming conventions (`shift-swap` hyphen vs `shift_marketplace` underscore).

**Cascade Invariant 2** — every datum has one role — is at risk: same business outcome
(shift reassignment) reachable via two parallel paths with diverging audit trails.

At V1 scale (one workspace, manager-monitored), this is acceptable. At V2+ scale
(multi-workspace, automation, cross-workspace profiles), two parallel authority paths
create audit surface ambiguity and multi-stage approval conflicts.

## Decision Outcome

**V1: Ship both surfaces as-is.** No convergence changes in V1. `shift-swap` and
`shift_marketplace` remain distinct capabilities.

**V2: Unified `engine_authority_pipeline` replaces binary config.**

### V2 Schema Sketch

Replace the binary `engine_authority_config.shift_marketplace.auto_approve_claim`
(single boolean) with a workflow definition table:

```sql
CREATE TABLE engine_authority_pipeline (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES workspace(id),
  capability      TEXT NOT NULL,          -- 'shift_lifecycle_marketplace'
  action_type     TEXT NOT NULL,          -- 'claim' | 'swap_propose' | etc.
  stage_index     INTEGER NOT NULL,       -- 0-indexed approval chain
  required_role   TEXT NOT NULL,          -- 'manager' | 'owner' | 'employee'
  max_wait_minutes INTEGER,               -- NULL = no timeout
  escalation_action TEXT,                 -- 'auto_approve' | 'auto_reject' | 'escalate_to_owner'
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (workspace_id, capability, action_type, stage_index)
);
```

This enables multi-stage approval chains, timeout escalation, and role-differentiated
stages — without a new ADR per stage variation.

### V2 Capability Convergence

`shift-swap` + `shift_marketplace` collapse into `shift_lifecycle_marketplace` capability.

- Old capability names retained as **legacy aliases** for 1 calendar quarter post-V2 ship.
- Alias behavior: route to new capability with deprecation telemetry event
  `capability.legacy_alias_invoked` (name, workspace_id, timestamp).
- After alias quarter ends: aliases removed, any remaining references = build-time error.

### V2 Naming Convention

Canonical name: `shift_lifecycle_marketplace` (underscore throughout).
`shift-swap` hyphen convention retired with V2 (L-0270 class — naming drift is a
cross-capability discoverability risk).

### V2 Cross-Workspace Profiles

Profiles with multi-job employment contracts across workspaces need explicit policy:
- Which workspace's `hour_factor` governs their shift cost?
- Which workspace's authority pipeline governs approval?

This is a blocking open question. V2 ADR MUST include a cross-workspace profile policy
before `shift_lifecycle_marketplace` ships. Acceptable options:
1. Source-workspace policy governs (workspace where shift is posted).
2. Home-workspace policy governs (workspace on primary contract).
3. Intersection policy (most restrictive).

### V2 Trigger Conditions

V2 opens when EITHER:
- First workspace requests multi-stage approval (e.g. shift_marketplace: employee claim → peer review → manager sign-off).
- `adr-contract-audit` finds a second ADR-0173 capability-overlap finding citing `shift-swap` + `shift_marketplace` as parallel paths.

## Consequences

- **Good, because** V1 ships without convergence complexity.
- **Good, because** V2 path is documented — implementer knows exactly what to build.
- **Good, because** `engine_authority_pipeline` table is re-usable across capabilities
  (contract signing, deviation approval, schedule publish) with no schema duplication.
- **Bad, because** two parallel audit trails (`shift_swap.*` vs `shift_offer.*`) exist in V1.
  Cross-surface reporting (how many total reassignments this week?) requires UNION query.
- **Bad, because** naming convention drift (`shift-swap` vs `shift_marketplace`) creates
  discoverability friction in capability registry for developers.
- **Bad, because** legacy alias quarter means two overlapping code paths for one quarter
  after V2 ship — test coverage must cover both.
- **Agent Impact:**
  - V1: treat `shift-swap` and `shift_marketplace` as SEPARATE capabilities with NO shared code
    except `packages/ai/src/scheduler/eligibility.ts` (ADR-0306 + ADR-0307 shared helper).
  - V2: capability registry references `shift_lifecycle_marketplace`. Legacy aliases handled
    by registry shim, NOT by duplicating tool implementations.
  - NEVER merge `shift-swap` and `shift_marketplace` tool implementations without this ADR
    having accepted status and the cross-workspace policy section filled in.

---

> Register in `docs/decisions/0000-decision-log.md`. No migration associated with V1.
> V2 migration: CREATE TABLE `engine_authority_pipeline`. Agent-Coord finding (2026-05-14 G3 council).
> Sibling: ADR-0306 (marketplace), ADR-0200 (shift-swap, on development).
