---
title: "Plan — handover-migration"
status: in_progress
updated: 2026-04-22
created: 2026-04-22
module: handover
tags: [plan, handover, telemetry, adr-0134, adr-0187, adr-0188, split-shift]
---

# Plan — handover-migration

> Branch: `feat/daily-operation-handover-migration` | Worktree: `/home/sxtnl/dev/smartout.ai-daily-operation-wt-2` | Base: `campaign/daily-operation` | Module: handover | Started: 2026-04-22

## Goal

Close three correctness gaps in the handover path: three mobile mutations that emit telemetry with empty-string IDs (ADR-0134 violation), one mobile reader that fetches the wrong `department_session` row (same-date instead of last-closed, Campaign Invariant #11), and one web Server Action that still inline-emits `session pending_signoff` after ADR-0187 consolidated that emitter to the DB trigger.

## Scope

### In scope
- Fix 4 mobile emit sites to resolve `workspace_id + actor_id` via `getProfileContext()` before `emit()`.
- Fix `BeforeShiftView` leader-note query to select the last CLOSED `department_session` where `closed_at < shift.start_at` (reconstructed from `shift_date + start_time`).
- Strip the inline `session pending_signoff` emit from `transition-session-action.ts`; keep `opened`/`closed`/`missed` emits intact.
- Write plan, journey, and handoff docs. Run typecheck to 0 errors.

### Out of scope
- Phase 2 reader migration (ADR-0188): `BeforeShiftView` continues to read the legacy `handoff_notes` TEXT column. Migration to `session_note(note_type='handoff')` is a separate sortie.
- Any new DB migration. ADR-0187 and ADR-0188 Phase 1 are already landed (`e2fa755a`, `4349f840`).
- Writer-side `session_note` migration for other handover writers (DailyNoteSheet already migrated in Phase 1).
- Clockout-wizard (M2 scope), recon-v2 (M1 scope), mobile-parity-poc (M4 scope).

## Implementation Steps

1. **Mobile telemetry fixes (ADR-0134)** — import `getProfileContext` in three files; replace `workspace_id: null, actor_id: ""` with resolved values:
   - `apps/mobile/src/hooks/mutations/use-cancel-absence.ts` — resolve before emit inside `cancelAbsence` callback.
   - `apps/mobile/src/hooks/mutations/use-confirm-hours.ts` — resolve inside `confirmHours` callback after `enqueue()` succeeds.
   - `apps/mobile/src/hooks/mutations/use-livekit-call.ts` — resolve inside both `connect()` and `disconnect()` callbacks; fall back to `callSession.startedBy` only if present, otherwise use resolver `profileId`.

2. **Split-shift query fix (Campaign Invariant #11)** — rewrite `useLeaderNote` inside `apps/mobile/src/components/home/BeforeShiftView.tsx` to:
   - Reconstruct `shiftStartIso` from `shift.shift_date + shift.start_time` via `useMemo`.
   - Select last CLOSED session: `.eq("workspace_id", ...).eq("department_id", ...).eq("status", "closed").lt("closed_at", shiftStartIso).order("closed_at", { ascending: false }).limit(1).maybeSingle()`.
   - Keep reading the TEXT `handoff_notes` column (ADR-0188 Phase 2 deferred).
   - Add note in queryKey so cache keys change when workspace or shift start moves.

3. **Strip 5th-writer inline emit (ADR-0187)** — in `apps/web/src/app/dashboard/_actions/transition-session-action.ts`:
   - Add `if (parsed.data.target !== "pending_signoff")` guard around the `emit()` call and simplify the `eventName` ternary to cover only the three remaining transitions.
   - Add ADR-0187 note comment above the UPDATE explaining that trigger owns the `pending_signoff` transition exclusively.

4. **Docs + gates** — write plan (this file), journey (all 5 flows), handoff (summary + decisions + learnings). Run `pnpm turbo typecheck --filter=web --filter=@smartout/mobile` to 0 errors.

## Success Criteria

- [x] All 4 emit sites resolve non-null `workspace_id + actor_id` via `getProfileContext()` (grep-verified: no `workspace_id: null` or `actor_id: ""` remain in the three mobile files).
- [x] `BeforeShiftView` query filters on `status="closed"`, `closed_at < shiftStartIso`, ordered `closed_at DESC`, limit 1.
- [x] `transition-session-action.ts` no longer emits `session pending_signoff` inline; `opened`/`closed`/`missed` still emit.
- [x] `pnpm turbo typecheck --filter=web --filter=@smartout/mobile` returns 0 errors.
- [x] Plan, journey, and handoff docs present with YAML frontmatter.

## Risks

| Risk | Mitigation |
|---|---|
| `getProfileContext()` hard-fail in live flow | Intentional per ADR-0134 §3.6 — emit must NOT fire with corrupt IDs. Hook sites all mutate async-onSuccess paths where a throw aborts emit, never the DB write. Write already committed via `enqueue()` before resolver runs in the two sync-queue hooks. |
| Stale `database.types.ts` breaks typecheck | Verified via `grep` that `closed_at`, `status`, `department_session_id`, `workspace_id` exist on the `department_session` Row type. Full turbo typecheck passes. |
| LiveKit `callSession.workspaceId` not actually non-null | Confirmed via `CallSession` schema in `@smartout/walkie-talkie` — `workspaceId` is required. Only `startedBy` was nullable; the fallback to `profileId` via `getProfileContext()` closes the gap. |
| Query shape finds zero rows for first-ever shift in a department | `.maybeSingle()` returns `null`, hook returns `null`, UI silently omits the LEADER NOTE section. Correct behaviour — no prior handover to show. |
| ADR-0187 trigger not yet installed in a branch DB | Out of scope for this sortie; trigger landed with `e2fa755a`. If preview/main diverge, that is a deployment issue, not a code issue. |
