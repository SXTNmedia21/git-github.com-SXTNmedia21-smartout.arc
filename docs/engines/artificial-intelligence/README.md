---
title: Artificial Intelligence Engine
id: ENGINE_ARTIFICIAL_INTELLIGENCE
version: "0.1"
status: reference
layer: architecture
created: 2026-03-06
updated: 2026-03-06
owner: platform
superseded_by: AI_RUNTIME_SYSTEM_DEFINITION_V1
tags:
  - engine
  - ai
  - tools
  - harness
---

# Artificial Intelligence Engine

This package is now a reference pointer for historical AI engine split docs.

Canonical runtime architecture is defined in:

- `docs/architecture/AI_RUNTIME_SYSTEM_DEFINITION_V1.md`

Archived historical split docs are stored in:

- `docs/archive/artificial-inteligence/`

## Core Files

- `README.md`
  Pointer to canonical AI runtime spec and archive location.

## Three-Engine Composition

- `docs/engines/system-intelligence/` -> global machinery
- `docs/engines/industri-inteligence/` -> domain specialization
- `docs/engines/artificial-inteligence/` -> agent intelligence runtime

Composition model:

`System intelligence + Industry intelligence + Artificial intelligence -> Autonomous, safe execution`

This composition is conceptual. For normative runtime behavior, always defer to
`docs/architecture/AI_RUNTIME_SYSTEM_DEFINITION_V1.md`. For cascade-owned state,
governance, and proposal/enforcement behavior, defer to the cascade spec and
`ADR-0056`.
