---
title: "Årshjul — Helhetlig Designspec (Web + Mobil)"
id: DESIGN_YEAR_WHEEL_2026_04_19
version: "1.0"
status: draft
layer: spec
created: 2026-04-19
updated: 2026-04-19
author: pontus + claude
supersedes: []
depends_on:
  - MODULE_YEAR_WHEEL_PRD
  - ADR-0085
  - ADR-0113
  - ADR-0114
  - ADR-0115
  - ADR-0133
tags:
  - spec
  - year-wheel
  - seasons
  - planning-events
  - cascade
  - nordic-split
  - ux
module: year-wheel
---

# Årshjul — Helhetlig Designspec

> Komplett designspec for Årshjulet som strategisk planleggingsflate. Dekker canvas, sesonger, events, budsjett, faktorer, åpningstider, teamfaktorer og event engine-kobling.
> **Kanonisk funksjonell kilde:** `docs/modules/MODULE_YEAR_WHEEL_PRD.md`.
> **Cascade-ramme:** `docs/superpowers/specs/2026-03-21-cascade-scheduling-system-design.md` (I1 + 6D + 4C + K1a/K1b).

---

## 0. TL;DR

- Årshjulet er **strategisk kontrollromsfalte** — ikke en kalender, ikke en planleggingsapp. Her tegner bedriften året sitt.
- **Canvas / Blocks / Pins** er kjernemodellen. Canvas = året (tomt lerret = "NORMAL DRIFT"). Blocks = sesonger. Pins = events.
- Én side, tre dybdelag: **Timeline** (overblikk) → **Drawer** (sesongdetaljer) → **Machine Room** (budsjett + faktorer).
- Sesong er D1 × D4 × D5-skjæringspunkt: når (envelope), hvor mye (demand), og hvilken type drift (concept).
- Events (`planning_event`) forstyrrer demand via `demand_multiplier`; kan trigge hours-override og session hooks.
- Teamfaktorer løses **ikke** med ny tabell. Teams er allerede sesong-scoped (`team.season_id`); labor-justeringer ligger i `workspace_budget` via `day_factor`/`hour_factor`.
- Event Engine kobles via `season activated` → `engine_event` → propagering av budsjett og opprettelse av `department_session`.
- Nordic Split hele veien. CSS-variabler. Ingen hardkodede farger.

---

## 1. Designprinsipper

1. **Canvas er alltid meningsfullt.** Tomt canvas = "NORMAL DRIFT" (ikke "ingen data"). Året har alltid identitet.
2. **Tegn før du fyller.** Brukeren skal kunne dra opp en sesong på canvas (draw-to-create) før hun fyller inn navn, mål eller budsjett. Navn kan komme senere.
3. **Tre dybdelag, aldri mer.** Timeline → Drawer → Machine Room. Ingen modaler på toppen av modaler. Ingen tab-inception.
4. **Blocks eier sin tid. Pins eier sitt øyeblikk.** En sesong er en periode. En event er et punkt (eller kort intervall). De skal se forskjellige ut, og oppføre seg forskjellig.
5. **Cascade-provenans synlig.** Hvis noe er seeded fra I1 (industri-bootstrap), vist i drawer som "Fra Riksavtalen" / "Fra hospitality-baseline". Brukeren må forstå hva som er auto og hva hun har endret.
6. **Budsjett er konsekvens, ikke mål.** Når du setter inntektsmål + sesongfaktor, beregnes dagsmål, timemål og bemanningsbehov. Brukeren ser kausalkjeden, ikke bare inputfelter.
7. **Gate-driven activation.** "Aktiver sesong"-knapp er synlig men disabled til preconditions er oppfylt: (a) datoer satt, (b) budsjett > 0, (c) åpningstider definert for minst én avdeling, (d) ingen overlappende aktiv sesong (ADR-0085).
8. **Mobil som konsument.** Ansatte ser sesongstatus, mål og åpningstider read-only. Redigering er web-only (ADR-0133: "Web composes, mobile executes").
9. **40%-reduksjon av chrome.** Plass, typografi-hierarki og semantiske farger før rammer og bokser.

---

## 2. Informasjonsarkitektur

### 2.1 Rute-struktur

| Rute | Formål | Merknad |
| --- | --- | --- |
| `/dashboard/year-wheel` | Kanoniske inngang. Timeline + liste + drawer. | Erstatter legacy `/dashboard/season`. |
| `/dashboard/year-wheel?year=2026` | Åpner spesifikt år. | Query-param, ikke path-param. |
| `/dashboard/year-wheel?season=<uuid>` | Deep-link til sesong med drawer åpen. | Kopierbar URL. |
| `/dashboard/year-wheel?event=<uuid>` | Deep-link til event med popover/drawer. | Samme mønster. |

Ingen separate `/season/[id]` eller `/events` ruter. Alt i én kanonisk flate.

### 2.2 Sidelayout (desktop, bred skjerm)

