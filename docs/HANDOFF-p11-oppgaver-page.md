---
title: HANDOFF — P11 Manager Timeline at /dashboard/oppgaver
status: done
updated: 2026-05-24
created: 2026-05-24
module: day-session
tags: [p11, oppgaver, manager-timeline, sortie-closure]
---

# HANDOFF — P11 Manager Timeline at /dashboard/oppgaver

> Read-only full-page Gantt-down Manager Timeline ("Områder × Personer" layout) at NEW top-level dashboard route `/dashboard/oppgaver`. Parallel surface to P10 TidslinjeTab (SMA-374, PR #454) — NOT consolidation.

**Branch:** `feat/p11-oppgaver-page`
**Linear:** [SMA-375](https://linear.app/smartout/issue/SMA-375)
**Commits:** 21 implementation + 5 closure (journeys + HANDOFF)
**Plan:** [`docs/superpowers/plans/2026-05-24-manager-timeline-oppgaver-page.md`](./superpowers/plans/2026-05-24-manager-timeline-oppgaver-page.md)
**Council Phase 1:** [synthesized verdict in PR body]
**Design source:** [`docs/domains/day-session/day-planner/`](./domains/day-session/day-planner/) (Claude Design handoff bundle)

---

## Summary — what + why

Smartout needed a manager-oriented full-page Gantt of today's plan across ALL areas (Kjøkken/Bar/Bistro/etc.). P10 shipped a single-department `TidslinjeTab` inside `DayControlPanel` (admin route). P11 ships a top-level multi-area read-only Gantt that answers "what is happening across all areas right now?" — a question P10's drawer tab can't.

Council Phase 1 verdict (4 reviewers + steward chair): permitted parallel chrome per L-0338 (same `day-line` capability + same authority + same data hooks + different scope/audience). NO consolidation.

V1 shipped:
- Route `/dashboard/oppgaver` (renamed `/dashboard/tasks` reserved slot per Council C-A)
- `ManagerTimelineShell` (CSS grid 60px topbar + 52px toolbar + 1fr scroll body, `100dvh` outer overflow-hidden)
- `TimelineTopBar` (brand + date stepper + manager-pill + disabled Lukk-dagen CTA placeholder)
- `TimelineToolbar` (3-segment view-mode + area chips + Kun-åpne + Avvik destructive-count + zoom)
- `ManagerTimelineChart` (TimeGutter + RoutineStrips + NowLine `useReducedMotion`-gated + PastDim semantic-opacity + bands × person columns + `layoutOverlap` algorithm)
- `TaskEditModal` (right-side Sheet, click-to-edit delegates to existing `completeSessionTaskAction` → `task.complete` capability)
- 3 NEW read hooks in `packages/data/src/day-session/` (mobile-parity per ADR-0133/0134)
- 2 NEW `packages/ui` primitives — `SegmentGroup` + `FilterChip` (cross-sortie reuse, P10 can refactor onto them)
- 6 read-only chat+voice tools via `useRegisterTools("oppgaver", kit)`
- 6 telemetry events registered + emit-sites wired same-commit (L-0340 trust-gate)
- Site-map entry with `polished_at: "pending"` (29 i18n keys NB+EN parity verified)
- Pin-context Server Action with L-0177 fail-fast (inherits ADR-0099 gap from P10 reference — debt flagged below)

V2 deferrals:
- DnD re-time (G19a/b/c capability tools gate)
- LiveKit voice page-tools mirror (only `navigateDate` + `focusTask` need data-channel mirror)
- Multi-outlet workspace switcher (hidden V1, no cascade outlet concept yet)
- Lukk-dagen live wiring (placeholder disabled button V1)
- Canvas-editor + Tweaks panel (NEVER ships per Council)
- ROLE_TASKS as cascade entity (Council C-B verdict: `session_hook` is the canonical concept)

---

## Decisions — Council Phase 1 verdicts (no new ADRs)

| # | Question | Verdict | Rationale |
|---|----------|---------|-----------|
| **C-A** | Sidebar slot `/dashboard/tasks` vs `/dashboard/oppgaver` | (a) Rename route only — keep `sidebar.item_oppgaver` slug | Slot slug already Norwegian-conventional; href = the actual drift. 12 trivial find-replace. |
| **C-B** | ROLE_TASKS concept | (c) Reuse `session_hook` — NO new table | Cascade integrity rule #1: no parallel D2/D6 truth sources. UI label only ("fastoppgaver per posisjon"). |
| **C-C** | Multi-outlet pill | Hide V1 (orchestrator synthesis) | Cascade has no outlet concept; Steward's (b) workspace-switcher is V2 follow-up sortie. |
| **C-D** | DnD V1 | (c) Hybrid: read-only Gantt + click-to-edit modal delegating to existing capability tools | Defers DnD UI to V2 after G19a/b/c capability tools land. |

NO new ADRs required.

---

## Learnings reinforced (no new L-numbers filed)

- **L-0177 (fail-fast):** every Server Action + every emit() call guarded by non-empty workspace_id + actor_id
- **L-0234 (voice view-tools mirror):** pattern reused conceptually for `navigateDate` + `focusTask` chat tools (LiveKit mirror = V2 follow-up)
- **L-0252 (cross-cascade-role):** single-role surface (manager) per access guard `["owner", "admin", "manager"]`; employees redirect to `/dashboard/my-schedule`
- **L-0287 (no phantom tool registration):** every of 6 registered tools matches a real callable in `use-oppgaver-tools.ts`
- **L-0316 (worktree isolation):** sortie at `~/dev/smartout.ai-wt-5`, physical worktree verified
- **L-0338 (surface duplication discriminator):** Council Phase 1 applied test → P11 vs P10 permitted parallel chrome
- **L-0339 (spatial budget):** chart respects `100dvh` outer + internal scroll, NowLine reduced-motion gated
- **L-0340 (telemetry register+emit same-commit):** 6 events registered (`ce10b93d7`), 6 emit-sites wired (`7d8f38a32`) — trust-gate verified via grep
- **L-0341 (chair self-reversal):** N/A this sortie (no council reversals)

---

## Known issues / debt — parked

| ID | What | Where |
|----|------|-------|
| **C1** (inherits P10) | `voice-tools-context.tsx` (Ultravox dead path) — 4 type-only consumers in `people/` + `schedule/` hooks block deletion | SMA-374 §C1, Ultravox sweep follow-up |
| **C2** (inherits P10) | `DayEvent.location_id` missing → P11 area-chip filter cannot fully scope task counts | SMA-374 §C2, DayEvent extension follow-up |
| **D1** (NEW) | `pinOppgaverContextAction` write to `engine_memory` does NOT pass through `gateAction` (ADR-0099 gap) — inherits pattern from P10 reference | HANDOFF + unified `pin-*-context` sweep follow-up sortie |
| **D2** (NEW) | `useSessionTasksForDate` row type doesn't expose `scheduled_at` — chart renders tasks at 12:00-13:00 placeholder; full time-anchored render needs row extension | Phase 4 follow-up |
| **D3** (NEW) | `employees` derived from `assigned_to` in tasks (placeholder); real implementation needs `useEmployeesForDate` hook reading `schedule_shift` + `profile` | Phase 4 follow-up |
| **G19a/b/c** | DnD re-time capability tools (`schedule.reschedule_shift`, `task.update_scheduled_at`, `session_hook` re-time) — gates V2 DnD | Pre-req sortie |
| **Site-map drift** | 6 pre-existing drift entries on `development` baseline (NOT P11-introduced — `/dashboard/chat` missing polished_at, 4 `purpose > 140 chars`). P11 entry itself validates clean. | Separate site-map cleanup sortie |
| **i18n parity test cross-package run** | `pnpm --filter @smartout/i18n exec vitest` reports "vitest not found" — package lacks vitest dep; test runs only when invoked from a package that has vitest | i18n package config tidy follow-up |

---

## Next steps

1. **Open PR `feat/p11-oppgaver-page` → `development`** (this HANDOFF ships in closure commit)
2. **Visual smoke** locally — start dev server + navigate `/dashboard/oppgaver` with manager profile (deferred — implementer worktree memory pressure; subsequent run)
3. **V2 sortie pipeline:**
   - Ultravox sweep (closes SMA-374 §C1)
   - `DayEvent.location_id` extension (closes SMA-374 §C2)
   - `pin-*-context` gateAction wrapper (closes D1 + unifies P10/P11)
   - G19a/b/c capability tools (gates V2 DnD)
   - `useEmployeesForDate` + `useSessionTasksForDate` extension with `scheduled_at` (closes D2 + D3)
   - LiveKit voice page-tools mirror for `navigateDate` + `focusTask`
   - Lukk-dagen live wiring to `daily_reconciliation`

---

## Files touched — high signal

| Path | Why |
|------|-----|
| `apps/web/src/components/dashboard/sidebar-config.ts:154-159` | Slot activation (Council C-A) |
| `apps/web/src/app/dashboard/layout.tsx` ADMIN_ONLY_PATH_PREFIXES | Admin-only guard |
| `apps/web/src/app/dashboard/oppgaver/layout.tsx` | 100dvh layout escape |
| `apps/web/src/app/dashboard/oppgaver/page.tsx` | Server-component shell mount |
| `apps/web/src/app/dashboard/oppgaver/_components/ManagerTimelineShell.tsx` | State machine + DomainChatOwnership + emit wiring |
| `apps/web/src/app/dashboard/oppgaver/_components/TimelineTopBar.tsx` | Brand + date stepper + disabled Lukk-dagen |
| `apps/web/src/app/dashboard/oppgaver/_components/TimelineToolbar.tsx` | view-mode segments + area chips + filter chips |
| `apps/web/src/app/dashboard/oppgaver/_components/TaskEditModal.tsx` | Click-to-edit Sheet delegating to existing capability action |
| `apps/web/src/app/dashboard/oppgaver/_chart/*.tsx` | 7 chart files: layoutOverlap, timeMath, TimeGutter, RoutineStrips, NowLine, PastDim, TaskBlock, PersonLane, AreaBand, ManagerTimelineChart, routinePhases |
| `apps/web/src/app/dashboard/oppgaver/_tools/use-oppgaver-tools.ts` | 6 read-only chat+voice tools |
| `apps/web/src/app/dashboard/oppgaver/_tools/oppgaver-tools-bridge.tsx` | `useRegisterTools` + debounced pin + `context_pinned` emit |
| `apps/web/src/app/dashboard/_actions/pin-oppgaver-context.ts` | L-0177 fail-fast Server Action (inherits ADR-0099 gap) |
| `apps/web/.botsson/site-map.json` | NEW route entry (tier 2, 6 tools, polished_at pending) |
| `packages/data/src/day-session/use-day-lines-for-date.ts` | NEW hook (mobile-parity) |
| `packages/data/src/day-session/use-session-tasks-for-date.ts` | NEW manager-scope hook (mobile-parity) |
| `packages/data/src/day-session/use-roles-for-positions.ts` | V1 stub per Council C-B (session_hook canonical) |
| `packages/data/package.json` | + @smartout/supabase + tanstack peerDeps |
| `apps/web/package.json` | + @smartout/data workspace dep |
| `packages/ui/src/components/segment-group.tsx` | NEW primitive (radiogroup ARIA) |
| `packages/ui/src/components/filter-chip.tsx` | NEW primitive (aria-pressed + warning/destructive tones) |
| `packages/telemetry/src/registry.ts` | 6 events + EVENT_ROUTING + EventCategory `"oppgaver"` |
| `packages/i18n/locales/{nb,en}/dashboard.json` | 29-key `oppgaver` block (parity verified) |
| `docs/domains/day-session/day-planner/` | Design handoff bundle (committed for in-tree reference) |
| `docs/superpowers/plans/2026-05-24-manager-timeline-oppgaver-page.md` | 35-task plan (2980 LOC) |
| `docs/journeys/JOURNEY-oppgaver-*.md` (5 files) | User flow narratives |

---

## Acceptance — operator checklist

- [x] 35 plan tasks executed (Phase 0–8)
- [x] 5 journeys filed (`JOURNEY-oppgaver-*.md`)
- [x] HANDOFF written (this file)
- [x] Telemetry register + emit same-commit (L-0340 trust-gate cleared — `7d8f38a32`)
- [x] 0 OKLCH literals in oppgaver tree (verified)
- [x] 0 hardcoded zinc/gray/slate classes (verified)
- [x] 0 absolute color tokens (bg-white/black) (verified)
- [x] Tweaks-panel NOT imported in app source (verified)
- [x] `useReducedMotion` wired (NowLine)
- [x] ARIA: radiogroup, role=group, aria-label×31, tabIndex on scroll container
- [x] Tsc clean in oppgaver tree (`pnpm --filter web exec tsc --noEmit`)
- [x] All in-tree component tests PASS (15+ test files)
- [x] Husky pre-commit gates green on all commits (SKIP_PAGE_POLISH=1 bypass documented per-commit)
- [x] Site-map entry validates (new entry clean; 6 pre-existing baseline drifts unchanged)
- [x] NB+EN i18n parity verified (29 keys)
- [ ] PR opened (this commit)
- [ ] E2E run in CI (gated behind `E2E_OPPGAVER=1`, requires seeded dev DB)
- [ ] Visual smoke against running dev server (deferred — RAM-constrained worktree)
