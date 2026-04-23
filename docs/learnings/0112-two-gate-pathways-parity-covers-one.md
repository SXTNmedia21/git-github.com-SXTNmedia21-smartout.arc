---
title: "Two Gate Pathways — Parity Gate Covers ADR-0099, Not ADR-0091"
id: LEARNING_0112
status: canonical
layer: learning
created: 2026-04-22
updated: 2026-04-22
tags: [authority, c4, gate-action, cascade-gate-write, adr-0099, adr-0091, adr-0189, parity-gate, taxonomy, daily-operation]
---

# Learning-0112: Two Gate Pathways — Parity Gate Covers ADR-0099, Not ADR-0091

## Context

Phase 0e of the 2026-04-22 daily-operation session surfaced ten suspected unseeded capabilities from a combined grep/parity-gate scan:

- Seven colon-delimited: `profile:update:role`, `profile:update:department`, `profile:update:status`, `profile:update:bulk`, `profile:delete`, `season:create`, `season:update`.
- Three dotted: `observer_request.create`, `observer_request.claim`, `observer_request.approve`.

The handoff flagged L-0107 ("authority appearance ≠ presence") and specifically noted the seven colon-delimited strings *might* use a different gate pathway. The AST-based parity gate (`scripts/authority-seed-parity.ts`) agreed with half of that suspicion: it reported only the three `observer_request.*` as missing seeds, while silently ignoring the seven colon strings.

The resolution required reading both the parity gate's pattern matcher and the actual call-sites of every suspect.

## Discovery

Smartout has **two structurally distinct authority gates, each with its own RPC and its own seed-presence semantics**. The parity gate (ADR-0189) was designed around exactly one of them.

### Pathway A — `gate_action` (ADR-0099 Unified Authority Gate)

- **RPC:** `supabase.rpc("gate_action", { p_capability, p_channel, ... })`
- **TS helper:** `gateAction({ capability, ... })` — `apps/web/src/app/dashboard/_actions/_shared.ts`
- **Evaluates against:** `engine_authority_config` row for `(workspace_id, capability)`.
- **Default behaviour when no row exists:** ALLOW (`allow=true, reason=NULL`). The CVE vector.
- **Capability shape:** dotted literals (`reconciliation.override`, `observer_request.claim`, `session.open`). Matches the parity gate's `DOTTED_RE = /^[a-z_][a-z0-9_]*(\.[a-z_][a-z0-9_]*)+$/`.
- **Parity gate coverage:** yes. `scripts/authority-seed-parity.ts` walks every `.rpc("gate_action", ...)` and `gateAction({ capability: ... })` call expression, collects literal capabilities, diffs against `INSERT INTO engine_authority_config` seeds.

### Pathway B — `cascade_gate_write` (ADR-0091 Cascade Governance Gate)

- **RPC:** `supabase.rpc("cascade_gate_write", { p_entity_type, p_capability, p_action, ... })`
- **TS helper:** `gatedInsert` / `gatedUpdate` / `gatedDelete` — `packages/supabase/src/gate-client.ts`
- **Evaluates against:** framework rules, `change_proposal` tree, entity-specific cascade rules. Reads `p_capability` for audit-trail labelling but **does not consult `engine_authority_config`**.
- **Default behaviour:** framework-rule dependent. Not a single-row allow/deny.
- **Capability shape:** colon literals (`profile:update:role`, `season:create`). Does NOT match `DOTTED_RE`. Does NOT appear in the `SINGLE_WORD_ALLOWLIST`.
- **Parity gate coverage:** no. `scripts/authority-seed-parity.ts` doesn't scan `cascade_gate_write` calls, and even if it did, there's no `engine_authority_config` seed to diff against — that's not how pathway B evaluates authority.

### Why the seven colon strings weren't in "missing seeds"

They flow through `GateContext.capability` into `gatedInsert`/`gatedUpdate`, which invokes `cascade_gate_write`. The capability string is recorded on the gate audit row but authority is evaluated by cascade framework logic, not by `engine_authority_config` lookup. Seeding `profile:update:role` into `engine_authority_config` would be a no-op — no code reads it.

### Why the three observer_request strings WERE in "missing seeds"

They flow through direct `admin.rpc("gate_action", { p_capability: "observer_request.create", ... })` in `apps/web/src/app/api/observer-requests/**/route.ts`. These are pathway-A calls against dotted literals. They must be seeded.

## Impact

- **Immediate:** seed migration `20260517090000_seed_observer_request_authority.sql` adds the three missing pathway-A rows. The seven pathway-B capabilities are documented as non-seedable in the migration header — zero code reads them from `engine_authority_config`, so seeding would be performative.
- **ADR-0189 scope clarification:** the parity gate's charter is "every pathway-A literal has an `engine_authority_config` seed." It does not (and should not) attempt to enforce pathway-B governance — that's ADR-0091's domain, and the enforcement surface there is framework rules, not seed rows.
- **Future triage:** when an audit surfaces an "ungated capability", the first question is always "which RPC?" — not "which seed file?". The RPC identifies the pathway; the pathway identifies the enforcement surface; the enforcement surface identifies what "seeded" even means.
- **Test/fixture caveat:** grep-count audits for "capability:" literals without call-site verification overcount. L-0072 (audit inflation pattern) applies here too — the Phase 0b scan surfaced ten suspects, but seven were pathway-B false positives of the pathway-A gate's concern.

## References

- ADR-0099 (unified authority gate — pathway A, `gate_action`)
- ADR-0091 (cascade gate write — pathway B, `cascade_gate_write`)
- ADR-0137 (gate-action stacking semantics — formalises the two-gate interaction for capability tools writing to governance-gated entities)
- ADR-0189 (authority seed parity CI check — charter is pathway A only)
- Learning-0107 (authority appearance ≠ presence — the CVE framing for pathway A)
- Learning-0097 (C4 authority defaults are not free — the original discovery on cascade_gate_write)
- Learning-0111 (CI capability seed parity mechanics)
- `scripts/authority-seed-parity.ts` — AST walker; recognises `gate_action` RPC + `gateAction` helper only
- `packages/supabase/src/gate-client.ts:183` — `cascade_gate_write` call (pathway B)
- `apps/web/src/app/dashboard/_actions/_shared.ts:95` — `gate_action` helper internals (pathway A)
- Seed migration: `supabase/migrations/20260517090000_seed_observer_request_authority.sql`

---

> Registered in `docs/learnings/0000-learning-log.md`.
