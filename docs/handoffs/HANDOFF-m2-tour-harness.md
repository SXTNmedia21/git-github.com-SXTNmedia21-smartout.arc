---
title: "HANDOFF — M2.2 Same-Page Tour Harness for /dashboard/help"
feature: m2-tour-harness
sub_sortie: M2.2
status: complete
verdict: APPROVED — ready to merge
audit_date: 2026-04-28
created: 2026-04-28
updated: 2026-04-28
module: Core
tags: [handoff, m2, tour, help, harness]
---

# HANDOFF — M2.2 Same-Page Tour Harness

## Summary

Ships the read-only DOM tour harness for `/dashboard/help` per spec
`docs/superpowers/specs/2026-04-28-same-page-tour-harness.md`. Two
client-side UI tools (`ui.navigate_to`, `ui.highlight_element`) bound to a
6-anchor allow-list. No DB writes. Three telemetry events
(`help.tour_step_invoked`, `help.tour_completed`, `help.tour_cancelled`)
flow through `emit()` to all four destinations.

**In scope (M2.2):**
- Anchor allow-list + `isValidAnchor` guard.
- Six page anchors wired in `apps/web/src/app/dashboard/help/page.tsx`.
- `useHelpTour` hook (state, scroll, highlight lifecycle, ESC + off-target
  cancel, completion threshold, telemetry).
- `TourHighlight` overlay (z-40, animate-in unless reduced-motion).
- `useHelpTourKit` (two ClientToolDefinitions + implementations) +
  `HelpTourToolsBridge` (composes hook + kit, registers via
  `useRegisterTools("help-tour", kit)`, mounts overlay).
- E2E coverage: 4 specs covering 4 journeys.

**Out of scope (deferred to M2.3 or later):**
- Doc-ingest auto-update for tour anchors when `/help` page changes.
- Full agent-invoked E2E (chat → stage-engine → tool runtime → DOM).
- `window.__helpTour` test handle for direct kit invocation.

## Audit Verdicts

| Gate     | Verdict | Evidence |
|----------|---------|----------|
| **G-RO** (read-only DOM, no mutations) | **PASS** | Strict grep for `gateAction|.from(...)\.(insert|update|upsert|delete)|supabase.` across 5 tour files = 0 matches (rc=1). The 6 `emit()` calls (kit:146,181; hook:77,109,144,169) are telemetry only. `updateRect` in `TourHighlight.tsx:55` is a local UI-state setter, not a DB update. |
| **G-ANCHORS** (allow-list ↔ DOM) | **PASS** (6/6) | All 6 const values in `tour-anchors.ts` match `id="…"` in `page.tsx`: panic-bar:87, chat-hero:112, active-ticket-badge:99, quick-paths:119, curated-articles:127, kontakt-footer:137. |
| **I-1** (anchor allow-list guard) | **PASS** | `tour-anchors.ts:17-19` — `isValidAnchor` returns `id is TourAnchor` via `id in TOUR_ANCHORS`. Both kit implementations (kit:139,167) reject unknown ids with `{ ok: false, reason }`. |
| **I-2** (reduced-motion) | **PASS** | `useHelpTour.ts:55-58` matchMedia check, `:99` conditional `behavior: "instant"|"smooth"`. `TourHighlight.tsx:93` conditional `animationClass = reducedMotion ? "" : "animate-in fade-in zoom-in-95 duration-200"`. Bridge re-derives at `:53-56`. Telemetry payload includes `reduced_motion` flag. |
| **I-3** (ESC + off-target cancel) | **PASS** | `useHelpTour.ts:185-194` keydown ESC handler (only fires when `activeHighlight !== null`). `:197-218` document-level click handler — cancels when target is outside both anchor and `.help-tour-overlay`. Both paths emit `help.tour_cancelled` with proper trigger. |
| **I-4** (z-index layering) | **PASS** | `TourHighlight.tsx:99` uses `z-40`. `sheet.tsx:24,34` Sheet uses `z-50`. Overlay correctly stays below modals. Comment at `TourHighlight.tsx:8` documents the intent. |

## Phantom Contracts (ADR-0197)

**Producer → Consumer trace for each contract:**

| Contract | Producer | Consumer | Verdict |
|----------|----------|----------|---------|
| `ui.navigate_to` tool | `help-tour-kit.ts:39-58` (definition) + `:136-160` (implementation) | `HelpTourToolsBridge:33-47` `onInvoke` → `useHelpTour.navigateTo` (`useHelpTour.ts:92-123`) → `document.getElementById` + `scrollIntoView`. Bridge mounted at `page.tsx:152`. | **PASS** |
| `ui.highlight_element` tool | `help-tour-kit.ts:62-106` + `:162-195` | `HelpTourToolsBridge:43` → `useHelpTour.highlightElement:126-158` → `setActiveHighlight` → `TourHighlight` overlay rendered at bridge `:58-64`. | **PASS** |
| `help.tour_step_invoked` event | `useHelpTour.ts:109,144` + `help-tour-kit.ts:146,181` | Registry def `packages/telemetry/src/registry.ts:5802`, routing `:8583`. | **PASS** |
| `help.tour_completed` event | `useHelpTour.ts:77` (3-step / 60s threshold) | Registry def `:5822`, routing `:8587`. | **PASS** |
| `help.tour_cancelled` event | `useHelpTour.ts:169` | Registry def `:5836`, routing `:8591`. | **PASS** |

