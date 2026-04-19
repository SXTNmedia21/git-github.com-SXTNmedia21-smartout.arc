---
title: "Dag-informasjon — Designspec for alle komponenter (Web + Mobil)"
id: DESIGN_DAY_INFORMATION_2026_04_19
version: "1.0"
status: draft
layer: spec
created: 2026-04-19
updated: 2026-04-19
author: pontus + claude
supersedes: []
depends_on:
  - ADR-0095
  - ADR-0113
  - ADR-0115
  - ADR-0133
  - ADR-0134
  - DESIGN_YEAR_WHEEL_2026_04_19
  - DESIGN_RECON_2026_04_19
tags:
  - spec
  - day-information
  - department-session
  - shift-lifecycle
  - nordic-split
  - mobile
  - ux
module: scheduling
---

# Dag-informasjon — Helhetlig Designspec

> Komplett designspec for alle komponenter som viser og redigerer informasjon om én enkelt dag. Dekker web (day-control panel, reconciliation, shift-clock, year-wheel day factors, cost dashboard) og mobil (I dag, shift-clock, task feed, shifts, dagsinfo, deviation).
> **Mental modell:** Dagen er en `department_session`. Alt annet — vakter, oppgaver, hooks, budsjett, oppgjør, events, avvik — er lag på toppen.
> **Designramme:** Nordic Split (OKLCH warm, Instrument Serif, spring-motion).

---

## 0. TL;DR

- **Dagen er ikke en dato. Dagen er en session.** `department_session` er kanonisk dag-container, én per avdeling per dato.
- **Fire faser i alle dag-flater:** `upcoming → active → pending_signoff → closed` (eller `missed`). Alle komponenter status-koder visuelt.
- **Tre roller, samme data, forskjellig lys:** ansatt ser mine ting, leder ser teamet, admin ser summen. Komponenter er delte; filter og fokus skiller.
- **Mobil = utøvelse. Web = orkestrering.** Mobil: punch, oppgaver, avvik, sluttføring (D6). Web: KPI-oversikt, endring av bemanning, oppgjør, godkjenning (D1–D4 + C1+C4).
- **10 kanoniske dag-widgeter:** SessionHeader, PhaseTimeline, ShiftCard, TaskRow, HookTile, KpiTile, DeviationCard, BroadcastComposer, SignoffPanel, ReconSummary. Alle lever i `packages/ui` eller `packages/day` for mobil-parity.
- **24-timers, norsk locale, "I dag/i morgen/i går"**-labels. Ingen tidssoner i UI (alt er workspace-lokal).
- **Nordic Split-tokens overalt.** Status-farger er semantiske (success/warning/destructive/muted), ikke hardkodede hex.

---

## 1. Designprinsipper

1. **Én sannhet per dag — session er sannheten.** Alle dag-visninger leser fra `department_session` (+ tilknyttede tabeller). Aldri parallelle sannheter.
2. **Faser er kognitiv ramme.** Bruker tenker i "før vakten / under vakten / etter vakten / oppgjøret er gjort". Visuelt skal faser være tydelige, ikke skjulte i statuskoder.
3. **Read vs. write, aldri blandet.** En kort som viser KPI er ikke samtidig en knapp. Redigering skjer i eksplisitt modus (edit-toggle, drawer, sheet).
4. **Tetthet med luft.** Dag-informasjon er datadrevet — mange tall, oppgaver, navn. Løs med hierarkisk typografi, ikke bokser. Bruk monospace for tall.
5. **Idempotent handling.** Alle dag-mutasjoner (punch, complete task, approve, sign off) er idempotente. Dobbel-klikk skader ikke.
6. **Rask, ikke rask-følende.** Optimistic UI for punch og task-complete. Server-sync i bakgrunnen. Feil ruller tilbake med klar melding.
7. **Delt komponentbibliotek.** Samme `ShiftCard` brukes på web og mobil, med responsiv dimensjonering. Ingen platform-fork med mindre nødvendig.
8. **Stille når det ikke er noe.** Ingen "coming soon"-placeholders. Tomme dager vises som "Ingen vakter planlagt" med enkel, vennlig tone.
9. **Rolle-lys, ikke rolle-fork.** Samme komponent; filtrering + default-fokus gir riktig visning per rolle.
10. **Nordic Split, 40%-reduksjon.** Luft og typografi, ikke bokser på bokser.

---

## 2. Mental modell — Session er dagen

### 2.1 Kanonisk dag-container

```
department_session  (én per avdeling per dato)
   │
   ├── session_hook[]       (tidstrigger for prosedyrer)
   │     └── session_task[]  (faktiske oppgaver å gjøre)
   │
   ├── schedule_shift[]     (ansatte som jobber)
   │     └── time_entry[]    (punch-inn/ut data)
   │
   ├── deviation[]          (avvik rapportert i løpet av dagen)
   │
   ├── broadcast[]          (meldinger sendt til teamet)
   │
   └── daily_reconciliation  (oppgjør — slutt av dag)
         ├── revenue_totals
         ├── shift_approval[]
         └── deviation_resolution[]
```

Alt dag-scoped data knytter seg til session. Session er den eneste dag-entiteten som har sin egen status-maskin.

### 2.2 Hvorfor session er roten (ikke dato)

- Dato er bare en tidskoordinat. Det er ingenting å redigere på en dato.
- Session har status, eier, åpnings-/lukketid, tilstand. Den er redigerbar og auditert.
- Én workspace kan ha flere samtidige sessions på samme dato (én per avdeling). Dato alene er ikke spesifikk nok.

### 2.3 Hva er _ikke_ på session