```
┌─────────────────────────────────────────────────────────────────┐
│ DashboardShell sidebar                                          │
├─────────────────────────────────────────────────────────────────┤
│ PageHeader: Årshjul 2026                      [Dupliser år] [+] │
│                                                                 │
│ YearNavigation: ◄  2025  │ 2026  │ 2027  ►       [I dag] [År▾] │
│                                                                 │
│ ─── Canvas (timeline) ──────────────────────────────────────── │
│                                                                 │
│  Jan  Feb  Mar  Apr  Mai  Jun  Jul  Aug  Sep  Okt  Nov  Des    │
│  ────────────────────────────────────────────────────────────  │
│  ░░░░░░░░░░  [━━━━━ Påske ━━━━━]      [━━━━━ Sommer ━━━━━]     │
│               ● 17. mai     ● Olsok                            │
│  ─────────────────── NORMAL DRIFT ─────────────────────────── │
│                                                                 │
│ ─── To-spalt under canvas ─────────────────────────────────── │
│  Sesonger (3)                    │   Events (12)               │
│  • Påske • Sommer • Jul          │   ● 17. mai ● Olsok ...     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 2.3 Drawer-arkitektur (høyre slide-in)

Drawer åpnes når man klikker på en sesong-block. Inneholder tabs (tre nivåer av informasjon):

```
SeasonDrawer
├── Header: [navn] [dato-range] [status-badge] [aktiver/arkiver]
│
├── Tabs
│   ├── Oversikt    — navn, dato, cycle-binding, mål-sammendrag
│   ├── Åpningstider — department_operating_hours + overrides
│   ├── Mål         — season_goal CRUD
│   ├── Prosedyrer   — policy/protocol bindings (placeholder i P1)
│   └── Machine Room ✦ — åpner egen sheet (budsjett + faktorer)
│
└── Footer: "Sist endret av X, Y siden" + deep-link URL
```

### 2.4 Machine Room (separat sheet, ikke tab)

Machine Room er **ikke** en tab i drawer. Det er en egen, bredere sheet som åpnes fra drawer, fordi det inneholder store tabeller (7-rader dag-faktorer, 24-rader time-faktorer) og beregninger som ikke bor i en smal drawer.

```
MachineRoomSheet
├── Header: Machine Room — Sommer 2026
├── Budget Setup: total_target_revenue, labor %, avg_wage, season_factor
├── Day Factors: 7-rader tabell (Mon–Sun), factor = 0.3–3.0
├── Hour Factors: 24-rader tabell (0–23), factor = 0.0–3.0
└── Beregnet: daglige mål × ukedag, timemål × åpningstid, bemanning
```

---

## 3. Canvas / Blocks / Pins — detaljert

### 3.1 Canvas

- Rendrer året som 12 måneder, hver måned har proporsjonal bredde (ikke 31 kolonner uansett).
- Bakgrunn: subtil horisontal baseline, med måneds-labels øverst.
- **"NORMAL DRIFT"-sone**: områder uten sesong viser en diskret, svak diagonalstripe eller fraktal-støy med teksten "NORMAL DRIFT" i `text-muted-foreground/40`. Dette er **bevisst identitet** — ikke tom tilstand.
- "I dag"-markør: vertikal 1px linje i `border-foreground/60`, ikke farget. Skal ikke dominere.
- Zoom: Year (default) | Month (zooms til én måned med daglige kolonner).

### 3.2 Blocks (sesonger)

Visuelt:
- Horisontal, avrundet stav. Høyde: 40px på desktop, 32px på mobil.
- Farge: sesongens `color` (valgt ved opprettelse; default fra status-paletten).
  - Status `draft` → `bg-muted` + `border-dashed` + `text-muted-foreground`
  - Status `active` → fullfarge, `shadow-sm`, `text-primary-foreground`
  - Status `archived` → `bg-muted/40` + dempet
- Navn sentrert i blocken, truncate hvis for smal.
- Venstre og høyre kant er **drag-handles** (6px hitbox, `cursor-ew-resize`). Drag justerer `start_date` / `end_date`.
- Klikk på blocken åpner SeasonDrawer.

Interaksjonsregler:
- Overlapping sesonger stables vertikalt (lane 1, lane 2). Maks 3 lanes — flere enn det indikerer dårlig planlegging og skal trigge advarsel.
- Drag er live: URL oppdateres, men mutasjonen kommitteres kun på `mouseup`. Telemetri: `season updated` med `properties.data.reason = "drag_resize"`.
- Drag som skaper overlapp med en **aktiv** sesong er blokkert (ADR-0085) og viser toast: "En annen aktiv sesong dekker allerede disse datoene."

### 3.3 Pins (events)

Visuelt:
- Sirkel, 12px diameter, plassert på eksakt `event_date` på tidslinjen.
- Farge fra `planning_event.category`:
  - `internal` → `bg-accent`
  - `cultural_commercial` → `bg-primary`
  - `business_critical` → `bg-destructive` (dempet variant)
- Ring rundt pinnen hvis `demand_multiplier > 1.5` (høy impact) eller `< 0.5` (lavt).
- Hover: popover viser navn, dato, kategori, multiplier, `expected_covers`.
- Klikk: popover med "Rediger" / "Slett" / "Se i drawer".

Multi-day events:
- Hvis `end_date > event_date`, rendrer som en **kort stav** (ikke pin). Styling: samme farge, men halv høyde av en season-block. Dette skiller dem visuelt fra sesonger.

### 3.4 Interaksjon på tomt canvas

- **Click** på tomt område: åpner popover "Hva vil du legge til?"
  - Opprett sesong (starter draw-mode)
  - Opprett event (oppretter event på klikket dato)
- **Drag** på tomt område (mousedown + move > 8px): går rett i draw-mode for sesong. Viser et phantom-block som følger musa. `mouseup` kommitterer `start_date` / `end_date` og åpner en inline-popover for navn.
- **Right-click** på dato: "Opprett event her" shortcut.

Dette er **Hypothesis 1** i PRD §9 — draw-to-create som primær UX.

---

## 4. Sesong (Season) — designspesifikasjon

### 4.1 Cascade-ramme

Sesong er skjæringspunktet mellom tre dimensjoner:
- **D1 Envelope** — definerer hvilke `department_operating_hours` som gjelder i perioden.
- **D4 Demand** — bærer `season_budget` + `day_factor` + `hour_factor`.
- **D5 Concept** — parametriserer hvilken type drift dette er (sommer, høytid, lavsesong).

**Ikke-fraksjoner:** Sesong er **ikke** et rollefilter, ikke et ansatt-filter, ikke et treningsprogram. Hvis du trenger å filtrere ansatte til sesong, bruk `team.season_id`.

### 4.2 Lifecycle (status-maskin)

```
         create                activate              archive
   ─────────────▶  draft  ─────────────▶  active  ─────────────▶ archived
                    │                        │                       │
                    │     update             │     update            │ (read-only)
                    ├────────────┐           ├────────────┐
                    └◀───────────┘           └◀───────────┘
