---
title: "System Intelligence — Overview"
id: ENGINE_SYSTEM_INTELLIGENCE_OVERVIEW
version: "1.0"
status: draft
layer: architecture
created: 2026-04-28
updated: 2026-04-28
owner: platform
module: journey-engine
tags:
  - overview
  - journey-engine
  - system-intelligence
---

# System Intelligence — Overview

> Entry point for the System Intelligence engine package. Read this first. Then jump to the file that owns the layer you're touching.

System Intelligence is the global platform machinery: state, contracts, agent runtime, event routing, telemetry, journey authoring, and verification. Sits alongside `industri-inteligence/` (industry specialization) and `artificial-inteligence/` (model + voice config) under `docs/engines/`.

The runtime composition:

```
System intelligence (global)
   + Industry intelligence (specialization per vertical)
   + Workspace intelligence (per-tenant memory + authority)
   = User-facing execution
```

---

## What lives here

| File | Layer | Read when |
|---|---|---|
| **`00-overview.md`** | entry point | starting cold; orientation |
| **`01-prd.md`** | PRD v0.2 | designing/extending the engine; canonical requirements |
| **`02-architecture.md`** | architecture + contracts | wiring runtime; reading DB schema; building API |
| **`03-mental-model.md`** | portable mental model | onboarding to journey-engine concepts; cross-project lift |
| **`04-lifecycle.md`** | status state machine | implementing transitions; reconciling 13-status authoring vs IR runtime enum |
| **`05-protocol-pipeline.md`** | authoring pipeline | running the `journey-protocol` skill; writing a journey from scratch |
| **`06-ir-template.md`** | IR authoring template | filling out a new IR YAML by hand or via skill |
| **`07-journey-package-compiler.md`** | package compile contract | understanding what gets generated from one IR |
| **`10-rescue-prompt-spec.md`** | rescue context format | authoring agent fallback for stuck/failed runs |
| **`11-handoff-capstone.md`** | campaign capstone | seeing what the journey-engine campaign actually shipped (code refs, ADRs, gates) |
| **`packages/`** | reference protocol packages | seeing real Roadmap+Journey+Mission+License examples (admin-onboarding, check-my-schedule, punch-into-shift) |

Numbers 08, 09, 12+ are reserved for future canonical specs (event envelope, gold reference packages, runtime-state-card schema). Files were archived during 2026-03-22 docs reorg; restore from `docs/archive/` if needed.

---

## How the layers fit

```
     ┌─────────────────────────────────────────────────────┐
     │  AUTHORING                                          │
     │  Skill (journey-protocol)                           │
     │   ─► 05-protocol-pipeline.md (5 ops)                │
     │   ─► 06-ir-template.md                              │
     │   ─► 10-rescue-prompt-spec.md                       │
     │   ─► outputs: docs/journeys/<slug>/ folder          │
     ├─────────────────────────────────────────────────────┤
     │  COMPILE                                            │
     │   ─► 07-journey-package-compiler.md                 │
     │   ─► IR → 13-file folder + 5 runtime artefacts      │
     ├─────────────────────────────────────────────────────┤
     │  RUNTIME                                            │
     │   ─► 01-prd.md  (engine PRD v0.2)                   │
     │   ─► 02-architecture.md  (DB + API + algorithms)    │
     │   ─► 03-mental-model.md  (capability surfaces)      │
     │   ─► 04-lifecycle.md  (state transitions)           │
     ├─────────────────────────────────────────────────────┤
     │  WHAT WE SHIPPED                                    │
     │   ─► 11-handoff-capstone.md  (4 caps, gates, ADRs)  │
     └─────────────────────────────────────────────────────┘
```

---

## The five-second summary

1. A **journey** = one actor, one goal, one path.
2. Authored once as an **IR** (intermediate representation) via the `journey-protocol` skill.
3. Approve compiles the IR into a **13-file folder** at `docs/journeys/<slug>/` — that folder is source of truth.
4. Runtime executes the journey via **4 capabilities** (`run_dev`, `run_guided`, `publish_mission`, `publish_guide`).
5. **Roadmap** (button user clicks) and **Mission** (agent trigger) are paired — same `mission_id` join.
6. Every step emits a **registry-bound event**. CI fails on phantom emits. Dashboard renders the live `FLOW.md`.
7. Failure modes get a **`RESCUE-PROMPT.md`** — agent context for what to say when run state goes stuck/failed.

---

## Cross-engine links

- Industry specialization: `docs/engines/industri-inteligence/`
- AI config (voice, model): `docs/engines/artificial-inteligence/`
- Cascade architecture (D1–D6 + C1–C4): `docs/superpowers/specs/2026-03-21-cascade-scheduling-system-design.md`
- Closure deliverables for individual journeys (per-feature stubs): `docs/journeys/JOURNEY-*.md` (different beast — feature closure handoffs, not protocol packages)
