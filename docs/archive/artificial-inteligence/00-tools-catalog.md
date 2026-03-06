---
title: AI Tools Catalog
id: ENGINE_AI_TOOLS_CATALOG
version: "0.1"
status: reference
layer: architecture
created: 2026-03-06
updated: 2026-03-06
owner: platform
superseded_by: AI_RUNTIME_SYSTEM_DEFINITION_V1
tags:
  - ai
  - tools
  - capabilities
---

# AI Tools Catalog

> Reference snapshot only: canonical runtime/tool contracts live in `docs/architecture/AI_RUNTIME_SYSTEM_DEFINITION_V1.md`.

## Purpose

Define the canonical tool layer that AI agents can use to read, reason, and act inside Smartout.

## Tool Classes

1. **Read tools**  
   Query state, retrieve records, inspect context.
2. **Action tools**  
   Perform safe mutations through validated contracts.
3. **Control tools**  
   Start, pause, resume, or cancel mission/process activity.
4. **Communication tools**  
   Send nudges, requests, and escalations.
5. **Verification tools**  
   Trigger checks, tests, and quality gates.

## Capability Mapping

- `profile` -> identity and role context tools
- `schedule` -> shift and availability tools
- `training` -> readiness and protocol tools
- `operations` -> session and task tools
- `knowledge` -> policy/procedure retrieval tools
- `guardian` -> monitoring and intervention tools
- `ui` -> navigation and interaction support tools

## Tool Contract Rules

- Every tool must declare:
  - input schema
  - output schema
  - side-effect level
  - authority requirements
  - idempotency behavior
- Unsafe tools require explicit policy and authority checks before execution.
