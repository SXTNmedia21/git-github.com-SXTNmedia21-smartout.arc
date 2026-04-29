---
title: "Plan — m2-tour-harness"
feature: m2-tour-harness
spec: docs/superpowers/specs/2026-04-28-same-page-tour-harness.md
status: draft
updated: 2026-04-28
created: 2026-04-28
module: Core
campaign: core-module
milestone: M2.2
tags: [plan, help, botsson, tour, ui-tools]
---

# Plan — m2-tour-harness

> Branch: `feat/core-module-m2-tour-harness` | Worktree: `/home/sxtnl/dev/smartout.ai-core-module-wt-1` | Base: `campaign/core-module` | Module: Core

**Spec:** [Same-Page Tour Harness on /dashboard/help (M2.2)](../superpowers/specs/2026-04-28-same-page-tour-harness.md)

## Journeys (the contract)

- [JOURNEY-m2-tour-harness-employee-onboarding](../journeys/JOURNEY-m2-tour-harness-employee-onboarding.md) — Employee asks "vis meg hvordan jeg ber om hjelp" → Botsson highlights panic bar
- [JOURNEY-m2-tour-harness-admin-discovery](../journeys/JOURNEY-m2-tour-harness-admin-discovery.md) — Admin asks "hvor finner jeg [feature]" → Botsson navigates + highlights tier
- [JOURNEY-m2-tour-harness-cancellation](../journeys/JOURNEY-m2-tour-harness-cancellation.md) — User presses ESC or off-target click → highlights clear, telemetry cancelled
- [JOURNEY-m2-tour-harness-reduced-motion](../journeys/JOURNEY-m2-tour-harness-reduced-motion.md) — `prefers-reduced-motion: reduce` → instant scroll, static outline (I-2)

## Goal

Add two page-scoped client tools to `/dashboard/help` so Botsson can guide users *within* the page (point at panic bar, point at chat hero, etc.). Read-only DOM. NO mutation.

## Tasks

- [ ] **T1** — Create anchor allow-list at `apps/web/src/app/dashboard/help/_lib/tour-anchors.ts`. Const map: `{ panic_bar: "panic-bar", chat_hero: "chat-hero", quick_paths: "quick-paths", curated_articles: "curated-articles", kontakt_footer: "kontakt-footer", active_ticket_badge: "active-ticket-badge" }`. Export `TourAnchor` union type + `TOUR_ANCHORS` const + `isValidAnchor(id: string)` guard.
- [ ] **T2** — Add `id` attributes to anchor sections in `apps/web/src/app/dashboard/help/page.tsx` (PanicBar wrapper, BotssonChatHero wrapper, QuickPathCards section, CuratedArticlesList section, KontaktFooter section, ActiveTicketBadge wrapper). Match anchor IDs from T1.
- [ ] **T3** — Add telemetry events to `packages/telemetry/src/registry.ts`:
  - `help.tour_step_invoked` → posthog + activity_trail. Payload `{ workspaceId, actorId, tool: 'navigate_to'|'highlight_element', target_id: TourAnchor, reduced_motion: boolean }`.
  - `help.tour_completed` → posthog + activity_trail. Payload `{ workspaceId, actorId, step_count: number, duration_ms: number }`.
  - `help.tour_cancelled` → posthog + activity_trail. Payload `{ workspaceId, actorId, trigger: 'esc'|'off_target_click', step_count: number }`.