```

Regler:
- Én aktiv sesong per overlappende tidsrom per workspace (ADR-0085). To sesonger kan være aktive samtidig hvis de ikke overlapper (f.eks. "Sommer" og "Juleverksted").
- Arkivering er permanent for visning, men alle relasjoner (budget, factors, goals, hours) beholdes.
- Drag-resize tillatt i både `draft` og `active`. Men i `active` må man bekrefte: "Du endrer en aktiv sesong — dette påvirker pågående `department_session`-instanser."

### 4.3 Opprettelse — to mønstre

**Mønster A — Draw-to-create (primær):**
1. Drag på canvas → phantom-block.
2. `mouseup` → inline popover med navn-input (auto-fokus), Enter bekrefter.
3. Sesong opprettes med `status = draft`, `color = neste i default-paletten`, ingen budget.
4. Drawer åpner automatisk på "Oversikt"-tab med nudge: "Sett budsjett for å aktivere".

**Mønster B — Formular (fallback):**
1. Klikk `+ Ny sesong` i sidehode → SeasonCreateSheet slide-in.
2. Felt: navn, start_date, end_date, cycle (dropdown, default = aktivt år), farge.
3. Submit → samme resultat som A.

### 4.4 Drawer — Oversikt-tab

```
┌─ Oversikt ──────────────────────────────────────────┐
│ Navn:           [Sommer 2026                     ]  │
│ Periode:        15.06.2026 → 31.08.2026             │
│ Year wheel:     [2026 Planning Year        ▾]       │
│                                                     │
│ Status:         ● Utkast   (Activer ▸ disabled)    │
│ ⓘ For å aktivere mangler:                           │
│   • Inntektsmål                                     │
│   • Åpningstider for minst én avdeling              │
│                                                     │
│ Oppsummering:                                       │
│   Inntektsmål:    — kr                              │
│   Dager:          78                                │
│   Aktive avdelinger: 0 / 3                          │
│   Events i periode: 2                               │
│                                                     │
│ [Slett] [Dupliser]                                  │
└─────────────────────────────────────────────────────┘
```

"Hva mangler"-listen er **live**. Når bruker fyller inn i Machine Room eller Åpningstider, oppdateres listen uten reload.

### 4.5 Drawer — Åpningstider-tab

Viser `department_operating_hours` scoped til sesongen (`season_id = this`), fallback til workspace-default hvis ingen finnes.

```
┌─ Åpningstider ──────────────────────────────────────┐
│ Avdeling: [Kjøkken ▾]                               │
│                                                     │
│ Man    11:00 — 23:00     (fra workspace-default)    │
│ Tir    11:00 — 23:00     (fra workspace-default)    │
│ Ons    11:00 — 23:00     ⓘ Sesong-override          │
│ Tor    11:00 — 23:00                                │
│ Fre    11:00 — 24:00                                │
│ Lør    11:00 — 24:00                                │
│ Søn    stengt                                       │
│                                                     │
│ [+ Override for enkelt-dato]                        │
│                                                     │
│ Dato-overrides (2):                                 │
│ • 17.05.2026 — 13:00 — 23:00 (grunnet 17. mai)     │
│ • 24.06.2026 — stengt (sommerferie start)           │
└─────────────────────────────────────────────────────┘
```

Provenans-badge ("fra workspace-default", "sesong-override") gir bruker kontroll over hvor verdien kommer fra.

### 4.6 Drawer — Mål-tab

`season_goal` CRUD. Mål er rene tekst-mål for sesongen (ikke KPI-er — de ligger i `workspace_kpi_target`).

```
┌─ Mål ───────────────────────────────────────────────┐
│ [+ Nytt mål]                                        │
│                                                     │
│ ✓ Nå 10M NOK i omsetning                            │
│ ✓ Null vektovertid for kokker                       │
│ ○ Introdusere ny vegetar-meny                       │
│ ○ Trene 3 nye servitører til senior                 │
└─────────────────────────────────────────────────────┘
```

Dette er **ikke** protocol-assignments. Det er strategiske mål bruker skriver selv.

### 4.7 Drawer — Prosedyrer-tab (P2 — skeleton)

Placeholder i P1. I P2: velg hvilke `protocol`-instanser som binder seg til denne sesongen (f.eks. "Sommermeny-opplæring" aktiveres ved sesongstart).

---

## 5. Machine Room — budsjett og faktorer

### 5.1 Formål og mental modell

Machine Room er hvor bruker setter **demand-distribusjon**. Ikke KPI-tracking (det er avstemming). Ikke vaktplan (det er schedule). Kun: _"Hvordan fordeler jeg forventet omsetning over perioden?"_

Dette er D4 i cascade.

### 5.2 Seksjoner i Machine Room

```
┌─ Machine Room — Sommer 2026 ───────────────────────────┐
│                                                        │
│  ─── Budget Setup ──────────────────────────────────  │
│  Inntektsmål:       [12 000 000 kr]                    │
│  Sesongfaktor:      [1.2]  (vs baseline 1.0)           │
│  Pris per gjest:    [   650 kr]  (valgfri)             │
│  Labor-mål:         [30 %]                             │
│  Snittlønn:         [   280 kr/t]                      │
│                                                        │
│  ─── Dagfaktorer (relative vekter) ─────────────────  │
│  Man  [1.00]    Tir  [0.90]    Ons  [1.00]             │
│  Tor  [1.20]    Fre  [1.80]    Lør  [2.40]             │
│  Søn  [0.60]                                           │
│                                                        │
│  ─── Timefaktorer ──────────────────────────────────  │
│  [0-5: 0.0]   [6-10: 0.3]   [11-14: 1.2]              │
│  [15-17: 0.8] [18-21: 2.4]  [22-23: 1.0]              │
│                                                        │
│  ─── Beregnet konsekvens ──────────────────────────── │
│  Dagsmål (fredag):    92 307 kr                        │
│  Topptime (19:00):    18 461 kr                        │
│  Bemanning (fredag):  ~ 13 personer på topp            │
│                                                        │
│  [Lagre] [Propager til workspace_budget]              │
└────────────────────────────────────────────────────────┘
```

### 5.3 Beregningsflyt

Rent pure functions i `apps/web/src/lib/season-calculations.ts`:

1. `calculateDayTargets(total_target_revenue, start_date, end_date, day_factors[])` → `DayTarget[]`
2. `calculateHourTargets(day_target, open_hour, close_hour, hour_factors[])` → `HourTarget[]`
3. `calculateStaffingNeeded(day_target, avg_wage, labor_pct)` → `StaffingResult`

Alle **rekalkuleres live** i UI når bruker endrer en faktor. Ingen commit til DB før bruker trykker "Lagre".

### 5.4 Propagering til `workspace_budget`

"Propager"-knapp kaller `propagateBudgetTargets()` (cascade-function) som skriver hver dag × time i perioden inn i `workspace_budget`-tabellen. Dette er **eksplisitt handling**, ikke automatisk ved lagring. Grunn: propagering kan overskrive eksisterende manuelle justeringer, så bruker må bekrefte.

Etter propagering emittes `season_budget propagated` → triggerer videre cascade (schedule-resolution bruker disse verdiene neste gang).

### 5.5 Validering

- Alle dag-faktorer må være > 0. Null eller negativ = feil.
- Minimum én time-faktor > 0, ellers ingen omsetning mulig.
- Sum av dag-faktor × antall forekomster bør ikke avvike > 50% fra forventet basis — ellers vis "suspicious distribution"-advarsel.

---

## 6. Planning Events

### 6.1 Konseptuell plass

`planning_event` er **en D4 demand-forstyrrelse**. Den sier: "På denne datoen forventer vi annerledes aktivitet enn baseline." Det er **ikke**:
- En kalender-avtale (det er Google Calendar).
- En vakt (det er `schedule_shift`).
- Et protocol-trigger (det er `session_hook`).

Den kan imidlertid _koble til_ en hours-override (via `planning_event.hours_override_id`) — slik at én 17. mai både markerer redusert demand **og** endrer åpningstider.

### 6.2 Kategorier

| Kategori | Eksempel | Visuell identitet |
| --- | --- | --- |
| `internal` | "Personalfest", "Inventering" | Grå/accent pin |
| `cultural_commercial` | "17. mai", "Black Friday", "Allehelgens" | Primær pin |
| `business_critical` | "Strømbrudd planlagt", "Systembytte", "Konsert rett ved" | Destructive pin |

### 6.3 Source

| Source | Hvor kommer den fra |
| --- | --- |
| `manual` | Bruker opprettet |
| `external_api` | Hentet fra API (f.eks. NRK-kalender) |
| `calendar_sync` | Synket fra Google/Outlook |
| `ai_generated` | Foreslått av Bot/AI (med confidence) |

`ai_generated`-events har `confidence < 1.0` og vises med stiplet ring. Bruker må bekrefte før de teller i beregninger.

### 6.4 Demand multiplier

Formel ved resolution:
```
effective_demand(date) = baseline_demand(date) × product(event.demand_multiplier for event covering date)
```

Hvis to events overlapper (f.eks. 17. mai + konsert), multipliseres effektene. Bruker advares ved overlappende events med `total_multiplier > 3.0`: "Dette er urealistisk høyt — sjekk eventene."

### 6.5 Opprettelse

Tre inngangspunkter:
1. **Klikk på dato på canvas** → popover → "Nytt event her".
2. **Right-click pin** → "Dupliser", "Flytt dato".
3. **Sheet** fra sidehode eller drawer.

Form-felt:
- Navn (required)
- Kategori (required)
- Dato (required, prefyllt fra kontekst)
- Slutt-dato (valgfri)
- Demand-multiplier (default 1.0)
- Expected covers (valgfri, kun hospitality)
- "Koble til hours-override?" (checkbox → åpner sub-form)
- Recurring? (checkbox → RRULE-builder, kun P2)

### 6.6 Scoping til sesong (P0-gap i PRD §12)

**Nåværende feil:** Events lastes workspace-wide. Bruker ser events fra andre sesonger i listen.

**Fix (del av dette speccen):** Events filtreres på `planning_cycle_id = active_year.planning_cycle_id` by default. Toggle: "Vis alle events" for når man trenger å se på tvers.

---

## 7. Team-faktorer (Teamfaktorer)

### 7.1 Avklaring — ingen ny tabell

Etter utforskning: det finnes **ikke** en `team_factor` eller `team_adjustment`-tabell i nåværende skjema. Det er **et bevisst valg** — teams er allerede sesong-scoped og bemanning løses via `day_factor`/`hour_factor` + `team.season_id`.

### 7.2 Nåværende mønster

- `team` har `season_id` (nullable). Hvis satt, er teamet kun aktivt i sesongen.
- `team` har `leader_profile_id` og `team_type`.
- Bemanningsbehov per dag → beregnet fra `day_factor × avg_wage × labor_%` → gir antall personer.
- Team-tilknytning → avgjør hvilke `profile`-rader som er kandidater til vakter i sesongen.

### 7.3 UX i årshjul

På Overview-tab i drawer, under "Oppsummering":
```
Teams aktive i sesongen: 2
  • Sommercrew (6 ansatte, leder: Anna)
  • Kjøkken-ekstra (3 ansatte)
