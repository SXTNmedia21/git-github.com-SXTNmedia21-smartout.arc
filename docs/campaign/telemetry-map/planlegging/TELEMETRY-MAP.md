---
title: Telemetry Map — planlegging (year-wheel / season calendar)
status: draft
updated: 2026-05-31
created: 2026-05-31
module: planlegging
tags: [telemetry, planlegging, season, calendar, booking, leave, year-wheel]
---

# Telemetry Map — planlegging domain

**Gate: FAIL** — 5 blockers (see control.json). Honest FAIL > fake PASS.

**Coverage:** 43/43 elements mapped. 16/29 required events exist in registry. 4/8 mutations have a real hook (season activate/archive are wired via use-season-tools.ts; the rest are toast-stubs or ungated writes).

---

## Design file index

| File                   | Responsibility                                                                                                              |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| planlegging.jsx        | Page shell — toolbar, view switching, filter/layer/saved-view dropdowns, CreateButton, Attention badge                      |
| planlegging-data.jsx   | Data layer only (PL namespace) — no interactive controls                                                                    |
| planlegging-panels.jsx | Slide-over panels: Detail (shift/booking/event/leave/season/pin/attention), BookingCreate, OpeningHours, Attention, BotCard |
| planlegging-season.jsx | SeasonPanel (4 tabs: Oversikt, Åpningstider, Mål, Hendelser) + MachineRoom overlay                                          |
| planlegging-views.jsx  | WeekView, MonthView, DayView, AgendaView, YearView                                                                          |

---

## Element catalogue

Legend — backend status: OK=hook exists | STUB=toast only, no hook | UNGATED=hook exists but no C4 gate | F0.x=blocked on named feature | NOOP=pure UI

### Toolbar — view segment (planlegging.jsx:117)

| ID    | Element              | Interaction                 | Proposed event                                  | Registry status | Backend         |
| ----- | -------------------- | --------------------------- | ----------------------------------------------- | --------------- | --------------- |
| PL-01 | View segment: Dag    | onClick → setView("day")    | `planlegging view_changed` {from, to: "day"}    | MISSING         | NOOP (UI state) |
| PL-02 | View segment: Uke    | onClick → setView("week")   | `planlegging view_changed` {from, to: "week"}   | MISSING         | NOOP            |
| PL-03 | View segment: Måned  | onClick → setView("month")  | `planlegging view_changed` {from, to: "month"}  | MISSING         | NOOP            |
| PL-04 | View segment: Agenda | onClick → setView("agenda") | `planlegging view_changed` {from, to: "agenda"} | MISSING         | NOOP            |
| PL-05 | View segment: År     | onClick → setView("year")   | `planlegging view_changed` {from, to: "year"}   | MISSING         | NOOP            |

### Toolbar — navigation (planlegging.jsx:120–124)

| ID    | Element       | Interaction         | Proposed event                                            | Registry status | Backend |
| ----- | ------------- | ------------------- | --------------------------------------------------------- | --------------- | ------- |
| PL-06 | Nav ← Forrige | onClick → nav(-1)   | `planlegging date_navigated` {direction: "back", view}    | MISSING         | NOOP    |
| PL-07 | Nav → Neste   | onClick → nav(1)    | `planlegging date_navigated` {direction: "forward", view} | MISSING         | NOOP    |
| PL-08 | I dag button  | onClick → goToday() | `planlegging today_clicked` {view}                        | MISSING         | NOOP    |

### Toolbar — Visninger dropdown (planlegging.jsx:128–139)

| ID    | Element               | Interaction                         | Proposed event                                                       | Registry status | Backend            |
| ----- | --------------------- | ----------------------------------- | -------------------------------------------------------------------- | --------------- | ------------------ |
| PL-09 | Saved view item (any) | onClick → applySaved(v)             | `planlegging saved_view_applied` {view_id, view_name, calendar_view} | MISSING         | NOOP (local state) |
| PL-10 | "Vis alt" reset       | onClick → reset show + setMenu null | `planlegging saved_view_applied` {view_id: "all"}                    | MISSING         | NOOP               |

### Toolbar — Lag dropdown (planlegging.jsx:142–157)

