---
title: AI Interaction Patterns
id: ENGINE_AI_INTERACTION_PATTERNS
version: "0.1"
status: draft
layer: architecture
created: 2026-03-06
updated: 2026-03-06
owner: platform
tags:
  - ai
  - interaction
  - orchestration
---

# AI Interaction Patterns

## Purpose

Define repeatable interaction patterns for how AI engages users, operators, and system workflows.

## Primary Patterns

1. **Guide**  
   Step-by-step support for onboarding and training workflows.
2. **Assist**  
   Contextual help in the middle of active work.
3. **Explain**  
   Answer questions with policy/procedure-grounded context.
4. **Recommend**  
   Suggest improvements with confidence and rationale.
5. **Intervene**  
   Trigger nudges/escalations when risk patterns are detected.

## Orchestration Patterns

- `single-agent` for focused flows
- `orchestrator + specialist` for multi-domain tasks
- `guardian + operator` for monitored autonomy
- `human-in-the-loop` for high-impact decisions

## Pattern Selection Signals

- risk level
- confidence score
- user role
- session mode (mission vs agent)
- authority tier
