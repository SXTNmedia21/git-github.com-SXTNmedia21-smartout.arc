# Tidslinje Journey Drafts — Source for P10 Sortie 3 Task 21

> **Purpose:** Spec source for the 5 journey files that Task 21 of `2026-05-23-tidslinje-tab-day-control-panel.md` materializes into `docs/journeys/JOURNEY-tidslinje-*.md`. Each section below = body of one journey file. Wrap each with the canonical frontmatter (title/status/created/updated/module/tags) when copying.

---

## File 1: `docs/journeys/JOURNEY-tidslinje-manager-plan-tomorrow.md`

**Frontmatter:**
```yaml
title: "Journey: Manager planlegger morgendagen kvelden før"
status: draft
created: 2026-05-23
updated: 2026-05-23
module: day-session
tags: [journey, tidslinje, day-control-panel, p10, manager, planning]
```

**Body:**

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

---

## File 2: `docs/journeys/JOURNEY-tidslinje-manager-live-status.md`

**Frontmatter:**
```yaml
title: "Journey: Manager sjekker live-status under lunsj-rush"
status: draft
created: 2026-05-23
updated: 2026-05-23
module: day-session
tags: [journey, tidslinje, day-control-panel, p10, manager, live-status]
```

**Body:**

# Journey: Manager sjekker live-status under lunsj-rush

**Precondition:** `department_session.status = 'active'`. Vakter check'et inn. Minst 1 `session_task` pågående.

1. Klokken 12:15. Manager på gulvet hører klage fra gjest → drar opp app, klikker dato i header → DayControlPanel åpnes → klikker **Tidslinje**
2. System renderer liste m/ live-status-dots per item:
   - 🟢 grønn = pågående/ferdig på tid
   - 🟡 gul = nær deadline
   - 🔴 rød = overdue/ikke startet
3. Manager ser `Prep grønnsaker 11:30 🔴 OVERDUE — ingen tildelt` + `Lunsj-vakt 10:30 🟢 Kari sjekket inn 10:28`
4. Manager klikker `Prep` rad → EntityDrawer åpnes m/ task-detalj (inherited fra DashboardShell globalt) → Manager tildeler `Per` → System ruter via `task.assign` capability → emit `task.assigned` → live-status oppdateres 🟡
5. Manager ser nederste linje: "1 åpen vakt 14:00 — Bar" → klikker linje → SlotPicker åpnes → Manager velger eksisterende ansatt fra liste → System ruter via `schedule.assign_employee` → vakt nå tildelt
6. Manager lukker panel → går tilbake til gulv

**Postcondition:** Live tidslinje viser current truth. Alle re-assignments gjennom gated tools. `activity_trail` logger hver action med `actor_id=manager`.

**Error paths:**
- Live-status drift (read-after-write inconsistency) → 5s polling via TanStack `staleTime` + WebSocket fallback (engine_event subscription) → user ser stale dot maks 5s
- Ansatt allerede fullbooket → gate_action DENY → modal "Per har konflikt: vakt 13-17 Sal" + foreslå alternativ
- Panel åpnes for dato uten session → "Ingen session for denne dagen" CTA → `[+ Opprett session]` knapp

**V1 scope note (2026-05-23):** Live-status-dots (steg 2) krever utvidet status-derivation i `useDayTimelineEvents` — egen task i Sortie 2 hvis det er V1, ellers V2.

---

## File 3: `docs/journeys/JOURNEY-tidslinje-employee-mobile-mirror.md`

**Frontmatter:**
```yaml
title: "Journey: Ansatt sjekker hva som skjer i dag (mobile)"
status: draft
created: 2026-05-23
updated: 2026-05-23
module: day-session
tags: [journey, tidslinje, p10, employee, mobile, adr-0133]
```

**Body:**

# Journey: Ansatt sjekker hva som skjer i dag (mobile)

**Precondition:** Ansatt innlogget på mobile app. Aktiv vakt i dag.

1. Ansatt åpner Smartout mobile → tap `(me)` tab default → ser Min Dag (per ADR-0316)
2. Ansatt trykker `Se hele dagen →` link → mobile renderer Tidslinje-view (read-only mirror av Tidslinje-tab per mobile boundary ADR-0133: "execute, not author")
3. Ansatt ser hele dagens timeline kronologisk: hvem er på sal, hvem er på kjøkken, hvilke tasks som pågår, day_line-windows (åpningstid sal 10-22, kjøkken 11-22)
4. Ansatt ser egen vakt highlighted m/ chip "Du" + neste task hen er tildelt 🟡 "Cleaning 13:00"
5. Ansatt swiper tilbake → tar vakt-spesifikk handling

**Postcondition:** Ansatt har situasjonsforståelse. Ingen mutation skjedde (mobile = execute-side, ikke author).

**Error paths:**
- Offline → cached snapshot fra siste sync vises m/ banner "Offline — sist oppdatert 12:34"
- Ansatt prøver å trykke item de ikke eier → toast "Kun manager kan endre" + linje forblir uendret (ingen knapp i UI overhodet, men defense-in-depth)

**V1 scope note (2026-05-23):** Mobile-implementasjon er IKKE i P10-scope. Web-Tidslinje shipped P10; mobile mirror er separat sortie under mobile-campaign. Journey dokumenterer planlagt UX for fremtidig referanse.

---

## File 4: `docs/journeys/JOURNEY-tidslinje-manager-botsson-reschedule.md`

