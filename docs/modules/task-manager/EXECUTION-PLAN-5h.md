---
title: "Task Manager — 5h Agent-Team Orchestration: Admin-Authored Task → Mobile Execution During Active Shift"
status: draft
created: 2026-05-21
updated: 2026-05-21
module: task-manager
tags: [execution-plan, agent-team, orchestrator, task-manager, shift-tasks, mobile-execution, 5h]
---

# 5h Agent-Team Orchestration

## DEDICATED GOAL (north star — every agent serves this)
> **Admin adds a task → the assigned user executes it on mobile while their shift is active.**

One vertical, end-to-end. Author (web/admin) → anchor (day_line + window) → surface (mobile, only when shift active) → execute (mobile complete). Everything outside this goal is OUT.

## The orchestrator
**Opus lead.** Owns the goal. Does NOT write code. Decomposes into narrow tracks, dispatches the team, reviews every output against the goal, resolves cross-track contracts, escalates design forks to council, drives to a verified end-to-end demo. Single success test: *a task an admin types in the web shows on the right phone during an active shift and can be ticked off there.*

## The agent team (roster)
| Agent | Model | Narrow responsibility | Owns files |
|-------|-------|----------------------|-----------|
| **A-DATA** | sonnet (db) | Active-shift task resolver: expose `day_line_id`/`scheduled_at`/`location_id` in `fn_list_my_tasks` + new `fn_list_active_shift_tasks(profile_id)` resolving the employee's ACTIVE `shift_session` → day_lines → session_task in window | migrations, `fn_list_my_tasks` + `list_mine` TS mirror |
| **A-AUTHOR** | sonnet (web) | Admin authoring: add-task writes `session_task` with `day_line_id` + `assigned_to` + `scheduled_at`/window; AddTaskDialog defaults area+window | `add-day-line-item-action`, `add-task-action`, AddTaskDialog |
| **A-ANCHOR** | sonnet (edge) | Hook/cron tasks get `day_line_id` (single-area attach per council) so they're reachable by the resolver | `session-hook-executor`, `engine-dispatch assign_task` |
| **A-MOBILE** | sonnet (mobile) | Mobile shift view: when `shift_session` active, show its tasks via resolver; execute → BFF complete; gate execution on active shift. Port TaskKort/feed from `taskmanager-handoff/` (mockup-source rule) | `apps/mobile/.../task/*`, `use-my-tasks`, shift screen |
| **A-TELE** | sonnet | Telemetry (`task.surfaced_on_shift`/reuse `task completed`) registered (emit-wiring, ADR-0377) + golden e2e test for the vertical | registry, e2e/test |
| **R-GUARD** | opus (supervisor) | Guardrail + scope: zero behavior change outside the goal; ADR-0317 lockstep on `fn_list_my_tasks` | review-only |
| **R-CONTRACT** | opus (agent-coord) | Code-trace the payload both directions: web author → DB → resolver → mobile → BFF complete. Dual-perspective (admin author + employee execute) | review-only |

Orchestrator assigns each a task with precise scope + the shared contract; members do not cross file boundaries; orchestrator merges.

## Shared contracts (locked by orchestrator + council)
- **Active shift** = `shift_session.status IN ('scheduled','clocked_in')` for the employee on the business date (council Q-A confirms exact set; recommend `clocked_in` to show during the shift, `scheduled` for pre-shift prep — decide).
- **Task→shift reachability** = `session_task.day_line_id → day_line → shift_session_day_line → shift_session(employee, active)`. (0387a/ADR-0367 schema already there; A-DATA + A-ANCHOR make it resolve.)
- **Resolver shape** = same normalized columns as `fn_list_my_tasks` + `day_line_id`/`location_id`/`scheduled_at`. ADR-0317 lockstep: SQL + `list_mine` TS move together.
- **Execute** = mobile → `/api/mobile/tasks/[id]/complete` → `task.complete{source:'session'}` (exists; A-MOBILE wires the active-shift surface to it).

---

## Timeline (5h wall-clock)

