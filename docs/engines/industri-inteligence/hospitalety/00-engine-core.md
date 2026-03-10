---
title: Industry Intelligence Engine Core
id: ENGINE_INDUSTRY_CORE
version: "0.1"
status: draft
layer: architecture
created: 2026-03-06
updated: 2026-03-06
owner: platform
tags:
  - engine
  - architecture
  - event-motor
  - journeys
---

# Industry Intelligence Engine Core

## Purpose

Define what must be global system machinery and what must be industry-specific concept knowledge.

This split is mandatory to keep testing reliable and prevent cross-industry leakage.

## Layer Split

### 1) System Layer (global, reusable)

Owned by platform architecture and shared by all industries.

- Event definitions and event taxonomy
- Hooks lifecycle (start-hook, run, verify, stop-hook)
- Trigger registry (time, user, system, agent, integration)
- Endpoint/integration contract registry
- Agent tool bridge and UI command bridge
- Telemetry contracts (vector attributes, friction signals, outcomes)
- Test orchestration primitives (automated/manual/A-B/security)

### 2) Industry Layer (isolated, domain-specific)

Owned by industry intelligence package per industry.

- Seven-persona AI council
- Research model (workflow, tactics, success factors, KPIs)
- Default policy baseline
- Business structure templates
- Task pipeline templates
- Journey templates composed from reusable architecture components

## Engine Package Minimum Requirements

Each industry engine must contain:

1. AI council with seven representative personas
2. Default policies with operational/compliance coverage
3. Template library (business structure + task pipeline + journey)
4. Testing profile links (automated, manual, A/B, security)
5. Relevance map describing where each template is used

## Composition Model

Industry engine output should compose like this:

`System primitives + Industry templates + Policy guardrails + Persona assumptions -> Journey specification -> Test plan`

## Relevance Rules

- Use **system layer** documents when implementing core machinery.
- Use **industry layer** documents when defining behavior, defaults, content, and validation logic.
- Never encode industry assumptions inside global event/hook/trigger definitions.