- `planning_event` (D4) — lever på `planning_cycle`, ikke session. Påvirker session via demand multiplier, men er ikke barn.
- `workspace_budget` for dagen — beregnet fra season_budget + factors, ikke eid av session.
- `public_holiday` — K1a platform-data, read-only på session.

---

## 3. Informasjonsarkitektur — hvor bor dag-informasjon

### 3.1 Web-flater

| Flate | Rute | Primær bruker | Dag-fokus |
| --- | --- | --- | --- |
| Schedule / Day Control | `/dashboard/schedule` → klikk på dag-celle | Leder, admin | Full orkestrering: KPI, timeline, bemanning, budsjett, broadcast |
| Reconciliation | `/dashboard/reconciliation/[date]` | Admin, finans | Oppgjør: inntekt, lønn, avvik-resolusjon, lås |
| Shift Clock | `/dashboard/shift-clock` | Ansatt (web), leder-overview | Live stempling: aktiv vakt, pauser, oppgaver |
| Cost Dashboard | `/dashboard/cost` | Admin | KPI-rollup: dagsvis kostnad, arbeidstid |
| Year Wheel — Day Factors | `/dashboard/year-wheel` (Machine Room) | Admin | Planlegging: ukedag-vekter (ikke spesifikk dag) |

### 3.2 Mobil-flater

| Flate | Rute | Primær bruker | Dag-fokus |
| --- | --- | --- | --- |
| Home / I dag | `/(app)/(home)/` | Ansatt | Fase-basert: før / under / etter vakt |
| Shifts | `/(app)/(shifts)/` | Ansatt | Ukentlig vakt-oversikt, dagens uthevet |
| Shift Detail | `/(app)/(shifts)/[id]` | Ansatt | Enkelt vakt (tid, rolle, lokasjon, kolleger) |
| Shift Clock | del av Home | Ansatt | Punch + pause + tips |
| Task Feed | del av Home (During) | Ansatt | Dagens oppgaver sortert etter prioritet |
| Dagsinfo (create) | Sheet fra Home eller Shifts | Ansatt, leder | Lag note/alert/event |
| Deviation | `/(app)/(home)/deviation` | Ansatt | Rapportér avvik |

### 3.3 Delingslinje (ADR-0133)

Web eier: oppgjør, KPI-overvåking, endring av bemanning, godkjenning, broadcast.
Mobil eier: punch, oppgave-utførelse, avvik-rapportering, bekreftelse av arbeidstimer (C4 ansatt-signoff).

---

## 4. Session lifecycle — tilstandsmaskin

### 4.1 Faser

```
           auto-create             open()                signoff()
 (null) ─────────────▶  upcoming ──────────▶  active ───────────────▶  pending_signoff
                            │                    │                           │
                            │ planned_open +     │                           │ approve()
                            │ grace_period       │                           ▼
                            ▼                    ▼                        closed
                          missed            (no open event)                  │
                                                                             │ lock()
                                                                             ▼
                                                                          locked
```

### 4.2 Fase-beskrivelser

| Fase | Betydning | Hvem eier |
| --- | --- | --- |
| `upcoming` | Sesjonen er planlagt men ikke startet. Oppgaver er opprettet men ikke aktive. | Auto-opprettet ved I1 bootstrap / schedule publish |
| `active` | Sesjonen kjører. Punch er mulig, oppgaver utføres, hooks fyrer. | Ansvarlig leder på vakt |
| `pending_signoff` | Siste operatør har lukket. Venter på admin-oppgjør. | Ansatt (stempler ut siste) |
| `closed` | Dagen er ferdig operativt. Oppgjør kan gjøres, men ikke ennå låst. | Admin |
| `missed` | Sesjonen ble aldri åpnet innen grace-perioden. | System (cron) |
| `locked` | Oppgjør godkjent og låst. Read-only permanent. | Admin/finans |

### 4.3 Visuell konsekvens per fase

Hver komponent MÅ vise fase eksplisitt:

| Fase | Badge-farge | Ikon | Header-tekst |
| --- | --- | --- | --- |
| upcoming | `bg-muted text-muted-foreground` | `Clock` | "Starter {relative_time}" |
| active | `bg-success/10 text-success` + pulse | `Zap` | "Pågår — {elapsed}" |
| pending_signoff | `bg-warning/10 text-warning` | `CheckCircle2` | "Venter på oppgjør" |
| closed | `bg-muted text-muted-foreground` | `Archive` | "Stengt — {time}" |
| missed | `bg-destructive/10 text-destructive` | `AlertCircle` | "Ikke åpnet" |
| locked | `bg-primary/10 text-primary` | `Lock` | "Låst {date}" |

### 4.4 Auto-transisjoner

- `upcoming → missed`: hvis `now() > planned_open + grace_period (15min default)` uten `opened_at`.
- `upcoming → active`: når første punch eller manuell åpning.
- `active → pending_signoff`: når siste vakt-ansatt punchet ut ELLER manuell lukking.
- `pending_signoff → closed`: admin approve-action.
- `closed → locked`: admin lock-action (irreversibel uten ADR-prosess).

---

## 5. Kanonisk komponent-bibliotek

Alle dag-komponenter lever i `packages/day` (ny, foreslått) eller eksisterende `packages/ui` med day-prefix. Dette sikrer **mobil-parity fra dag én** per ADR-0133.

### 5.1 Ti kanoniske widgeter

