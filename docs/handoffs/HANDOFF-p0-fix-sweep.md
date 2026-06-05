---
title: HANDOFF — p0-fix-sweep
status: done
updated: 2026-05-19
created: 2026-05-19
module: mobile
tags: [handoff, mobile, sync, telemetry, payroll, task, p0, audit]
---

# HANDOFF — p0-fix-sweep

> Branch: `feat/mobile-p0-fix-sweep` | Worktree: `/home/sxtnl/wsl/smartout.ai-mobile-wt-1` | Completed: 2026-05-19

## Summary

Four P0 blockers surfaced by the 2026-05-19 overnight production-readiness audit of `campaign/mobile @ 044455266`. Each was a silent failure: tasks silently not completing, events not reaching engine_event, chat messages silently lost, and wrong product copy framing the payroll screen as a payslip service.

None of these had visible UI errors — they were only discoverable via schema inspection + telemetry registry audit. The sortie converts all four from silent-loss to either working correctly (P0-A, P0-B, P0-D) or loud-fail with a clear path forward (P0-C).

**Commits:**
- `13e7f531a` — plan scaffold (docs only)
- `f363e6b59` — P0-A + P0-C: harden complete_task + send_message schemas
- `a09bbc8ae` — P0-B: emit canonical "task created" from mobile create-task
- `7ccca32d8` — P0-D: rename lønnsslipp → lønnsgrunnlag in mobile strings

**Files changed (code):**
- `apps/mobile/src/hooks/shift-clock/useShiftChat.ts` — rollback on Zod throw (P0-C)
- `apps/mobile/src/hooks/mutations/use-create-task.ts` — canonical event + full metadata (P0-B)
- `apps/mobile/src/lib/sync/schemas.ts` — source required on completeTaskSchema, channel_id required on sendMessageSchema (P0-A + P0-C)
- `apps/mobile/src/lib/sync/action-map.ts` — PATCH → POST with source body (P0-A)
- `apps/mobile/src/lib/sync/__tests__/schemas.test.ts` — 5 new schema cases, 17/17 green
- `apps/mobile/src/constants/strings.ts` — 3 user-visible strings (P0-D)

---

## Decisions

All four decisions are implementation-level. No new ADR is required; each decision enforces an existing ADR rather than introducing a new architectural choice.

### D1 — Schema-patch-only for P0-C (useShiftChat mid-migration state)

`useShiftChat` reads `chat_conversation` + `chat_message` (legacy tables from pre-ADR-0132 era). The sync handler writes `channel_message` (new schema), which requires `channel_id`. These are not the same table. A full migration requires a dedicated BFF route + data migration + Realtime subscription rewrite — well beyond P0 scope.

**Decision:** ship schema strictening only. `sendMessageSchema` now requires `channel_id` as a uuid. `useShiftChat.sendMessage()` wraps `enqueue()` in try/catch, rolls back the optimistic prepend on throw, and logs a clear warning pointing to the follow-up sortie. The user cannot currently send shift chat messages from mobile; they see no broken UI state. The feature was silently broken before this fix (messages were enqueued with `conversation_id` and lost on sync). After this fix it fails loud at the call site.

**Rationale:** Silent-loss is always worse than loud-fail with a rollback. The schema strictening is a one-way gate: once `mobile-shift-chat-bff-migration` ships, `useShiftChat` will be replaced wholesale, not patched again. Keeping P0-C minimal avoids coupling the release gate to a multi-day migration.

### D2 — source discriminator required on completeTaskSchema (fail loud vs default-to-session)

ADR-0298 R3 defines the source-dispatched POST path. The BFF route `/api/mobile/tasks/[id]/complete` routes to the correct task-source handler (`session_task`, `personal_task`, `schedule_day_task`, `emma_task`) based on the `source` field. Pre-fix: no `source` was sent (legacy PATCH with empty body), so only session tasks could complete.

**Decision:** `source` is a required `z.enum([...])` in `completeTaskSchema`. Missing source throws at enqueue time, not at BFF time. `action-map.ts:complete_task` also double-checks and throws `"complete_task: missing source discriminator (ADR-0298 R3)"` before the fetch call.

**Rationale:** Defaulting to `"session"` when source is absent would silently miscomplete personal/day_ad_hoc/emma tasks as session tasks (wrong table write). Fail-loud at enqueue catches call-site bugs during development. All four sync handlers that intentionally call the legacy PATCH path (`confirm_shift`, `confirm_hours`, `complete_checkpoint`, `sign_checklist`) are out of ADR-0298 scope — they are shift-lifecycle operations, not task completions, and remain on PATCH intentionally.

### D3 — Canonical "task created" event over alias session_task.created

`useCreateTask` previously emitted `"session_task.created"`. The telemetry registry (`packages/telemetry/src/registry.ts:13132`) routes the canonical `"task created"` event to four destinations: PostHog, Logger, activity_trail, **engine_event**. The alias `"session_task.created"` routes to only three — it has no engine_event destination. Downstream D6 workflow triggers (shift checkout compliance gate) depend on engine_event to detect newly created compliance tasks.

**Decision:** switch to canonical `"task created"` with full `TaskCreated` metadata shape (`source`, `actor_kind`, `assigned_to_self`, `compliance`, `reason`, `manual`). Metadata hardcoded for mobile context: `source: "session"`, `actor_kind: "employee"`, `manual: true`, `reason: "Opprettet fra mobil"`. `compliance` and `assigned_to_self` computed from payload fields.

**Rationale:** The alias is a deprecated compatibility shim. Mobile was the only call-site still on it. Switching now means mobile and web emit the same canonical event, fixing PostHog funnel splits and unblocking the checkout gate.

