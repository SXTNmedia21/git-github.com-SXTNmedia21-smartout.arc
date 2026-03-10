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

This package defines the user-facing system engine for AI-first behavior in Smartout.

The focus is platform-wide machinery: states, transitions, agent runtime, event routing, notifications, verification, and learning loops.

## Core Files

- `00-core-state-engine.md`  
  Canonical state engine model and transition rules.
- `01-system-architecture-contracts.md`  
  Runtime contracts for APIs, events, schema versioning, and integrations.
- `02-agent-framework-runtime.md`  
  Agent roles, capability routing, authority, memory, and conflict control.
- `03-notification-intelligence.md`  
  Notification policy engine, routing, escalation, and anti-noise strategy.
- `04-state-machine-governance.md`  
  State machine design rules, guardrails, rollback, and migration guidance.
- `05-verification-safety-and-learning.md`  
  Test gates, safety controls, observability, and improvement loop.
- `06-autonomous-sensory-runtime.md`
  Multi-signal runtime for anomaly sensing and autonomous intervention.
- `07-journey-package-compiler.md`
  Canonical artifact contract for roadmap, journey, mission, license, and test layers.
- `08-event-envelope-spec.md`
  Canonical envelope contract for all runtime events across journey, process, guardian, and verification.
- `09-gold-package-admin-onboarding.md`
  Fully linked example package for `R-001` onboarding with mission/license/test bindings.
- `10-implementation-and-gap-plan.md`
  Program-level implementation waves, ownership model, and remaining gaps to close.

## Relationship to Industry Intelligence

- `docs/engines/system-inteligence/` defines global platform machinery.
- `docs/engines/industri-inteligence/` defines industry-specific specialization.

Composition model:

`System intelligence (global) + Industry intelligence (specialization) -> User-facing execution`
