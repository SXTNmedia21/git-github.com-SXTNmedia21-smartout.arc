---
title: "ADR-0016: Services Directory for Backend Microservices"
id: ADR-0016
status: accepted
layer: decision
created: 2026-02-27
updated: 2026-02-27
---

# ADR-0016: Services Directory for Backend Microservices

**Status:** Accepted
**Date:** 2026-02-27

## Context and Problem Statement

`apps/scrapling/` is a Python FastAPI microservice, not a UI application. Placing it alongside Next.js frontends in `apps/` muddies the intent of the monorepo structure. As the project grows, we need a clear convention for where backend services live.

## Decision Drivers (Why we must make a decision)

- `apps/` currently mixes UI apps (Next.js) with backend services (Python FastAPI)
- New developers and agents need to quickly understand what lives where
- Future backend services (webhook handlers, job runners) need a home
- Monorepo conventions should be self-documenting

## Considered Options

- **Keep services in `apps/`** — everything runnable goes in one place
- **Create `services/` directory** — separate UI apps from backend microservices
- **Put services under `packages/`** — treat them as internal packages

## Decision Outcome

Chosen option: **"Create `services/` directory"**, because it makes the monorepo intent immediately clear:

- `apps/` = UI applications (Next.js frontends)
- `services/` = Backend microservices (Python, Deno, etc.)
- `packages/` = Shared TypeScript libraries
- `agents/` = AI agents (Pydantic)

## Rules & Consequences enforced for Agents

- **Good, because** the directory structure is self-documenting — no guessing where a new service belongs
- **Good, because** pnpm workspace can optionally include `services/*` for tooling integration
- **Bad, because** one-time migration effort to move existing services
- **Agent Impact:** When creating new backend services, place them in `services/`. UI apps go in `apps/`. Never mix the two.
