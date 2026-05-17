---
title: "Plan — ui-shell-tidslinjen-a11y-polish"
status: in_progress
updated: 2026-05-17
created: 2026-05-17
module: dashboard-dagslinjen
tags: [plan, a11y, wcag, sub-sortie, council-r1-follow-up]
---

# Plan — ui-shell-tidslinjen-a11y-polish

> Branch: `feat/ui-shell-ui-shell-tidslinjen-a11y-polish` | Worktree: /home/sxtnl/dev/smartout.ai-ui-shell-wt-2 | Base: `campaign/ui-shell` @ `a8eef6add` | Module: dashboard-dagslinjen | Started: 2026-05-17

## Goal

Close two sortie-introduced WCAG defects on the Tidslinjen surface flagged by the post-implementation R1 Council (2026-05-17): `animate-pulse` without reduced-motion gate (WCAG 2.3.3) on the now-marker dot, and missing `focus-visible:ring` on the cluster popover trigger (WCAG 2.4.11). Pre-existing OKLCH-literal debt on `TimelineTab.tsx:242` is **deferred** to a broader Nordic Split token migration driven by ADR-0349.

## Context

Council R1 verdict on `campaign/ui-shell` commits ed3854d33 + 5a236d7d8 + be0b43a4e: **APPROVE — with mandatory P2 follow-up sub-sortie**. 4/4 reviewers APPROVE; design+a11y reviewer surfaced 3 concrete defects, Steward provenance check via git-blame confirmed:

| Finding | Provenance | Scope |
|---|---|---|
| `TimelineTab.tsx:242` 3× OKLCH literals | `d0deaa6a9a` (2026-05-16) | Pre-existing — deferred to ADR-0349 migration |
| `DayTimelineStrip.tsx:481` `animate-pulse` no rm-gate | `5a236d7d82` (sortie) | **This plan** |
| `ClusterMarker.tsx:213` `focus-visible:outline-none` no ring | `be0b43a4eb` (sortie) | **This plan** |

## Tasks

- [x] **Task 1** — `apps/web/src/components/day/DayTimelineStrip.tsx:481` — wrap `animate-pulse` in `cn(..., !reduceMotion && "animate-pulse")`. `useReducedMotion` already imported (line 5) and `reduceMotion` already in scope (line 199); `cn` already imported from `@smartout/ui` (line 8). Mirror pattern from `DayEventList.tsx:44`.
- [x] **Task 2** — `apps/web/src/components/day/ClusterMarker.tsx:213-214` — append `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:rounded-full` to the className tuple. Keep existing `focus-visible:outline-none focus-visible:scale-125`.
- [x] **Task 3** — Typecheck passes (`pnpm --filter web typecheck`).
- [x] **Task 4** — JOURNEY-ui-shell-tidslinjen-a11y-polish.md.
- [x] **Task 5** — Decision-log entries for 2 proposed ADRs (Nordic Split OKLCH literal ban = ADR-0349; getPhaseBoundaries presentation-only ontology = ADR-0351). Slots 0348 + 0350 taken by concurrent same-day work (L-0258 detector + BotssonHost mount pattern); slot 0349 free, 0351 next free after their 0350.
- [x] **Task 6** — HANDOFF written.

## Acceptance Criteria

- [x] `apps/web` typecheck exit 0 in the new worktree
- [x] `grep -n 'animate-pulse' apps/web/src/components/day/DayTimelineStrip.tsx` shows the new conditional class
- [x] `grep -n 'focus-visible:ring-ring' apps/web/src/components/day/ClusterMarker.tsx` returns 1 hit
- [x] No new files in `apps/web/src/components/day/`; only the two existing files modified
- [x] No telemetry changes (registry untouched)
- [x] No new ADRs required for the fixes themselves (both consume canonical Nordic Split + Tailwind patterns already in use)
- [x] User journey written
- [x] Decision log entries for the 2 proposed ADRs (0349 + 0351)

## Out of Scope

- OKLCH literal migration on `TimelineTab.tsx:242` — codebase-wide debt across 6+ files in `components/day/`. Requires ADR-0349 + lint rule + dedicated migration sortie.
- `getPhaseBoundaries` ontology comment — Steward P3 recommendation, lower urgency; bundle into separate documentation pass per ADR-0351.
- `eventTypeKind` typing tightening to `DayEventType` union — Coord-flagged P3 polish.
- `departmentId`/`sessionId` prop required-string hardening — Coord-flagged P3 polish.
