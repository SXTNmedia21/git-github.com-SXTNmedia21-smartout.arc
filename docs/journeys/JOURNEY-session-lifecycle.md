---
title: "Journey — session-lifecycle"
feature: session-lifecycle
status: verified
updated: 2026-04-20
created: 2026-04-20
module: operations
tags: [journey, session, lifecycle, daily-operation, admin]
---

# JOURNEY — daily-operation session-lifecycle

> 4 admin-journeys. Alle verifiserer Invariant #13 (no blockers, always navigable). Hver journey har precondition, happy path, postcondition og error path.

---

## J1 — Admin oppretter manuell session for i dag

**Precondition:**
- Admin logget inn på `/dashboard` (WebDayControl).
- Ingen `department_session` finnes for dagens dato + admin's active department (ingen automatisk opprettelse har skjedd).
- Admin har `session.open` capability i `engine_authority_config`.
- DateNavigator står på dagens dato.

**Happy path:**
1. WebDayControl laster → query returnerer 0 rader for `(department_id, date)` → System rendrer `NoSessionCTA` (dead-end erstattet med CTA) → Admin ser header "Ingen session ennå" med to knapper: "Opprett som planlagt" + "Åpne nå (aktiv)".
2. Admin klikker "Åpne nå (aktiv)" → System kjører `openSessionAction({ dateISO, departmentId, activateNow: true })` → Server Action finner ingen eksisterende rad → INSERT `department_session` med `status='active'` + `opened_at=now()`.
3. System emitter `session opened` via `packages/telemetry/src/registry.ts` med `manual=true` + actor_id + workspace_id → `activity_trail` + `engine_event` + PostHog + Logger mottar event.
4. TanStack query invalidates `["day-control", dateISO, departmentId]` → WebDayControl re-queryer → Admin ser PhaseBadge=Pågår + 7 tabs rendret (Overview / Roster / Tasks / Deviations / Messages / Handover / Approval).

**Postcondition:**
- `department_session` rad finnes med `status='active'`, `opened_at` satt, `manual_created=true` i metadata.
- `engine_event` har rad med `name='session opened'`, `payload.manual=true`.
- WebDayControl rendrer full day-control-flate.

**Error path:**
- **Mangler capability:** Admin uten `session.open` scope → CTA skjules helt + viser "Kontakt eier for å åpne session"-hint (C4 gate via `engine_authority_config`).
- **Server Action rejecter:** RLS-feil eller nettverksfeil → toast "Kunne ikke opprette session, prøv igjen" → CTA re-enables → ingen emit.
- **Duplikat-forsøk:** Admin klikker to ganger før første response → idempotent pattern (find-then-insert) → andre call returnerer eksisterende session uten å emit → toast "Session finnes allerede".

---

## J2 — Admin oppretter retroaktiv session 2 dager tilbake

**Precondition:**
- Admin på WebDayControl. DateNavigator viser dagens dato.
- Admin har `session.open` capability.
- Ingen session finnes for `today - 2` dager for admin's active department.

**Happy path:**
1. Admin klikker venstre-chevron i DateNavigator to ganger → `dateISO` state oppdateres til `today - 2` → "Tilbake til i dag"-knapp rendres (bare synlig når ikke på dagens dato).
2. Query re-kjører med ny dateISO → 0 rader returnert → `NoSessionCTA` rendres.
3. Admin klikker "Opprett som planlagt" → System kjører `openSessionAction({ dateISO: '2026-04-18', departmentId, activateNow: false })` → INSERT `department_session` med `status='upcoming'` + `opened_at=null`.
4. System emitter `session opened` med `manual=true` + `date != today` → activity_trail tagget retroaktiv.
5. Query invalidates → PhaseBadge=Starter snart + 7 tabs rendret → Admin kan nå manuelt transition til active/closed via SessionActionsBar (se J4).

**Postcondition:**
- `department_session` rad for historisk dato med `status='upcoming'`.
- Admin kan navigere tilbake til dagens dato via "Tilbake til i dag"-knapp.

**Error path:**
- **Fremtidig dato:** Admin navigerer høyre-chevron forbi dagens dato → ingen spesiell sperre i UI (fremtidig sessions er lovlige for forhåndsplanlegging), men C4 kan gate via `session.open` scope med `allow_future=false`-check. Dokumentert som follow-up FU-1.
- **Nettverksfeil:** Server Action feiler → toast + CTA re-enables, query rollbacks eventuell optimistic update.
- **Dato utenfor workspace retention:** >90 dager tilbake → Zod refine rejecter i Server Action → toast "Dato for langt tilbake for manuell opprettelse".

---

## J3 — Admin legger inn retroaktiv punch for shift uten tid

**Precondition:**
- Admin i detail-view for en closed `department_session` (via J1/J2 eller automatisk opprettet).
- Minst én `schedule_shift` finnes for dagen uten tilhørende `timesheet.time_entry` (shift ble aldri stemplet inn/ut).
- Admin har `shift.manual_time_entry` capability.
- Admin på RosterTab.

**Happy path:**
1. Admin går til RosterTab → ser tabellrad med ansatt-navn + shift-metadata + punch_in/punch_out felter som viser "—" (ingen time_entry).
2. Raden har inline Pencil-knapp (lucide) → Admin klikker → `ManualTimeEntryDialog` åpner som AlertDialog.
3. Admin fyller `punch_in` via `<input type="datetime-local">` → `punch_out` via samme → `reason` textarea (Zod: min 8 tegn) → "Bekreft"-knapp enabled når alle validations pass.
4. Admin trykker "Bekreft" → System kjører `manualTimeEntryAction({ shiftId, punchIn, punchOut, reason })` → Server Action kjører find-then-update-or-insert mot `timesheet.time_entry` (ingen UNIQUE på shift_id, så ingen upsert).
5. System emitter `shift punched_in` via registry med `manual=true` + `reason` i payload → `activity_trail` + `engine_event` oppdatert.
6. Query invalidates `["time-entries", shiftId]`, `["roster", sessionId]`, `["shift-approvals", dateISO]`, `["day-control", dateISO, departmentId]`, `["roster", dateISO]` → Dialog lukker + raden i RosterTab oppdateres med nye tidspunkter.