- [ ] **T4** — Build `helpTourKit` ClientToolKit at `apps/web/src/app/Botsson/_components/help-tour-kit.ts`. Two tools: `ui.navigate_to({ target_id })` and `ui.highlight_element({ target_id, label, duration_ms? })`. Validates target_id via `isValidAnchor`. Returns `{ ok: false, reason: "unknown_target" }` if invalid.
- [ ] **T5** — Build overlay component `apps/web/src/app/dashboard/help/_components/TourHighlight.tsx` (Client Component). Renders absolute-positioned outline div + label badge. z-index BELOW shadcn Sheet/Dialog (use `z-40`, Sheet uses `z-50`). Animates outline draw on mount; respects `prefers-reduced-motion: reduce` (no animation).
- [ ] **T6** — Build `useHelpTour` hook at `apps/web/src/app/dashboard/help/_hooks/useHelpTour.ts`. Manages active highlight state, ESC + off-target click handlers, telemetry emit, step counter for `tour_completed` (3+ steps within 60s). Single-active-highlight policy (Q1 default).
- [ ] **T7** — Build `HelpTourToolsBridge` Client Component at `apps/web/src/app/Botsson/_components/help-tour-tools-bridge.tsx`. Mirrors `HelpVoiceToolsBridge` shape — calls `useRegisterTools("help", kit)` where kit comes from T4 + bound to T6 hook.
- [ ] **T8** — Mount `<HelpTourToolsBridge />` from `apps/web/src/app/dashboard/help/page.tsx` alongside existing `<HelpVoiceToolsBridge />`.
- [ ] **T9** — `prefers-reduced-motion` integration: `ui.navigate_to` uses `behavior: "smooth"` normally, `behavior: "instant"` when reduced. `ui.highlight_element` emits `reduced_motion: true` in telemetry; TourHighlight component skips outline-draw animation.
- [ ] **T10** — Focus management: when `ui.navigate_to` lands, set `tabindex=-1` on target element if missing, then call `.focus({ preventScroll: true })` so screen readers announce.
- [ ] **T11** — E2E `apps/e2e/tests/journey-help-tour-onboarding.spec.ts` — Journey 1: chat hero invokes ui.navigate_to + ui.highlight_element with target_id='panic_bar' → panic bar visible in viewport, outline overlay present, telemetry emit count = 2.
- [ ] **T12** — E2E `apps/e2e/tests/journey-help-tour-anchors.spec.ts` — Anchor allow-list invariant (I-1): invoke with target_id='nonexistent' returns `{ok:false, reason:"unknown_target"}`. Each valid anchor has exactly one matching `id` in DOM.
- [ ] **T13** — E2E `apps/e2e/tests/journey-help-tour-cancellation.spec.ts` — Journey 3 (I-3): trigger highlight, press ESC → overlay removed + `help.tour_cancelled` emit. Repeat with off-target click.
- [ ] **T14** — E2E `apps/e2e/tests/journey-help-tour-reduced-motion.spec.ts` — Journey 4 (I-2): reducedMotion context → `ui.navigate_to` uses instant scroll, no animation classes on outline.
- [ ] **T15** — Audit G-RO + G-ANCHORS:
  - G-RO: grep `help-tour-tools-bridge.tsx`, `help-tour-kit.ts`, `useHelpTour.ts`, `tour-anchors.ts`, `TourHighlight.tsx` for `gateAction|insert|update|emit\(.*opened|delete from`. Must return 0.
  - G-ANCHORS: grep `apps/web/src/app/dashboard/help/page.tsx` for each anchor id from TOUR_ANCHORS. Must return ≥1 match each.
- [ ] **T16** — `pnpm turbo typecheck` PASS.
- [ ] **T17** — Update each journey frontmatter `status: verified` + `e2e_test:` path.
- [ ] **T18** — HANDOFF in `docs/handoffs/HANDOFF-m2-tour-harness.md` with G-RO + G-ANCHORS audit + I-1..I-4 verdicts.

## Acceptance Criteria

- [ ] Every declared journey has `status: verified` in frontmatter
- [ ] Typecheck passes: `pnpm turbo typecheck`
- [ ] Decision log updated for any architectural choices (ADR for ui-tools page-tool pattern if it doesn't already exist)
- [ ] At least one E2E test exists per journey
- [ ] G-RO merge-blocker: 0 mutation paths in tour code
- [ ] G-ANCHORS merge-blocker: every TOUR_ANCHORS const has matching DOM id on /help page
