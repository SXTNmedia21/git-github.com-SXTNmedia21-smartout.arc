---
title: "Plan — website-polish"
status: draft
updated: 2026-05-16
created: 2026-05-16
module: MODULE_01
tags: [plan, page-polish, ui-shell]
---

# Plan — website-polish

> Branch: `feat/ui-shell-website-polish` | Worktree: /home/sxtnl/dev/smartout.ai-ui-shell-wt-1 | Base: `campaign/ui-shell` | Module: MODULE_01 | Started: 2026-05-16

## Goal

Take `/dashboard/website` + sub-route `/dashboard/website/pages/[pageId]` from "works" to production-grade via `smartout-page-polish` 8-phase workflow. Sole unpolished top-segment in `apps/web/src/app/dashboard/`. Closes ui-shell campaign's top-segment polish gate.

## Scope

In scope:
- `/dashboard/website` (Server Component shell + `WebsiteOverview` client island)
- `/dashboard/website/pages/[pageId]` (editor surface)
- `/dashboard/website/setup` if route exists

Out of scope:
- New website features (polish, not build)
- Mobile parity beyond Phase 9 data-layer check (ADR-0133: website = web-only authoring)
- HarnessAdapter voice path (flag-gated, separate sortie when flag flips)

## Pre-flight (Phase 0)

- [ ] Verify no relevant capability in `packages/ai/src/capabilities/` collides on tool names
- [ ] `gate_action` seeded for test workspace
- [ ] Identify existing website mutations → confirm telemetry registry entries exist or queue add

## Tasks — 8 phases per route

### Phase 1 — Speed baseline
- [ ] Lighthouse on `/dashboard/website` (signed-in admin) — record LCP, CLS, TTI
- [ ] Lighthouse on `/dashboard/website/pages/[pageId]` — same metrics
- [ ] DevTools Performance: cold + warm load, note frames >50ms
- [ ] Save baseline to scratch (no commit)

### Phase 2 — Fix bottlenecks
- [ ] Audit skeleton-flash on Suspense boundary
- [ ] Hoist outer shell + AmbientOrb per Skeleton Crossfade Pattern if applicable
- [ ] Match skeleton dimensions to real content
- [ ] `next/dynamic` for below-fold imports

### Phase 3 — Re-test
- [ ] Re-run Lighthouse + Performance — confirm LCP < 1.5s warm

### Phase 4 — UI/UX polish (Nordic Split)
- [ ] `grep zinc-|gray-|slate-` in website tree → 0 hits
- [ ] `font-heading` on headings, `font-mono` on data
- [ ] Empty states: icon + heading + body + primary action
- [ ] Motion via framer-motion tokens (no inline stiffness/damping)
- [ ] Husky pre-commit §10 grep-gate passes

### Phase 5 — Telemetry registry
- [ ] List every mutation on these routes (page CRUD, publish, settings)
- [ ] Confirm registry entry per event in `packages/telemetry/src/registry.ts`
- [ ] `emit()` in onSuccess or after DB write
- [ ] `pnpm --filter @smartout/telemetry test` green

### Phase 6 — Page instructions
- [ ] Header description (one sentence, ≤140 chars, says WHAT FOR)
- [ ] Empty state copy with next-action
- [ ] Error state copy with retry hint

### Phase 7 — Harness tools
- [ ] `_tools/use-website-tools.ts` (dataRef pattern per §7.5.1)
- [ ] `_tools/website-tools-bridge.tsx` (client island)
- [ ] Register `useRegisterTools("website", kit)` — descriptions for LLM
- [ ] Sub-route `useRegisterTools("website-page-editor", kit)` per §7 scope-naming
- [ ] ClientToolParameter shape correct (type inside schema, string-literal location)
- [ ] No mutation tools for publish — read tools only (ADR-0244)

### Phase 7.6 — Surface disambiguation
- [ ] Website routes do NOT own chat surface → no `<DomainChatOwnership>` needed

### Phase 8 — Site-map
- [ ] Entry `/dashboard/website` in `apps/web/.botsson/site-map.json`
- [ ] Entry `/dashboard/website/pages/[pageId]`
- [ ] purpose ≤140 chars, module from ROUTES.md, tier=3, access=["admin","owner"]
- [ ] Tools list verbatim from useRegisterTools kits
- [ ] `pnpm --filter web site-map:validate` exits 0

### Phase 9 — Mobile parity
- [ ] Document `mobile_parity: web_only` in run.yml (authoring verb per ADR-0133)

### Run.yml
- [ ] `.claude/page-polish/dashboard-website.run.yml` with `verified: true`
- [ ] Sub-route doc-only: `.claude/page-polish/dashboard-website-pages-pageid.run.yml`

## Acceptance Criteria

- [ ] Lighthouse LCP < 1.5s warm on both routes
- [ ] `pnpm turbo typecheck` 0 errors
- [ ] `pnpm --filter web site-map:validate` exits 0
- [ ] `pnpm --filter @smartout/telemetry test` green
- [ ] Husky pre-commit §10 + page-polish gate pass on staged
- [ ] Decision log updated (any new ADR drafted)
- [ ] 3 user journeys written
- [ ] Handoff with decisions + learnings + next steps

## Risks

- Editor sub-route may pull heavy WYSIWYG/markdown deps → Phase 2 bundle audit critical
- Publish flow may already have telemetry — verify before duplicating
- HarnessAdapter voice path off → tools dormant on voice channel until flag flips (acceptable, documented)

## Next

Execute phases 1→9 sequentially. Each phase has independent verify step. Close-feature gate requires journeys + handoff + typecheck.
