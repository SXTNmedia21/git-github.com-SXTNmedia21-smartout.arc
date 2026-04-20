---
title: "User Journeys — WebDayControl (overview-v2)"
status: done
updated: 2026-04-19
created: 2026-04-19
module: dashboard
tags: [journey, day-control, admin, leder]
---

# User Journeys — WebDayControl

> Every journey this feature enables. WebDayControl replaces OversiktView as the admin "Oversikt" surface.

---

## Journey: Leder opens the day

**Precondition:** Leder has signed in, `profile.department_id` is set, a `department_session` exists for today (seeded by session-lifecycle edge function).

1. Leder clicks "Oversikt" in the dashboard variant bar → System renders `WebDayControl` (ADR-0156) → Leder sees: top bar with Wordmark + actor, SessionHeader with warm Instrument Serif heading ("Mandag 19. april"), phase badge ("Pågår" in green with pulse), planned hours ("11:00–23:00 · Åpnet 10:58"), and a 7-tab SubNav.
2. Default tab is "Oversikt" → System queries `useDepartmentSessions`, `useLiveShifts`, `useDeviations({ status: ["open", "acknowledged"] })` → Leder sees 6 KPI tiles (revenue/laborcost/hours labeled "Kun etter dag-oppgjør" because phase=active, oncall/tasksdone/deviations live), an "Aktiv bemanning nå" list of clocked-in shifts, and a right-rail of open deviations + "Siste meldinger" placeholder.
3. System writes `engine_memory` fact via `pinDayControlContextAction` (24h TTL) → Botsson can answer "hvor mange avvik har vi i dag?" without re-fetching.

**Postcondition:** Panel is loaded, session context pinned for AI, KPI tiles reflect live state.

**Error paths:**
- Profile has no department → `NoDepartmentState` renders: "Ingen avdeling knyttet — kontakt admin". Workspace fallback applies first (first department by `created_at ASC`); if none, message appears.
- No session for today → `NoSessionState` renders: "Ingen sesjon registrert for i dag — venter på åpningsrutine". Engine owns creation.
- Query failure → TanStack error boundary (existing dashboard pattern).

---

## Journey: Leder reviews day timeline

**Precondition:** Leder is on WebDayControl. Clicks "Dagslinjen" tab.

1. System queries `useSessionHooksWithTasks(sessionId)` → returns hooks grouped by `session_hook_id` with nested `session_task` rows.
2. Tab body animates in via Framer Motion spring (stiffness 35, damping 22, mass 2.2; reduced-motion fallback = 150ms fade).
3. System renders `PhaseTimeline` with "NÅ" marker positioned by computed `nowPct` (elapsed / total session window) → Leder sees horizontal rail of hook markers, check icons on completed hooks, orange accent on in-progress.
4. Leder sees stack of `HookTile` accordions. In-progress hooks are open by default; completed hooks are collapsed.
5. Leder expands a "Lunsj-prep" hook → `aria-expanded` flips, chevron rotates → visible `TaskRow` list with compliance shields on critical tasks.

**Postcondition:** Leder has full timeline + task context.

**Error paths:** No hooks/tasks → empty state "Ingen hooks eller oppgaver registrert for denne sesjonen."

---

## Journey: Leder toggles a task

**Precondition:** Leder is on Dagslinjen or Oppgaver, a task is visible.

1. Leder clicks the checkbox on "Svinekjøtt prep til middag" → UI optimistically flips (light-green check) via `optimisticIds` state + `startTransition`.
2. System calls `toggleSessionTaskAction({ taskId, done: true })` → Server Action resolves profile via `resolveCurrentProfile()` (ADR-0151), verifies workspace match, updates `session_task` (status='completed', completed_at=now, completed_by=profile), then `emit("session task_completed", { data: { task_id, profile_id } })` — registry fan-out to PostHog + logger + activity_trail + engine_event.
3. System refetches `useSessionHooksWithTasks` → UI settles on real state, optimistic flag cleared.

**Postcondition:** `session_task.status = 'completed'`. Four telemetry destinations received the event. Audit trail complete.

**Error paths:**
- Server Action returns `{ ok: false, error }` → `toast.error(error)` fires; refetch reverts UI.
- Network failure → TanStack's refetch shows latest DB state; optimistic flag clears.

---

## Journey: Leder sends a broadcast

**Precondition:** Leder on "Melding" tab.