### D4 — lønnsslipp → lønnsgrunnlag in user-visible strings only; internal identifiers retained

Smartout produces wage basis (lønnsgrunnlag) that accountants, Tripletex, and Visma consume. Framing the output as a payslip (lønnsslipp) misrepresents the product. This positioning rule is in MEMORY (`feedback_lonnsgrunnlag_not_lonnsslipp.md`, 2026-05-08).

**Decision:** update only the three user-visible Norwegian strings in `apps/mobile/src/constants/strings.ts` (`noPayslips` empty-state ×2 occurrences, `loadErrorPayslip` error message ×1). Internal TS identifiers (`PayslipScreen` component name, `loadErrorPayslip` string key name) retained to avoid churn in a P0 sweep — these are engineering identifiers, not user-visible copy.

**Rationale:** Touching component names and key names would require refactoring import chains and string lookups across multiple files, bloating the diff for zero user-visible gain. The positioning correction is complete at the UX layer.

---

## Learnings

### L1 — Stale telemetry dist blocks typecheck in fresh worktrees (pattern confirmed)

On worktree creation, `@smartout/telemetry` and `@smartout/utils` `dist/*.d.ts` files are absent. The first typecheck run fails on EntityType imports. Fix: `pnpm --filter @smartout/telemetry build && pnpm --filter @smartout/utils build` before running any `pnpm turbo typecheck`. Already documented in MEMORY as `learning_stale_telemetry_dist_blocks_typecheck.md`. This sortie is the **third** confirmed occurrence — should be added to the worktree setup script or promoted to a pre-dispatch build step in the sortie creation checklist.

### L2 — Mid-migration tables create silent-loss risk; schema strictening converts to loud-fail

When a codebase is mid-migration between two schemas (here: `chat_message` → `channel_message`), code that was written for the old schema can pass TypeScript and Zod validation while writing to a different table than intended at runtime. The send_message case in this sortie: `useShiftChat` built payloads with `conversation_id` (old field); `sendMessageSchema` had a `catchall(z.unknown())` that accepted it silently; the sync handler wrote to `channel_message` (which ignores `conversation_id`) → messages lost.

**Pattern:** whenever a table migration is in progress and two code paths coexist, the schema for the deprecated path should be made **strict** (no catchall) immediately, even before the migration is complete. Silent acceptance is more dangerous than loud rejection during a mid-migration window.

### L3 — Lint-staged formatter reformats but preserves semantics; verify post-format diff per CLAUDE.md

The pre-commit hook ran Prettier on `strings.ts` and re-indented the `noPayslips` value (long string, Prettier may wrap). Verify that the formatter did not revert content changes by running `git show HEAD -- apps/mobile/src/constants/strings.ts` and confirming the Norwegian copy is correct. This is a CLAUDE.md mandatory step ("After running linters or prettier, ALWAYS re-verify edits survived"). Confirmed clean in this sortie.

### L4 — ADR-0298 R3 mid-state: PATCH and POST coexist on the same BFF route

Four sync handlers (`confirm_shift`, `confirm_hours`, `complete_checkpoint`, `sign_checklist`) still call PATCH on `/api/mobile/tasks/[id]/complete`. These are shift-lifecycle confirmation operations that predate ADR-0298 and use the task-complete BFF endpoint as a side-effect hook, not as a task-completion operation. They are intentionally out of scope.

The BFF route therefore currently serves two contracts simultaneously: legacy PATCH (no body, session-only side effect) and source-dispatched POST (body `{ source }`). This is a documented mid-state per ADR-0298 R3. The four legacy PATCH callers must be migrated to their own dedicated BFF routes before the PATCH path can be retired. Track in `schedule` campaign or a dedicated sortie.

---

## Known Issues / Debt

| ID | Severity | Description | Follow-up |
|----|----------|-------------|-----------|
| D1 | P0 | `useShiftChat` reads `chat_conversation`/`chat_message`; sync writes `channel_message` — send is blocked at Zod throw with rollback | `mobile-shift-chat-bff-migration` sortie |
| — | P1 | HACCPForm alpha-append bug (`theme.colors.success + "1A"`) | P1 sweep, not this sortie |
| — | P1 | 20+ hardcoded hex/rgba values in `PayslipScreen`, `DuringShiftView`, `channels` | `mobile-design-token-sweep` sortie |
| — | P0 | `shift_id` FK missing on `session_task` / `schedule_day_task` — prevents cascade shift-scoped task queries | Requires migration; defer to `schedule` campaign |
| L4 | debt | 4 sync handlers (`confirm_shift`, `confirm_hours`, `complete_checkpoint`, `sign_checklist`) still on legacy PATCH path | Dedicated BFF routes per handler before PATCH retirement |

---

## Next Steps

Three follow-up sortier to complete the mobile release story:

1. **`mobile-shift-chat-bff-migration`** (P0) — Replace `useShiftChat` with a channel-aware hook reading `channel`/`channel_message`. Add dedicated `/api/mobile/shifts/[id]/chat` BFF route. Remove `sendMessageSchema` workaround.

2. **`mobile-design-token-sweep`** (P1) — Replace all hardcoded hex/rgba in `PayslipScreen`, `DuringShiftView`, and `channels` with Nordic Split CSS variables. ADR-0366 compliance sweep for mobile surfaces.

3. **`schedule-shift-task-fk`** (P0 schema gap) — Add `shift_id` FK to `session_task` + `schedule_day_task` with migration. Requires coordination with `schedule` campaign to avoid constraint conflicts.
