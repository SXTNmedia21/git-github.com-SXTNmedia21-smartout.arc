---
title: JOURNEY — ui-shell staff-prefetch
feature: staff-prefetch
status: verified
updated: 2026-05-18
created: 2026-05-18
module: mobile-schedule
tags: [mobile, journey]
---

# JOURNEY — Ansatt-dropdown viser hele teamet uavhengig av scope

## Journey: Employee opens Ansatt dropdown from default scope

**Precondition:** User signed in on mobile PWA (http://localhost:8083). Workspace has ≥ 2 active profiles. ShiftListScreen mounted with default scope `me`.

1. User taps "Ansatt ▾" chip → System opens dropdown panel → User sees 4-column avatar grid with EVERY active profile in workspace, not only themselves.
2. User taps a colleague avatar → System sets scope `{ kind: "person", value: profile_id }` → User sees only that colleague's shifts in the week.
3. User taps "✦ Mine vakter" → System resets scope to `me` → User sees own shifts. Dropdown state remains populated (no re-fetch latency).

**Postcondition:** Staff list cached for the active week; switching between `me` / `all` / `dept` / `person` does NOT alter dropdown content.

**Error paths:**
- `useTeamStaff` fetch fails → dropdown shows empty state with "Kunne ikke laste team" + retry button. Other scopes continue to work (shift list unaffected).
- Workspace has only 1 active profile → dropdown shows that single entry (degenerate but valid).

## Journey: Manager filters by person from team-wide view

**Precondition:** Same as above; user has manager role.

1. User selects "Hele teamet" → All workspace shifts render.
2. User taps "Ansatt ▾" → Dropdown shows full staff list (identical to me-scope case).
3. User picks "Erik" → Shift list filters to Erik's published shifts for the week.
4. User taps "Avdeling ▾ → Bar" → scope changes to `{ kind: "dept", value: "bar" }`; staff dropdown remains populated (no re-fetch).

**Postcondition:** Scope transitions never empty the dropdown.

**Error paths:** Same fail-fast behavior as journey 1.

## Journey: Vaktliste renders team shifts for the week

**Precondition:** Workspace has ≥ 1 published shift in current week. Mobile PWA signed in. Scope = "Hele teamet".

1. User opens Vakter tab → System fetches via `useTeamShifts(weekStart, scope=all)` → Shifts grouped by date render in 7 DayCrewCluster cards.
2. User selects "Mine vakter" → List filters to own published shifts; days without own shifts render "Ingen vakter".

**Postcondition:** Each shift row shows role, time, dept color, owner avatar.

**Error paths:**
- DB join `position → department` previously selected `id` (which does not exist on `department` — the PK is `department_id`). PostgREST returned empty `data`; vaktliste rendered empty for the whole team. FIXED: select `department_id` instead.
- Network failure → "Kunne ikke laste vakter. Prøv igjen." error card. Loading skeleton during fetch.

## Journey: Tap a shift to open its detail screen

**Precondition:** User signed in on mobile PWA. Vaktliste OR kalender renders ≥ 1 shift.

1. From Vaktliste: user taps a shift row → System calls `router.push("/(app)/(shifts)/[id]", { id })` → Shift detail screen mounts with full data + tabs (Detaljer / Oppgaver / Emma) + bottom action bar.
2. From Kalender: user taps a shift card OR a shift item in the list → Same navigation (id stripped of `shift-` prefix before push).
3. From Kalender: user taps a non-shift item (task / booking / deviation / note) → DetailSheet drawer opens with item context.

**Postcondition:** Shift items always reach the dedicated detail screen; non-shift items always open the drawer. No "Phase 3e — TODO" no-op silence.

**Error paths:** Invalid shift id → `if (!shift)` branch renders "Vakt ikke funnet" with back button.

## Journey: Confirm a shift end-to-end

**Precondition:** Shift detail screen loaded; shift not yet confirmed (`confirmed_at IS NULL`).

1. User taps "Bekreft vakt" → `handleConfirm` calls `enqueue("confirm_shift", { schedule_shift_id })` → Sync queue dispatches `actionMap.confirm_shift` → PATCH `/api/mobile/shifts/[id]/confirm` (Bearer JWT, empty body).
2. BFF validates: path param is UUID, body strict-empty (per ADR-0151 no client-supplied identity), `resolveMobileActor` resolves from JWT.
3. `confirmShiftAction(shiftId, actor, "system")` loads row, fail-fast on workspace mismatch (L-0177), gates via `schedule.confirm_shift` (suggest level), UPDATEs `confirmed_at = now()` + `confirmed_by = actor.profileId`.
4. Telemetry `emit({ event: "shift confirmed", ... })` routes to PostHog + `activity_trail` + `engine_event` per ADR-0134. `nonEmpty()` guards on workspace_id + actor_id.
5. Client setQueryData optimistic update; haptic success.

**Postcondition:** Shift row in DB has `confirmed_at` + `confirmed_by`; activity_trail has one `shift confirmed` row keyed to the actor; PWA re-renders detail screen without the "Bekreft vakt" button.

**Error paths:**
- Mobile PWA cross-origin → web BFF: without CORS headers on `/api/mobile/*`, browser rejects preflight; fetch throws "Failed to fetch". FIXED: `apps/web/next.config.ts` `headers()` block sets Allow-Origin / Methods / Headers; dev=*, prod=`https://m.smartout.ai`.
- Zod strict schema previously rejected `confirmed_at` / `confirmed_by` on the client-side payload (sync queue validation). FIXED: removed both from `enqueue` call; server resolves them per L-0177.
- Bottombar previously fit Bekreft + Bytt + Stemple inn in one row; "Stemple inn" clipped. FIXED: 2-row layout (secondary actions flex:1 on top, primary CTA full-width below).
- BFF down (port 3060) → "Failed to fetch". Operator must run `op run --env-file=.env.template -- pnpm --filter web dev` alongside `pnpm --filter mobile dev`.

## Journey: Close the DetailSheet drawer

**Precondition:** Kalender DetailSheet open over a task / booking / deviation / note item.

1. User taps X in header OR Lukk button in footer → `requestClose()` calls `sheetRef.current?.close()` → @gorhom BottomSheet animates down.
2. After animation settles, BottomSheet fires `onClose` → `handleClose` clears `item` state.

**Postcondition:** Sheet visually closed; item null; backdrop removed.

**Error paths:**
- Previously: Lukk handlers ran only state cleanup (`setItem(null)`) without calling `.close()` on the sheet ref; @gorhom requires the ref method for animation. Sheet "closed" via re-render mount/unmount — visually it never moved. FIXED: introduced `requestClose` separate from `handleClose`; both X and footer Lukk use `requestClose`.