**Frontmatter:**
```yaml
title: "Journey: Manager re-planlegger etter avbestilling (Botsson assist)"
status: draft
created: 2026-05-23
updated: 2026-05-23
module: day-session
tags: [journey, tidslinje, day-control-panel, p10, manager, botsson, voice]
```

**Body:**

# Journey: Manager re-planlegger etter avbestilling (Botsson assist)

**Precondition:** Tidslinje-tab åpen. Botsson Orb passive (DayControlPanel deklarerer ikke `DomainChatOwnership`; Orb interaktiv per ADR-0238).

1. Avbestilling kommer på sms kl 11:00 (bord 8, 6 personer kl 19:00) → Manager åpner Tidslinje-tab
2. Manager trykker Orb og sier "Avbestilling kveld, fjern Per fra 18-vakta og flytt cleaning til 17:00"
3. Botsson leser pinned context (`pinDayControlPanelContextAction` ga den date + dept) → klassifiserer intent → kaller `schedule.unassign_employee(shift_id, profile_id=Per)` + `task.update_scheduled_at(task_id=cleaning, scheduled_at=17:00)`
4. Begge tools wrappes i `gatedMutation` per ADR-0204 → gate_action validerer → DB updates + emits
5. Tidslinje-tab rerender live (TanStack invalidation triggered av emit-bus) → Manager ser Per fjernet + cleaning på 17:00 + toast "2 endringer utført"
6. Botsson svarer "Per fjernet fra 18-vakta. Cleaning flyttet til 17:00. Per er nå tilgjengelig — vil du tilby ekstra-vakt et annet sted?"

**Postcondition:** 2 mutations via samme capability surface som DnD bruker (single pipeline preserved per Steward synthesis L-0338). `authority_config` tillot suggest-level uten ekstra confirm fordi manager-rolle + lav-risiko (mindre enn 2 timer endring).

**Error paths:**
- Botsson tolker feil ("flytt cleaning til 17:00" → 17:00 i morgen) → suggest-authority betyr Botsson foreslår + ber confirm → Manager kanselerer → ingen DB-write
- Tool ikke seedet i authority_config for denne rollen → gate_action DENY + Botsson sier "Trenger admin for denne handlingen"
- Channel-guard treffer (Orb i voice-modus prøver task-tool) → ADR-0078 double-guard rejecter → "Bruker chat for denne"

**V1 scope note (2026-05-23):** Steg 3 (`schedule.unassign_employee` + `task.update_scheduled_at`) er DEFERRED til capability-sortie (G19b). V1 kan demonstrere intent classification + suggest-confirm UX-flow med EKSISTERENDE tools (f.eks. `day-line.update_hours`). Full journey låses opp ved G19a/b/c closure.

---

## File 5: `docs/journeys/JOURNEY-tidslinje-manager-empty-day-bootstrap.md`

**Frontmatter:**
```yaml
title: "Journey: Manager åpner panel for tom dag (edge)"
status: draft
created: 2026-05-23
updated: 2026-05-23
module: day-session
tags: [journey, tidslinje, day-control-panel, p10, manager, bootstrap, edge-case]
```

**Body:**

# Journey: Manager åpner panel for tom dag (edge)

**Precondition:** Klikket dato uten `department_session`.

1. Manager klikker dato 3 uker fram → DayControlPanel åpner → klikker **Tidslinje**
2. System ser ingen `department_session` → renderer empty-state: "Ingen plan for denne dagen ennå" + `[+ Opprett dagsplan fra mal]` CTA
3. Manager trykker → SlotPicker viser tilgjengelige `timeline_template`-rader (week-day-templates) → velger `Standard mandag`
4. System ruter via `day-line.instantiate_template` (eksisterer, PASS Trust Gate) → oppretter `department_session` + `day_lines` + `session_hooks` + `session_tasks` atomært via delegation (ADR-0240/0356)
5. Tidslinje refresher → manager ser full struktur tom for assignments → kan begynne planlegging per Journey 1

**Postcondition:** Tom dag har struktur. Bootstrap-template ga D6 produksjons-skjelett uten å låse spesifikke ansatte.

**Error paths:**
- Template-versjon mismatch (template eldre enn nåværende `framework_rule`) → gate_action validerer + tilbyr "Bruk gammel mal" vs "Tilpass først"
- Ingen templates eksisterer → CTA viser i stedet "Sett opp dagsmal under Innstillinger →"

**V1 scope note (2026-05-23):** Steg 2-4 (empty-state + bootstrap CTA + template-instantiate) krever ny empty-state UI i TidslinjeTab. V1 kan ship med simpler empty-state ("Ingen aktivitet for valgte lokasjoner" — eksisterer per Task 17 i14n keys); template-bootstrap CTA i V2.

---

## Cross-references

When Task 21 runs, also update these existing files:
- `docs/journeys/0000-journey-log.md` — add 5 entries (one per file)
- `docs/domains/day-session/USER-FLOWS.md` — link the 5 journeys
- `docs/domains/day-session/E2E-COVERAGE.md` — note that E2E tests under `apps/web/e2e/tidslinje-tab/` cover Journeys 1 (steg 1-3) + 5 (empty state) at happy-path level

## Provenance

These journey drafts were generated live during the 2026-05-23 PM2 council session (Tidslinje surface boundary), as the response to Pontus's "konkretiser til journey-form" request. Saved here as Task 21 spec source.