| # | Komponent | Formål | Web | Mobil |
| --- | --- | --- | --- | --- |
| 1 | `SessionHeader` | Dato + fase-badge + åpnings-/lukketider + rask-status | ✅ | ✅ |
| 2 | `PhaseTimeline` | Horisontal linje med hooks og pågått-indikator | ✅ | ✅ (kondensert) |
| 3 | `ShiftCard` | Individuell vakt: tid, rolle, navn, status | ✅ | ✅ |
| 4 | `TaskRow` | Enkeltoppgave: tittel, eier, status, evidence-ikon | ✅ | ✅ |
| 5 | `HookTile` | Tidstrigger-container med oppgavene under | ✅ | ✅ |
| 6 | `KpiTile` | Enkelt KPI: label, verdi, variance, trend | ✅ | ✅ (mindre) |
| 7 | `DeviationCard` | Avvik: type, beskrivelse, status, bilder | ✅ | ✅ |
| 8 | `BroadcastComposer` | Send melding til teamet | ✅ | ❌ (leder-only, web) |
| 9 | `SignoffPanel` | Avslutnings-form: notater, bekreft, signer | ✅ | ✅ |
| 10 | `ReconSummary` | Oppgjørs-sammendrag: omsetning, lønn, margin | ✅ | ❌ (read-only i mobil) |

### 5.2 Komponent-detaljer

#### 5.2.1 `SessionHeader`

```
┌──────────────────────────────────────────────────────────┐
│  MANDAG 19. APRIL   ●Pågår — 3t 12m                      │
│  Kjøkken · Café Skuta                                    │
│  11:00 — 23:00  (planlagt)  ·  åpnet 10:58                │
└──────────────────────────────────────────────────────────┘
```

Props:
- `session: DepartmentSession`
- `variant: "full" | "compact"` — full på side-header, compact i lister

Visuell hierarki:
- Dato: `font-heading text-2xl` (Instrument Serif), kapitaler
- Fase-badge: høyre, `font-sans text-xs font-medium uppercase tracking-wide`
- Lokasjon: `font-sans text-sm text-muted-foreground`
- Tider: `font-mono text-sm`

#### 5.2.2 `PhaseTimeline`

```
10:00 ──○── 11:00 [●pre-open] 11:30 [●open] ...... 22:30 [●pre-close] 23:00 ──○──
             │                                                        │
             └── Sesjons-vindu ──────────────────────────────────────┘
                          ▲
                          └─ markør for "nå"
```

Viser session-vindu som horisontal stav, hooks som prikker på staven, "nå"-markør som vertikal linje. Oppgaver per hook tilgjengelig via klikk.

Props:
- `session: DepartmentSession`
- `hooks: SessionHook[]`
- `onHookClick?: (hook) => void`
- `density: "dense" | "sparse"` — dense for mobil, sparse for web

Mobil-variant: vertikal i stedet for horisontal (plass-økonomi).

#### 5.2.3 `ShiftCard`

```
┌────────────────────────────────┐
│ 11:00 — 19:00                  │
│ Anna Olsen                     │
│ Servitør · Sone B              │
│ ●Aktiv                         │
└────────────────────────────────┘
```

Visuell grammatikk:
- Tid: `font-mono text-base font-semibold`
- Navn: `font-sans text-base font-medium`
- Rolle + sone: `font-sans text-sm text-muted-foreground`
- Status-prikk: 8px sirkel, `bg-{status-color}` med pulse hvis aktiv

Props:
- `shift: ScheduleShift`
- `variant: "compact" | "default" | "detailed"`
- `showAvatar?: boolean`
- `onClick?: () => void`

Lifecycle-integrasjon: bruker `useShiftLifecycle(shiftId)` fra `packages/schedule` for å avlede fase (planlegges | pagar | oppgjor | avsluttet) per ADR-0095.

#### 5.2.4 `TaskRow`

```
[ ] Temperaturlogg kjølerom                  🌡️  Anna  · 2/5
```

Elements:
- Checkbox (venstre, store target på mobil min 44x44px)
- Tittel: `font-sans text-sm font-medium`
- Compliance-ikon hvis `is_compliance_required`: høyre med liten farge
- Eier-avatar eller navn
- Evidence-progresjon hvis definert (f.eks. 2/5 bilder)

Status-baserte stiler:
- `pending` / `available` — nøytral
- `in_progress` — primær-ring rundt checkbox
- `completed` — strikethrough + checkbox-fill + fade
- `overdue` — destructive left-border + warning-ikon
- `escalated` — destructive badge + "Eskalert til {role}"

#### 5.2.5 `HookTile`

Container for en hook med dens oppgaver:
```
┌─ 11:00 · Åpningsrutine (open) ─────────────────── 3/5 ──┐
│  [x] Sjekk kjølerom temperatur                          │
│  [x] Tørk bord og stoler                                │
│  [ ] Sett opp kasseapparat                              │
│  [ ] Tenn stearinlys                                    │
│  [ ] Slipp ut dagens meny                               │
└─────────────────────────────────────────────────────────┘
```

Kollapser når alle oppgaver er ferdig. Header viser hook-type-badge (pre_open/open/scheduled/pre_close/close).

#### 5.2.6 `KpiTile`

```
┌──────────────────┐
│ Omsetning        │
│ 87 400 kr        │
│ ↗ +4% vs. mål    │
└──────────────────┘
```

Props:
- `label: string`
- `value: string | number`
- `format: "currency" | "percent" | "hours" | "count"`
- `variance?: { value, direction: "up" | "down" | "flat", vs: string }`
- `trend?: number[]` — mini-sparkline (kun web detailed-variant)
- `emphasis: "default" | "primary" | "muted"`

Varianter:
- `variant="compact"`: tall + label, ingen variance (mobil KPI-grid)
- `variant="default"`: som over + variance
- `variant="detailed"`: + sparkline (web dashboard)

#### 5.2.7 `DeviationCard`

```
┌─ AVVIK · 14:23 ─────────────────────── ●Åpen ─┐
│ Temperatur kjølerom: 9.2°C                    │
│ Kjølerom 2 var over grenseverdi i 20 min...   │
│ Rapportert av: Anna Olsen                     │
│ 📸 3 bilder                                   │
│ [Se detaljer] [Marker som løst]               │
└───────────────────────────────────────────────┘
```

