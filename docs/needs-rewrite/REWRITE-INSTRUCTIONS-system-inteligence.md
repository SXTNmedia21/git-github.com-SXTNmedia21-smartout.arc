---
title: "Rewrite Instructions — System Intelligence Engine Files"
status: in_progress
updated: 2026-03-22
created: 2026-03-22
module: docs
tags: [rewrite, cascade, system-inteligence]
---

# Rewrite Instructions — System Intelligence Engine Files

## Files

- `00-core-state-engine.md` — State domain model
- `01-system-architecture-contracts.md` — Runtime contracts
- `02-agent-framework-runtime.md` — Agent authority/capability model

## What happened

These files defined Phase A engine patterns. The Cascade Core Foundation spec
(`docs/superpowers/specs/2026-03-21-cascade-scheduling-system-design.md`)
now defines the canonical architecture:

- State model -> Cascade dimensions D1-D6 + control planes C1-C4
- Runtime contracts -> Cascade Phase B proposal/enforcement pipeline
- Agent runtime -> Cascade C2 (Interaction Plane) + existing agent-framework.md

## What to extract (still valuable)

- `00-core-state-engine.md`: State domain taxonomy (if not fully covered by cascade dimensions)
- `01-system-architecture-contracts.md`: Any runtime contracts not covered by cascade Phase B/D
- `02-agent-framework-runtime.md`: Agent authority model details not in `architecture/agent-framework.md`

## Target documents

- Cascade spec Section 2 (Architecture) — if state model gaps found
- `architecture/agent-framework.md` — for agent runtime details
- Cascade spec Phase D — for adapter/runtime contracts

## What to drop

- Any state model, governance, or propagation patterns now defined by cascade
- Phase A sequencing and wave planning
- Duplicate architecture contracts
