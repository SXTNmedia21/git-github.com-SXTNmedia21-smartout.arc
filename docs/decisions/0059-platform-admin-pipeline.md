---
title: "ADR-0059: Platform Admin Pipeline Separation"
status: accepted
updated: 2026-03-28
created: 2026-03-28
module: stage-engine
tags: [adr, admin, pipeline, telegram, walkai]
---

# ADR-0059: Platform Admin Pipeline Separation

## Context

The Telegram adapter needs a message processing pipeline for the platform admin (Pontus). The existing `routeAgentMessage()` pipeline is workspace-scoped at every layer:

- `chat.ts` rejects requests without workspace_id (403)
- `agent-router.ts` requires workspaceId for authority loading, context collection, and tool selection
- `createAgentSession()` takes `workspaceId: string` (not nullable)
- Intent classifier categorizes into employee-facing capabilities

The platform admin is not an employee. His messages cross workspace boundaries.

## Decision

Create a separate lightweight `routeAdminMessage()` pipeline that:

1. Does NOT require workspace_id (accepts optional workspace context)
2. Skips workspace-scoped authority loading (god-mode = full access)
3. Has its own admin tool set (separate from employee capabilities)
4. Has its own system prompt (admin persona, not employee-facing)
5. Reuses the LLM infrastructure but skips workspace plumbing

## Rationale

- **Nullable DB column != nullable pipeline.** Migration 20260330 made `engine_sessions.workspace_id` nullable, but the TypeScript layer independently enforces non-null at every step.
- **A sentinel "system workspace" would violate tenant isolation semantics** and require `WHERE workspace_id != SENTINEL` guards in every downstream consumer.
- **Admin and employee are fundamentally different contexts** — different authority model, different tools, different intent space.

## Consequences

- Two message pipelines: `routeAgentMessage()` (workspace-scoped) and `routeAdminMessage()` (platform-scoped)
- Admin tools are plain functions, not registered capabilities
- Admin sessions have `workspace_id = NULL` in the database
- Future admin features can extend `routeAdminMessage()` without touching the employee pipeline
