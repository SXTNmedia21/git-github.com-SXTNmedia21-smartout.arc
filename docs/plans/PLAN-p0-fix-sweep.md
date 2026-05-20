---
title: "Plan — p0-fix-sweep"
status: in_progress
updated: 2026-05-19
created: 2026-05-19
module: Mobile
tags: [plan, mobile, release-blocker, audit-followup]
---

# Plan — p0-fix-sweep

> Branch: `feat/mobile-p0-fix-sweep` | Worktree: /home/sxtnl/dev/smartout.ai-mobile-wt-1 | Base: `campaign/mobile` | Module: Mobile | Started: 2026-05-19

## Goal

Land 4 P0 blockers surfaced by overnight production-readiness review so mobile can ship tomorrow. No schema migrations, no full ADR-0132 chat migration. Schema-patch-only path for P0-C: convert silent message loss to loud Zod throw.

## Source

Overnight review delivered by `feature-dev:code-reviewer` (sonnet) against `campaign/mobile` @ 044455266. Verdict: READY-WITH-FIXES.

## Tasks

### P0-A — Offline `complete_task` uses legacy PATCH path

- [x] `apps/mobile/src/lib/sync/action-map.ts` — change `complete_task` handler from `PATCH` (legacy session_task-only) to `POST` with `{ source }` body (ADR-0298 Sortie 3 source-dispatched path).
- [x] `apps/mobile/src/lib/sync/schemas.ts` — add `source: z.enum(["session", "personal", "day_ad_hoc", "emma"])` to `completeTaskSchema`. Keep `.strict()` so missing source fails at enqueue.

**Risk before fix:** Offline completion of personal/day_ad_hoc/emma tasks routes through `completeSessionTaskAction` (session_task only) → 422 or silent no-op. ADR-0298 R3 violation.

### P0-B — Mobile `useCreateTask` emits deprecated alias

- [x] `apps/mobile/src/hooks/mutations/use-create-task.ts` — replace `event: "session_task.created"` (alias, no `engine_event` routing) with canonical `event: "task created"` (4-destination including `engine_event` per registry line 13132).
- [x] Match `TaskCreated` interface shape (registry line 1106): `entity: { entity_type, entity_id }`, `metadata: { source, actor_kind, assigned_to_self, compliance, reason, manual }`.

**Risk before fix:** Mobile-created session_tasks never trigger downstream D6 workflow steps (shift checkout gate). PostHog funnel splits between mobile (`session_task.created`) and web (`task created`).

### P0-C — Shift chat enqueues to deprecated `conversation_id` path

Schema-patch only. Full BFF migration deferred to `mobile-shift-chat-bff-migration` post-release sortie.

- [x] `apps/mobile/src/lib/sync/schemas.ts` — `sendMessageSchema`: keep `.catchall(z.unknown())` for forward-compat metadata fields but require `channel_id: uuid()`. Document deferred migration in schema comment.
- [ ] `apps/mobile/src/hooks/shift-clock/useShiftChat.ts` — `sendMessage`: rollback optimistic prepend if enqueue throws (Zod ValidationError). Log clear known-limitation message. Header comment marks hook as pending channel/channel_message migration.

**Risk before fix:** `useShiftChat` enqueues with `conversation_id` field; sync handler writes to `channel_message` (which requires `channel_id`, not `conversation_id`). Insert silently fails or drops field. Message lost without user feedback.

**Risk after fix:** Shift-chat offline send fails LOUDLY at enqueue (Zod throw on missing `channel_id`). Optimistic UI rolls back. User sees clear error toast. Trade silent-loss for loud-fail until full migration ships.

### P0-D — Payroll empty/error wording uses "lønnsslipp"

- [x] `apps/mobile/src/constants/strings.ts:229-230,236` — replace 3 occurrences of `lønnsslipp` with `lønnsgrunnlag`. Pontus positioning rule: Smartout produces wage basis for accountants/Tripletex/Visma, NOT payslips.

**Risk before fix:** Wrong product positioning visible to end-users on payroll screen.

## Out of Scope

- `shift_id` FK migration on `session_task` / `schedule_day_task` (NOT-OVERNIGHT, defer to schedule campaign)
- Full ADR-0132 BFF migration for `useShiftChat` (defer to `mobile-shift-chat-bff-migration` sortie)
- 20+ P1 hardcoded hex/rgba sweep across PayslipScreen + DuringShiftView + channels feature
- HACCPForm alpha-append bug (`theme.colors.success + "1A"` — P1)
- Admin location+shift filter UI on web (per audit: clean, no blocker)

## Acceptance Criteria

- [ ] Typecheck: `pnpm turbo typecheck --filter=@smartout/mobile` passes
- [ ] Schema tests: `pnpm --filter=@smartout/mobile test schemas.test.ts` passes (with new `source` requirement on complete_task + new `channel_id` requirement on send_message)
- [ ] Grep validations:
  - `grep -rn "lønnsslipp" apps/mobile/src/constants/strings.ts` returns 0 matches in user-visible strings
  - `grep -n 'method: "PATCH"' apps/mobile/src/lib/sync/action-map.ts` — complete_task handler shows POST
  - `grep -n 'session_task.created' apps/mobile/src/hooks/mutations/use-create-task.ts` returns 0 matches
  - sendMessageSchema in `apps/mobile/src/lib/sync/schemas.ts` declares `channel_id` as required UUID
- [ ] Decision log updated (implementation-level fixes only; documented in HANDOFF)
- [ ] HANDOFF written at closure

## Follow-up Sortie (Post-Release)

`mobile-shift-chat-bff-migration` — Migrate `useShiftChat` from `chat_message`+`chat_conversation` (old) to `channel_message`+`channel` (new). Route through BFF per ADR-0132. Update sync handler. Backfill conversation→channel mapping. Estimated 1-2 sortier.