| ID    | Element                 | Interaction             | Proposed event                                             | Registry status | Backend |
| ----- | ----------------------- | ----------------------- | ---------------------------------------------------------- | --------------- | ------- |
| PL-11 | Layer toggle (any type) | onClick → toggleType(t) | `planlegging layer_toggled` {layer, enabled: bool}         | MISSING         | NOOP    |
| PL-12 | "Alle" layers           | onClick → show all      | `planlegging layer_toggled` {layer: "all", enabled: true}  | MISSING         | NOOP    |
| PL-13 | "Ingen" layers          | onClick → show none     | `planlegging layer_toggled` {layer: "all", enabled: false} | MISSING         | NOOP    |

### Toolbar — Filter dropdown (planlegging.jsx:160–175)

| ID    | Element                   | Interaction                       | Proposed event                                            | Registry status | Backend |
| ----- | ------------------------- | --------------------------------- | --------------------------------------------------------- | --------------- | ------- |
| PL-14 | Filter facet toggle (any) | onClick → toggleFilter(grp, val)  | `planlegging filter_applied` {group, value, active: bool} | MISSING         | NOOP    |
| PL-15 | Filter Nullstill          | onClick → setFilters(emptySets()) | `planlegging filter_reset` {}                             | MISSING         | NOOP    |
| PL-16 | Filter Ferdig             | onClick → setMenu(null)           | (dismiss — noop, no new data)                             | —               | NOOP    |

### Toolbar — Verktøy dropdown (planlegging.jsx:178–185)

| ID    | Element               | Interaction                  | Proposed event                                                                | Registry status | Backend           |
| ----- | --------------------- | ---------------------------- | ----------------------------------------------------------------------------- | --------------- | ----------------- |
| PL-17 | Åpningstider (tool)   | onClick → setHoursOpen(true) | `planlegging opening_hours_panel_opened` {}                                   | MISSING         | NOOP (panel open) |
| PL-18 | Årshjul (tool)        | onClick → setView("year")    | `planlegging view_changed` {from: current, to: "year", trigger: "tools_menu"} | MISSING         | NOOP              |
| PL-19 | Eksporter PDF         | onClick → toast              | `planlegging export_requested` {format: "pdf", view}                          | MISSING         | STUB              |
| PL-20 | Kalenderinnstillinger | onClick → toast              | `planlegging settings_opened` {}                                              | MISSING         | STUB              |

### Toolbar — Attention + CreateButton (planlegging.jsx:187–196)

| ID    | Element                | Interaction                            | Proposed event                                                               | Registry status | Backend            |
| ----- | ---------------------- | -------------------------------------- | ---------------------------------------------------------------------------- | --------------- | ------------------ |
| PL-21 | Attention badge button | onClick → setAttnOpen(true)            | `planlegging attention_panel_opened` {count}                                 | MISSING         | NOOP               |
| PL-22 | CreateButton: Booking  | onAction("Booking") → setBooking(slot) | `planlegging create_button_used` {entity: "booking"}                         | MISSING         | NOOP (opens panel) |
| PL-23 | CreateButton: Event    | onAction("Event") → toast              | `planlegging create_button_used` {entity: "event"}                           | MISSING         | STUB               |
| PL-24 | CreateButton: Vakt     | onAction("Vakt") → goRoute("vaktplan") | `planlegging cross_domain_navigate` {to: "vaktplan", trigger: "create_vakt"} | MISSING         | NOOP               |

### Panel — BookingCreatePanel (planlegging-panels.jsx:295–338)

| ID     | Element                | Interaction                 | Proposed event                                  | Registry status | Backend                 |
| ------ | ---------------------- | --------------------------- | ----------------------------------------------- | --------------- | ----------------------- |
| PL-25  | Opprett booking button | onClick → toast + onClose() | `booking created` {entity_type: "booking", ...} | **IN REGISTRY** | **STUB — no hook** (B2) |
| PL-26  | Booking type segopt    | onClick → setBtype(t)       | (local form state — noop)                       | —               | NOOP                    |
| PL-27  | Avdeling segopt        | onClick → setDep(d)         | (local form state — noop)                       | —               | NOOP                    |
| PL-28  | Starttid stepper ▲▼    | onClick → setSt(±1)         | (local form state — noop)                       | —               | NOOP                    |
| PL-28b | Gjester stepper ▲▼     | onClick → setGuests(±1)     | (local form state — noop)                       | —               | NOOP                    |

