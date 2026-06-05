---
title: "HANDOFF — dayplanner-dnd-and-views"
status: done
feature: dayplanner-dnd-and-views
created: 2026-05-25
updated: 2026-05-25
module: day-session
tags: [handoff, dayplanner, oppgaver, dnd, view-modes, p11-followup]
---

# HANDOFF — dayplanner-dnd-and-views

## Summary

This sortie closed the gap between the Claude Design prototype for the Oppgaver day-planner and the
shipped p10/p11 implementation. Phase A (Wave 1a–1c) wired drag-and-drop re-timing end-to-end:
a new 7th task-capability tool (`update_session_task`), server action, `useDragRetiming` hook, full
DnD wiring across PersonLane / AreaBand / UnassignedLane, keyboard-accessible fallback via
TaskEditModal edit-mode, and two registered+emit-wired telemetry events. Phases B and C confirmed
that viewMode swimlanes and filter+zoom landed correctly in p11 and added E2E coverage. A Wave 1c
code-review caught two timezone-class bugs and a controlled-input init defect — all three closed in
fixup `2a6de8e41` before merge. Visual-parity audit (Wave 2) declared MINOR DEVIATIONS with 6 items
explicitly deferred to a follow-up touch-up sortie.

## What Shipped (per phase)

### Phase A — DnD Re-Timing

- **7th task-capability tool `update_session_task`** (`packages/ai/src/capabilities/task/tools.ts`)
  — ADR-0298 sole-writer contract. L-0177 fail-fast on row-not-found (both server-action layer and
  capability layer). Maps `assigned_to` parameter to `assigned_profile_id` column server-side.
  Emits `task.session_task_updated` (ADR-0134 Law 4).