**Postcondition:**
- `timesheet.time_entry` har rad med `shift_id`, `punch_in`, `punch_out`, `notes=reason`, `manual=true`.
- `engine_event` har `shift punched_in` med manual-flag.
- RosterTab viser tidspunktene i stedet for "—".

**Error path:**
- **Reason < 8 tegn:** Zod refine feiler client-side → "Bekreft" disabled + hint "Minst 8 tegn for revisjonsspor".
- **punch_out før punch_in:** Zod refine `.refine((data) => data.punchOut > data.punchIn)` feiler → felt-nivå feilmelding.
- **Duplikat shift_id:** time_entry finnes allerede → find-then-update-or-insert pattern kjører `.update()` i stedet for `.insert()` (idempotent). Toast "Tidspunkter oppdatert".
- **Mangler capability:** Pencil-knapp skjules helt + RosterTab viser "Kun lesevisning"-hint.
- **Concurrent modification:** Annen admin har allerede editert → 409 + refetch + toast "Raden ble oppdatert av Pontus 09:47, last inn på nytt".

---

## J4 — Admin overstyrer session-transisjon

**Precondition:**
- Admin i detail-view for en `department_session` med `status='upcoming'`.
- Admin har `session.transition` capability (ikke nødvendigvis `session.signoff`).
- `SessionActionsBar` rendrer i header-området av WebDayControl.
- `LEGAL_TRANSITIONS` mapper `upcoming → [active, missed]`.

**Happy path:**
1. Admin ser SessionActionsBar med to knapper: "Åpne" (target=active) + "Markér som uteblitt" (target=missed) — begge gyldige per LEGAL-mapet. Illegal transitions (f.eks. active/closed) vises ikke.
2. Admin klikker "Åpne" → System kjører `transitionSessionAction({ sessionId, target: 'active' })` → Server Action C4-gater på `session.transition` → UPDATE `department_session` SET `status='active'`, `opened_at=COALESCE(opened_at, now())`.
3. System emitter `session opened` via registry med `manual=true` + `from_status='upcoming'` + `to_status='active'` → fire destinations mottar.
4. Query invalidates → PhaseBadge fader fra Starter snart → Pågår (Framer spring) → SessionActionsBar re-render med nye lovlige transitions (`active → [closed, missed]`).

**Postcondition:**
- `department_session.status='active'`, `opened_at` satt hvis ikke var før.
- `engine_event` har `session opened` med from/to-status.
- SessionActionsBar viser nye lovlige neste-transitions.

**Error path:**
- **Illegal transisjon:** Admin prøver aldri direkte (ikke i UI-mapet), men om request konstrueres manuelt → Server Action Zod rejecter + ingen mutasjon.
- **Mangler `session.signoff` for target=closed:** Knapp "Godkjenn oppgjør" skjules i SessionActionsBar fordi `transitionSessionAction` er dual-gated (target=closed krever både `session.transition` OG `session.signoff`) → Admin må ha begge capabilities.
- **Concurrent modification:** Annen admin har allerede transitioned → 409 + refetch + toast "Session er allerede aktiv (transitioned av Pontus 09:47)".
- **Server Action rejecter:** Nettverksfeil eller RLS → toast + knapp re-enables → ingen state-endring.

---

## Cross-cutting — Invariant #13 discipline

Alle fire journeys demonstrerer no-blockers-prinsippet:

- **J1 + J2** — Manuell session-creation erstatter dead-end "Ingen session"-tilstand med CTA. Admin navigerer fritt i dato og kan retroaktivt opprette sessions.
- **J3** — Retroaktiv tid-entry lukker gapet mellom planlagt shift og faktisk arbeidstid når punch-in ble glemt eller telefonen var død.
- **J4** — Manuell status-overstyring lar admin drive sessionen fremover selv om auto-transitioner feilet eller ikke fyrte.

Hver funksjon fjerner en potensiell dead-end. Empty-state = CTA. Ingen blockers mellom admin og sannheten.

**Grep-gate før close-feature:**

```bash
rg 'No session exists|Ingen session registrert|Cannot edit' \
   apps/web/src/components/day/NoSessionCTA.tsx \
   apps/web/src/components/day/SessionActionsBar.tsx \
   apps/web/src/components/day/DateNavigator.tsx \
   apps/web/src/components/day/roster/ManualTimeEntryDialog.tsx
```

Skal returnere 0 treff — ingen dead-end-tekst i UI. Alle empty-states rendrer CTA.

**C4 authority gates (alle manuelle handlinger):**

| Handling | Required capability |
|---|---|
| `openSessionAction` | `session.open` |
| `transitionSessionAction` (target ≠ closed) | `session.transition` |
| `transitionSessionAction` (target = closed) | `session.transition` + `session.signoff` |
| `manualTimeEntryAction` | `shift.manual_time_entry` |

Capability-seed migration: `supabase/migrations/20260420XXXX_seed_session_lifecycle_authority.sql` (Batch 2 commit `4852053a`).

Alle manuelle handlinger logger via `emit()` med `manual=true` i payload — QA-dashbord kan filtrere på manuell aktivitet for audit.