### Panel — DetailPanel: Shift (planlegging-panels.jsx:57–97)

| ID    | Element         | Interaction                   | Proposed event                                                                   | Registry status | Backend |
| ----- | --------------- | ----------------------------- | -------------------------------------------------------------------------------- | --------------- | ------- |
| PL-31 | Åpne i vaktplan | onClick → goRoute("vaktplan") | `planlegging cross_domain_navigate` {to: "vaktplan", entity: "shift", entity_id} | MISSING         | NOOP    |
| PL-32 | Rediger (shift) | onClick → toast               | `planlegging item_edit_opened` {entity: "shift", entity_id}                      | MISSING         | STUB    |

### Panel — DetailPanel: Booking (planlegging-panels.jsx:99–135)

| ID    | Element                     | Interaction            | Proposed event                                                | Registry status | Backend |
| ----- | --------------------------- | ---------------------- | ------------------------------------------------------------- | --------------- | ------- |
| PL-33 | Bekreft (booking pending)   | onClick → toast + undo | `booking confirmed` {entity_id}                               | MISSING         | STUB    |
| PL-34 | Endre (booking non-pending) | onClick → toast        | `planlegging item_edit_opened` {entity: "booking", entity_id} | MISSING         | STUB    |
| PL-35 | Avlys booking               | onClick → toast + undo | `booking cancelled` {entity_id}                               | MISSING         | STUB    |
| PL-36 | Ring (phone button)         | onClick → (phone link) | (browser/OS action — noop for telemetry)                      | —               | NOOP    |

### Panel — DetailPanel: Event (planlegging-panels.jsx:137–173)

| ID    | Element              | Interaction                   | Proposed event                                                        | Registry status | Backend |
| ----- | -------------------- | ----------------------------- | --------------------------------------------------------------------- | --------------- | ------- |
| PL-37 | Til vaktplan (event) | onClick → goRoute("vaktplan") | `planlegging cross_domain_navigate` {to: "vaktplan", entity: "event"} | MISSING         | NOOP    |
| PL-38 | Rediger event        | onClick → toast               | `planlegging item_edit_opened` {entity: "event"}                      | MISSING         | STUB    |

### Panel — DetailPanel: Leave (planlegging-panels.jsx:175–213)

| ID    | Element                  | Interaction            | Proposed event                                                        | Registry status | Backend                 |
| ----- | ------------------------ | ---------------------- | --------------------------------------------------------------------- | --------------- | ----------------------- |
| PL-29 | Godkjenn (leave pending) | onClick → toast + undo | `absence approved` {entity_id}                                        | **IN REGISTRY** | **STUB — no hook** (B3) |
| PL-30 | Avslå (leave pending)    | onClick → toast + undo | `absence rejected` {entity_id}                                        | **IN REGISTRY** | **STUB — no hook** (B3) |
| PL-39 | Til vaktplan (leave)     | onClick → goRoute      | `planlegging cross_domain_navigate` {to: "vaktplan", entity: "leave"} | MISSING         | NOOP                    |

### Panel — DetailPanel: Season (planlegging-panels.jsx:215–243)

| ID   | Element            | Interaction                   | Proposed event                                                         | Registry status | Backend |
| ---- | ------------------ | ----------------------------- | ---------------------------------------------------------------------- | --------------- | ------- |
| S-01 | Planlegg bemanning | onClick → goRoute("vaktplan") | `planlegging cross_domain_navigate` {to: "vaktplan", entity: "season"} | MISSING         | NOOP    |
| S-02 | Åpne i årshjul     | onClick → toast               | `season block_clicked` {season_name, year: 2026}                       | **IN REGISTRY** | STUB    |

### Panel — DetailPanel: Pin (planlegging-panels.jsx:246–263)

| ID   | Element        | Interaction     | Proposed event                                  | Registry status | Backend |
| ---- | -------------- | --------------- | ----------------------------------------------- | --------------- | ------- |
| S-03 | Åpne i årsplan | onClick → toast | `season pin_clicked` {iso, season_id, pin_kind} | **IN REGISTRY** | STUB    |

### Panel — AttentionPanel (planlegging-panels.jsx:384–413)

