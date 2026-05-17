---
title: "Plan — harness-adapter-mvp"
status: draft
updated: 2026-05-14
created: 2026-05-14
module: harness
tags: [plan, harness, adr-0327]
---

# Plan — harness-adapter-mvp

> Branch: `feat/harness-adapter-mvp` | Worktree: /home/sxtnl/dev/smartout.ai-wt-1 | Base: `development` | Module: harness | Started: 2026-05-14

## Canonical plan location

Full plan with task-by-task steps lives at:

**`docs/superpowers/plans/2026-05-14-harness-adapter-mvp.md`**

That file is the source of truth for execution. This `docs/plans/PLAN-*.md` is a pointer required by the close-feature gate; do not duplicate content.

## Goal

Close the dead-pipe between client tool registry + site-map.json and any LLM consumer by shipping the unified `HarnessAdapter` (ADR-0327). MVP = ADR body completion + Phase 1 interface scaffold + Phase 2 registry-source implementation. Consumer wiring (Phase 3 chat, Phase 4 voice) deferred to dedicated sortie.

## Predecessor context

- ADR-0327 proposed: `docs/decisions/0327-harness-adapter-unified-llm-consumer.md` (frontmatter + context + decision only; body deferred to Task 1 of this sortie).
- Council 2026-05-14 finding: L-0264 chair self-reversal — 75 page-scope tools dead-pipe.
- Handoff: `docs/handoffs/HANDOFF-2026-05-14-polish-wave-council-harness-adapter.md`.

## Tasks

See canonical plan. 8 tasks total:

- [ ] Task 1 — Complete ADR-0327 body (alternatives, consequences, phases, test strategy, status → accepted)
- [ ] Task 2 — Phase 1 interface + types (`packages/ai/src/harness/types.ts`)
- [ ] Task 3 — Phase 2 Capabilities source
- [ ] Task 4 — Phase 2 Site-map source
- [ ] Task 5 — Phase 2 Authority enforcement
- [ ] Task 6 — Phase 2 Factory + integration
- [ ] Task 7 — Journey doc (3 server-side consumer journeys + closure gate)
- [ ] Task 8 — HANDOFF + closure

## Journeys

See `docs/journeys/JOURNEY-harness-adapter-mvp.md`. Three server-side consumer journeys; end-user journeys deferred to Phase 3+ when consumers ship.

## Acceptance Criteria

- [ ] Typecheck passes: `pnpm turbo typecheck`
- [ ] Decision log updated (ADR-0327 flipped proposed → accepted)
- [ ] User journeys written + 3 verification protocols pass
- [ ] `packages/ai/src/harness/` directory exists with interface + 3 sources + factory + tests
- [ ] No `useRegisterTools` calls touched (Phase 7 client registry stays intact for Phase 3 wiring)
- [ ] `DEAD-PIPE-2026-05-14` markers on 42 `_tools/` files NOT removed (Phase 3 will close)

## Execution

Use `superpowers:subagent-driven-development` (per polish-pipe-fix plan precedent) or `superpowers:executing-plans`.
