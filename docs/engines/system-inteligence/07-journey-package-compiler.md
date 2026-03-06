---
title: Journey Package Compiler
id: ENGINE_SYSTEM_JOURNEY_PACKAGE_COMPILER
version: "0.1"
status: draft
layer: architecture
created: 2026-03-06
updated: 2026-03-06
owner: platform
tags:
  - journey
  - roadmap
  - mission
  - protocol
  - tests
---

# Journey Package Compiler

## Purpose

Define the full artifact package every roadmap must produce so user execution, agent execution, oversight, and verification stay aligned.

## Canonical Package

Each roadmap compiles into one complete journey package:

1. **Roadmap** (user blueprint)
2. **Journey** (live experience flow)
3. **Mission** (agent execution flow)
4. **License** (policy + task + authority contract)
5. **User Test** (human experience validation)
6. **Knowledge Test** (understanding and retention validation)
7. **Function Test** (system behavior and integration validation)
8. **E2E Test Script** (automation)
9. **API Contract Extract** (endpoints, schema, side effects)

## Artifact Intent

- Roadmap answers: "What should happen?"
- Journey answers: "What does the user do and see?"
- Mission answers: "What does the agent do and decide?"
- License answers: "What is allowed, required, and blocked?"
- Tests answer: "Did it actually work?"

## Compile Rules

- A journey cannot be marked implementation-ready until required artifacts exist.
- Mission and License must reference the same state transitions and hooks as Roadmap/Journey.
- User, Knowledge, and Function tests must map to explicit acceptance criteria.
- E2E assertions must reference deterministic selectors and expected state changes.

## Runtime Binding

At runtime, the package binds through:

`start-hook -> mission + journey execution -> test gates -> stop-hook -> certification/reporting`

All runtime events in this binding must follow:

- `docs/engines/system-inteligence/08-event-envelope-spec.md`

Reference package example:

- `docs/engines/system-inteligence/09-gold-package-admin-onboarding.md`

## Ownership Model

- Product owns Roadmap/Journey semantics.
- Agent framework owns Mission behavior.
- Governance owns License policy integrity.
- QA/Platform own test fidelity and execution reliability.