| ID    | Element                        | Interaction                             | Proposed event                                                  | Registry status | Backend |
| ----- | ------------------------------ | --------------------------------------- | --------------------------------------------------------------- | --------------- | ------- |
| PL-42 | Attention item click (list)    | onClick → onOpen({type:"attention",id}) | `planlegging attention_item_actioned` {sev, type, attention_id} | MISSING         | NOOP    |
| PL-43 | BotCard CTA (Lag tiltaksliste) | onClick → setState("done")              | `planlegging botsson_cta_clicked` {cta_label}                   | MISSING         | NOOP    |

### Panel — BotCard (planlegging-panels.jsx:22–43)

| ID    | Element                   | Interaction                              | Proposed event                                | Registry status | Backend            |
| ----- | ------------------------- | ---------------------------------------- | --------------------------------------------- | --------------- | ------------------ |
| BC-01 | BotCard CTA confirm       | onClick → setState("done") + onConfirm() | `planlegging botsson_cta_clicked` {cta_label} | MISSING         | varies per context |
| BC-02 | BotCard "Ikke nå" dismiss | onClick → setState("dismissed")          | `planlegging botsson_dismissed` {cta_label}   | MISSING         | NOOP               |

### Panel — OpeningHoursPanel (planlegging-panels.jsx:340–382)

| ID     | Element                   | Interaction               | Proposed event                                        | Registry status | Backend   |
| ------ | ------------------------- | ------------------------- | ----------------------------------------------------- | --------------- | --------- |
| PL-40  | Lagre (opening hours)     | onClick → toast + onClose | `planlegging opening_hours_saved` {changes_count}     | MISSING         | STUB (B5) |
| PL-41  | Legg til unntak           | onClick → toast           | `planlegging opening_hours_exception_added` {}        | MISSING         | STUB (B5) |
| PL-41b | Edit day button (per row) | onClick → toast           | `planlegging opening_hours_day_edit_opened` {weekday} | MISSING         | STUB      |

### SeasonPanel — Oversikt tab (planlegging-season.jsx:164–189)

| ID    | Element               | Interaction                                   | Proposed event                                     | Registry status | Backend                      |
| ----- | --------------------- | --------------------------------------------- | -------------------------------------------------- | --------------- | ---------------------------- |
| SP-01 | Aktiver sesong button | onClick → doActivate() → activateSeasonAction | `season activated`                                 | **IN REGISTRY** | **OK** (use-season-tools.ts) |
| SP-02 | Arkiver button        | onClick → doActivate() → archiveSeasonAction  | `season archived`                                  | **IN REGISTRY** | **OK** (use-season-tools.ts) |
| SP-03 | Machine Room (card)   | onClick → setMachine(true)                    | `planlegging machine_room_opened` {season_id}      | MISSING         | NOOP                         |
| SP-04 | Tab switch (any)      | onClick → setTab(k)                           | `season tab_changed` {tab_from, tab_to, season_id} | **IN REGISTRY** | NOOP                         |

### SeasonPanel — Åpningstider tab (planlegging-season.jsx:191–209)

| ID    | Element                 | Interaction     | Proposed event                               | Registry status | Backend |
| ----- | ----------------------- | --------------- | -------------------------------------------- | --------------- | ------- |
| SP-05 | Override for enkeltdato | onClick → toast | `season operating_hours_updated` {season_id} | **IN REGISTRY** | STUB    |

### SeasonPanel — Mål tab (planlegging-season.jsx:212–223)

| ID    | Element                   | Interaction               | Proposed event                                         | Registry status | Backend                 |
| ----- | ------------------------- | ------------------------- | ------------------------------------------------------ | --------------- | ----------------------- |
| SP-06 | Goal toggle (done/undone) | onClick → toggleGoal(gid) | `season goal_toggled` {season_id, goal_id, done: bool} | MISSING         | NOOP (local state only) |
| SP-07 | Nytt mål                  | onClick → toast           | `season_goal created` {season_id}                      | **IN REGISTRY** | STUB                    |

### SeasonPanel — footer buttons

