---
title: "Procedure Engine — 5h Agent-Team Orchestration: Admin-Authored Task → Mobile Execution During Active Shift"
status: draft
created: 2026-05-21
updated: 2026-05-22
module: procedure-engine
tags: [execution-plan, agent-team, orchestrator, procedure-engine, shift-tasks, mobile-execution, 5h]
---

# 5h Agent-Team Orchestration

## DEDICATED GOAL (north star — every agent serves this)
> **The day-plan (day_line) function.** Admin ties a task to a **location** (the day_line). When an employee's shift operates **at that location**, the task appears in their **"Min dag"** / shift-tasks and they execute it there.

One vertical, end-to-end. Author (web/admin) ties task to a **location's day_line** → employee's `shift_session` is **at that location** → task surfaces in **Min dag** (mobile) → execute (complete). The anchor is **location** (`day_line.location_id`), not a generic "active shift". Everything outside this goal is OUT.

## ⚠️ REVISED 2026-05-21 (dual-perspective verification) — scope cut, pipe ~70% already shipped
Grep of both sides found the **receiver pipe largely built**, overturning the council's Q-B:
- ✅ **Author (web):** `task.create_session`/`day-line.add_item` accept `day_line_id`+assignee+scheduled_at — SHIPPED.
- ✅ **Resolve shift→day_lines→tasks (mobile, client-side):** `use-shift-session.ts` (joins `shift_session_day_line→day_line→location`) + `useDayLineItems` (fetch `session_task` by day_line_id + ADR-0367 §M2 leak-filter + ADR-0134 telemetry) → wired into `HomeShiftCard`/`DuringShiftView.v2`. **The dedicated `fn_list_shift_tasks` resolver is REDUNDANT → A-DATA DROPPED.**
- ✅ **Execute (mobile):** `use-complete-calendar-task` + `TaskModal` + BFF `/api/mobile/tasks/[id]/complete` → `task.complete`. SHIPPED.

**REAL remaining gaps (the actual build):**
1. **A-ANCHOR (must):** `session-hook-executor` + `engine-dispatch assign_task` set `day_line_id` (single-location else NULL). Without this, cron/hook tasks have NULL day_line_id → `useDayLineItems` never finds them → only manually-authored day_line tasks appear. **This is the core gap.**
2. **Status-gate (verify/small):** confirm `HomeShiftCard`/`DuringShiftView` only surface tasks when `shift_session.status ∈ scheduled/clocked_in` (`use-shift-session` returns status but does not filter — caller must). Add gate if missing.
3. **Full "Min dag" surface (UI sortie, mockup-ported):** the prototype's full Min dag (3 sections Må løses nå/I dag/Fullført, day-meter, filter chips) is NOT built — mobile has the shift-card, not the full forside. Optional upgrade.
4. **Web receiver parity:** none today (TasksTab is manager/session-scoped). Out (mobile-primary, ADR-0133).

## MOCKUP SOURCE — CONFIRMED (Pontus directive, port not redesign)
The Min dag / mobile-day UI is **ported from the design-folder mockups**, NOT redesigned:
- **`docs/modules/procedure-engine/taskmanager-DESIGNE/components/min-dag.jsx`** + `Task Manager.html` — canonical Min dag (TaskKort 10-element, sections, day-meter, filter chips, Botsson-nudge).
- **`docs/design/day-handoff/source/day/mobile-day.jsx`** + `docs/design/day-handoff/source/components/primitives.jsx` — mobile-day surface primitives.
- **`docs/design/design_handoff_calendar/source/shiftlist.jsx`** — shift-list reference.
A-MOBILE pulls components/layout/interaction from these; adapts hex → `@smartout/design-tokens` `native.ts` (ADR-0366, no literals) + RN adaptation (SectionList, Reanimated, a11y per frontend review). Existing `HomeShiftCard`/`DuringShiftView` must align to these mockups, not diverge.

## The orchestrator
**Opus lead.** Owns the goal. Does NOT write code. Decomposes into narrow tracks, dispatches the team, reviews every output against the goal, resolves cross-track contracts, escalates design forks to council, drives to a verified end-to-end demo. Single success test: *a task an admin types in the web shows on the right phone during an active shift and can be ticked off there.*

## The agent team (roster)
| Agent | Model | Narrow responsibility | Owns files |
|-------|-------|----------------------|-----------|
| **A-DATA** | sonnet (db) | Location-anchored shift resolver: expose `day_line_id`/`scheduled_at`/`location_id` in `fn_list_my_tasks` + new `fn_list_shift_tasks(profile_id)` resolving the employee's shift_session **by location** → day_lines at that location → session_task in window | migrations, `fn_list_my_tasks` + `list_mine` TS mirror |
| **A-AUTHOR** | sonnet (web) | Admin authoring: add-task to a **location's day_line** writes `session_task` with `day_line_id` + `assigned_to` + `scheduled_at`/window; AddTaskDialog/day-line strip default area+window | `add-day-line-item-action`, `add-task-action`, AddTaskDialog, DayLineStrip |
| **A-ANCHOR** | sonnet (edge) | Hook/cron tasks get `day_line_id` (single-location attach per council) so they're reachable by the resolver | `session-hook-executor`, `engine-dispatch assign_task` |
| **A-MOBILE** | sonnet (mobile) | **"Min dag"** view: show the employee's tasks for the location(s) their shift operates on; execute → BFF complete; gate on shift-at-location. Port TaskKort/sections/day-meter from `taskmanager-DESIGNE/components/min-dag.jsx` (mockup-source rule) | `apps/mobile/.../task/*`, `use-my-tasks`, Min dag screen |
| **A-TELE** | sonnet | Telemetry (`task.surfaced_on_shift`/reuse `task completed`) registered (emit-wiring, ADR-0377) + golden e2e test for the vertical | registry, e2e/test |
| **R-GUARD** | opus (supervisor) | Guardrail + scope: zero behavior change outside the goal; ADR-0317 lockstep on `fn_list_my_tasks` | review-only |
| **R-CONTRACT** | opus (agent-coord) | Code-trace the payload both directions: web author → DB → resolver → mobile → BFF complete. Dual-perspective (admin author + employee execute) | review-only |

