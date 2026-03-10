---
title: AI Context Contract
id: ENGINE_AI_CONTEXT_CONTRACT
version: "0.1"
status: reference
layer: architecture
created: 2026-03-06
updated: 2026-03-06
owner: platform
superseded_by: AI_RUNTIME_SYSTEM_DEFINITION_V1
tags:
  - ai
  - context
  - memory
  - prompts
---

# AI Context Contract

> Reference snapshot only: canonical context envelope and packing rules live in `docs/architecture/AI_RUNTIME_SYSTEM_DEFINITION_V1.md`.

## Purpose

Define what context AI can use, how it is prioritized, and how it remains safe, relevant, and bounded.

## Context Layers

1. **Mission context**  
   Mission instructions, success criteria, and non-goals.
2. **Persona context**  
   Agent personality profile, specialty boundaries, and response posture.
3. **Identity context**  
   Role, permissions, workspace, language.
4. **Session context**  
   Active mission/session state and recent events.
5. **Domain context**  
   Industry package assumptions, policies, and templates.
6. **Memory context**  
   Retrieved memory snippets with relevance thresholds.
7. **Execution context**  
   Available stage skills/tools, authority state, current goals.

## Packing Rules

- Prefer smallest sufficient context for the task.
- Include authoritative sources before inferred context.
- Time-box event context to avoid stale state decisions.
- Do not include sensitive secrets in model-visible context.
- For mission sessions, always bind context to current stage scope.

## Context Quality Checks

- relevance score threshold
- freshness threshold
- source trust level
- contradiction detection

## Failure Handling

If context quality is insufficient:

- ask a clarification question,
- fetch missing context through read tools, or
- downgrade to safe non-mutating assistance mode.
