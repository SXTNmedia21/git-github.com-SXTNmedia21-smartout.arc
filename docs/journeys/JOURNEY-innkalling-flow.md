---
title: Innkalling — staff event flow
status: draft
updated: 2026-04-29
created: 2026-04-29
module: people
tags: [innkalling, staff-event, manager-flow]
---

# Journey — Innkalling

## Journey 1: Admin kaller inn én ansatt til utviklingssamtale

**Precondition:** Admin innlogget, på workspace med minst én aktiv ansatt.

1. Admin går til `/dashboard/people/invitations` → System viser "Innkalling"-side med tom liste eller eksisterende events → Admin ser "+ Ny innkalling"-knapp.
2. Admin klikker "+ Ny innkalling" → System åpner `StaffEventDialog` → Admin ser tom form med type-toggle.
3. Admin velger type "Utviklingssamtale" → System markerer toggle aktiv (orange ring).
4. Admin skriver tittel "1:1 Q2", melding "Forberede deg på neste kvartal", velger dato i morgen, 14:00-15:00 → System validerer ends_at > starts_at.
5. Admin søker opp og velger én ansatt i deltaker-multi-select → System viser valgt ansatt med chip.
6. Admin klikker "Send innkalling" → System inserter `staff_event` + 1 `staff_event_attendee` row → emit `staff_event.created` → toast "Innkalling sendt" → dialog lukker → liste oppdateres med ny rad øverst.

**Postcondition:** Event finnes i `staff_event`. Attendee-row med `status='invited'`. Activity_trail har entry. Engine_event har `staff_event.created` for downstream automation.

**Error paths:**
- Ingen deltakere valgt → submit-knapp disabled.
- ends_at <= starts_at → form-validering, toast "Sluttid må være etter starttid".
- RLS-violation (manager prøver å lage i annet workspace) → server action 403, toast "Ingen tilgang".

## Journey 2: Admin kaller inn flere ansatte til personalmøte

**Precondition:** Admin innlogget, workspace har 5+ aktive ansatte.

1. Admin åpner `/dashboard/people/invitations` → klikker "+ Ny innkalling".
2. Admin velger type "Personalmøte", tittel "Månedsmøte mai", melding tom, dato 1. mai, 09:00-10:30.
3. Admin søker "kjøkken" i deltaker-velger → System filtrerer ansatte → Admin haker av 4 ansatte → System viser 4 chips.
4. Admin klikker "Send innkalling" → System inserter 1 event + 4 attendee-rows i én transaksjon → toast "Innkalling sendt til 4" → liste oppdateres.

**Postcondition:** 1 event, 4 attendees alle `invited`.

**Error paths:**
- Transaksjon feiler midt i attendee-insert → rollback, toast "Kunne ikke lagre — prøv igjen", ingen partial state.

## Journey 3: Manager ser sine egne innkallinger

**Precondition:** Ansatt-bruker logget inn (ikke admin).

Phase 2 — ikke implementert i denne sortien. Kun listing + read er Phase 2. Phase 1 lager kun create-flow + admin-listing.

## Tabell-aksessmønster

- INSERT: `createStaffEvent` server action → derives `workspace_id` + `created_by` fra session.
- SELECT: server-fetch i `page.tsx`, filtrert på workspace_id.
- DELETE: senere phase.
