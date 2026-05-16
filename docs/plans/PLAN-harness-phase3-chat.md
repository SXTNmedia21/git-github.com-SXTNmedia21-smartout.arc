---
title: "Plan — harness-phase3-chat"
status: complete
updated: 2026-05-14
created: 2026-05-14
module: harness
tags: [plan, harness, adr-0327, phase3, chat]
---

# Plan — harness-phase3-chat

> Branch: `feat/harness-phase3-chat` | Worktree: /home/sxtnl/dev/smartout.ai-wt-1 | Base: `development` | Module: harness | Started: 2026-05-14

## Canonical plan reference

No standalone superpowers plan doc was written for this sortie. Authoritative sources:

- **Goal + acceptance criteria:** `.claude/state/harness-phase3-chat/goal.md`
- **Dependency graph + wave layout:** `.claude/state/harness-phase3-chat/dependency-graph.md`
- **ADR:** `docs/decisions/0327-harness-adapter-unified-llm-consumer.md` (Phase 3 section)

This `docs/plans/PLAN-*.md` file is the pointer required by the close-feature gate. See harness-adapter-mvp precedent (`docs/plans/PLAN-harness-adapter-mvp.md`).

## Goal

Wire chat consumer to `HarnessAdapter` per ADR-0327 Phase 3. BFF `/api/botsson/chat` accepts + forwards `client_tools`; stage-engine `/agent/chat` resolves tools via HarnessAdapter (capabilities + client tools merged + authority re-applied) instead of bare `toVercelTools`; feature flag `HARNESS_ADAPTER_CHAT` gates the new path; 42 DEAD-PIPE markers removed after smoke-test green.

## Tasks

- [x] Wave 1 — A1: ADR-0327 Phase 3 status flip (IN PROGRESS)
- [x] Wave 1 — B1: BFF schema — `client_tools` field in `RequestSchema` + forward to stage-engine
- [x] Wave 1 — C1: Stage-engine route schema — `client_tools` field + `HARNESS_ADAPTER_CHAT` flag gate
- [x] Wave 1 — D1: chat-tool-resolver impl (HarnessAdapter compose + client-tool merge + authority re-apply)
- [x] Wave 2 — E1: Integration + pipeline tests (BFF 5/5 + route 6/6 + resolver 10/10 = 21/21)
- [x] Wave 3 — Cleanup: DEAD-PIPE-2026-05-14 markers removed from 42 `_tools/` files
- [x] Wave 4 — F1: JOURNEY-harness-phase3-chat.md (3 journeys, verified: true)
- [x] Wave 4 — F2: HANDOFF-harness-phase3-chat.md

## Journeys

See `docs/journeys/JOURNEY-harness-phase3-chat.md`. Three server-side / integration journeys:

1. BFF accepts + forwards `client_tools` — verified 5/5
2. Stage-engine resolves tool bundle via HarnessAdapter — verified 6/6 route + 10/10 resolver
3. Authority re-application prevents client-tool PII bypass — verified 1/1

## Acceptance Criteria

- [x] Typecheck passes: `pnpm turbo typecheck` (52/52 packages)
- [x] ADR-0327 Phase 3 status IN PROGRESS (operator flips to SHIPPED post live smoke)
- [x] User journeys written + all 3 verification protocols pass (21/21)
- [x] `HARNESS_ADAPTER_CHAT` feature flag gates new path (default `false`)
- [x] `toVercelTools` fallback path preserved + exercised when flag is `false`
- [x] DEAD-PIPE-2026-05-14 markers removed from all 42 `_tools/use-*-tools.ts` files
- [x] HANDOFF written