[Administrer teams ▸]  (lenke til /dashboard/organization?tab=teams&season=...)
```

Teams administreres **ikke** i årshjul. Deres grunnstruktur hører hjemme i `/dashboard/organization`. Årshjul viser kun **binding** sesong↔team.

### 7.4 Fremtidig: per-team labor-faktor (P2+)

Hvis bedriften trenger å si "sommercrew er 1.3× dyrere fordi de trenger overtid", kan vi utvide i fremtiden med:
- Ny kolonne `team.labor_cost_factor` (DEFAULT 1.0), ELLER
- Ny tabell `team_cost_adjustment` hvis det trengs granulær per-dato-justering.

Dette er **ikke del av P1**. Krever eget ADR.

---

## 8. Åpningstider — D1 detaljert

### 8.1 Tre-lags prioritet

Resolver henter effektiv åpningstid med denne prioriteten (høyest først):

1. `department_hours_override` med eksakt `override_date` — høyest prioritet.
2. `department_operating_hours` med `season_id = aktiv_sesong` — sesong-scoped.
3. `department_operating_hours` med `season_id IS NULL` — workspace-default.
4. Fallback: I1 industry-seeded defaults (hospitality: 11–23 hverdag).

### 8.2 UX i drawer

Som vist i §4.5 — provenans-badge viser hvilket lag verdien kommer fra. Når bruker endrer en celle, spørres: "Vil du sette dette som sesong-spesifikk eller override for én dag?"

### 8.3 Kobling til events

Når bruker oppretter event med checkbox "Koble til hours-override":
- Event får `hours_override_id` FK.
- Override opprettes med `reason = event.name` og `planning_event_id = event.id`.
- På timeline vises pinnen med et lite ur-ikon ved siden av for å indikere "påvirker åpningstid".

### 8.4 Legacy-advarsel

**ALDRI bruk `operating_hours` eller `company_opening_hours`** i årshjul-koden. Kun `department_operating_hours` (runtime truth). Dette er kjent trap i cascade-modellen.

---

## 9. Event Engine — kobling

### 9.1 Cascade produserer, Event Engine konsumerer

Kritisk skille fra cascade-skillen: Cascade er **beregning**. Event Engine er **orkestrering**. Årshjul tilhører cascade — men når sesong aktiveres, må ting skje i Event Engine.

### 9.2 Tilkoblingspunkter

Når `season activated` emittes:

```
season.status: draft → active
   │
   ├─▶ emit("season activated") → activity_trail + engine_event
   │
   ├─▶ engine_event trigger → engine_process "season-activation" (planned)
   │     │
   │     ├─▶ step: propagateBudgetTargets() → workspace_budget rows
   │     ├─▶ step: upsertDepartmentSessions() for alle dager i perioden
   │     ├─▶ step: resolveSessionHooks() — bind session_hook til sessions
   │     └─▶ step: notify workspace admins
   │
   └─▶ UI opdateres via Supabase realtime