### T+0:00 – 0:30 — COUNCIL (resolve the 4 forks that block the team)
Reviewers: system-steward (chair), supervisor, system-agent-coordinator (code-tracer), + frontend-designer (mobile surface). Pre-loaded files + Phase 2.5 fact-check.
- **Q-A** Active-shift definition: `clocked_in` only, or `scheduled`+`clocked_in`? (drives resolver WHERE + when tasks appear).
- **Q-B** Resolver: new `fn_list_active_shift_tasks(profile_id)` vs `fn_list_my_tasks` + `p_shift_session_id` param? (recommend dedicated fn — keeps `fn_list_my_tasks` stable).
- **Q-C** Hook-attach heuristic: single-area session → attach day_line_id; multi-area/ambiguous → NULL (don't guess). Confirm.
- **Q-D** ADR-0317 lockstep + dual-perspective: confirm the author-side write and the mobile read agree on `assigned_to` + `day_line_id` semantics.
Gate: verdict committed → contracts locked → build.

### T+0:30 – 0:50 — SETUP
- `/start-feature task-active-shift-mobile` (sub-sortie of campaign/daily-operation). Declare journeys:
  1. `admin-adds-task-to-shift` — admin authors a task on a location/day_line for an employee + window.
  2. `employee-executes-on-mobile-active-shift` — task shows on mobile only when shift active; employee completes it.
  3. `task-hidden-when-shift-inactive` — same task not shown/executable when shift not active (error/edge path).
- Preflight worktree: `pnpm install`, `pnpm --filter @smartout/ai build`, Supabase Local up, commit spec+plan+journeys.

### T+0:50 – 2:45 — WAVE 1 (parallel, 5 build agents)
Dispatch A-DATA, A-AUTHOR, A-ANCHOR, A-MOBILE, A-TELE in parallel (mostly disjoint files). Each returns to orchestrator; no commit before review.
- A-DATA: resolver + RPC col exposure + TS mirror.
- A-AUTHOR: author path passes day_line_id + assignee + window.
- A-ANCHOR: hook/assign_task set day_line_id.
- A-MOBILE: active-shift feed scaffold + execute wiring (UI port in Wave 2).
- A-TELE: telemetry registration + e2e harness skeleton.

### T+2:45 – 3:20 — GATE 1 (orchestrator review + integration)
- Guardrail (R-GUARD): no out-of-goal behavior change; ADR-0317 lockstep verified.
- Contract trace (R-CONTRACT): web author → DB → resolver → mobile → complete, both directions; dual-perspective (admin sees authored, employee sees+completes).
- `pnpm turbo typecheck` (constrained heap 3584, WSL2 OOM recipe).
- Supabase Local: admin-add a day_line task for employee X with active shift_session → resolver returns it; employee Y (no active shift) → not returned.

### T+3:20 – 4:15 — WAVE 2 (UI port + active-shift gating + tests)
- A-MOBILE: port TaskKort/feed visuals from `taskmanager-handoff/` (Nordic Split + a11y; frontend-designer review). Active-shift gate: hide/disable execute when shift inactive.
- Remediate Gate 1 findings.
- A-TELE: golden e2e — admin add → mobile (active) shows → complete → web reflects done.
- Telemetry emit verified (registry + call-site, ADR-0377).

### T+4:15 – 4:40 — GATE 2 (end-to-end demo verification)
Full vertical on Supabase Local + (mobile sim/emulator or BFF-level):
- Admin (web) adds task "Sjekk kjøletemp" to Bar day_line, assignee = bartender on shift, window 18:00.
- Bartender's shift_session active (clocked_in) → task appears in mobile feed for that shift.
- Bartender completes on mobile → `task.complete` → web day-control shows done + telemetry emitted.
- Same task with shift NOT active → not shown / not executable.

### T+4:40 – 5:00 — CLOSE + OOM buffer
- Journeys → verified (evidence). Handoff. `/close-feature` → merge campaign/daily-operation, sync development.
- WSL2 buffer: warm `web` typecheck (3584), `pnpm install` campaign root if payroll symlink missing, push constrained-heap.

---

## Risk register
| Risk | Mitigation |
|------|-----------|
| WSL2 OOM on push (hit 4× last sortie) | constrained heap 3584 + warm cache + campaign-root install; 10-min buffer |
| Mobile verification hard locally (no device) | verify at BFF/resolver level + mobile unit/component test; real-device pass deferred to follow-up if needed |
| ADR-0317 drift (fn_list_my_tasks SQL vs TS) | R-GUARD diff-check both; single agent (A-DATA) owns both |
| Hook-attach guesses wrong day_line | council Q-C: single-area only, else NULL |
| Author↔mobile contract mismatch (assigned_to, day_line_id) | R-CONTRACT dual-perspective trace at Gate 1 |
| shift_session not auto-created for test shift | `ensure_shift_session` trigger (ADR-0367) — verify fires; seed shift if not |

## Falsifiable done (5h)
- [ ] Council verdict committed (Q-A..Q-D locked).
- [ ] Sub-sortie merged to campaign: resolver + author + anchor + mobile + telemetry.
- [ ] End-to-end demo verified: admin-typed task → mobile shows during active shift → completed on mobile → web reflects.
- [ ] Active-shift gate proven: task hidden/non-executable when shift inactive.
- [ ] Zero behavior change outside the goal; `pnpm turbo typecheck` green.
- [ ] 3 journeys verified.

## Out of scope (overflow)
0387b role-mandatory compliance gating · S1 doc-extraction · S4 full admin surface (Bibliotek/Maler/manual-builder/quizmaster) · 0387c starter-routines wizard · R2 push-notification dispatch (task appears on open; push is a fast-follow) · R3 routine step-expansion.

## Graceful degradation if 5h tight
Ship the **data + author + anchor + mobile-read** (task visible on active shift) FIRST — that proves the goal. Execute-complete on mobile already exists (BFF). UI polish (prototype port) + telemetry niceties defer. Never half-ship the resolver or the active-shift filter.