| ID    | Element                            | Interaction                   | Proposed event                                                             | Registry status | Backend |
| ----- | ---------------------------------- | ----------------------------- | -------------------------------------------------------------------------- | --------------- | ------- |
| SP-08 | Planlegg bemanning (season footer) | onClick → goRoute("vaktplan") | `planlegging cross_domain_navigate` {to: "vaktplan", from: "season_panel"} | MISSING         | NOOP    |
| SP-09 | Machine Room (footer button)       | onClick → setMachine(true)    | `planlegging machine_room_opened` {season_id}                              | MISSING         | NOOP    |

### MachineRoom (planlegging-season.jsx:23–117)

| ID    | Element                | Interaction                       | Proposed event                                        | Registry status | Backend                                                             |
| ----- | ---------------------- | --------------------------------- | ----------------------------------------------------- | --------------- | ------------------------------------------------------------------- |
| MR-01 | BField: Inntektsmål    | onChange → setBudget              | (continuous — fire on blur/save only)                 | —               | NOOP until save                                                     |
| MR-02 | BField: Sesongfaktor   | onChange → setSeasonFactor        | (continuous)                                          | —               | NOOP until save                                                     |
| MR-03 | BField: Lønnsmål       | onChange → setLaborPct            | (continuous)                                          | —               | NOOP until save                                                     |
| MR-04 | Day factor inputs (7×) | onChange → setFactors             | (continuous)                                          | —               | NOOP until save                                                     |
| MR-05 | Hour bar click (24×)   | onClick → prompt + setHourFactors | `hour_factors updated` {season_budget_id, count: 24}  | **IN REGISTRY** | STUB                                                                |
| MR-10 | Lagre utkast           | onClick → toast                   | `season_budget updated` {season_id}                   | **IN REGISTRY** | STUB — no hook (would need season_budget upsert)                    |
| MR-11 | Propager til budsjett  | onClick → toast + onClose         | `workspace_budget updated` {period_type, period_date} | **IN REGISTRY** | **UNGATED** (use-budget.ts:103 direct upsert, no C4 gate — F0.3/B1) |

### Views — interaction targets

| ID   | Element                                     | Source                                   | Proposed event                                                                | Registry status | Backend            |
| ---- | ------------------------------------------- | ---------------------------------------- | ----------------------------------------------------------------------------- | --------------- | ------------------ |
| V-01 | WeekView: season band click                 | onOpen({type:"season",id})               | `season block_clicked` {season_name, year}                                    | **IN REGISTRY** | NOOP               |
| V-02 | WeekView: event bar click                   | onOpen(e)                                | `calendar item_viewed` {item_type:"booking"/"shift"}                          | **IN REGISTRY** | NOOP               |
| V-03 | WeekView: leave bar click                   | onOpen(l)                                | `calendar item_viewed` {item_type:"booking"}                                  | **IN REGISTRY** | NOOP               |
| V-04 | WeekView: timed block click (shift/booking) | onOpen(it)                               | `calendar item_viewed` {item_type}                                            | **IN REGISTRY** | NOOP               |
| V-05 | WeekView: column click (empty slot)         | onCreate({iso,wd,st}) → setBooking(slot) | `planlegging create_button_used` {entity:"booking", trigger:"calendar_click"} | MISSING         | NOOP (opens panel) |
| V-06 | MonthView: day cell click                   | onPickDay(iso) → setDayIdx/setView       | `planlegging date_navigated` {direction:"day_selected", iso}                  | MISSING         | NOOP               |
| V-07 | MonthView: item chip click                  | onOpen(it.raw)                           | `calendar item_viewed` {item_type}                                            | **IN REGISTRY** | NOOP               |
| V-08 | DayView: timed block click                  | onOpen(it)                               | `calendar item_viewed` {item_type}                                            | **IN REGISTRY** | NOOP               |
| V-09 | DayView: column click (empty slot)          | onCreate({iso,wd,st})                    | `planlegging create_button_used` {entity:"booking", trigger:"calendar_click"} | MISSING         | NOOP               |
| V-10 | DayView: event bar click                    | onOpen(e)                                | `calendar item_viewed` {item_type:"event"}                                    | **IN REGISTRY** | NOOP               |
| V-11 | DayView: leave bar click                    | onOpen(l)                                | `calendar item_viewed` {item_type:"leave"}                                    | **IN REGISTRY** | NOOP               |
| V-12 | DayView: attention callout click            | onOpen({type:"attention",id})            | `planlegging attention_item_actioned` {attention_id, sev}                     | MISSING         | NOOP               |
| V-13 | AgendaView: agenda item click               | onOpen(r.raw)                            | `calendar item_viewed` {item_type}                                            | **IN REGISTRY** | NOOP               |
| V-14 | YearView: month label click                 | onPickMonth(m) → setMonthM+setView       | `planlegging date_navigated` {direction:"month_selected", month}              | MISSING         | NOOP               |
| V-15 | YearView: year pin click                    | onOpen({type:"pin",id:p.iso})            | `season pin_clicked` {iso, season_id}                                         | **IN REGISTRY** | NOOP               |
| V-16 | YearView: season card click                 | onOpen({type:"season",id})               | `season block_clicked` {season_name, year}                                    | **IN REGISTRY** | NOOP               |

