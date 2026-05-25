---
title: "Journey: Manager planlegger morgendagen kvelden før"
status: verified
feature: p10-tidslinje-tab
created: 2026-05-23
updated: 2026-05-23
module: day-session
tags: [journey, tidslinje, day-control-panel, p10, manager, planning]
---

# Journey: Manager planlegger morgendagen kvelden før

**Precondition:** Manager innlogget. `department_session` for morgendag eksisterer (eller kan opprettes). Minst 2 locations + day_line-templates seedet.

1. Manager klikker dato i schedule-grid → System åpner DayControlPanel bottom-sheet → Manager ser 8 tabs (Oversikt, Dagsinfo, Reservasjoner, Oppgaver, **Tidslinje**, Budsjett, Bemanning, Økonomi)
2. Manager klikker **Tidslinje** → System pinner kontekst (`pinDayControlPanelContextAction` skriver til `engine_memory`, surface=`day_control_panel`) + emit `tidslinje_tab_opened` → Manager ser flat kronologisk liste m/ chip-bar `[Alle][Sal][Kjøkken][Bar]` på topp
3. Manager klikker `[Kjøkken]` chip → System filtrerer client-side (local useState, ikke URL) + emit `tidslinje_filter_changed` med filter_value=`<loc_id>` + active=true → Manager ser kun kjøkken-items
4. Manager drar `Lunsj-vakt 11:30` til `10:30`-slot → System ruter via stage-engine `schedule.reschedule_shift` capability (DEFERRED V2, se G19a) → gate_action validerer (RLS + workspace_id + role) → DB update + emit `shift.rescheduled` → Manager ser vakt på ny tid + toast "Lunsj flyttet til 10:30"
5. Manager dropper ny task `Prep grønnsaker 09:00` fra `[+ Ny linje]` drawer → System ruter via `task.create_session` (eksisterer, `scheduled_at` allerede støttet per ADR-0367) → DB insert + emit `task.created` → Liste oppdateres
6. Manager lukker panel (Esc/X) → Plan persistert

**Postcondition:** `schedule_shift` + `session_task` rader på nye tidspunkter, alle gjennom gated capability writes. `engine_memory` har pin slik at Botsson kan referere "morgendagen" i påfølgende dialog. `activity_trail` har 1 rad per re-time.

**Error paths:**
- Re-time bryter D3-regel (overtid/hviletid) → gate_action returnerer DENY → toast "Konflikt: bryter §10-8 hviletid 11 timer" + linje tilbake til original posisjon
- workspace_id resolveres ikke → L-0177 fail-fast throw → toast "Manglende kontekst, last på nytt"
- Capability tool feiler → Sentry-event + rollback + toast "Kunne ikke lagre, prøv igjen"

**V1 scope note (2026-05-23):** Steg 4+5 (DnD re-time + ny linje) er DEFERRED til separat capability-sortie. V1 av TidslinjeTab er read-only — steg 1+2+3+6 fungerer; steg 4+5 dokumentert her som planlagt UX.