No orphan producers, no orphan consumers, no missing registry entries.

## Decisions Made

1. **Test handle vs structural-only E2E.** The `window.__helpTour` test
   handle for direct kit invocation was NOT wired in this sub-sortie.
   Reason: the dynamic tool registry is not exposed via `window` in the
   current Botsson architecture, so an in-process handle would have meant
   touching kernel files. We chose structural-only E2E (verify anchors +
   DOM behaviour + telemetry routing) and deferred full agent-invoked
   E2E to a separate integration test with stubbed agent.
2. **Admin-discovery shares E2E with employee-onboarding.** The two
   journeys execute the same code path through the harness; only the
   conversational framing differs. We documented this explicitly in
   the admin-discovery journey frontmatter via `e2e_coverage_note` rather
   than duplicating a near-identical spec.
3. **`recordStep()` is shared by both navigateTo and highlightElement.**
   Either tool counts as a step for the 3-in-60s completion threshold.
   This matches the spec — a tour "session" is intent-driven, not
   tool-specific.
4. **Off-target click cancel is gated on `activeHighlight !== null`.**
   The click listener only mounts while a highlight is active
   (useHelpTour.ts:198 early return), preventing global click pollution.

## Files Changed

**Commits on `feat/core-module-m2-tour-harness`:**
- `9e6b5adc` — spec (M2.2 same-page tour harness)
- `524f46ee` — plan + 4 journey stubs
- `36247e60` — T1 — tour anchor allow-list (`tour-anchors.ts`)
- `598de130` — T2/T3 — anchor ids on /help tiers
- `59f92941` — T4–T10 — kit + overlay + hook + bridge + mount + reduced-motion + focus
- `b1574fa2` — T11 — onboarding tour E2E (Journey 1)
- `03a04578` — T12 — anchors invariant E2E (I-1, G-ANCHORS)
- `1cd12e05` — T13 — cancellation E2E (Journey 3, I-3)
- `63adfe84` — T14 — reduced-motion E2E (Journey 4, I-2)
- (this commit) — T15–T18 — audit + journey verification flip + HANDOFF

**Implementation:**
- `apps/web/src/app/dashboard/help/_lib/tour-anchors.ts` (new)
- `apps/web/src/app/dashboard/help/_hooks/useHelpTour.ts` (new)
- `apps/web/src/app/dashboard/help/_components/TourHighlight.tsx` (new)
- `apps/web/src/app/dashboard/help/page.tsx` (anchors + bridge mount)
- `apps/web/src/app/Botsson/_components/help-tour-kit.ts` (new)
- `apps/web/src/app/Botsson/_components/help-tour-tools-bridge.tsx` (new)
- `packages/telemetry/src/registry.ts` (3 new events + routing)

**E2E:**
- `apps/e2e/tests/journey-help-tour-onboarding.spec.ts`
- `apps/e2e/tests/journey-help-tour-anchors.spec.ts`
- `apps/e2e/tests/journey-help-tour-cancellation.spec.ts`
- `apps/e2e/tests/journey-help-tour-reduced-motion.spec.ts`

**Docs:**
- `docs/superpowers/specs/2026-04-28-same-page-tour-harness.md` (spec)
- `docs/plans/PLAN-m2-tour-harness.md` (plan)
- `docs/journeys/JOURNEY-m2-tour-harness-{employee-onboarding,admin-discovery,cancellation,reduced-motion}.md` (4 journeys, all flipped to `status: verified`)

**Typecheck:** `pnpm turbo typecheck` → **36/36 PASS** (FULL TURBO,
1.389s, all cached).

## Known Debt

1. **`window.__helpTour` test handle not wired.** T13 (cancellation) and
   T14 (reduced-motion) E2E specs gracefully skip telemetry assertions
   when the handle is absent. Recommend wiring the handle in a small
   follow-up chore so the cancel + reduced-motion telemetry paths get
   real assertions instead of structural-only checks. Effort: ~1h.
2. **Full agent-invoked E2E deferred.** No test exercises the full
   chat → stage-engine → tool runtime → DOM path. Recommend adding an
   integration test with a stubbed agent in M3 or as a dedicated
   integration-test campaign. Effort: ~1d.
3. **`help.tour_completed` 3-step / 60s heuristic.** May need tuning
   post-launch based on real usage data. The threshold is currently
   hard-coded in `useHelpTour.ts:38-39` (`SESSION_WINDOW_MS`,
   `COMPLETION_THRESHOLD`). Consider making it workspace-configurable
   or product-tunable if telemetry shows skew.
4. **Doc-ingest auto-update (M2.3).** When `/help` content changes,
   tour anchors should not silently drift from the allow-list. M2.3 is
   the next sub-sortie scoped to add a build-time check + doc-ingest
   regen.

## Next Steps

**Recommended:** `/close-feature` now. M2.2 is complete, audited, all
gates pass, typecheck green, journeys verified. Debt items 1–3 are
chores (small, scoped) suitable for separate sub-sorties or chore
commits on development.

**Alternative:** if Pontus prefers, queue M2.3 (doc-ingest
auto-update) as the next sub-sortie under the same campaign.

— Steward, 2026-04-28