### Empty-state

| ID    | Element                 | Interaction        | Proposed event                                                                 | Registry status | Backend |
| ----- | ----------------------- | ------------------ | ------------------------------------------------------------------------------ | --------------- | ------- |
| ES-01 | "Vis alt" (empty state) | onClick → show all | `planlegging layer_toggled` {layer:"all", enabled:true, trigger:"empty_state"} | MISSING         | NOOP    |

---

## Registry coverage summary

| Event                                       | Registry                              | Hook / action                  |
| ------------------------------------------- | ------------------------------------- | ------------------------------ |
| `season activated`                          | IN REGISTRY                           | activateSeasonAction (OK)      |
| `season archived`                           | IN REGISTRY                           | archiveSeasonAction (OK)       |
| `season tab_changed`                        | IN REGISTRY                           | NOOP                           |
| `season block_clicked`                      | IN REGISTRY                           | NOOP                           |
| `season pin_clicked`                        | IN REGISTRY                           | NOOP                           |
| `season operating_hours_updated`            | IN REGISTRY                           | STUB                           |
| `season_goal created`                       | IN REGISTRY                           | STUB                           |
| `season_budget updated`                     | IN REGISTRY                           | STUB                           |
| `day_factors updated`                       | IN REGISTRY                           | STUB                           |
| `hour_factors updated`                      | IN REGISTRY                           | STUB                           |
| `booking created`                           | IN REGISTRY                           | STUB (no hook)                 |
| `absence approved`                          | IN REGISTRY                           | STUB (no hook)                 |
| `absence rejected`                          | IN REGISTRY                           | STUB (no hook)                 |
| `calendar item_viewed`                      | IN REGISTRY                           | NOOP                           |
| `workspace_budget updated`                  | IN REGISTRY                           | UNGATED (use-budget:103, F0.3) |
| `calendar view_changed`                     | IN REGISTRY (scope: different domain) | —                              |
| `planlegging view_changed`                  | MISSING                               | —                              |
| `planlegging layer_toggled`                 | MISSING                               | —                              |
| `planlegging saved_view_applied`            | MISSING                               | —                              |
| `planlegging filter_applied`                | MISSING                               | —                              |
| `planlegging filter_reset`                  | MISSING                               | —                              |
| `planlegging date_navigated`                | MISSING                               | —                              |
| `planlegging today_clicked`                 | MISSING                               | —                              |
| `planlegging attention_panel_opened`        | MISSING                               | —                              |
| `planlegging attention_item_actioned`       | MISSING                               | —                              |
| `planlegging opening_hours_saved`           | MISSING                               | —                              |
| `planlegging opening_hours_exception_added` | MISSING                               | —                              |
| `planlegging machine_room_opened`           | MISSING                               | —                              |
| `planlegging machine_room_draft_saved`      | MISSING                               | —                              |
| `booking confirmed`                         | MISSING                               | —                              |
| `booking cancelled`                         | MISSING                               | —                              |
| `season goal_toggled`                       | MISSING                               | —                              |
| `season operating_hours_override_added`     | MISSING                               | —                              |
| `planlegging create_button_used`            | MISSING                               | —                              |
| `planlegging botsson_cta_clicked`           | MISSING                               | —                              |
| `planlegging botsson_dismissed`             | MISSING                               | —                              |
| `planlegging cross_domain_navigate`         | MISSING                               | —                              |
| `planlegging empty_state_show_all_clicked`  | MISSING                               | —                              |
| `booking machine_room_propagated`           | MISSING                               | —                              |
