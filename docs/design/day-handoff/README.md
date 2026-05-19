# Smartout — Dag-informasjon · Handoff

> **Til utvikler:** Dette er spec for **Dag & Sesjon** — modulen som styrer en dag i drift fra åpning til oppgjør. Alt visuelt språk, alle 10 widgets, datamodellen og fase-logikken er **allerede etablert i prototypen under `source/`**. Ingenting skal designes på nytt. Hent komponentene derfra, port til deres egen stack, og hold semantikken (faser, hooks, oppgjør) intakt — den er produktets ryggrad.

---

## Innhold

1. [Hva er Dag-informasjon?](#1-hva-er-dag-informasjon)
2. [Datamodellen — Sesjon, Hook, Task, Avvik](#2-datamodellen--sesjon-hook-task-avvik)
3. [De seks fasene](#3-de-seks-fasene)
4. [10 kanoniske widgets](#4-10-kanoniske-widgets)
5. [Web day-control panel (leder/admin)](#5-web-day-control-panel-lederadmin)
6. [Mobil Home (ansatt)](#6-mobil-home-ansatt)
7. [Admin-avstemming](#7-adminavstemming)
8. [Designsystem — tokens](#8-designsystem--tokens)
9. [State & cross-tab triggere](#9-state--cross-tab-triggere)
10. [Filoversikt i `source/`](#10-filoversikt-i-source)
11. [Akseptansekriterier](#11-akseptansekriterier)
12. [Åpne spørsmål](#12-åpne-spørsmål)

---

## 1. Hva er Dag-informasjon?

Dag-informasjon er det orkestrerende laget i Smartout — det som binder ansatte, oppgaver, avvik, omsetning og oppgjør sammen til **én sesjon per dag per avdeling**. Hver sesjon er en tilstandsmaskin som beveger seg gjennom seks faser, og hver fase bestemmer hva både leder og ansatt ser.

Tre roller bruker modulen:

| Rolle | Eksempel | Inngang |
|---|---|---|
| **Ansatt** | Anna Olsen, Servitør | Mobil Home — egen vakt, neste oppgave, klokke inn/ut |
| **Leder** | Marcus Lien, Kjøkkensjef | Web day-control panel — 7 sub-tabs, sender til oppgjør |
| **Admin** | Pontus Sjögren | Avstemming — ukesoversikt, godkjenner/låser dager |

**Sentral regel:** Faser driver visningen, ikke omvendt. Alle skjermer leser `session.phase` og rendrer deretter. Endrer du fase, endrer hele UI seg samtidig.

---

## 2. Datamodellen — Sesjon, Hook, Task, Avvik

> **Kilde:** `source/day/data.js`. Bruk feltnavnene 1:1.

### Session (én per dag per avdeling)

```js
{
  id: 'ses-2026-04-19-kjokken',
  date: '2026-04-19',
  dayLong: 'Mandag', dayNum: '19', month: 'april', year: '2026',
  relativeLabel: 'I dag',                // 'I går', 'I morgen', dato
  dept: 'Kjøkken', deptKey: 'kjokken',
  location: 'Café Skuta',
  plannedOpen: '11:00', plannedClose: '23:00',
  openedAt: '10:58',                     // null før åpning
  closedAt: null,
  graceMinutes: 15,                      // hvor lenge etter plannedOpen før status=missed
  openedBy: { name: 'Bjørn Tandberg', role: 'Sous-chef', time: '10:58' },
  signoffNotes: '',
}
```

### Hook (rutine/protokoll knyttet til et tidspunkt i sesjonen)

```js
{
  id: 'h3',
  type: 'pre_open' | 'open' | 'scheduled' | 'pre_close' | 'close',
  title: 'Lunsj-prep',
  time: '12:00',
  offset: '+1t',                        // relativ til open/close
  state: 'completed' | 'in_progress' | 'upcoming',
  progress: '2/4',
  tasks: [ Task, … ]
}
```

### Task (på en hook)

```js
{
  id: 't10',
  title: 'Svinekjøtt prep til middag',
  owner: 'Cecilie',
  done: false,
  active: true,                          // pågår nå
  overdue: false,
  compliance: true,                      // krever HMS/hygiene-bevis
  evidence: '0/2 bilder',                // null hvis ikke bilde-krav
  note: 'Alle under 4°C',                // valgfri loggverdi
}
```

### Deviation (avvik)

```js
{
  id: 'dv1',
  severity: 'critical' | 'high' | 'medium' | 'low',
  type: 'Temperatur' | 'Hygiene' | 'HMS' | 'Drift',
  status: 'open' | 'resolved',
  title: 'Kjølerom 2 over grenseverdi 20 min',
  desc: '…',
  reporter: 'Anna Olsen',
  time: '13:45',
  photos: 3,
  assignedTo: 'Marcus Lien',
  resolvedBy: 'Bjørn',                   // kun hvis status=resolved
  resolvedAt: '12:28',
}
```

### Broadcast (kort melding i sesjonen)

```js
{
  id: 'b1',
  type: 'note' | 'alert' | 'reminder',
  author: 'Marcus Lien', role: 'Kjøkkensjef',
  time: '09:12',
  title: 'Lunsj-gjest: bordbestilling 14',
  body: 'Familie på 8, to barn, en vegetar…',
}
```

### Shift (vakter knyttet til sesjonen)

```js
{
  id: 's2',
  name: 'Bjørn Tandberg', role: 'Sous-chef', initials: 'BT',
  dept: 'kjokken' | 'sal' | 'bar' | 'event',
  start: '10:58', end: '19:00',
  status: 'upcoming' | 'active' | 'completed',
  live: true,
  break: 'pause' | null,
  planned: 8.0, actual: 3.6,
  isMe: false,                           // true for innlogget bruker
}
```

### KPI (vises på Oversikt + Oppgjør)

```js
{ key, label, value, unit, planned, delta, deltaDir: 'up'|'down', sub }
```

---

## 3. De seks fasene

> **Kilde:** `source/day/data.js → PHASES`, `source/day/widgets.jsx → PHASE_STYLES`. Fase-logikken er hjertet av produktet.

| Fase | Når | UI-tone | Hva ansatt ser | Hva leder ser |
|---|---|---|---|---|
| `upcoming` | Før `plannedOpen` | nøytral grå | Mobile Home Before — neste vakt, kolleger, meldinger | Tom dagsoversikt, planlegging |
| `active` | Mellom `openedAt` og `closedAt` | grønn (pulserende) | Mobile Home During — live timer, neste oppgave, kolleger | Hele day-control: oppgaver, avvik, bemanning |
| `pending_signoff` | Etter `closedAt`, før leder bekrefter | gul/varsel | Mobile Home After — "venter på oppgjør", neste vakt | Sign-off-panel, gjør oppgjør → admin |
| `closed` | Etter leder-oppgjør, før admin låser | nøytral | Read-only kvittering | Read-only sammendrag |
| `missed` | `now > plannedOpen + graceMinutes` og ikke åpnet | rød/error | Varsel "vakt ikke åpnet" | Banner med "Åpne nå" / "Marker som ikke avholdt" |
| `locked` | Etter admin-godkjenning | brand-orange | Tall låst inn, ingen flere endringer | Read-only, kan reverseres av admin |

**State-overganger (auto + manuelle):**
- `upcoming → active` — manuelt av første ansatt eller leder som "åpner dagen" (`openedAt` settes)
- `upcoming → missed` — auto når `now > plannedOpen + graceMinutes`
- `active → pending_signoff` — manuelt av leder ved "Avslutt dagen" (`closedAt` settes)
- `pending_signoff → closed` — manuelt av leder ved "Godkjenn oppgjør"
- `closed → locked` — manuelt av admin (uke-låsing)

---

## 4. 10 kanoniske widgets

> **Kilde:** `source/day/widgets.jsx`. Disse er byggesteinene — alt under (§5–§7) er kompositt av disse. **Bygg dem først, port resten etter.**

| # | Komponent | Hvor brukes den |
|---|---|---|
| 1 | **SessionHeader** | Top på web day-control og mobile Home. Viser dato, fase-badge, åpningstid, hvor lenge sesjonen har vart. Variants: `full` (44px serif) og `inline` (28px). |
| 2 | **PhaseTimeline** | Vannrett tidslinje 10:30–23:00 med hook-prikker (completed/in_progress/upcoming) og en NÅ-markør i orange. |
| 3 | **ShiftCard** | Person + tid + rolle + status. Variants: `default`, `detailed` (med planlagt/faktisk timer), `compact` (radform). 3px venstre-stripe = avdelingsfarge. |
| 4 | **TaskRow** | Avhukingsboks + tittel + eier + bevis/HMS-ikoner. Bruker subtask-state (`done`, `active`, `overdue`). |
| 5 | **HookTile** | Sammenleggbart kort som inneholder TaskRows. Header: tid · tittel · type-pill · `progress` ("2/5"). |
| 6 | **KpiTile** | Tall + enhet + delta-pil (up/down) + sub-tekst. Mono-font, tabular-nums. |
| 7 | **DeviationCard** | 3px venstre-stripe (severity-farge), AVVIK-eyebrow, beskrivelse, reporter, bilder-counter. Inkluderer actions ("Marker som løst"). |
| 8 | **BroadcastComposer** | Type-pills (Melding/Alert/Påminnelse) + input + Send-knapp. Sender til hele teamet på vakt. |
| 9 | **SignoffPanel** | Lederens "Avslutt dagen". 3 stats (oppgaver, åpne avvik, siste ut) + notat-felt + stor primær CTA. |
| 10 | **ReconSummary** | Adminoppgjør — 2×2 grid med Omsetning, Arbeidstid, Lønnskostnad, Margin + delta. To CTA-knapper "Spør om revisjon" / "Godkjenn oppgjør". |

I tillegg: **PhaseBadge** (gjenbrukes overalt) — rund pill med fase-dot, ev. pulserende animasjon.

### Variantmatrise (hvilke variants finnes)

- `SessionHeader`: `full` · `inline` · med/uten close-knapp
- `ShiftCard`: `default` · `detailed` · `compact`
- `HookTile`: `defaultOpen=true` · `false`
- `KpiTile`: `default` · `compact`
- `DeviationCard`: `default` (med actions) · `compact` (uten)

---

## 5. Web day-control panel (leder/admin)

> **Kilde:** `source/day/web-day.jsx → WebDayControl`. Brukes av Marcus (leder) på desktop. Reagerer på `phase`-endringer — bytt fase via Tweaks i prototypen for å se alle tilstander.

### Struktur (top → bunn)

1. **Topbar** — Smartout-wordmark, bruker-chip høyre
2. **SessionHeader (full)** — dato, fase, åpningstid
3. **Sub-nav (7 tabs)** — Oversikt · Dagslinjen · Bemanning · Oppgaver · Avvik · Melding · Oppgjør
4. **Tab-body** — egne layouts per tab

### Tab-innhold

| Tab | Layout |
|---|---|
| **Oversikt** | 2-kol: venstre = 3×2 KPI + PhaseTimeline + aktiv bemanning. Høyre = åpne avvik + siste meldinger. |
| **Dagslinjen** | PhaseTimeline øverst + alle HookTiles vertikalt (in_progress er default åpen). |
| **Bemanning** | Avdelings-chips + tabell (Tid / Person / Planlagt / Faktisk / Status). |
| **Oppgaver** | Alle HookTiles, default åpen for ikke-fullførte. |
| **Avvik** | Stack av DeviationCards (full variant, med actions). |
| **Melding** | BroadcastComposer øverst + liste over tidligere meldinger med 3px farge-stripe per type. |
| **Oppgjør** | 2-kol: SignoffPanel + ReconSummary. Aktiveres når `phase === 'pending_signoff'`. |

### Atferd

- Klikk på sub-tab → `setTab(key)`. Underline-bar slider til ny tab.
- I `Oppgjør`-tab: hovedknappen "Bekreft og send til oppgjør" → setter `phase = 'pending_signoff'`, varsler admin.
- I `Avvik`-tab: "Marker som løst" → `deviation.status = 'resolved'`.

---

## 6. Mobil Home (ansatt)

> **Kilde:** `source/day/mobile-day.jsx → MobileHomeFrame`. Anna Olsen sin opplevelse. Tre faser, tre helt forskjellige skjermer — men samme komponent-shell.

### 6.1 Before (`phase === 'upcoming'`)
*`MobileHomeBefore`*

- **MobilePhaseHeader** — "God dag, Anna", fase-eyebrow, vakt-tid
- **MobileWeekStrip** — 7 piller (man–søn), dato i mono, orange dot under dager med vakt
- **"Din neste vakt"-kort** — stort mono-tall (`15:00 – 23:00`), "starter om 2t 28m", avdelingschip
- **"Hvem er på i dag"** — opptil 4 kolleger med live-dot
- **"Meldinger til teamet"** — 2 siste broadcasts
- **MobileTabBar** — Hjem · Vakter · Oppgaver · Meg

### 6.2 During (`phase === 'active'`) ⭐
*`MobileHomeDuring`*

Hovedscreen — kjernen av appen.

- **Live timer-kort** — mørk gradient med orange radial glow:
  - "Klokket inn" eyebrow med pulserende dot
  - **52px mono-tall som tikker hvert sekund** (`03:34:15`)
  - Progress-bar (faktiske / 8t)
  - 3-kol mini-stats: Tjent (kr) · Pause (min) · Tillegg (+kr)
  - To CTA: "Ta pause" (sekundær) · "Klokk ut" (primær orange)
- **"Neste oppgave"-kort** — tid, tittel, om bilde kreves, "Se alle oppgaver (3)"
- **"På vakt nå"** — kolleger med pause-status
- **2×1 kvikkactions** — "Rapportér avvik" · "Meld til leder"

**Timer-implementasjon:** start-tidspunkt persisters (server eller localStorage). Hver klient regner ut elapsed lokalt mot `Date.now()` — ikke send tikker fra server. Format: `HH:MM:SS` med `padStart`.

### 6.3 After (`phase === 'pending_signoff'` eller `closed`)
*`MobileHomeAfter`*

- **"Vakten er ferdig"** — grønn check-eyebrow, serif "God jobb i dag.", klokket-ut tid
- **3-kol oppsummering** — Timer · Lønn · Tillegg
- **"Venter på oppgjør"-banner** — gul, forklarer at lederen godkjenner først
- **"Neste vakt"-kort** — dag · tid · avdeling · hvor lenge fri

### Frame

Phone-rammen er 390–414 px bred. Inkludert i `MobileHomeFrame`: status-bar (44px), tab-bar (sticky bunn). Innhold scroller mellom.

---

## 7. Admin-avstemming

> **Kilde:** `source/day/recon.jsx → ReconView`. Pontus' arbeidsflyt — gå gjennom uka, godkjenn dag for dag.

### Liste-visning (`ReconList`)

- **Eyebrow** — "Avstemming · Pontus Sjögren"
- **Tittel (serif 40px)** — "Uke 17 — 13.–19. april"
- **3 oppsummerings-kort** — Venter oppgjør · Klar til å låse · Avvik denne uka
- **Tabell** med kolonner: Dato · Avdeling · Omsetning · Labor % · Status · (åpne →)
- Hver rad har **RECON_STATUS**-badge (active/pending/closed/locked/missed). Klikk på `pending_signoff`-rad → åpne detalj-overlay.

### Detalj-overlay

Trigget av klikk på 18. apr Kjøkken-raden. Viser ReconSummary i full bredde med all data fra sesjonen.

---

## 8. Designsystem — tokens

> **Kilde:** `source/styles.css` + `source/components/primitives.jsx → SO`. Smartout sitt eksisterende type/farge/spacing-vokabular. Disse skal IKKE finnes på nytt.

### Farger

```css
/* Brand */
--orange:       #f97316;
--orange-light: #fb923c;
--orange-dark:  #c2410c;
--purple:       #8b5cf6;

/* Semantisk */
--success: #11ad32;
--warning: #c18200;
--error:   #e7000b;
--info:    #2784d5;

/* Avdelinger */
--dept-kjokken: #ee560c;
--dept-sal:     #00ab93;
--dept-bar:     #864ad2;
--dept-event:   #c18200;
--dept-lager:   #008388;

/* Surfaces (warm neutrals) */
--bg:        #fdfcfa;   /* sand-hvit */
--card:      #ffffff;
--secondary: #f5f3f0;
--fg:        #1c1814;
--muted:     #7a756e;
--border:    #e8e5e1;
```

### Fase-farger (utledet — fra `PHASE_STYLES`)

| Fase | dot | fg | bg |
|---|---|---|---|
| `upcoming` | `#7a756e` | `#5a544c` | `rgba(122,117,110,0.10)` |
| `active` | `#11ad32` (puls) | `#0a7a22` | `rgba(17,173,50,0.10)` |
| `pending_signoff` | `#c18200` | `#8a5d00` | `rgba(193,130,0,0.12)` |
| `closed` | `#908a82` | `#7a756e` | `rgba(122,117,110,0.08)` |
| `missed` | `#e7000b` | `#9a000a` | `rgba(231,0,11,0.10)` |
| `locked` | `#f97316` | `#c2410c` | `rgba(249,115,22,0.10)` |

### Severity-farger (på DeviationCard's venstre-stripe)

`critical` / `high` → `--error` · `medium` → `--warning` · `low` → `--info`

### Typografi

- **Display / serif:** Instrument Serif, 22–44px, letter-spacing `-0.02em`
- **Brødtekst:** Geist (400/500/600/700)
- **Mono (tider, KPI-tall, tellverk):** Geist Mono, `font-variant-numeric: tabular-nums`
- **Eyebrows:** Geist 600/700, 10px, `letter-spacing: 0.14–0.18em`, UPPERCASE

### Spacing & form

- 4px grid (4, 6, 8, 10, 12, 14, 16, 18, 20, 24)
- Radius: kort `14–16px` · chips `9999px` · ikon-rammer `10–12px` · knapper `10–12px`
- Primær-CTA shadow: `0 2px 12px rgba(249,115,22,0.28)`
- Pulse-animasjon (live indicators): `soPulse 1.8s ease-in-out infinite` — definert som keyframe i `source/Smartout Dag-informasjon.html`

### Avdelingsstripe-konvensjon

3px venstre-border eller -stripe brukes konsekvent for å indikere avdeling: ShiftCard, mobile vakt-kort, broadcast-rader. Fargen er én av `--dept-*` mappet fra `shift.dept`.

---

## 9. State & cross-tab triggere

### Globalt (per sesjon)

```js
session = {
  phase, openedAt, closedAt, signoffNotes,
  hooks: Hook[],
  shifts: Shift[],
  deviations: Deviation[],
  broadcasts: Broadcast[],
  kpis: Kpi[],
}
```

### Web day-control (lokalt)

```js
const [tab, setTab] = useState('overview');
```

`phase` er lest fra session (i prototypen drevet av Tweaks-toggles).

### Mobile Home (lokalt)

```js
const [elapsedTime, setElapsed] = useState(...); // tikker hvert sekund (kun During)
```

### Atferd som krysser views

| Trigger | Effekt |
|---|---|
| Ansatt klokker inn (mobil) | Session går `upcoming → active` om første person |
| Ansatt huker av Task (mobil) | `task.done = true`, oppdaterer `hook.progress`, dukker opp i ledere sin "Oversikt" |
| Leder trykker "Avslutt dagen" | `phase = 'pending_signoff'`, mobile-bruker ser "venter på oppgjør" |
| Admin trykker "Godkjenn oppgjør" | `phase = 'closed'` |
| Avvik rapporteres på mobil | Vises momentant i lederens "Avvik"-tab + Oversikt-sidebar |
| Bcast sendt av leder | Vises i mobil "Meldinger til teamet" |

Animasjoner: hold lett. Pulserende dots der det er live-state. Sub-tab underline glider 150ms. Ingen tunge spring-animasjoner.

---

## 10. Filoversikt i `source/`

```
source/
├── Smartout Dag-informasjon.html   # Entry — laster alle scripts, definerer @keyframes soPulse
├── styles.css                      # Designsystem-tokens (felles med resten av Smartout)
├── design-canvas.jsx               # DCSection / DCArtboard — kun for prototype-rammeverket
├── components/
│   └── primitives.jsx              # SO, Icon, Wordmark, Badge, Button, Input, Tabs, NordicSplit
└── day/
    ├── data.js                     # All mock-data — SESSION, PHASES, KPIS, SHIFTS, HOOKS, DEVIATIONS, BROADCASTS, MY_WEEK, MY_SHIFT, RECON_LIST
    ├── widgets.jsx                 # 10 kanoniske widgets (§4) ⭐
    ├── web-day.jsx                 # WebDayControl + 7 tabs (§5)
    ├── mobile-day.jsx              # MobileHomeFrame + Before/During/After (§6)
    └── recon.jsx                   # ReconList + detail-overlay (§7)
```

**Anbefalt mappestruktur i target-app:**

```
features/day/
├── domain/
│   ├── session.ts          # Session, Phase, transitions
│   ├── hooks.ts            # Hook, Task
│   ├── deviations.ts
│   └── broadcasts.ts
├── widgets/                # De 10 widgetene fra §4
│   ├── SessionHeader
│   ├── PhaseTimeline
│   ├── ShiftCard
│   ├── HookTile / TaskRow
│   ├── KpiTile
│   ├── DeviationCard
│   ├── BroadcastComposer
│   ├── SignoffPanel
│   ├── ReconSummary
│   └── PhaseBadge
├── web/
│   ├── DayControlPanel     # Shell + sub-nav
│   └── tabs/               # Overview, Timeline, Roster, Tasks, Deviations, Broadcast, Signoff
├── mobile/
│   └── Home/               # Before, During, After
└── admin/
    └── ReconList
```

### Slik kjører du prototypen lokalt

Åpne `source/Smartout Dag-informasjon.html` i en moderne nettleser. Babel-transpilerer JSX in-browser; ingen build steg. Toggle Tweaks i toolbar for å bytte fase.

---

## 11. Akseptansekriterier

### Widgets (§4)
- [ ] Alle 10 widgets rendrer pixel-likt med samme variants
- [ ] `PhaseBadge` har pulserende dot for `active`-fase
- [ ] `PhaseTimeline` viser NÅ-markør riktig posisjonert (0–100% basert på elapsed / total)
- [ ] `HookTile` toggler open/close, default-åpen for `in_progress`
- [ ] `KpiTile` bruker mono + tabular-nums for tall, deltapil opp/ned

### Faser (§3)
- [ ] Alle 6 fasene har korrekt PHASE_STYLES (dot, fg, bg)
- [ ] State-overganger fungerer som spesifisert (upcoming → active → pending_signoff → closed)
- [ ] `missed`-fase trigges auto når `now > plannedOpen + graceMinutes`

### Web day-control (§5)
- [ ] Top-bar + SessionHeader + 7 sub-tabs
- [ ] Hver tab har innholdet beskrevet i §5
- [ ] `Oppgjør`-tab tilgjengelig kun fra `pending_signoff`
- [ ] "Avslutt dagen" → `phase = 'pending_signoff'`

### Mobil Home (§6)
- [ ] Tre forskjellige skjermer basert på `phase` (Before/During/After)
- [ ] Live timer tikker hvert sekund, formaterer `HH:MM:SS`, persister `clockedInAt`
- [ ] Progress-bar oppdateres med `hoursSoFar / 8`
- [ ] Tab-bar har 4 tabs (Hjem, Vakter, Oppgaver, Meg)

### Admin-avstemming (§7)
- [ ] Ukesvisning med oppsummerings-kort + tabell
- [ ] Klikk på `pending_signoff`-rad → detalj-overlay med ReconSummary
- [ ] "Godkjenn oppgjør" → `phase = 'closed'`

### Generelt
- [ ] Norsk språk overalt — ingen engelsk leakage
- [ ] Avdelingsfarge-konvensjon brukt konsekvent (3px stripe = `dept.color`)
- [ ] Mono-font kun for tall (tid, KPI, tellverk)
- [ ] Touch-targets på mobil ≥ 44px

---

## 12. Åpne spørsmål

Avklar med produkt før bygg:

1. **`active`-overgang** — hvem åpner dagen offisielt? Første ansatt som klokker inn, leder manuelt, eller auto på `plannedOpen`?
2. **`graceMinutes`** — er 15 min hardkodet per kjede eller justerbart per avdeling?
3. **Multi-avdeling** — har Café Skuta én sesjon per dag (felles) eller én per avdeling (Kjøkken, Sal, Bar)? Prototypen forutsetter **én per avdeling**.
4. **Push-notifikasjoner** — skal `missed`-fase eller åpne avvik trigge push? Til hvem (alle med vakt, kun leder)?
5. **Offline** — restaurant-personale har ofte dårlig dekning. Skal mobile timer fungere offline og synce ved gjenoppkobling?
6. **Tids-zone** — alle tider er Europe/Oslo. Bekreft.
7. **RBAC** — hva ser en vanlig ansatt vs. skiftleder vs. avdelingsleder vs. admin? Prototypen viser alt; produksjon må respektere roller.
8. **Lukking av låst dag** — kan admin reversere `locked` tilbake til `closed`? Med audit-log?
9. **Avvik-foto-lagring** — hvor lagres bilder, og er det HMS-krav om varighet?
10. **Real-time sync** — websockets eller polling for at mobil ser hva leder gjør (og omvendt)?

---

**Kontakt:** Anna Olsen (servitør) · Marcus Lien (kjøkkensjef) · Pontus Sjögren (admin) — alle fiktive mock-brukere i Café Skuta som drar gjennom hele prototypen.