Orchestrator assigns each a task with precise scope + the shared contract; members do not cross file boundaries; orchestrator merges.

## Shared contracts (locked by orchestrator + council)
- **Location anchor** = `session_task.day_line_id → day_line.location_id`. A task "tied to a location" = a task on that location's day_line. Admin authors against a day_line (which is `(department_session, location)`).
- **Shift-at-location** = the employee has a `shift_session` whose `location_id` matches the day_line's location, linked via `shift_session_day_line`. Resolver keys on **location match**, not just shift existence.
- **Task→shift reachability** = `session_task.day_line_id → day_line(location) → shift_session_day_line → shift_session(employee, location, status)`. (ADR-0367 schema already there; A-DATA + A-ANCHOR make it resolve.)
- **Shift state** = council Q-A decides which `shift_session.status` shows tasks (`clocked_in` during shift; maybe `scheduled` for pre-shift prep).
- **Surface = "Min dag"** = the employee day view (prototype `taskmanager-DESIGNE/components/min-dag.jsx` — TaskKort, sections, day-meter). Mobile primary; web Min dag parity later.
- **Resolver shape** = same normalized columns as `fn_list_my_tasks` + `day_line_id`/`location_id`/`scheduled_at`. ADR-0317 lockstep: SQL + `list_mine` TS move together.
- **Execute** = mobile → `/api/mobile/tasks/[id]/complete` → `task.complete{source:'session'}` (exists; A-MOBILE wires the Min dag surface to it).

---

## Timeline (5h wall-clock)

### T+0:00 – 0:30 — COUNCIL ✅ DONE (2026-05-21) — APPROVE WITH CONDITIONS
5/5 reviewers + 11/11 fact-check VERIFIED. Chair self-reversed Q-B (7th L-0147 precedent). **LOCKED contract:**
- **Q-A → two gates:** SURFACE on `shift_session.status IN ('scheduled','clocked_in')` (pre-shift prep visible); EXECUTE/complete gated on `clocked_in`. Index `idx_shift_session_employee_active` covers both — free.
- **Q-B → DEDICATED `fn_list_shift_tasks(p_window_start, p_window_end)`**, **SECURITY DEFINER, NO profile_id param — identity via `auth.uid()`** (ADR-0151). Reason: web uses `resolve_cascade_tasks` not `fn_list_my_tasks` (`use-cascade-tasks.ts:27`); extending ARM1 would mutate the live mobile consumer + leak (`fn_list_my_tasks_v2:96-97` fans `assigned_to IS NULL` to all). Dedicated fn = zero existing-consumer blast radius + own ADR-0317 lockstep pair.
- **Q-C → confirmed:** hook single-location attach else NULL (write-time/trigger; resolver-agnostic; record provenance).
- **Q-D → A-AUTHOR ALREADY SHIPPED:** `task.create_session` accepts `day_line_id`+`assignee_profile_id`+`scheduled_at` (`tools.ts:392-470`); `day-line.add_item` delegates (`tools.ts:284-294`); `complete` handles unassigned-on-shift (`tools.ts:806`). **A-AUTHOR track DELETED.**
- **C1 resolver (two arms OR'd):** (a) `assigned_to ∈ caller_profiles`; (b) `session_task.day_line_id ∈ (caller's shift_session day_lines via shift_session_day_line, status-gated)`. `st.status='pending'` + window + LEFT JOIN session_hook.
- **Telemetry → DROP `task.surfaced_on_shift`** (read ≠ mutation, L-0176/0177 phantom class). Reuse `task completed` on execute.
- **Mobile → direct RPC** (`use-my-tasks` pattern), no new BFF read route (ADR-0132 OK for read-only SECURITY DEFINER RPC).

**Merge-blockers:** (1) ADR-0317 lockstep introspection guard ships THIS sortie (extend `sortie-3-task-capability.spec.sql:220-245`); (2) typegen ordering: migration → `npx supabase gen types` (NO `op run`) → TS mirror → typecheck; (3) e2e MUST include a second-location shift that does NOT surface the task (proves isolation).

### T+0:30 – 0:50 — SETUP
- `/start-feature task-active-shift-mobile` (sub-sortie of campaign/daily-operation). Declare journeys:
  1. `admin-ties-task-to-location` — admin authors a task on a location's day_line (the day-plan) for an employee + window.
  2. `employee-sees-location-tasks-in-min-dag` — when the employee's shift operates at that location, the task shows in Min dag (mobile); employee completes it there.
  3. `tasks-scoped-to-shift-location` — task for location A does NOT show for an employee whose shift is at location B (location scoping, edge path).
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
- A-MOBILE: port TaskKort/feed visuals from `taskmanager-DESIGNE/` (Nordic Split + a11y; frontend-designer review). Active-shift gate: hide/disable execute when shift inactive.
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
