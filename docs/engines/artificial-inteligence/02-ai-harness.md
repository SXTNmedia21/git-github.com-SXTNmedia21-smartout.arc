---
title: AI Harness
id: ENGINE_AI_HARNESS
version: "0.1"
status: draft
layer: architecture
created: 2026-03-06
updated: 2026-03-06
owner: platform
tags:
  - ai
  - harness
  - runtime
---

# AI Harness

## Purpose

Define the execution harness that turns model outputs into safe, deterministic system behavior.

## Canonical Runtime Model

The harness runs a strict model for structured missions:

1. **Mission**  
   Global objective, mission instructions, and success contract.
2. **Agent Persona**  
   Personality, communication style, specialty boundaries, and risk behavior.
3. **Skills**  
   The executable tools/capabilities available to the persona.
4. **Stages**  
   Phase-specific instructions, context scope, and allowed skill set.

This model prevents "one generic assistant" behavior and makes mission execution auditable.

## Harness Responsibilities

1. Parse session mode (`mission` vs `agent`) and load correct runtime contract.
2. Resolve mission instructions and active stage instructions.
3. Load agent persona and enforce persona-specific behavior boundaries.
4. Resolve stage-allowed skills and perform capability/tool routing.
5. Run authority + policy pre-checks before any side-effecting action.
6. Execute tool calls with retry/fallback policy.
7. Normalize results, update state, and emit events for observability and learning.

## Harness Loop

`input -> classify -> load mission/persona/stage -> select skill -> check authority -> call tool -> verify -> update stage/session -> respond -> log events`

## Stage Contract (Required)

Every stage must declare:

- stage objective
- explicit done criteria
- anti-goals (what not to do)
- context scope (what data/sources are visible)
- allowed skills (tool allow-list)
- escalation/fallback behavior

No stage should run without this contract.

## Reliability Controls

- deterministic retry policy by error type
- timeout and circuit-breaker rules
- fallback path when a tool/provider fails
- anti-loop protection for repeated failed actions
- stage deadlock detection (no progress across repeated turns)

## Persona Controls

- persona is runtime configuration, not only prompt text
- persona defines communication tone and decision posture
- persona can narrow or expand skill usage within mission limits
- persona must never bypass authority, policy, or stage constraints

## Output Contract

Harness results should always include:

- user-facing response
- executed actions summary
- confidence and risk markers
- next recommended step
- stage transition decision (`stay`, `advance`, `fallback`, `escalate`)