#### 5.2.8 `BroadcastComposer`

Web-only fixed footer på day-control panel:
```
┌──────────────────────────────────────────────────────────┐
│ [Melding / Alert / Påminnelse]                           │
│ [  Skriv til teamet...                          ] [Send] │
└──────────────────────────────────────────────────────────┘
```

Type-valg (segment-control): Melding (info), Alert (viktig), Påminnelse (task-bound).

#### 5.2.9 `SignoffPanel`

Vises når session er i `pending_signoff`:
```
┌─ Avslutt dagen ─────────────────────────────┐
│ Notater til oppgjør:                        │
│ [ _________________________________ ]       │
│                                             │
│ Oppgaver fullført:     23/25  ⚠ 2 uferdig  │
│ Avvik åpne:            1                    │
│ Siste ansatt ut:       22:47                │
│                                             │
│ [  Bekreft og send til oppgjør  ]           │
└─────────────────────────────────────────────┘
```

#### 5.2.10 `ReconSummary`

Read-only på mobil, interaktiv på web:
```
┌─ Oppgjør — 19. april ──────────────────┐
│ Omsetning:       87 400 kr             │
│ Arbeidstid:      42.5 timer            │
│ Lønnskostnad:    11 900 kr (14%)       │
│ Margin mot mål:  +3.2%                 │
│                                        │
│ Status: ●Venter på godkjenning         │
│ [Godkjenn] [Spør om revisjon]          │
└────────────────────────────────────────┘
```

---

## 6. Web: Day Control Panel

### 6.1 Struktur

Bottom-sheet fra week-grid-klikk (schedule). 7 tabs:

```
┌─ Day Control — MANDAG 19. APRIL ──────────────  ✕ [↗] ┐
│ [Oversikt] [Dagsinfo] [Reservasjoner] [Oppgaver]       │
│ [Budsjett] [Bemanning] [Økonomi]                       │
├────────────────────────────────────────────────────────┤
│                                                        │
│ (valgt tabs innhold)                                   │
│                                                        │
├────────────────────────────────────────────────────────┤
│ BroadcastComposer (alltid synlig)                      │
└────────────────────────────────────────────────────────┘
```

### 6.2 Per tab

**Oversikt** — SessionHeader + PhaseTimeline + KpiTile-grid (4 KPIs) + ShiftCard-liste (kompakt) + SignoffPanel hvis `pending_signoff`.

**Dagsinfo** — Melding-feed: broadcasts og notater for dagen. `BroadcastComposer` i footer.

**Reservasjoner** — Integrasjons-felt (P2 for hospitality: bordbestillinger). Placeholder i P1.

**Oppgaver** — HookTile-liste gruppert per hook-type. Progresjons-bar øverst (X/Y oppgaver fullført).

**Budsjett** — Planlagt vs. faktisk KPI-tiles. "Overstyr for dag"-knapp åpner mini-sheet med dag-spesifikk override.

**Bemanning** — ShiftCard-grid (detailed variant). Drag-handle for å flytte vakt til annen ansatt/dato. "+ Legg til vakt"-knapp.

**Økonomi** — ReconSummary + lenke til full reconciliation-side.

### 6.3 Endringer til eksisterende kode

Nåværende: `apps/web/src/app/dashboard/schedule/_components/day-control/` eksisterer med 7 tab-komponenter. Endringer:
- Refaktor: alle tabs bruker de 10 kanoniske widgetene i stedet for egne sub-komponenter.
- `DaySessionProvider.tsx` beholdes — er den delte state-kilde.
- `TimelineView.tsx` erstatttes av `PhaseTimeline` fra `packages/day`.

---

## 7. Web: Reconciliation

### 7.1 Ruter

- `/dashboard/reconciliation` — liste over dager med status
- `/dashboard/reconciliation/[date]` — enkelt dag-oppgjør

### 7.2 Listevisning

Tabell med `DayList`-komponent:
```
┌──────────────────────────────────────────────────────────┐
│  Dato       │ Avdeling │ Omsetning │ Lønn % │ Status    │
├──────────────────────────────────────────────────────────┤
│  19. apr    │ Kjøkken  │ 87 400    │ 14%    │ ●Åpen     │
│  19. apr    │ Bar      │ 23 100    │ 22%    │ ●Innsendt │
│  18. apr    │ Kjøkken  │ 91 200    │ 13%    │ ●Godkjent │
│  18. apr    │ Bar      │ 26 500    │ 19%    │ ●Låst     │
└──────────────────────────────────────────────────────────┘
```

Filter: status, avdeling, datointervall. Status-badger med Nordic Split semantiske farger.

### 7.3 Detalj-visning

Tre tabs: Inntekt | Vakter | Avvik. Se egen reconciliation-spec (`2026-04-19-reconciliation-redesign-design.md`) for full detalj. Dag-informasjon-spec'en beholder kun kontrakten: bruker de samme 10 widgetene hvor relevant.

---

## 8. Web: Shift Clock (punching fra PC)

### 8.1 Formål

Browsr-basert stempling for arbeidsplasser uten mobil-tilgang (f.eks. kjøkken-PC, resepsjons-terminal).

### 8.2 Layout

