---
title: "Journey Package Compiler"
id: ENGINE_SYSTEM_JOURNEY_PACKAGE_COMPILER
version: "1.0"
status: draft
layer: architecture
created: 2026-03-06
updated: 2026-04-28
owner: platform
module: journey-engine
tags:
  - journey
  - roadmap
  - mission
  - protocol
  - compiler
  - flow
  - rescue
---

# Journey Package Compiler

> Defines what every approved journey produces on disk. Inputs: one IR. Outputs: 13 files in `docs/journeys/<slug>/`. See `05-protocol-pipeline.md` for the authoring pipeline that drives compilation.

## Purpose

Define the full artefact package every approved journey produces so user execution, agent execution, oversight, and verification stay aligned. One IR → one folder → one source of truth.

## Canonical Package (13 files)

Each approved IR compiles into one folder at `docs/journeys/<slug>/`:

| # | Artefact | What it answers | Generated from |
|---|---|---|---|
| 1 | `journey.md` | Source of truth (frontmatter + step body) | IR (canonical) |
| 2 | `ROADMAP.md` | The button — what user clicks to start | hand-authored, paired with MISSION |
| 3 | `MISSION.md` | The agent trigger — what fires when ROADMAP-button pressed | IR auto-derive + author enrichment |
| 4 | `LIVE-EXPERIENCE.md` | Prose flow as user lives it | IR steps → narrative |
| 5 | `LICENSE.md` | Authority + policy contract (C4 manifest) | IR capability refs → authority manifest |
| 6 | `FLOW.md` | ★ Chronological function list — closed-loop spine | IR steps + observability fields |
| 7 | `API.md` | Merged: endpoints + events + functions | IR network_response triggers + registry |
| 8 | `DATAFLOW.md` | Tables touched, data shapes, side-effects | IR assertions + side_effects |
| 9 | `COUPLINGS.md` | Other journeys/missions/services this binds to | IR prerequisites + terminates + exclusive_with |
| 10 | `e2e.spec.ts` | Playwright automation | FLOW.md → one assertion per row |
| 11 | `RESCUE-PROMPT.md` | Agent context for stuck/failed runs (optional) | hand-authored, see `10-rescue-prompt-spec.md` |
| 12 | `ir/journey.yaml` | Canonical immutable IR (post-approve) | spec → refine → approve |
| 13 | `ir/journey.hash` | sha256 integrity check | hash of journey.yaml |

### Why these 13

Each artefact maps to a **distinct consumer surface**:

- `journey.md` → authors + agents + devs
- `ROADMAP.md` → button-renderer + UX
- `MISSION.md` → Stage Engine runtime
- `LIVE-EXPERIENCE.md` → onboarding writers + support + marketing
- `LICENSE.md` → authority loader + security review
- `FLOW.md` → dashboard + observability + e2e generator
- `API.md` → frontend devs + backend devs
- `DATAFLOW.md` → DBAs + security review
- `COUPLINGS.md` → architects + cross-journey reasoning
- `e2e.spec.ts` → CI
- `RESCUE-PROMPT.md` → agent runtime on stuck/failed
- `ir/*` → all generators + run snapshots

Removing any one creates a gap. Adding a 14th duplicates an existing consumer.

## What was dropped (and why)

The earlier 9-artefact list (v0.1 of this doc) included:

- **User Test** (human experience validation) → dropped
- **Knowledge Test** (understanding/retention validation) → dropped
- **Function Test** (system behavior/integration validation) → dropped

Per author intent (2026-04-28): these are *reports* on data collection, not artefacts the engine compiles. They live in observability dashboards reading `journey_event` + `journey_run`, not in the journey folder.

The `E2E Test Script` (item 8 in v0.1) and `API Contract Extract` (item 9 in v0.1) are kept and renamed to `e2e.spec.ts` and `API.md` respectively.

## What about inference-pattern + state-card (PRD §3 runtime artefacts)?

PRD `01-prd.md` §3 lists 5 runtime artefacts: dev-test, user guide, mission, **inference pattern**, **runtime state card**. The 13-file folder above maps as:

| PRD §3 artefact | 13-file folder location |
|---|---|
| Dev-test script | `e2e.spec.ts` (generated from FLOW.md) |
| User guide | `LIVE-EXPERIENCE.md` (compiled from journey.md) |
| Mission | `MISSION.md` + `engine_missions` row (paired) |
| Inference pattern | **derived at runtime from `ir/journey.yaml`** — pattern matcher reads IR directly per ADR-0194 hybrid mapping. Not a separate file. |
| Runtime state card | **rendered at runtime from `ir/journey.yaml`** by `apps/web/src/components/journey/Fjernkontroll.tsx` (per ADR-0177). Schema-driven, no per-journey file. |

Inference pattern + state card are NOT materialized as files in the folder. They are **runtime projections** of the IR. This is intentional — both are schema-driven, and per-journey duplication would create drift risk.

If a future ADR needs them as files (e.g. for offline pattern-matching deployment), add `ir/inference-pattern.json` and `ir/state-card.json`. As of 2026-04-28, both are runtime-derived.

## Compile rules

- A journey cannot be marked `implemented` until all 13 files materialize successfully (compile gate)
- `ROADMAP.md` and `MISSION.md` must pair: `ROADMAP.fires_mission == MISSION.mission_id`
- `MISSION.md` stages must reference the same step keys as `journey.md` steps
- `LICENSE.md` must declare authority for every capability the journey invokes (no implicit defaults)
- `FLOW.md` rows must each reference a registry-bound event
- `e2e.spec.ts` must regenerate cleanly from `FLOW.md` — no hand-edits
- `journey.md` step keys must each appear exactly once in `FLOW.md` `trigger_ref`

## Runtime binding

At runtime, the package binds through:

```
start-hook (ROADMAP click)
    → fires_mission (MISSION.mission_id)
    → mission + journey execution
    → FLOW rows checked sequentially
    → step events emitted to registry
    → success_gate evaluated
    → stop-hook (completed | failed | stuck)
    → certification + reporting
```

If run state goes `stuck` or `failed`, agent loads `RESCUE-PROMPT.md` from the journey folder (if present) for context-screen.

## Ownership model

| Artefact | Owner |
|---|---|
| `journey.md`, `ROADMAP.md`, `LIVE-EXPERIENCE.md` | Product |
| `MISSION.md`, `RESCUE-PROMPT.md` | Agent framework |
| `LICENSE.md` | Governance (C4) |
| `FLOW.md`, `API.md`, `DATAFLOW.md`, `COUPLINGS.md` | Platform |
| `e2e.spec.ts` | QA / Platform (regenerated only) |
| `ir/*` | Engine (immutable) |

## Cross-references

- `00-overview.md` — entry point
- `05-protocol-pipeline.md` — the authoring pipeline that drives this compile
- `01-prd.md` §3 — five runtime artefacts (subset of the 13: MISSION, LIVE-EXPERIENCE = user guide, e2e.spec.ts = dev-test, plus runtime-only inference-pattern + state-card live in `ir/`)
- `10-rescue-prompt-spec.md` — RESCUE-PROMPT.md format
- `packages/admin-onboarding/` — reference example

## Changelog

| Date | Version | Change |
|---|---|---|
| 2026-03-06 | 0.1.0 | Initial. 9-artefact list with three test-report artefacts. |
| 2026-04-28 | 1.0.0 | 13-file canonical layout. Drops User/Knowledge/Function-test (reports, not artefacts). Adds FLOW.md, ROADMAP+MISSION pairing, RESCUE-PROMPT.md, ir/. Cross-refs migrated to 0X-named files in this folder. |