- **Server action `update-task-scheduled-at`**
  (`apps/web/src/app/dashboard/_actions/update-task-scheduled-at.ts`) — derives workspace_id from
  session (Law 1 / ADR-0151). Delegates mutation to capability tool. Additionally emits
  `oppgaver.task_re_timed` (surface-level audit event distinct from the tool's internal emit).
  Returns `{ ok, data, error }` shape for optimistic-rollback in the hook.

- **`useDragRetiming` hook** — optimistic state update on drag-end, rollback on server error,
  debounced to avoid redundant calls on same-slot drop.

- **DnD wiring** in `TaskBlock`, `PersonLane`, `AreaBand`, `UnassignedLane` via
  `ChartDragContext` — zero runtime deps (native HTML5 drag-and-drop, no `@dnd-kit`).

- **Keyboard a11y** — TaskEditModal gained an `editTime` mode: clicking a task when drag is not
  available opens the modal with a time picker, which calls the same server action on save.

- **Telemetry registration** — `oppgaver.task_re_timed` + `task.session_task_updated` both
  registered in `packages/telemetry/src/registry.ts` AND emit-wired at call-sites (L-0340 verified
  post-closure: `oppgaver.task_re_timed` 1 call-site in server action;
  `task.session_task_updated` 1 call-site in capability tool).

- **Wave 1c fixup** (`2a6de8e41`):
  - HIGH-1: `TaskEditModal` `editTime` state initialized to `""` — fixed to lazy-init from
    `task.scheduled_at` on open.
  - HIGH-2: `handleSaveEdit` constructed ISO as `"${editTime}:00.000Z"` — UTC-literal bug
    silently wrong at UTC+2. Fixed to construct from local `Date.setHours`.
  - MEDIUM-1: `dateISO` prop missing on modal — added, threaded through.

### Phase B — ViewMode Swimlanes

Verified shipped from p11. PersonLane / AreaBand / UnassignedLane swimlane rendering already
correct. Wave 2 added E2E spec covering journey 1 (swimlane render) and journey 3 (filter+zoom).

### Phase C — Filter + Zoom

Verified shipped from p11. Filter sidebar + zoom slider present and functional. E2E coverage added
in Wave 2.

## Decisions

1. **ADR-0298 compliance — task capability as sole writer to `session_task`:** The sortie did not
   introduce any direct `supabase.from("session_task").update()` call. All mutations route through
   `update_session_task` tool → `gate_action` → capability write. This preserves ADR-0298 audit
   trail invariant.

2. **DnD library — native HTML5, keyboard fallback via modal:** `@dnd-kit` was evaluated but
   rejected to keep the bundle delta near-zero. Touch-screen drag is a gap, deferred. The
   keyboard-accessible TaskEditModal edit-mode is an explicit a11y contract, not a workaround.

3. **L-0177 defense-in-depth at two layers:** The server action fails-fast with a 400 if the task
   row is not found in the workspace before delegating to the tool. The capability tool also
   re-validates post-`gate_action`. Both layers use explicit error returns — no silent JWT-workspace
   fallback.

4. **`assigned_to` param → `assigned_profile_id` column mapping:** The capability tool schema
   exposes `assigned_to` (human-readable intent name); the internal DB update uses
   `assigned_profile_id`. This shields the API surface from schema rename risk.

5. **TimezoneFix — construct ISO from local `Date.setHours`:** The Wave 1c review caught
   `"${editTime}:00.000Z"` treating the user-entered HH:MM as UTC. The fix reads the existing
   `scheduled_at` date, sets hours+minutes via local `Date` methods, then calls `.toISOString()`.
   Any "edit field → ISO save" path needs an integration test — mocked-Date unit tests do not catch
   this class of bug.

6. **Visual parity verdict — MINOR DEVIATIONS, 6 items deferred:** Wave 2 audit compared rendered
   output against the Claude Design prototype. All functional contracts met; 6 cosmetic/spacing
   items deferred to a dedicated follow-up sortie (see PLAN Deferred section at
   `docs/plans/PLAN-dayplanner-dnd-and-views.md`).

## Learnings

1. **L-0316 sub-agent commit-collision (3rd occurrence this week — SKILL.md threshold hit):**
   Wave 1a dispatched Track A + Track B agents in parallel against the same worktree. Both staged
   changes simultaneously; the lint-staged pre-commit hook batched both diffs into Track A's commit
   message. Content was correct; message was misleading. Pattern now at promotion threshold for
   `smartout-agent-dev` SKILL.md as mandatory isolation check before parallel dispatch.

2. **L-0286 worktree missing pnpm symlinks (recurring):** After `pnpm install` reported "Already
   up to date" in the worktree, `packages/contracts/node_modules/` was still missing and typecheck
   failed TS2307. Force-install (`pnpm install --force`) resolved it. This is a pre-flight check
   candidate for new worktrees.

3. **L-0190 stale telemetry dist (recurring):** Wave 1a Track B vitest blocked until
   `pnpm --filter @smartout/telemetry build` ran explicitly. Same class as L-0193. Pre-flight check:
   `pnpm --filter @smartout/telemetry build && pnpm --filter @smartout/ai build` before first test
   run in a new worktree.

4. **NEW — controlled vs defaultValue conflict on shadcn Input:** React silently ignores
   `defaultValue` when a `value` prop is present. The `TaskEditModal` bug (HIGH-1) was exactly
   this: `value={editTime}` where `editTime` was initialized to `""`, so the field always opened
   blank regardless of `defaultValue`. Pattern: never use `defaultValue` on a controlled input.
   Initialize state from the source of truth in `useState(() => initialValue)` instead.

5. **NEW — `"${HH}:${MM}:00.000Z"` timezone literal:** Any time an edit field collects HH:MM from
   a user in a local timezone and the target is an ISO UTC timestamp, constructing the literal by
   appending `Z` will be wrong by the user's UTC offset. This was wrong-by-two-hours for Norway
   (UTC+2). Unit tests with mocked `Date` do not catch this. Need an integration test that runs in a
   non-UTC timezone (e.g., `TZ=Europe/Oslo vitest`).

6. **close-feature scope kebab-case digit-split (p10/p11/this sortie):** The commitlint kebab-case
   rule splits `dayplanner-dnd-and-views` correctly, but the close-feature sync-merge commit
   generated by the script uses the full branch-name fragment as scope, which in p10/p11 included
   digit prefixes that triggered the reject. Workaround: use `oppgaver` or `day-session` as manual
   scope on the sync-merge commit with `--no-verify` (L-0337 pre-authorized pattern). Should be
   promoted to SKILL.md or CLAUDE.md note under "close-feature" section.

## Debt (Deferred)

Full deferred-item list with risk notes is in `docs/plans/PLAN-dayplanner-dnd-and-views.md`
§Deferred. Summary:

1. **6 visual-parity items** — minor spacing, shadow, color-token drift vs Claude Design prototype.
   Estimated ½ day. Does not block any functional journey.

2. **E2E specs gated on `E2E_OPPGAVER` env** — Journey 1, 2 (stub), 3 specs in
   `apps/e2e/oppgaver/`. Require Pontus to seed the fixture data and run locally.
   `E2E_OPPGAVER=1 pnpm playwright test apps/e2e/oppgaver/` — do not merge if red.

3. **SKIP_PAGE_POLISH bypass on `dashboard-oppgaver.run.yml`** — carried from p11. Should be
   removed once the 6 deferred parity items are addressed.

4. **role → task data path stub** — `useRolesForPositions` returns a V1 stub (hardcoded empty
   array). Full role-mode requires a server-side join against `session_role` / `team`. Deferred per
   PLAN risk register; role swimlane will render correctly once the hook is filled in.

5. **Touch-screen drag not tested** — native HTML5 `ondragstart` does not fire on mobile touch
   events. The keyboard/modal fallback covers a11y; touch-native drag requires `@dnd-kit` or
   `@use-gesture/react` in a follow-up sortie.

## Next Steps

1. Pontus runs `E2E_OPPGAVER=1 pnpm playwright test apps/e2e/oppgaver/` locally with seeded
   fixtures — confirm Journey 1 + 3 green before calling sortie fully done.
2. Visual-parity follow-up sortie — 6 deferred cosmetic items, estimated ½ day.
3. role-task data path sortie — only needed when role-mode swimlane is promoted to user-facing
   (currently hidden behind feature flag).
