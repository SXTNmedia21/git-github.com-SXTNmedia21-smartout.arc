---
title: "Handoff — handover-migration"
status: in_progress
updated: 2026-04-22
created: 2026-04-22
module: handover
tags: [handoff, telemetry, split-shift, adr-0134, adr-0187, adr-0188]
---

# Handoff — handover-migration (M3)

> Sub-sortie of `campaign/daily-operation`. Branch: `feat/daily-operation-handover-migration`.

## Summary

Three correctness fixes in the handover path:

1. **Mobile telemetry (ADR-0134):** four emit sites that previously passed `workspace_id: null, actor_id: ""` now resolve both IDs via `getProfileContext()` before calling `emit()`. Sites: `useCancelAbsence`, `useConfirmHours`, and both the `connect` + `disconnect` callbacks of `useLiveKitCall`.
2. **Split-shift read (Invariant #11):** `BeforeShiftView.useLeaderNote` no longer queries `department_session` by same-calendar-date. It now selects the LAST CLOSED session for the department where `closed_at < shiftStartIso` (reconstructed from `shift_date + start_time`). Works for split shifts, midnight-crossing shifts, and same-day multiple-session scenarios.
3. **Single-emitter invariant (ADR-0187):** `transition-session-action.ts` no longer inline-emits `session pending_signoff` after UPDATE. The DB trigger `trg_session_pending_signoff` is now the sole emitter for that transition. Other transitions (`opened`, `closed`, `missed`) remain inline-emitted.

No new DB migrations. No schema changes. No new ADRs. All changes are code-only; the governing ADRs (0134, 0187, 0188) were already accepted.

## Decisions

No new ADRs written during this sortie. Cited ADRs:

- **ADR-0134 — Mobile Telemetry Contract:** mandates non-null `workspace_id + actor_id` before `emit()`. Fail-fast via `getProfileContext()` per §3.6.
- **ADR-0187 — session state events single emit source:** DB trigger owns `active → pending_signoff` emit. Application code MUST NOT inline-emit this transition. Only `pending_signoff` is trigger-owned; other transitions still emit inline per existing wiring.
- **ADR-0188 — handoff_notes column deprecation:** `session_note(note_type='handoff')` is canonical; Phase 1 (DailyNoteSheet writer) already shipped in `4349f840`. Phase 2 (reader migration) is explicitly OUT OF SCOPE here — `BeforeShiftView` continues to read the TEXT column and only fixes its row-selection logic.

## Learnings

1. **`callSession.startedBy` is nullable while the call is still being negotiated.** The previous `?? ""` fallback produced empty-string `actor_id` during initial-connect telemetry. The correct source of truth during live interaction is the authenticated profile (`getProfileContext().profileId`), not the (still-unresolved) session-level `startedBy`. Pattern used: `callSession.startedBy ?? profileId`. Keeps the historical record (startedBy is the canonical originator) while guaranteeing non-null telemetry.

2. **`schedule_shift` has no `start_at` timestamptz.** Only `shift_date` (date) + `start_time` (time). Any code that filters `department_session.closed_at` by "before the shift starts" must reconstruct ISO via `new Date(\`${shift_date}T${cleanedStartTime}\`).toISOString()` — and clean the `start_time` string of spurious offset suffixes that can leak through Postgres `time` serialisation (pattern already established in `hoursUntilShift`).

3. **Split-shift semantics require three predicates together, not two.** Previous query was `(department_id, session_date)` which is wrong in three scenarios: (a) split A+B shifts on same date → returns open session A, not closed session A; (b) midnight-crossing shift → returns today's open session, not yesterday's closed one; (c) multiple sessions per department per day (rare but legal) → returns arbitrary row. Correct predicate: `(workspace_id, department_id, status='closed', closed_at < shiftStartIso)` ordered `closed_at DESC`, limit 1.

4. **Pattern consistency between signoff-session-action and transition-session-action.** The just-landed `signoff-session-action.ts` (ADR-0187 consolidation) keeps `session closed` emit inline but strips `session pending_signoff`. This sortie mirrors that pattern in `transition-session-action.ts` using an `if (target !== "pending_signoff")` guard rather than removing the emit block wholesale — preserving the opened/closed/missed paths that the trigger does NOT own.

5. **Turbo cache behaviour across worktrees.** A fresh worktree (no `node_modules`) still benefits from the shared build cache — `@smartout/types`, `@smartout/telemetry`, `@smartout/supabase`, `@smartout/utils` all cache-hit even on first invocation. Full typecheck for web + mobile from cold start: ~1m50s.

## Known Issues / Debt

- **Phase 2 of ADR-0188 (reader migration) is deferred.** `BeforeShiftView` still reads the `handoff_notes` TEXT column. A separate sortie needs to migrate reads to `session_note(note_type='handoff')`. When that lands, the query shape stays identical (same predicates + ordering); only the SELECT list + join changes.
- **LiveKit abrupt-disconnect path does not emit `call.ended`.** The room-event `handleDisconnected` callback resets UI state but never calls `emit()`. Only explicit `disconnect()` emits. Known gap; documented in the journey as a non-happy path; fix belongs in a voice/walkie-talkie sortie, not here.
- **`useConfirmHours` and `useCancelAbsence` enqueue BEFORE resolving profile context.** If `getProfileContext()` throws, the DB write persists in the queue but the telemetry event never fires. Accepted trade-off per ADR-0134: data integrity wins over telemetry completeness. Consider moving the resolver call BEFORE `enqueue()` in a future sortie if audit-gap concerns arise.
- **No new E2E tests.** Playwright / Detox coverage for these specific paths would catch regressions of the empty-string fallback. Non-blocking per `close-feature.sh` gates (recommended, not required).

## Next Steps

1. **Close this sortie** via `close-feature.sh 2` (Pontus runs).
2. **ADR-0188 Phase 2 sortie** — migrate `BeforeShiftView` and any other `department_session.handoff_notes` readers to `session_note(note_type='handoff')`. Query shape from this sortie (last-closed-before-shift-start) is the template; swap the column source.
3. **LiveKit abrupt-disconnect emit** — separate sortie to add `emit("channel.call.ended")` inside the `RoomEvent.Disconnected` handler, de-duped against explicit `disconnect()` calls.
4. **Telemetry-resolver-order audit** — sweep all mobile mutations where enqueue-before-emit may silently drop telemetry on auth failure; decide per site whether to reorder or accept trade-off.

## Files Touched

- `apps/mobile/src/hooks/mutations/use-cancel-absence.ts`
- `apps/mobile/src/hooks/mutations/use-confirm-hours.ts`
- `apps/mobile/src/hooks/mutations/use-livekit-call.ts`
- `apps/mobile/src/components/home/BeforeShiftView.tsx`
- `apps/web/src/app/dashboard/_actions/transition-session-action.ts`
- `docs/plans/PLAN-handover-migration.md` (rewrote from stub)
- `docs/journeys/JOURNEY-handover-migration.md` (new)
- `docs/HANDOFF-handover-migration.md` (this file)

## Verification

- `grep -n 'workspace_id: null\|actor_id: ""' apps/mobile/src/hooks/mutations/use-{cancel-absence,confirm-hours,livekit-call}.ts` → 0 matches.
- `grep -n 'getProfileContext' apps/mobile/src/hooks/mutations/use-{cancel-absence,confirm-hours,livekit-call}.ts` → 3 imports + 4 call sites.
- `grep -n 'session pending_signoff' apps/web/src/app/dashboard/_actions/transition-session-action.ts` → 0 matches.
- `grep -n 'session opened\|session closed\|session missed' apps/web/src/app/dashboard/_actions/transition-session-action.ts` → 3 matches (inline emits preserved).
- `pnpm turbo typecheck --filter=web --filter=@smartout/mobile` → 0 errors, 8/8 tasks successful.