```
┌─ 19. APRIL 2026 — 14:32 ────────────────────────────────┐
│                                                         │
│  Hei Anna!                                              │
│  Din neste vakt: I dag 15:00 — 23:00                    │
│                                                         │
│              [  STEMPEL INN  ]   ← stor CTA             │
│                                                         │
│  Pågående på jobb (3):                                  │
│  • Bjørn Servitør   11:00 → nå (3t 32m)                 │
│  • Cecilie Kokk     12:00 → nå (2t 32m)                 │
│  • Dennis Manager   08:00 → nå (6t 32m) [●Pause]        │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 8.3 Aktiv-modus (innstemplet)

Samme layout, men stor CTA blir `[ STEMPEL UT ]`. TaskFeed + PhaseTimeline under.

### 8.4 LeaderOverview-variant

Samme rute, men leder med `role ∈ {manager, admin}` ser utvidet tabell med all staff + actions: "Ring", "Fjern fra dag", "Send melding".

---

## 9. Mobil: Home — Fase-basert visning

### 9.1 Tre faser av dagen

Mobil Home har tre automatisk-bestemte visninger basert på `useShiftPhase()`:

| Fase | Visning | Trigger |
| --- | --- | --- |
| `idle` (før vakt) | `BeforeShiftView` | Ingen aktiv vakt i dag, men har kommende |
| `clocked_in` (på vakt) | `DuringShiftView` | Har aktiv `time_entry` |
| `on_break` | `DuringShiftView` med pause-modus | Aktiv vakt + pause toggled |
| `summary` (etter siste vakt) | `AfterShiftView` | Siste vakt stemplet ut, før dagslutt |

### 9.2 `BeforeShiftView`

```
┌─────────────────────────────────────┐
│  Hei Anna! 🌅                       │
│                                     │
│  Din neste vakt:                    │
│                                     │
│  ┌─ I DAG 15:00 — 23:00 ──────────┐ │
│  │ Servitør · Kjøkken              │ │
│  │ Starter om 2t 28m               │ │
│  └─────────────────────────────────┘ │
│                                     │
│  Sjekkliste før vakt:               │
│  [ ] Les dagens meny                │
│  [ ] Sjekk personalmelding          │
│                                     │
│  [  Stemple inn (disabled)  ]       │
│                                     │
└─────────────────────────────────────┘
```

Komponenter: `SessionHeader` (compact), `ShiftCard` (detailed), `TaskRow` (pre-shift sjekkliste).

### 9.3 `DuringShiftView`

```
┌─────────────────────────────────────┐
│  [●Aktiv]  03:32:15                 │ ← stor timer
│  Servitør · Sone B                  │
│                                     │
│  ┌─ Dagens oppgaver ──────────────┐ │
│  │ [x] Åpningsrutine (5/5)         │ │
│  │ [●] Lunsj-prep (2/4)            │ │
│  │ [ ] Pre-close (0/3)             │ │
│  └─────────────────────────────────┘ │
│                                     │
│  [PAUSE]  [RAPPORTER AVVIK]         │
│                                     │
│  ┌─ Opptjent i dag ───────────────┐ │
│  │ 892 kr                          │ │
│  │ 3.5t · 255 kr/t · 29 kr tillegg│ │
│  └─────────────────────────────────┘ │
│                                     │
│  [  STEMPEL UT  ]                   │
└─────────────────────────────────────┘
```

Komponenter: timer-header (custom), `HookTile` kollapset, `KpiTile` (earnings), rask-actions grid, stort STEMPEL UT.

### 9.4 `AfterShiftView`

```
┌─────────────────────────────────────┐
│  ✓ Godt jobbet, Anna!               │
│                                     │
│  Vakt: 15:00 — 23:12                │
│  Arbeidet: 8t 12m                   │
│  Opptjent: 2 210 kr                 │
│                                     │
│  ┌─ Handoff til neste skift ──────┐ │
│  │ Hva bør neste skift vite?       │ │
│  │ [ _________________________ ]   │ │
│  └─────────────────────────────────┘ │
│                                     │
│  Oppsummering:                      │
│  • Oppgaver fullført: 22/25         │
│  • Ikke fullført: 3 (overført)      │
│  • Avvik: 0                         │
│                                     │
│  [  Bekreft og send  ]              │
└─────────────────────────────────────┘
```

Komponenter: `SessionHeader`, `KpiTile` (earnings), handoff-form, `SignoffPanel` (ansatt-variant).

---

## 10. Mobil: Shifts (personlig plan)

### 10.1 Ukevisning

```
┌─────────────────────────────────────┐
│ DENNE UKA         [Uke 17 ▾]        │
│                                     │
│ Man 15. apr     Ingen vakt          │
│ Tir 16. apr     11:00 — 19:00 · Kjk │
│ Ons 17. apr     Ingen vakt          │
│ Tor 18. apr     15:00 — 23:00 · Bar │
│ Fre 19. apr ●   15:00 — 23:00 · Kjk │ ← i dag, uthevet
│ Lør 20. apr     10:00 — 18:00 · Kjk │
│ Søn 21. apr     Ingen vakt          │
│                                     │
│ [Neste uke →]                       │
└─────────────────────────────────────┘
```

Dagens dato: `text-primary font-semibold` + venstre-bord-prikk.
"Ingen vakt"-dager: `text-muted-foreground/60 italic`.

### 10.2 Shift Detail

Tapp på en rad → `/shifts/[id]`:
```
┌─────────────────────────────────────┐
│ FREDAG 19. APRIL                    │
│ 15:00 — 23:00 (8 timer)             │
│                                     │
│ Kjøkken · Café Skuta                │
│ Rolle: Servitør · Sone B            │
│                                     │
│ ┌─ Kolleger på vakt ─────────────┐  │
│ │ • Bjørn (åpner)                │  │
│ │ • Cecilie (lunsj)              │  │
│ │ • Dennis (leder)               │  │
│ └────────────────────────────────┘  │
│                                     │
│ ┌─ Planlagte oppgaver ──────────┐  │
│ │ HookTile · pre_open · 15:00    │  │
│ │ HookTile · scheduled · 18:00   │  │
│ │ HookTile · pre_close · 22:30   │  │
│ └────────────────────────────────┘  │
│                                     │
│ Estimert inntjening: 2 180 kr       │
│                                     │
│ [Jeg kan ikke ta vakten] (swap)     │
└─────────────────────────────────────┘
```

---

## 11. Dagsinfo (note / alert / event)

### 11.1 Opprettelsespunkter

- Web: `DayInfoDialog` fra day-control panel "Dagsinfo"-tab footer
- Mobil: `CreateDayInfoSheet` bottom-sheet fra Home eller Shifts

### 11.2 Form-innhold

```
┌─ Ny dagsinfo ─────────────────────────┐
│ Type:                                 │
│ [● Note] [○ Alert] [○ Event]          │
│                                       │
│ Kategori (valgfri):                   │
│ [Meny] [Gjest] [Logistikk] [Annet]    │
│                                       │
│ Tittel: [                          ]  │
│                                       │
│ Beskrivelse:                          │
│ [                                  ]  │
│ [                                  ]  │
│                                       │
│ Gjelder:                              │
│ ○ Bare i dag                          │
│ ● I dag + neste skift                 │
│ ○ Hele uken                           │
│                                       │
│ Send som push til teamet? [ ]         │
│                                       │
│ [Lagre]                               │
└───────────────────────────────────────┘
```

### 11.3 Visnings-plassering

Dagsinfo-entries vises:
- Web day-control Dagsinfo-tab
- Mobil Home DuringShiftView (kompakt strip øverst hvis `type = alert`)
- Mobil Shifts (indikator-prikk på dato)

---

## 12. Deviation (avvik) — felles komponent

### 12.1 Opprettelse (mobil først)

Sheet fra DuringShiftView "Rapporter avvik":
```
┌─ Nytt avvik ──────────────────────────┐
│ Type: [Temperatur ▾]                  │
│   • Temperatur                        │
│   • Allergeninformasjon               │
│   • Hygiene                           │
│   • Sikkerhet                         │
│   • HR/konflikt                       │
│   • Annet                             │
│                                       │
│ Beskrivelse:                          │
│ [                                   ] │
│                                       │
│ Bilder: [📸 Ta bilde] [📎 Galleri]   │
│                                       │
│ Alvorlighet:                          │
│ ○ Lav  ● Middels  ○ Høy  ○ Kritisk    │
│                                       │
│ [Rapporter]                           │
└───────────────────────────────────────┘
```

Emit: `deviation created` + push-notifikasjon til leder hvis `alvorlighet ∈ {høy, kritisk}`.

### 12.2 Visning

`DeviationCard` brukes i:
- Web day-control Oversikt (siste 3 avvik, + link til flere)
- Reconciliation Avvik-tab (alle)
- Mobil Home DuringShiftView (kun egne + åpne)

---

## 13. Time / dato-formatering

### 13.1 Utils (forslag: `packages/utils/src/time.ts`)

```ts
formatDateLabel(date, variant: "full" | "short" | "compact")
// "MANDAG 19. APRIL" | "man 19. apr" | "19/4"