1. Leder selects type pill ("Alert") → `aria-checked` flips (radiogroup, not tablist).
2. Leder types "Leverandør forsinket 30min" and clicks Send.
3. System calls `sendBroadcastAction({ type: "alert", title, body, sessionId, departmentId })` → Server Action:
   - Resolves profile server-side (ADR-0151).
   - `hasMinimumRole("manager")` check — rejects if employee.
   - `detectPii()` scans title+body for personnummer / bank regex (ADR-0077 guardrail) — rejects with clear toast if hit.
   - Resolves-or-creates workspace news `channel` (`channel_type='news'`).
   - Inserts `channel_message` with `content = **title** + body`, `message_type='announcement'`, `delivery_mode='notification_only'`, `target_profile_ids`, `system_data = { broadcast_type, title, department_id, session_id }`.
   - Emits `communication.broadcast_sent` with registry-defined `properties.metadata` shape (fan-out: activity_trail + posthog).
4. System shows success toast + appends local-state broadcast to the tab feed.

**Postcondition:** Broadcast persists in komm news channel with full D6 provenance in system_data. Employees receive `notification_only` delivery.

**Error paths:**
- PII hit → toast "Meldingen inneholder personnummer. Personlige detaljer må ikke sendes i broadcast-kanal." Payload rejected.
- Employee role → toast "Kun ledere og admins kan sende broadcasts."
- Supabase insert error → toast with error message.

---

## Journey: Leder submits the day for signoff

**Precondition:** Session is `active`. Leder on "Oppgjør" tab.

1. Leder sees `SignoffPanel` with stat grid (oppgaver done/total, open deviations, last-out time) + textarea + orange CTA "Bekreft og send til oppgjør →".
2. Leder optionally enters notes, clicks CTA.
3. System calls `signoffSessionAction({ sessionId, confirm: "pending", notes })` → Server Action:
   - Resolves profile, verifies role ≥ manager.
   - Loads session, verifies status === "active" + workspace match.
   - Updates `department_session.status = 'pending_signoff'`, stores notes.
   - Emits `session pending_signoff` (closes the historical gap where TanStack hook never fired this registry event).
4. Success toast: "Dagen sendt til oppgjør".

**Postcondition:** `department_session.status = 'pending_signoff'`. DB trigger `trg_session_pending_signoff` fires, engine picks it up, daily_close process starts. Admin can now approve.

**Error paths:**
- Status not "active" → toast "Kan ikke sette til pending_signoff fra status 'X'."
- Role too low → toast "Ikke tilstrekkelig rettigheter (krever leder eller admin)."

---

## Journey: Admin approves the signoff

**Precondition:** Session is `pending_signoff`. Admin on "Oppgjør" tab.

1. Admin sees `ReconSummary` with phase badge "Venter på oppgjør" and two buttons (Spør om revisjon / Godkjenn oppgjør).
2. Admin clicks "Godkjenn oppgjør".
3. System calls `signoffSessionAction({ sessionId, confirm: "close" })` → Server Action:
   - Role ≥ admin check.
   - Updates `department_session.status = 'closed'`, stores `closed_at` + `closed_by = profile_id`.
   - Emits `session closed`.
4. Success toast: "Dagen godkjent og stengt".

**Postcondition:** `department_session.status = 'closed'`. Day is audit-locked until reconciliation completes.

**Error paths:**
- Admin role not granted → toast "Kun admin kan godkjenne og stenge dagen."
- Status not `pending_signoff` → toast explaining state machine.

---

## Journey: Admin reviews roster

**Precondition:** Admin on "Bemanning" tab.

1. System queries `useRoster(departmentId, today)` → joins `schedule_shift` with `timesheet.time_entry` (shift_id FK).
2. Admin sees table: `Tid | Person | Planlagt | Faktisk | Status` with one row per shift.
3. Active shifts show live pulse dot (motion-safe:animate-pulse); "Faktisk" column computed from `punch_in`/`punch_out` (or `now - punch_in` if still clocked in).

**Postcondition:** Admin sees planned vs actual hours at a glance.

**Error paths:** No shifts → empty state pointing to `/dashboard/schedule`.

---

## Journey: Leder manages deviations

**Precondition:** Leder on "Avvik" tab.

1. System queries `useDeviations({ status: ["open", "acknowledged", "resolved", "escalated"] })` → returns workspace-scoped deviations (session-scoping is a planned follow-up).
2. Leder sees stack of `DeviationCard`s with severity-colored left border, 4-way status pill (ÅPEN / UNDER OPPFØLGING / LØST / ESKALERT).
3. Leder can drill into details (existing `useUpdateDeviation` mutation supports resolve/escalate from legacy HMS drawer).

**Postcondition:** Leder has visibility of all active deviations.

**Error paths:** No deviations → "Ingen avvik registrert. Logg avvik fra mobilens deviation-flow."

---

## Cross-cutting: Reduced motion

Any time Framer Motion springs are triggered (tab switch, future HookTile expand animations), `useReducedMotion()` detects `prefers-reduced-motion: reduce` and swaps to a 150ms opacity fade. CSS pulse animations use `motion-safe:animate-pulse` prefix. No motion is ever unconditional.
