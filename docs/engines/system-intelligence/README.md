---
title: System Intelligence Engine
id: ENGINE_SYSTEM_INTELLIGENCE
version: "1.0"
status: draft
layer: architecture
created: 2026-03-06
updated: 2026-04-28
owner: platform
module: journey-engine
tags:
  - engine
  - system-intelligence
  - state-machine
  - ai-first
  - journey-engine
---

# System Intelligence Engine

Read **[`00-overview.md`](./00-overview.md)** first. It indexes everything in this folder.

## What lives here

| File | Purpose |
|---|---|
| `00-overview.md` | Entry point — start here |
| `01-prd.md` | PRD v0.2 — canonical engine requirements |
| `02-architecture.md` | DB schema, API contracts, algorithms |
| `03-mental-model.md` | Portable mental model (cross-project) |
| `04-lifecycle.md` | 13-status authoring + 7-enum IR + 6-state run reconciliation |
| `05-protocol-pipeline.md` | Five-op authoring pipeline + 13-file folder + FLOW.md schema |
| `06-ir-template.md` | Authoring template the skill writes |
| `07-journey-package-compiler.md` | What gets generated from one IR (the 13-file contract) |
| `10-rescue-prompt-spec.md` | Agent context for stuck/failed runs |
| `11-handoff-capstone.md` | What the journey-engine campaign actually shipped |
| `packages/` | Reference protocol packages (admin-onboarding, check-my-schedule, punch-into-shift) |

## Composition

```
System intelligence (this engine, global)
   + Industry intelligence (specialization per vertical)
   + Workspace intelligence (per-tenant memory + authority)
   = User-facing execution
```

See sibling engines:

- `docs/engines/industri-inteligence/` — industry packages (NACE-driven defaults, Riksavtalen, hospitality)
- `docs/engines/artificial-inteligence/` — model + voice config (Ultravox, OpenRouter)

## Renamed from `system-inteligence`

Folder renamed `system-inteligence` → `system-intelligence` on 2026-04-28 to fix the long-standing typo. Cross-refs in `INDEX.md`, `EVENT_MOTOR.md`, `MODULE_0_ROADMAP.md` updated. Sibling folders `artificial-inteligence` and `industri-inteligence` retain their original spelling pending separate rename decisions.
