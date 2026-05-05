---
title: System Intelligence Engine
id: ENGINE_SYSTEM_INTELLIGENCE
version: "0.1"
status: draft
layer: architecture
created: 2026-03-06
updated: 2026-03-06
owner: platform
tags:
  - engine
  - system-intelligence
  - state-machine
  - ai-first
---

# System Intelligence Engine

> **Supersession Notice (2026-03-22):** Most files in this directory have been
> archived to `docs/archive/system-inteligence/`. The Cascade Core Foundation
> spec (`docs/superpowers/specs/2026-03-21-cascade-scheduling-system-design.md`)
> now defines the canonical architecture for state management, governance,
> and proposal/enforcement. Remaining files (this README, 07-journey-package-compiler)
> are still active. Files in `docs/needs-rewrite/` contain content pending
> consolidation into the cascade spec.

This package defines the user-facing system engine for AI-first behavior in Smartout.

The focus is platform-wide machinery: states, transitions, agent runtime, event routing, notifications, verification, and learning loops.

## Active Files

- `README.md`
  Current status pointer for this package.
- `07-journey-package-compiler.md`
  Remaining active artifact contract not yet folded into newer canonical docs.

## Archived Historical Files

The following files describe the older system-intelligence package structure and
should be treated as historical reference unless explicitly pulled forward into a
new canonical doc:

- `00-core-state-engine.md`
- `01-system-architecture-contracts.md`
- `02-agent-framework-runtime.md`
- `03-notification-intelligence.md`
- `04-state-machine-governance.md`
- `05-verification-safety-and-learning.md`
- `06-autonomous-sensory-runtime.md`
- `08-event-envelope-spec.md`
- `09-gold-package-admin-onboarding.md`
- `10-implementation-and-gap-plan.md`

## Relationship to Industry Intelligence

- `docs/engines/system-inteligence/` defines global platform machinery.
- `docs/engines/industri-inteligence/` defines industry-specific specialization.

Composition model:

`System intelligence (global) + Industry intelligence (specialization) -> User-facing execution`