```

### 9.3 Idempotens (P0-gap i PRD §12)

**Problem:** Aktivering kan trigges fra (a) UI-mutasjon, (b) DB-trigger, (c) manuell replay. Tre kilder = risiko for duplikater.

**Fix i dette speccen:**
1. `engine_event` for aktivering bruker idempotency key: `season_activated:{season_id}:{activated_at_truncated_to_minute}`.
2. `engine_process` sjekker key før execution; returnerer existing state ved duplikat.
3. `department_session`-upsert er idempotent per `(department_id, date)`.

### 9.4 Hva som **ikke** skal være i Event Engine

- Rene beregninger (dag-mål, time-mål, bemanning) → cascade pure functions.
- UI-visningslogikk → React state / TanStack Query.
- Telemetri-emit → `@smartout/telemetry` direkte.

Event Engine brukes kun for **flersteg-sideeffekter** som må være idempotente, auditerte og potensielt asynkrone.

---

## 10. Telemetri

### 10.1 Mutasjoner (krav: emit etter hver)

Fra `packages/telemetry/src/registry.ts` — kanonisk liste:

| Event | Trigger | Destinasjoner |
| --- | --- | --- |
| `season created` | SeasonCreateSheet submit, draw-to-create commit | activity_trail, engine_event |
| `season updated` | Drawer-felt lagring, drag-resize | activity_trail |
| `season activated` | "Aktiver"-knapp | activity_trail, engine_event |
| `season archived` | "Arkiver"-knapp | activity_trail, engine_event |
| `season_budget updated` | Machine Room lagring | activity_trail, engine_event |
| `season_budget propagated` | "Propager"-knapp | activity_trail, engine_event |
| `season_goal created/updated/deleted` | Mål-tab CRUD | activity_trail |
| `season_operating_hours updated/override_created/override_deleted` | Åpningstider-tab | activity_trail |
| `season_policy_binding updated` | Prosedyrer-tab (P2) | activity_trail |
| `planning_event created/updated/deleted` | Event CRUD | activity_trail, engine_event (created only) |
| `planning_cycle created/duplicated` | Dupliser år | activity_trail |

### 10.2 Navigasjonsevents (PostHog-only)

| Event | Trigger |
| --- | --- |
| `season year_navigated` | Year prev/next, quick-jump |
| `season block_clicked` | Block-klikk |
| `season pin_clicked` | Pin-klikk |
| `year_wheel zoom_changed` | Year ↔ Month toggle |
| `year_wheel draw_to_create_started` | Mousedown på tomt canvas |
| `year_wheel draw_to_create_committed` | Mouseup → sesong opprettet |
| `year_wheel draw_to_create_cancelled` | Escape |

### 10.3 Payload-krav

Alle events inkluderer:
- `workspace_id` (required)
- `actor_id` (profile_id, required, ikke tomstreng — ADR-0134)
- `entity_type` + `entity_id` der relevant
- `properties.data` med operasjonsspesifikke felt (f.eks. `reason: "drag_resize"`)

---

## 11. Nordic Split — designtokens

### 11.1 Farger

Ingen hardkodede farger. Kun CSS-variabler:
- Canvas bakgrunn: `bg-background`
- Month-labels: `text-muted-foreground`
- I-dag markør: `border-foreground/60`
- "NORMAL DRIFT"-watermark: `text-muted-foreground/30`
- Block draft: `bg-muted text-muted-foreground border-dashed`
- Block active: `bg-primary text-primary-foreground shadow-sm`
- Block archived: `bg-muted/40 text-muted-foreground`
- Pin internal: `bg-accent`
- Pin cultural: `bg-primary`
- Pin critical: `bg-destructive`
- Drawer bakgrunn: `bg-card border-border`
- Aktiv status-badge: `bg-success/10 text-success border-success/20`
- Draft status-badge: `bg-muted text-muted-foreground`
- Archived status-badge: `bg-muted/50 text-muted-foreground/70`

Farge per sesong (bruker-valgt) er lagret i `season.color` og brukes kun på block-fill. Den respekterer light/dark via OKLCH-mapping.

### 11.2 Typografi

- Sidetittel: `font-heading text-3xl` (Instrument Serif)
- Year-label i YearNavigation: `font-heading text-2xl`
- Month-labels på canvas: `font-sans text-sm tracking-wide font-medium text-muted-foreground`
- Block-labels: `font-sans text-sm font-medium`
- Drawer-header: `font-heading text-xl`
- Tabs: `font-sans text-sm font-medium`
- Tabeller (Machine Room): `font-mono text-sm` for tall, `font-sans text-sm` for labels

### 11.3 Motion

- Drawer slide-in: 220ms, `ease-out`
- Block drag: ingen motion (direkte under cursor)
- Draw phantom-block: `opacity-0.6`, rask fade-in (80ms)
- Pin-hover popover: 120ms fade-up
- Year-navigation: 160ms cross-fade av canvas (ikke slide)
- Zoom year↔month: 240ms eased scale

Motion-curves: standardiserte springs fra `packages/design-tokens/src/native.ts`. Ingen egne tweens.

---

## 12. Tilstandsmaskin — UI-tilstander

### 12.1 Page-load-tilstander

| Tilstand | Vises som |
| --- | --- |
| Loading (første render) | YearWheelLoading skeleton: canvas grid + 3 dempede block-stubs |
| Empty (ingen sesonger, ingen events) | Canvas med "NORMAL DRIFT"-watermark + onboarding-ping: "Dra over canvas for å tegne første sesong" |
| Populated | Full rendering |
| Error (query fail) | Fallback: stille canvas + toast "Kunne ikke laste sesong-data" + retry-knapp |
| Workspace ikke bootstrapped | Redirect til onboarding (I1 må kjøre først) |

### 12.2 Drag-tilstander

| Tilstand | Visuell respons |
| --- | --- |
| `idle` | Normal rendering |
| `dragging_edge` | Cursor: `ew-resize`. Block får `ring-2 ring-primary`. Live dato-tooltip. |
| `dragging_block` | IKKE støttet i P1 (kun edge-resize). Planlagt P2: flytt hele blocken. |
| `drawing_new_season` | Phantom-block følger cursor. Dato-range vist. |
| `commit_pending` | Optimistic update vises. Hvis feil: rollback + toast. |

### 12.3 Gate-tilstander på "Aktiver"

| Tilstand | "Aktiver"-knapp |
| --- | --- |
| Ingen budsjett | Disabled + "Legg til inntektsmål i Machine Room" |
| Ingen åpningstider | Disabled + "Sett åpningstider for minst én avdeling" |
| Overlapp med annen aktiv | Disabled + "Overlapper med [Sesong X] — arkiver den først" |
| Alt OK | Enabled, primary-farge |

---

## 13. Mobil — parity og scope

### 13.1 Mobil er read-only i P1

Per ADR-0133: Mobil eier D6 + C4. Årshjul er D1+D4+D5 (authoring). Mobil skal ikke redigere sesonger, events, eller budsjett.

### 13.2 Hva mobil viser

- Liste over aktive sesonger
- Current season + progress: "Sommer 2026 — dag 34 av 78"
- Kommende events i sesongen (neste 7 dager)
- Mine skift innenfor aktiv sesong

### 13.3 Hva mobil ikke gjør

- Ingen canvas-visning (ingen draw, ingen drag).
- Ingen Machine Room.
- Ingen CRUD.

### 13.4 Data-layer (krav)

Alle queries i `@smartout/year-wheel/hooks` skal være mobile-compatible. Ingen React-DOM-avhengigheter, ingen window-assumpions. Dette er allerede oppfylt per utforskningen (hooks ligger i packages/).

---

## 14. Komponenter — forbedringsliste

Basert på nåværende `apps/web/src/app/dashboard/year-wheel/_components/` vs. spec:

| Komponent | Status | Endring for spec-etterlevelse |
| --- | --- | --- |
| `YearWheelTimeline.tsx` | Eksisterer | Legg til "NORMAL DRIFT"-watermark; draw-to-create mousedown-handler; "I dag"-markør prominent |
| `TimelineBlock.tsx` | Eksisterer | Status-basert styling (draft/active/archived); ring ved drag; overlap-lanes |
| `TimelinePin.tsx` | Eksisterer | Kategori-basert farge; confidence-ring for AI-generated; event-date-range som kort stav for multi-day |
| `YearNavigation.tsx` | Eksisterer | Zoom-toggle (Year/Month) mangler — legg til |
| `SeasonCreateSheet.tsx` | Eksisterer | Behold som fallback; default blir draw-to-create |
| `SeasonDrawer.tsx` | Eksisterer | Tab-omorganisering: fjern "Machine Room" fra tabs, legg inn som separat sheet-åpner |
| `SeasonOverviewTab.tsx` | Eksisterer | "Hva mangler"-live-liste; team-summary-seksjon |
| `SeasonHoursTab.tsx` | Eksisterer | Provenans-badges ("workspace default" / "sesong" / "override") |
| `SeasonGoalsTab.tsx` | Skelett | P1: fullfør CRUD-wiring |
| `SeasonProceduresTab.tsx` | Skelett | P2: beholdes som placeholder |
| `BudgetSetupTab.tsx` | Eksisterer, i Machine Room | Beholdes |
| `DayFactorsTab.tsx` | Eksisterer | Normalisering-preview ("dette normaliserer til avg 1.0") |
| `HourFactorsTab.tsx` | Eksisterer | Varsel ved alle-null |
| `MachineRoomSheet.tsx` | Eksisterer | Beregnet-konsekvens-seksjon (dagsmål, topptime, bemanning) live-oppdateres |
| Nye: `DrawToCreateOverlay.tsx` | Mangler | Phantom-block + inline navn-popover |
| Nye: `SeasonColorPicker.tsx` | Mangler | Valg av sesong-farge (default-palett) |
| Nye: `EventPopover.tsx` | Delvis | Detalj-popover fra pin-klikk |

---

## 15. ADR-behov

Denne speccen avdekker behov for følgende ADR-er (utkast, skrives separat):

| ADR-utkast | Tema | Grunn |
| --- | --- | --- |
| ADR-NEXT-01 | Draw-to-create som primær UX for sesong-opprettelse | Endrer standard fra modal-form til canvas-interaksjon |
| ADR-NEXT-02 | Season activation idempotency via engine_event keys | Løser P0 i PRD §12 |
| ADR-NEXT-03 | Planning events default-scoped til aktiv planning_cycle | Løser P0 scoping-gap |
| ADR-NEXT-04 | Machine Room som separat sheet, ikke tab | Designprinsipp: bredere tabeller trenger mer plass enn drawer |
| ADR-NEXT-05 | "NORMAL DRIFT" som canvas-identitet | Bevisst branding av empty state — ikke "ingen data" |
| ADR-NEXT-06 | Team-faktorer bruker eksisterende `team.season_id` + `day_factor` | Unngår ny tabell; venter på reell P2-behov for ny kolonne |

---

## 16. Åpne spørsmål

1. **Sesong-farge-palett:** Skal brukeren velge fritt (color picker) eller fra en kuratert palett (8–10 farger)? Forslag: **kuratert palett** av OKLCH-verdier som respekterer dark mode automatisk.
2. **Multi-workspace companies:** Hvis en `company` har flere `workspace`, skal årshjulet kunne vises på company-nivå eller kun workspace-nivå? Forslag: **kun workspace** i P1. Company-aggregat er en annen flate.
3. **Event-dupliseringslogikk ved `duplicateYear()`:** Skal ukedagsposisjon bevares (f.eks. hvis "Black Friday fredag" var 29. november 2024, skal den bli 28. november 2025)? Eller eksakt dato? Forslag: **eksakt dato**, men gi advarsel hvis helligdag flytter seg.
4. **Recurring events (RRULE):** Hvor langt frem expander vi recurring events? Forslag: **kun i aktivt år + 2 år frem**, pluss en generert "virtual pin" som klikk-bare genererer fremtidig expansion.
5. **Archive-cascade:** Når sesong arkiveres, skal events i den også arkiveres? Forslag: **nei** — events beholder egen lifecycle; arkivering av sesong er kun visuell.
6. **Sesong-mal:** Skal man kunne lagre sesong-mal (budget + factors) og gjenbruke neste år? Forslag: **P2**.

---

## 17. Implementeringsrekkefølge (for build-agent)

**P0 — Før merge til development:**
1. Event chain idempotency (ADR-NEXT-02).
2. Events scoping til planning_cycle (ADR-NEXT-03).
3. E2E-test for season-activate → department_session-upsert.

**P1 — Designspec delivery:**
4. Draw-to-create overlay + commit-flow.
5. "NORMAL DRIFT"-watermark.
6. Canvas zoom-toggle (Year/Month).
7. Machine Room som separat sheet.
8. Provenans-badges på åpningstider.
9. "Hva mangler"-live-liste i Overview-tab.
10. Status-basert block-styling.
11. Kategori-basert pin-styling.
12. Goals-tab CRUD ferdig.

**P2 — Etter P1-stabilisering:**
13. Team-summary i Overview.
14. Procedures-tab wiring.
15. Recurring events RRULE-expansion.
16. Budget cloning ved duplicateYear().
17. Sesong-mal-lagring.

**P3 — Mobil:**
18. Read-only mobil-visning (liste + current-season progress).

---

## 18. Referanser

- **PRD:** `docs/modules/MODULE_YEAR_WHEEL_PRD.md` (v2.0.0)
- **Cascade-spec:** `docs/superpowers/specs/2026-03-21-cascade-scheduling-system-design.md`
- **Cascade foundation:** `docs/superpowers/specs/2026-03-22-cascade-foundation-completion-design.md`
- **Gap closure (superseded):** `docs/superpowers/specs/2026-04-10-season-year-wheel-gap-closure-design.md`
- **Runtime cutover:** `docs/architecture/cascade-runtime-cutover-checklist.md`
- **Industry bootstrap (I1):** `packages/ai/src/industry/packages/hospitality.ts`
- **Pure functions:** `apps/web/src/lib/season-calculations.ts`, `apps/web/src/lib/cascade/`
- **Telemetri-registry:** `packages/telemetry/src/registry.ts`
- **ADR-0085:** Season overlap rules
- **ADR-0115:** RSC migration pattern
- **ADR-0133:** Mobile Surface Boundary (web composes, mobile executes)
- **ADR-0134:** Mobile Telemetry Contract

---

## Changelog

| Dato | Versjon | Endring | Forfatter |
| --- | --- | --- | --- |
| 2026-04-19 | 1.0 | Initial draft — helhetlig designspec for Årshjul | Pontus + Claude |