formatRelativeDay(date)
// "I dag" | "I går" | "I morgen" | "Man 19. apr"

formatTime(time: string | Date, format: "24h" | "duration")
// "15:30" | "3t 30m"

formatTimeRange(start, end)
// "15:00 — 23:00"

formatHours(decimal: number)
// 7.5 → "7t 30m"

formatCurrency(value: number)
// 87400 → "87 400 kr"

formatWeekdayShort(dow: number)
// 0 → "Man", 6 → "Søn"
```

### 13.2 Lokale

- Ingen i18n per P1 — norsk hardkodet for dato-labels, status-tekster og relative-day.
- Tall: mellomrom som tusen-separator (norsk standard), komma som desimal.
- Tid: alltid 24t, aldri AM/PM.

### 13.3 Tidssone

- Alt er workspace-lokal tid. Ingen UTC-konvertering i UI.
- Backend lagrer `TIMESTAMPTZ`, men frontend viser alltid som workspace-lokal.
- Ny ADR-utkast: "Ingen multi-timezone-støtte i P1 — alle workspaces er norsk tid."

---

## 14. Rolle-spesifikke linser

### 14.1 Samme komponenter, forskjellig fokus

| Widget | Ansatt ser | Leder ser | Admin ser |
| --- | --- | --- | --- |
| `SessionHeader` | Min vakt innen sesjonen | Hele sesjonen | Alle sesjoner i workspace |
| `ShiftCard` | Bare min vakt | Team-vakter | Alle vakter, alle avdelinger |
| `TaskRow` | Oppgaver tildelt meg | Teamets oppgaver | Alle oppgaver + compliance-stats |
| `KpiTile` | Min inntjening | Team-KPI | Workspace-KPI |
| `DeviationCard` | Egne åpne | Team-åpne | Alle, inkl. løste |
| `BroadcastComposer` | ❌ | ✅ send til team | ✅ send til workspace |
| `SignoffPanel` | Ansatt-variant (bekreft mine timer) | Leder-variant (send til oppgjør) | Admin-variant (godkjenn) |
| `ReconSummary` | ❌ | Read-only | Full redigering |

### 14.2 Implementering

Komponenter tar `viewerRole: "employee" | "manager" | "admin"` prop; rendrer forskjellige CTAs og data-filter. Serveren håndhever via RLS — UI-laget maskerer, men kan ikke omgå.

---

## 15. Nordic Split — tokens og regler

### 15.1 Farge per status

| Fase | Token | Fallback-verdi (kun ref) |
| --- | --- | --- |
| upcoming | `bg-muted text-muted-foreground` | warm neutral |
| active | `bg-success/10 text-success` + `animate-pulse` (prikk) | emerald hue 145 |
| pending_signoff | `bg-warning/10 text-warning` | amber hue 70 |
| closed | `bg-muted/50 text-muted-foreground/70` | dempet warm |
| missed | `bg-destructive/10 text-destructive` | red hue 25 |
| locked | `bg-primary/10 text-primary` | brand orange |

### 15.2 Typografi per komponent

| Element | Class |
| --- | --- |
| Page header (dato) | `font-heading text-3xl` |
| Panel header (dato) | `font-heading text-2xl` |
| Card header (navn/tittel) | `font-sans text-base font-semibold` |
| Meta-tekst (rolle, sone) | `font-sans text-sm text-muted-foreground` |
| Tall (tid, beløp, timer) | `font-mono text-base font-medium` |
| Timer (stor) | `font-mono text-5xl font-light tabular-nums` |
| Tasks/body | `font-sans text-sm` |

### 15.3 Spacing-ramme

- Card-padding: `p-4` (mobil), `p-5` (web)
- Section-gap: `space-y-4`
- Innen-card inline: `space-y-2`
- Grid-gap: `gap-3`

### 15.4 Motion

| Overgang | Spring |
| --- | --- |
| Day-control sheet enter | stiffness 35, damping 22, mass 2.2 |
| Tab-veksling | stiffness 40, damping 22, mass 2.0 |
| Task complete (strikethrough fade) | 240ms ease-out, ikke spring |
| Timer tick | ingen animasjon (tabular-nums bærer hjulet) |
| Phase-badge pulse (active) | 1.8s ease-in-out, infinite, opacity 0.6–1.0 |
| Punch in/out (mobil) | full-screen stiffness 30, damping 24, mass 2.5 |

### 15.5 Ikoner

Alle fra Lucide. Kanoniske:
- `Clock`, `Zap`, `CheckCircle2`, `Archive`, `AlertCircle`, `Lock`, `Thermometer` (avvik), `Camera` (evidence), `MessageSquare` (broadcast), `Play` (start), `Pause`, `StopCircle`, `TrendingUp`/`TrendingDown`, `Users`.

---

## 16. Packages-arkitektur

### 16.1 Foreslått ny pakke: `packages/day`

Formål: shared day-komponenter + hooks som fungerer på web og mobil.

```
packages/day/
├── src/
│   ├── components/
│   │   ├── SessionHeader.tsx
│   │   ├── PhaseTimeline.tsx
│   │   ├── ShiftCard.tsx
│   │   ├── TaskRow.tsx
│   │   ├── HookTile.tsx
│   │   ├── KpiTile.tsx
│   │   ├── DeviationCard.tsx
│   │   ├── SignoffPanel.tsx
│   │   └── ReconSummary.tsx
│   ├── hooks/
│   │   ├── useDepartmentSession.ts
│   │   ├── useSessionTasks.ts
│   │   ├── useSessionHooks.ts
│   │   ├── useShiftLifecycle.ts  (re-export fra packages/schedule)
│   │   ├── useDayKpis.ts
│   │   └── useDeviations.ts
│   └── types.ts
└── package.json
```

Platform-spesifikke komponenter (BroadcastComposer web-only, PunchAnimation mobil-only) forblir i respektive apps.

### 16.2 Re-bruk over apps

```
apps/web/
  └── imports ShiftCard, SessionHeader, KpiTile, TaskRow, HookTile
       fra @smartout/day

