---
title: "Unified AI Runtime System Definition v1"
id: ADR_0051
status: accepted
layer: decision
created: 2026-03-06
updated: 2026-03-06
---

# ADR-0051: Unified AI Runtime System Definition v1

## Context and Problem Statement

Smartout AI runtime behavior was split across multiple documents with overlapping terms and partially different contracts. The system lacked one canonical definition for how mission mode, agent mode, personas, stages, skills, guard rails, guardian lifecycle, context packing, and runtime events connect.

This fragmentation increased implementation risk, made audits harder, and created ambiguity about which contract was authoritative.

## Decision Drivers

- One canonical runtime contract is required for safe implementation at scale.
- Guardian call supervision must be first-class in the same runtime model.
- Mission mode and agent mode must share one envelope shape.
- Context loading must be deterministic and bounded.
- Event contracts must be auditable end-to-end.

## Considered Options

1. **Keep split docs** — continue with current distributed architecture notes.
2. **Partial merge** — unify only contracts while leaving context/system definitions separate.
3. **Single canonical runtime spec** — one document with envelope, context, system definition, and governance.

## Decision Outcome

Chosen option: **"Single canonical runtime spec"**, because it removes ambiguity and creates one enforceable architecture contract.

Smartout adopts `docs/architecture/AI_RUNTIME_SYSTEM_DEFINITION_V1.md` as the canonical source of truth for AI runtime behavior.

## Rules & Consequences

- **Good, because** mission, agent, guardian, and guard-rail behavior now share one coherent model.
- **Good, because** all runtime-critical contracts (contract envelope, context envelope, event envelope) are centralized.
- **Good, because** implementation and review work can validate against one definition.
- **Bad, because** existing AI engine docs become secondary references and require maintenance discipline to avoid drift.
- **Bad, because** migration requires teams to align naming and contract fields incrementally.
- **Agent Impact:** Treat `AI_RUNTIME_SYSTEM_DEFINITION_V1` as canonical. Existing docs in `docs/engines/artificial-inteligence/00-05` are reference annexes and must not introduce competing normative rules.

---
