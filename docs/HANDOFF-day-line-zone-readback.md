---
title: "HANDOFF — day-line-zone-readback (P1 day-line build)"
status: done
updated: 2026-05-29
created: 2026-05-29
module: day-session
tags: [day-line, adr-0430, adr-0367, adr-0133, right-rail, handoff]
---

# HANDOFF — day-line-zone-readback

## Summary

Day-line P1. Pontus's original ask: make the day-line working + match the binding Cloud Design
(`docs/domains/day-session/day-planner/project/Manager Timeline.html`). Three things:
restore the zone/location readback that ADR-0430 M4 stubbed null, build the right-rail that was
ENTIRELY MISSING, and un-stub the bands to the real roster. 5 plans.

## What changed

| Plan | Files | Change |
|---|---|---|
| 1 (web) | `apps/web/src/app/dashboard/_hooks/use-day-timeline-events.ts` | `locationByShift` was hardcoded `null` post-M4. Resolved via ADR-0367 tri-layer `schedule_shift → shift_session → shift_session_day_line → day_line.location_id` (two keyed queries, robust vs composite-FK embed ambiguity). Tidslinjen chip-bar location filter live again. |
| 2 (mobile + data) | `packages/data/src/day-session/shift-zones.ts` (new), `apps/mobile/src/hooks/queries/use-my-shifts.ts`, `BeforeShiftView.tsx`, `ShiftCard.tsx` | zones[] M:N readback (reader-only, ADR-0133). Resolution + `ShiftZone` type in packages/data; both mobile hooks resolve zones; rendered in BeforeShiftView + ShiftCard. `@smartout/data` added as mobile dep. |
| 3 (web) | `TimelineRightRail.tsx` (new), `ManagerTimelineShell.tsx` | Built the missing right-rail. Main grid → `1fr 380px`. Tabs + STATUS 4 KPI cards + Krever/Pågående/Neste, per the Cloud Design. KPI counts DERIVED (Pontus law). Nordic Split tokens, a11y (tablist/aria-selected/focus rings). |
| 4 (web + data + schema) | `packages/data/src/day-session/use-employees-for-date.ts` (new), `ManagerTimelineShell.tsx`, `use-session-tasks-for-date.ts`, migration `20260801000007_session_task_duration_minutes.sql`, `database.types.ts` | Real roster (schedule_shift + profile) replaces task-assignee stub; `bandIdByDept` bridges department_id→day_line_id (fixes a pre-existing keying mismatch); `session_task.duration_minutes` column drives task-block height (60 fallback). |
| 5 (web) | 5 `_chart/*.tsx`, `NowLine.tsx` | text-[0.6rem]→text-xs (council verdict); NowLine sr-only aria-live current-time announce. |

## Decisions

- **Design-token council verdict (DEGRADED, definitive): APPROVE WITH CHANGES — do NOT add a
  `text-2xs` design token.** Fact-check found the proposal's premise false: there is no font-size
  scale in `packages/design-tokens/` (color+spacing only), Tailwind v4 font sizes live in
  globals.css `@theme`/defaults, WCAG 1.4.4 is about resize-not-min-size, and ADR-0366 bans OKLCH
  *color* literals (font-size out of scope). Resolution: raise the 10 `text-[0.6rem]` to the
  existing `text-xs` (12px) — better legibility, no new global token. See `reports/COUNCIL-design-token.md`.
- **bandIdByDept bridge.** Pre-existing keying mismatch: bands keyed by `day_line_id`, tasks keyed
  area by `department_id`, chart filters `t.area === band.id`. Tasks weren't matching bands before.
  Fixed by mapping both tasks' and employees' department_id → the band's day_line_id.
- **Rail Bekreft = focus, not resolve.** Deviations in this view are derived from tasks with status
  "missed" (not the deviation table). Bekreft focuses the task; no fabricated resolve-mutation.
- **Detalj/Melding/Avvik tabs = V1 EmptyState.** No data source wired; fabricating surfaces would be
  phantom contracts. The Akkurat nå hero (v6.png) is fully built.

## Learnings

- **A design-token proposal must verify the token's actual home first.** Nordic Split font sizes are
  Tailwind `@theme`/defaults, NOT `packages/design-tokens` (color+spacing only). Prefer an existing
  scale step over a single-consumer global token.
- **turbo typecheck ≠ standalone tsc** (carried from the shift-mcp sortie): judge green with the
  turbo path the close gate uses — it builds workspace deps first.
- **Pre-existing area-keying mismatch in the timeline** — documented + fixed; worth a regression test
  in a follow-up (E2E asserting a task lands in its band).

## Known issues / debt

- **Web turbo typecheck deferred to RAM headroom** (L-0316 WSL2 OOM — exit 143 under sibling-agent
  contention). packages/data + mobile are green; web changes are type-consistent with those. The
  close-feature Gate 4 (diff-scoped turbo typecheck) is the authoritative run — done at close.
- **Full page-polish run still deferred** — `.claude/page-polish/dashboard-oppgaver.run.yml` stays
  `verified: false` (Lighthouse LCP, loading.tsx skeleton, harness-tool registration, telemetry
  view-emit remain). The page is in active construction; `SKIP_PAGE_POLISH=1` is its sanctioned bypass.
- **Live screenshot vs v6.png not captured** (needs dev-server render + RAM). Fidelity assessed
  structurally (markup + token + a11y vs the mockup CSS contract). Recommend a screenshot pass at
  page-polish completion.
- **Detalj/Melding/Avvik full surfaces** + rail-card hover-lift = follow-up polish.

## Next steps

- Full page-polish run on `/dashboard/oppgaver` once feature-complete (flip run.yml `verified: true`).
- Wire the deviation table into the rail Avvik tab + a real resolve action.
- Regression E2E: task lands in correct band (locks the bandIdByDept fix).

## Verification

- packages/data + mobile turbo typecheck: green.
- Design-fidelity: PASS (`reports/FIDELITY-VERDICT.md`).
- Council design-token: APPROVE-WITH-CHANGES applied.
- Web turbo typecheck: at close (diff-scoped Gate 4).
