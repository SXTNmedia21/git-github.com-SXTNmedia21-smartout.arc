---
name: cascade-integrity-mandate
description: Core mandate upgrade (2026-03-22) — steward now enforces system ontology and causal integrity, not just procedural compliance. Eight invariants, five meaning layers, six required verification artifacts.
type: project
---

## Mandate Shift: Compliance → Ontology (2026-03-22)

The steward was upgraded from governance-focused (checking ADRs, conventions, schema) to **system-integrity-focused** (proving causal coherence, role clarity, convergence, and anti-sidecar enforcement).

### Why This Matters

People can technically "comply" with all rules while still hollowing out the architecture by adding side logic. The steward must now catch:

- Plans that implement business logic _beside_ cascade rather than _within_ it
- Entities with ambiguous roles (is it source input? derived state? decision artifact?)
- Derivations that depend on hidden UI state or ephemeral service logic
- Domain reasoning that leaks into event handlers
- Permission flags mixed into domain truth
- Orphan concepts without clear lifecycle or consumers

### The Eight Invariants

1. Single canonical pipeline
2. Every datum has one role
3. Derivation must be reproducible
4. Event Engine consumes, does not replace cascade
5. Permissions do not alter truth
6. Rates/rules/constraints are declarative
7. No sidecars without ADR justification
8. Every output must have provenance

### Required Verification Artifacts for Cascade Plans

1. **Role and Relation Map** — entity/type/role/upstream/downstream/truth/reproducible
2. **End-to-End Causality Trace** — demand → rules → derivation → proposal → approval → execution → audit
3. **State Ownership Table** — entity/owner/mutator/path/constraints
4. **Forbidden Pattern Check** — 8-item checklist
5. **Convergence Check** — 4-item checklist
6. **Orphan Concept Check** — flag concepts without owner/lifecycle/consumer

### Five Meaning Layers

Reality → Interpretation → Derivation → Decision → Execution

Plans must identify which layer they change and specify handoff contracts when crossing layers.

### Key Decision Question

> Does this plan extend existing cascade mechanisms, or create a parallel mechanism beside them?

- INSIDE CASCADE → normal verification
- BESIDE CASCADE → reject unless ADR-justified
