---
title: HANDOFF — P10 TidslinjeTab in DayControlPanel
status: done
updated: 2026-05-24
created: 2026-05-24
module: day-session
tags: [p10, tidslinje, day-control-panel, sortie-closure]
---

# HANDOFF — P10 TidslinjeTab in DayControlPanel

> Sortie scope: slim, purpose-built unified D6 timeline tab in the `DayControlPanel` bottom-sheet (admin-route `/dashboard/schedule`), plus whole-drawer Phase 4 polish. Parallel surface to (planned) P11 Manager Timeline at `/dashboard/oppgaver`.

**Branch:** `feat/p10-tidslinje-tab`
**Linear:** [SMA-374](https://linear.app/smartout/issue/SMA-374) (Done)
**Commits:** 21 (`origin/development..origin/feat/p10-tidslinje-tab`)

---

## Summary — what + why

DayControlPanel had four tabs (Oversikt, Oppgaver, Avvik, Budsjett) but no chronological cross-source view. Council picked slim purpose-built `TidslinjeTab` over porting full `TimelineTab` (510 LOC, WebDayControl) — same `day-line` capability + same authority + same data layer = permitted parallel chrome per L-0338 discriminating test (ADR-0156 v2 amendment 2026-05-23).

Built:

- 5th tab `TidslinjeTab` between Oppgaver and Budsjett.
- Unified chronological list spanning `schedule_shift` + `session_task` + `session_hook` (extended `useDayTimelineEvents` with `hook` source).
- Manager Timeline chip recipe (h-7 px-2.5 rounded-full, fg/bg inversion on active) via `TidslinjeChipBar` — visual-only chip filter (location_id deferred, see C2).
- Task Manager prototype recipe in `TidslinjeRow` (compact card, time-mono, type icon, badge, title).
- Whole-drawer Phase 4 polish: header (round-full date stepper, font-heading title, mono em, 36px icon-btns), broadcast chips, PageTabNav badge slot.

Why a tab and not a panel: panel consolidation would force `WebDayControl` (manager-route `/dashboard/`) and `DayControlPanel` (admin-route `/dashboard/schedule`) to share chrome. They diverge in scope (manager-view-only vs admin-edit) and route audience (manager vs admin). Defer revisit to 2026-07-22 (+60d telemetry review).

---

## Decisions — registered in ADR / amendments

| # | Decision | Where |
|---|----------|-------|
| 1 | **ADR-0156 amendment (2026-05-23)** — surface-duplication discriminating test (same capability + same authority + same data layer = permitted parallel chrome) | `docs/decisions/0156-day-control-panel-canonical-admin-surface.md` §Amendment |
| 2 | Slim purpose-built `TidslinjeTab`, NOT port of `TimelineTab` from `WebDayControl` | Council Phase 5 verdict, this sortie |
| 3 | DnD re-time deferred to G19a/b/c capability tools (`schedule.reschedule_shift`, `task.update_scheduled_at`, `session_hook` re-time) — V1 ships read-only | Council deferral, this sortie |
| 4 | `PageTabNav` migration replaces inline `TabButton` (G17, WCAG 4.1.2 — name, role, value programmatic) | Commit `c9dd3faa3` |
| 5 | Dead Ultravox `voice-tools-context.tsx` path removed (G18) — post-ADR-0282 `useRegisterTools` harness is canonical | Commit `a213981c8` |
| 6 | `pinDayControlPanelContextAction` server action — L-0177 fail-fast on missing profile, "via DayControlPanel" discriminator distinguishes from `pinDayControlContextAction` (WebDayControl) | Commit `ff78fb9dc` |

---

## Learnings — captured

| ID | What | Filed |
|----|------|-------|
| L-0338 | Surface duplication ≠ authority fragmentation. Discriminating test = capability + authority + data layer. | `docs/learnings/0338-surface-duplication-not-authority-fragmentation.md` |
| L-0339 | Spatial budget as Phase 3 council axis. Drawer width × tab count × row density is its own concern; design+a11y triplet doesn't catch it. | `docs/learnings/0339-spatial-budget-phase3-council-axis.md` |
| L-0340 | Telemetry registry entry without `emit()` call-site (3rd occurrence, promote-to-skill threshold met). Trust-gate addition: grep `emit({` matching pattern when reviewing registry PRs. | `docs/learnings/0340-telemetry-registered-without-emit-3rd-occurrence.md` |
| L-0341 | L-0147 chair self-reversal 10th precedent. Pattern now stable: chair MUST re-verify when council triplet APPROVES on multi-axis change. | `docs/learnings/0341-l0147-tenth-precedent-chair-self-reversal.md` |

---

## Known issues / debt — parked

| ID | What | Where parked |
|----|------|--------------|
| C1 | `voice-tools-context.tsx` retained — 4 type-only consumers in `people/` + `schedule/` hooks block deletion. Full sweep = separate Ultravox sortie. | SMA-374 description §C1, follow-up Linear (open) |
| C2 | `DayEvent` shape missing `location_id` — chip-bar filter is visual-only no-op until extended. `useDayTimelineEvents` returns flat union without per-event location, filter UI renders + selects but doesn't reduce list. | SMA-374 description §C2, follow-up Linear (open) |
| G19a/b/c | DnD re-time capability tools missing: `schedule.reschedule_shift`, `task.update_scheduled_at`, `session_hook` re-time. Blocks Manager Timeline V1 DnD per Council deferral. | Linear (open), pre-req for P11 DnD V2 |
| Panel consolidation revisit | Scheduled 2026-07-22 after +60d telemetry review of `tidslinje_tab_opened` + `tidslinje_filter_changed` event rates per route. | `docs/domains/day-session/ROADMAP.md` §Revisit |

---

## Next steps

1. **Open PR `feat/p10-tidslinje-tab` → `development`** — this commit ships with HANDOFF.
2. **P11 Manager Timeline at `/dashboard/oppgaver`** — separate sortie (SMA-375, awaiting dispatch). Parallel surface, NOT consolidation.
3. **Follow-up sorties (parked):** Ultravox sweep (C1), `DayEvent.location_id` extension (C2), G19a/b/c capability bundle (gate before any DnD UI).

---

## Files touched — high signal

| Path | Why |
|------|-----|
| `apps/web/src/app/dashboard/schedule/_components/day-control/TidslinjeTab.tsx` | Tab assembly + emit telemetry (L-0177 + L-0340) |
| `apps/web/src/app/dashboard/schedule/_components/day-control/TidslinjeChipBar.tsx` | Manager Timeline chip recipe (artifact lines 450-468) |
| `apps/web/src/app/dashboard/schedule/_components/day-control/TidslinjeRow.tsx` | Task Manager prototype row recipe |
| `apps/web/src/app/dashboard/schedule/_components/day-control/DayControlPanel.tsx` | Mount 5th tab, replace inline TabButton with PageTabNav, header polish |
| `apps/web/src/app/dashboard/schedule/_components/day-control/DaySessionProvider.tsx` | Remove dead Ultravox path |
| `apps/web/src/app/dashboard/_actions/pin-day-control-panel-context.ts` | New Server Action with "via DayControlPanel" discriminator |
| `apps/web/src/app/dashboard/_hooks/use-day-timeline-events.ts` | Add `session_hook` source (DayEventType union extended) |
| `apps/web/src/components/dashboard/PageTabNav.tsx` | Optional `badge?: number \| string \| null` slot |
| `packages/telemetry/src/registry.ts` | Register `tidslinje_tab_opened` + `tidslinje_filter_changed` (ADR-0358) |
| `docs/decisions/0156-day-control-panel-canonical-admin-surface.md` | Amendment — surface-duplication discriminating test |
| `docs/domains/day-session/{ARCHITECTURE,E2E-COVERAGE,GAPS-AND-DEBT,ROADMAP,USER-FLOWS}.md` | Spine maintenance |
| `docs/journeys/JOURNEY-tidslinje-*.md` (5 files) | All flows: empty-day-bootstrap, plan-tomorrow, live-status, botsson-reschedule, employee-mobile-mirror |
| `packages/i18n/locales/{nb,en}/dashboard.json` | Tab label + chip + empty/loading state keys |

---

## Acceptance — operator checklist for merge

- [x] 5 journeys filed
- [x] Day-session domain spine updated
- [x] 4 learnings filed (L-0338, L-0339, L-0340, L-0341)
- [x] ADR-0156 amendment registered
- [x] Telemetry events registered + `emit()` call-sites wired (L-0340 trust-gate cleared)
- [x] PageTabNav migration shipped (WCAG 4.1.2)
- [x] Dead Ultravox path removed (G18 closed)
- [x] Playwright + axe regression test green (`tidslinje-no-mutation.test.ts` + a11y panel scope)
- [x] All husky gates green on push (`387b0f470..55c5c92d9`)
- [ ] PR opened (this commit)
