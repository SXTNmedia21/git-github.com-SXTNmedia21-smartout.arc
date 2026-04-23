---
title: "Journey — handover-migration"
status: in_progress
updated: 2026-04-22
created: 2026-04-22
module: handover
tags: [journey, handover, telemetry, split-shift, adr-0134, adr-0187]
---

# Journey — handover-migration

> Covers the five flows affected by M3 of `campaign/daily-operation`: four mobile emit-path fixes (ADR-0134) and one web inline-emit strip (ADR-0187), plus the split-shift read fix in `BeforeShiftView` (Invariant #11).

## Journey: Employee cancels a pending absence request (mobile)

**Precondition:** authenticated employee on mobile; `profile` row exists with non-null `profile_id + workspace_id`; at least one absence request with `status="pending"`.

1. Employee opens the absence list (`["my-absence-requests"]` cache hydrated) and taps **Avbryt** on a pending row.
2. `useCancelAbsence.cancelAbsence()` enqueues a `"cancel_absence"` action into the SQLite sync queue with `{ schedule_absence_id, status: "rejected" }`.
3. TanStack cache optimistically flips the matching row's `status` to `"rejected"`.
4. `["absence-balance"]` is invalidated.
5. `getProfileContext()` resolves `{ profileId, workspaceId }` from `auth.getUser()` + `profile` lookup.
6. `emit({ event: "absence cancelled", workspace_id: workspaceId, actor_id: profileId, ... })` fires with non-null IDs.
7. SyncWorker drains the queue and updates `public.schedule_absence` when online.
8. Employee sees the row in the "Rejected" section instantly; no round-trip wait.

**Postcondition:** `activity_trail` row for the cancellation carries the correct `workspace_id + actor_id`; ADR-0134 invariant holds.

**Error paths:**
- Offline: queue drain is deferred; optimistic UI still flips. `emit()` still resolves IDs and enqueues the telemetry event via PostHog/Logger.
- Auth expired between list render and cancel tap: `getProfileContext()` throws; the `void emit(...)` rejection is swallowed by `void`, but the DB write already enqueued. Next app foregrounding re-authenticates and `SyncWorker` drains normally. **Trade-off:** one telemetry event may be lost; DB truth is preserved.
- Profile row missing `workspace_id`: `getProfileContext()` throws `"Profile missing workspace_id"`; surfaced in Sentry. No corrupt emit.

---

## Journey: User joins and leaves a LiveKit voice call (mobile)

**Precondition:** authenticated user with a valid `CallSession` (token, serverUrl, workspaceId non-null per CallSession schema); network available.

1. User taps **Join** in the walkie-talkie surface; `useLiveKitCall.connect()` runs.
2. Room connects to LiveKit server; microphone is enabled if `audioPolicy !== "listen_only"`.
3. `getProfileContext()` resolves `{ profileId }`.
4. `emit({ event: "channel.call.started", workspace_id: callSession.workspaceId, actor_id: callSession.startedBy ?? profileId, ... })` fires with non-null IDs.
5. User talks / listens.
6. User taps **Leave** or the room disconnects; `disconnect()` runs.
7. `getProfileContext()` resolves `{ profileId }` again.
8. `emit({ event: "channel.call.ended", workspace_id: callSession.workspaceId, actor_id: callSession.startedBy ?? profileId, ... })` fires with non-null IDs.

**Postcondition:** both `call.started` and `call.ended` events land in `activity_trail` with non-empty `actor_id`; even in-progress calls (where `startedBy` may be null while the agent is still connecting) get the authenticated profile id.

**Error paths:**
- `callSession.startedBy` is null AND `getProfileContext()` throws: `emit()` never fires. Room lifecycle still proceeds (audio works). **Acceptable** — no corrupt emit.
- Room disconnects abruptly (network drop): `handleDisconnected` runs but does NOT emit; only the explicit `disconnect()` path emits. Known gap; outside this sortie's scope.
- `callSession` is null entirely: no emit at all (pre-existing guard). Preserved.

---

## Journey: Shift leader confirms or disputes registered hours (mobile)

**Precondition:** authenticated employee (typically leder role) with an open `shift_approval` row in `"pending"` state; sync queue operational.

1. Leader opens the hours-confirmation screen; sees planned vs registered hours side-by-side.
2. Leader taps **Bekreft** or **Bestrid**; if disputing, writes a justification.
3. `useConfirmHours.confirmHours({ approval_id, status, edit_justification })` runs.
4. `enqueue("confirm_hours", ...)` returns a local row id.
5. `getProfileContext()` resolves `{ profileId, workspaceId }`.
6. `emit({ event: "shift hours_confirmed", workspace_id: workspaceId, actor_id: profileId, ... })` fires with non-null IDs and the chosen `status` in properties.
7. SyncWorker drains the queue and updates `shift_approval.status` when online.

**Postcondition:** telemetry event carries the true `workspace_id + actor_id` for audit; `shift_approval` transitions to `approved` or `disputed` server-side.

**Error paths:**
- Submit while offline: queue buffers; emit still runs locally and PostHog batches on reconnect.
- Auth session expired: `getProfileContext()` throws inside the mutation; `emit` is skipped; the `enqueue` has already returned a row id, so the DB write is not lost. Trade-off accepted per ADR-0134.

---

## Journey: Employee views pre-shift handover on the home screen (mobile, split-shift safe)

**Precondition:** authenticated employee; a `schedule_shift` row exists for today or the near future with `department_id + workspace_id + start_time + shift_date`.

1. Employee opens the app; `BeforeShiftView` renders for the upcoming shift.
2. `useLeaderNote(shift)` reconstructs `shiftStartIso` from `shift_date + start_time` (strips any stray offset suffix).
3. The hook queries `department_session` for the same `workspace_id + department_id` where `status="closed"` and `closed_at < shiftStartIso`, ordered `closed_at DESC`, limit 1.
4. If a row is found, `handoff_notes` is returned; the UI renders the **LEADER NOTE** card.
5. If no prior closed session exists, the card is omitted; the rest of the screen renders normally.

**Postcondition (split-shift case):** Employee working shift B that starts 17:00 on the same calendar date as a still-open session A (09:00–15:00, closed 15:12) correctly reads A's handover — not the open session's empty notes, not a stale later session. Similarly, a shift starting 02:00 crossing midnight correctly reads the previous day's last-closed session.

**Error paths:**
- `shift.department_id` null: query is disabled, hook returns `undefined`, card omitted.
- Query error (RLS or network): `throw` propagates to TanStack; surface is empty LEADER NOTE area, error logged. Pre-existing behaviour.
- `handoff_notes` column soon-to-be-deprecated (ADR-0188): TEXT read still works until Phase 2 migrates reader to `session_note`.
- Multiple closed sessions with identical `closed_at` (sub-second collision): arbitrary single row returned. Acceptable — in practice closes are user-triggered seconds apart.

---

## Journey: Admin manually transitions a department_session (web)

**Precondition:** authenticated admin in the operations dashboard; a target `department_session` exists in a status that allows the requested transition per the legal-transitions map; capability gate passes.

1. Admin opens the WebDayControl surface for a session.
2. Admin clicks a state-change button (e.g. **Åpne vakt**, **Avslutt dag**, **Marker som uteblitt**, or admin-revert flows).
3. `transitionSessionAction({ sessionId, target })` runs on the server.
4. Zod validates input; `resolveCurrentProfile()` confirms auth; legal-transitions map rejects illegal hops.
5. `gateAction({ capability: "session.signoff" or "session.transition" })` runs; audit row written.
6. `department_session` UPDATE runs via the admin client.
7. If `target === "pending_signoff"`: **no inline `emit()` runs**; `trg_session_pending_signoff` on the DB writes the `engine_event` row per ADR-0187.
8. If `target` is `active`, `closed`, or `missed`: inline `emit()` fires with `workspace_id + actor_id` set from the loaded session and caller profile. Only one row lands in `activity_trail` for the transition.

**Postcondition:** Exactly one `activity_trail` row per state change; `pending_signoff` rows originate solely from the trigger; other transitions originate solely from the Server Action. ADR-0187 single-emitter invariant holds.

**Error paths:**
- Admin requests illegal transition: action returns `{ ok: false, error: "Kan ikke gå fra ..." }`; no UPDATE, no emit.
- Gate denies: action returns `{ ok: false, error: gate.reason }`; no UPDATE, no emit.
- UPDATE fails: emit skipped regardless of target; caller sees `{ ok: false, error: updateError.message }`.
- Legacy duplicate emit from a stale client calling the old code path: no longer possible — `pending_signoff` has no inline emit anywhere in this action. Grep proof in handoff.
