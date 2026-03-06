---
title: AI Context Contract
id: ENGINE_AI_CONTEXT_CONTRACT
version: "0.1"
status: draft
layer: architecture
created: 2026-03-06
updated: 2026-03-06
owner: platform
tags:
  - ai
  - context
  - memory
  - prompts
---

# AI Context Contract

## Purpose

Define what context AI can use, how it is prioritized, and how it remains safe, relevant, and bounded.

## Context Layers

1. **Identity context**  
   Role, permissions, workspace, language.
2. **Session context**  
   Active mission/session state and recent events.
3. **Domain context**  
   Industry package assumptions, policies, and templates.
4. **Memory context**  
   Retrieved memory snippets with relevance thresholds.
5. **Execution context**  
   Available tools, authority state, current goals.

## Packing Rules

- Prefer smallest sufficient context for the task.
- Include authoritative sources before inferred context.
- Time-box event context to avoid stale state decisions.
- Do not include sensitive secrets in model-visible context.

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