apps/mobile/
  └── imports ShiftCard, SessionHeader, KpiTile, TaskRow, HookTile
       fra @smartout/day

Responsive props:
  - density: "compact" | "default" | "detailed"
  - variant: "web" | "mobile" (auto-detected via platform)
```

### 16.3 Styling-lag

- Delte komponenter bruker Tailwind på web, NativeWind på mobil.
- CSS-variabler eksponeres på begge via `packages/design-tokens`.

---

## 17. Telemetri — dag-events

Må finnes eller legges til i `packages/telemetry/src/registry.ts`:

| Event | Kategori | Destinasjoner | Entity |
| --- | --- | --- | --- |
| `department_session opened` | operations | activity_trail, engine_event | department_session |
| `department_session signoff_requested` | operations | activity_trail, engine_event | department_session |
| `department_session closed` | operations | activity_trail, engine_event | department_session |
| `department_session locked` | operations | activity_trail, engine_event | department_session |
| `department_session missed` | operations | activity_trail (system) | department_session |
| `session_task completed` | operations | activity_trail | session_task |
| `session_task skipped` | operations | activity_trail | session_task |
| `session_task escalated` | operations | activity_trail, engine_event | session_task |
| `session_task evidence_captured` | operations | activity_trail | session_task |
| `shift punched_in` | operations | activity_trail, posthog | time_entry |
| `shift punched_out` | operations | activity_trail, posthog | time_entry |
| `shift break_started` | operations | activity_trail | time_entry |
| `shift break_ended` | operations | activity_trail | time_entry |
| `deviation reported` | operations | activity_trail, engine_event | deviation |
| `deviation resolved` | operations | activity_trail | deviation |
| `day_info created` | operations | activity_trail | day_info |
| `broadcast sent` | operations | activity_trail | broadcast |

Alle må inkludere `workspace_id`, `actor_id` (profile_id, ikke tom), og når relevant `department_session_id`.

---

## 18. Tilstander per widget

Hver komponent må håndtere fem tilstander:

| Tilstand | Visning |
| --- | --- |
| Loading | Skeleton i Nordic Split dempet tone, riktig høyde |
| Empty | "Ingen {entity} i dag" + subtil ikon |
| Populated | Full rendering |
| Error | Stille fallback: "Kunne ikke laste {x}" + retry-link |
| Offline (mobil) | Queued-indikator: "Handlingen sendes når du er online" |

Mobil må håndtere offline per ADR-0134 med Zod-validert offline queue.

---

## 19. ADR-behov

| ADR-utkast | Tema | Grunn |
| --- | --- | --- |
| ADR-NEXT-DAY-01 | `packages/day` som shared component-bibliotek | Sikrer mobil-parity fra dag én |
| ADR-NEXT-DAY-02 | Session er kanonisk dag-container | Ingen parallelle dag-sannheter |
| ADR-NEXT-DAY-03 | Session locked-transition er irreversibel | Compliance + audit requirement |
| ADR-NEXT-DAY-04 | Norsk lokal kun i P1 (ingen i18n) | Spesifiserer scope |
| ADR-NEXT-DAY-05 | Optimistisk UI for task-complete og punch | Krav om rask respons; ruller tilbake ved feil |
| ADR-NEXT-DAY-06 | `ShiftCard` + 9 andre kanoniske widgeter er delte | Forbyr parallell implementering i apps/web og apps/mobile |

---

## 20. Åpne spørsmål

1. **Én session per avdeling per dato** — hva med avdelinger som går over midnatt (f.eks. Bar stenger 03:00)? Forslag: session eies av "driftsdato" (business day), ikke kalenderdato. Session går 06:00 → 05:59.
2. **Tasks på tvers av skift:** hvis en `session_task` ikke fullføres før skifteslutt, skal den overføres til neste skift eller bli `overdue`? Forslag: konfigurerbart per hook (`carry_over_behavior: "escalate" | "overdue" | "next_shift"`).
3. **Handoff-notater per skift** — bor disse på `time_entry` eller `department_session.signoff_notes`? Forslag: handoff per time_entry (skift-spesifikk), signoff på session (dag-spesifikk).
4. **Offline-sync konfliktløsning:** hvis to enheter punch'er ut samme person samtidig, hvem vinner? Forslag: server-side UNIQUE constraint på `(time_entry_id, punched_out_at IS NULL)`; andre forsøk feiler med klar melding.
5. **Push-notifikasjoner for dagsinfo:** hvem beslutter når det pushes? Forslag: leder beslutter ved opprettelse (`send_push: boolean`), ikke auto.
6. **Deviation-eskalering som engine_process:** bruker vi Event Engine for å orkestrere eskalering (HR-ping, alarm, osv.) eller håndteres det i capability? Forslag: **engine_process** hvis eskalering trigger flere steg; capability hvis enkelt-send.
7. **KPI-ytelse på dashboard:** dag-KPI-beregninger kan bli tunge (mange rader). Cache-strategi? Forslag: materialized view + invalidering ved relevante mutasjoner; les via TanStack Query.

---

## 21. Implementeringsrekkefølge

**P0 — Design-system-grunnlag:**
1. Opprett `packages/day` med de 10 kanoniske widgetene (skalett).
2. Flytt eksisterende `apps/web/src/app/dashboard/schedule/_components/day-control/*` til å bruke widgets.
3. Flytt eksisterende `apps/mobile/src/components/shift-clock/*` til å bruke widgets.
4. Verify cross-platform styling via NativeWind.

**P1 — Funksjonell paritet:**
5. `SessionHeader` + `PhaseTimeline` ferdig i alle flater.
6. `ShiftCard` tre varianter (compact/default/detailed) med responsive.
7. `TaskRow` med evidence-støtte.
8. `KpiTile` tre varianter + sparkline (web kun).
9. `HookTile` med kollaps-logikk.
10. Offline-queue for mobil punch/task.

**P2 — Utvidelser:**
11. `DeviationCard` med full eskalerings-flow.
12. `BroadcastComposer` med push-trigger.
13. `SignoffPanel` med ansatt-variant (bekreft timer).
14. `ReconSummary` som separat sheet.
15. Dagsinfo-komponent på tvers av apps.

**P3 — Pollering og KPI-ytelse:**
16. Materialized views for dag-KPI.
17. Mini-sparklines i KpiTile detailed-variant.
18. Handoff-notater separat fra signoff.

---

## 22. Referanser

- **Web day-control:** `apps/web/src/app/dashboard/schedule/_components/day-control/`
- **Web reconciliation:** `apps/web/src/app/dashboard/reconciliation/`
- **Web shift-clock:** `apps/web/src/app/dashboard/shift-clock/`
- **Web year-wheel day factors:** `apps/web/src/app/dashboard/year-wheel/_components/DayFactorsTab.tsx`
- **Mobil home:** `apps/mobile/app/(app)/(home)/` + `apps/mobile/src/components/home/`
- **Mobil shift-clock:** `apps/mobile/src/components/shift-clock/`
- **Mobil shifts:** `apps/mobile/app/(app)/(shifts)/`
- **Packages schedule:** `packages/schedule/src/hooks/useShiftLifecycle.ts`
- **Design tokens:** `packages/design-tokens/src/tokens.ts`, `native.ts`
- **Styleguide:** `docs/design/ren-og-varm-styleguide.html`
- **Year-wheel spec:** `docs/superpowers/specs/2026-04-19-year-wheel-holistic-design.md`
- **Reconciliation spec:** `docs/superpowers/specs/2026-04-19-reconciliation-redesign-design.md`
- **Auth spec:** `docs/superpowers/specs/2026-04-19-auth-invitation-holistic-design.md`
- **ADR-0095:** Shift Lifecycle phases
- **ADR-0133:** Mobile Surface Boundary
- **ADR-0134:** Mobile Telemetry Contract

---

## Changelog

| Dato | Versjon | Endring | Forfatter |
| --- | --- | --- | --- |
| 2026-04-19 | 1.0 | Initial draft — helhetlig designspec for alle dag-informasjon-komponenter | Pontus + Claude |
