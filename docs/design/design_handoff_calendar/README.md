# Handoff: Smartout — Kalender + Vaktliste (mobil)

> Personlig kalender og vaktliste for ansatte i restaurant/bar (Pontus, sous-chef/skiftleder på Café Skuta). Mobil-først, mørk modus som default. Iterert i HTML/React, klar for produksjon i deres eget stack.

---

## 1. Om designfilene

Filene under `source/` er **designreferanser bygd som et kjørbart HTML/React-prototype** — ikke produksjonskode du skal kopiere rett inn. De viser intendert utseende, layout, interaksjon og dataform i hi-fi.

Oppgaven er å **gjenskape disse skjermene i Smartout sitt eksisterende mobil-stack** (React Native / Flutter / SwiftUI / hva enn dere allerede bruker), med deres egne komponentmønstre, navigasjon og state management. Hvis det ikke finnes et stack ennå, velg det som passer best og implementer designene der.

**Fidelity: Hifi.** Eksakte farger, typografi, spacing, hierarki og atferd er definert. Reproduser pixel-likt, men i deres egen komponent-grammatikk.

---

## 2. Hva er dette?

To tabs i samme appshell, navigerbart fra bottom tab-bar:

| Tab | Formål |
|---|---|
| **Kalender** | Personlig oversikt for innlogget ansatt — egne vakter, oppgaver, bookinger, avvik. Uke / Måned / Dag-modus. |
| **Vakter** | Bemanningsoversikt — hvem jobber når. Kan filtreres på Mine / Hele teamet / Avdeling / Per ansatt. |

Bruker = **Pontus L.**, sous-chef og noen ganger skiftleder. Han ser sine egne ting og må ha overblikk over kollegene på vakt.

---

## 3. Kjøre prototypen

Åpne `source/Kalender - mobil.html` i en moderne nettleser (Chrome/Safari). Babel-transpilerer JSX in-browser; ingen build steg.

Velg `Tweaks` (knapp dukker opp via toolbar) for å bytte mellom mørk/lys og mellom Kalender/Vakter-tab.

---

## 4. Skjermer

Alle skjermer er én iPhone-bredde: **390 × 844 px** (iPhone 14 Pro). Layoutene må fungere i 360–430 px-bredde. Status-bar tar topp 47 px, home-indicator bunn 34 px.

### 4.1 Kalender — Uke (default)
*Fil: `screens.jsx → WeekView`*

- **Header**: «Kalender» (Instrument Serif 22px, sentrert) + + ikon høyre.
- **Måned-rad**: «Mai 2026» (serif 22px) venstre + segmentert toggle Uke/Måned høyre.
- **Ukestripe**: 7 piller (man–søn). Hver pille = `MAN`-label (10px tracking 1.3) + dato (serif 26px). Valgt dag = full orange fyll, hvit tekst. I dag = liten orange dot under tallet.
- **Filter-chips** (horisontal scroll): `Alt`, `Oppgaver`, `Vakter`, `Bookinger`, `Avvik`. Hver chip har count badge i mono-font. Aktiv chip = orange fyll + hvit tekst. Trykk på `Vakter` → bytt til Vakter-tab automatisk.
- **Tasks summary card** (vises kun når filter er Alt eller Oppgaver, og dagen har oppgaver):
  - Stort serif-tall: «3 oppgaver»
  - Sub: «1 fullført · 2 gjenstår · 1 avvik» (avvik i error-rød)
  - Progress ring 56px høyre, fylt orange (eller error om avvik > 0)
- **Shift card**: full bredde, 5px farget vertikalstripe (avdelingsfarge), tittel + skiftleder-badge, tid · rolle · sone i mono.
- **Item-list**: vertikal stack, 8px gap. Hvert item har 36px ikon-ramme (avdelingsfarge ved 14% transparens), tittel (14.5px 600), under: tid (mono) · sub (muted). Avvik = 3px error-rød venstre-border.
- **Empty state**: 56px sirkel-ikon + «Ingen oppføringer» + hint om +.
- **Bottom tab bar**: Kalender · Vakter · ⊕ (orange FAB med Smartout-flamme) · Chat · Min Tid. Aktiv tab = orange ikon + label + 4px dot.

### 4.2 Kalender — Måned
*Fil: `screens.jsx → MonthView`*

- Header + måned-rad + view toggle som over.
- **Day-of-week-header**: 7-kol grid, MAN..SØN, 10px label.
- **Måned-grid**: 6×7 ruter (med leading/trailing blanks). Hver celle 80px+ høy:
  - Stort serif tall (18px) topp venstre
  - I-dag dot (orange) eller avvik-dot (error) topp høyre
  - Mini-event-blokker: vakt (avdelingsfarge ved 24% bg + farget tekst), booking (info-blå), `N oppg.` mono-counter
  - Valgt dag = full orange fyll
- **SelectedDaySheet** under griden: dagens dato, V/O/B-counter, første 3 items.
- Trykk på dag → naviger til Dag-modus.

### 4.3 Kalender — Dag (timeline)
*Fil: `screens.jsx → DayView`*

- Header med tilbake-pil, sentrert «MANDAG / 4. mai».
- **DayStat-strip**: 3 cards i 1×3 grid — Vakter (count + total timer), Oppgaver (count + done/total, error-farge om avvik), Bookinger (gjeste-sum).
- **Timeline 08:00–24:00**: 56px per time, mono-tidsmerker venstre, horisontale border-linjer.
- **Items posisjonert absolutt** etter starttid, høyde fra varighet. Bakgrunn = avdelingsfarge ved 22% over bg, 3px farget venstre-border. Tittel 12px 700 + tid mono.
- **NÅ-indikator** (kun i dag): 2px orange linje, 10px dot venstre, «NÅ · 18:16» badge høyre.
- **Notater**-seksjon nederst hvis noen.

### 4.4 Vaktliste — Uke
*Fil: `shiftlist.jsx → ShiftList`*

- Header «Vaktliste» + samme måned-rad og toggle.
- **ScopeChips**:
  - `✦ Mine vakter` (orange aktiv)
  - `Hele teamet`
  - `Avdeling ▾` (dropdown — Kjøkken/Sal/Bar/Event med farge-dot og count)
  - `Ansatt ▾` (4-kol avatar-grid med initialer + fornavn; «(deg)» på Pontus)
  Aktiv-chip farges av avdeling/person når valgt.
- **ScopeSummary card**: «UKE 19 · 4–10. MAI» + serif label («Hele teamet») venstre; mono count + timer-total høyre.
- **Day Crew Cluster** per dag (ALLE 7 dager vises, selv tomme):
  - Header: dag-short + serif dato + langt navn + I DAG badge + DU JOBBER badge + per-avdeling mini-tetthet (lille pill med count) + total count
  - Body: kompakte rader, én per ansatt på vakt
  - Pontus' egne rader = orange bakgrunn (10% transparens) + orange tekst + ringed avatar
  - Sortering: Mine først, så starttid
- **CompactShiftRow**: 28px avatar (eller 3px dept-stripe i Mine-modus) · navn · rolle-pill (avdelingsfarge) · LEDER-badge om skiftleder · tid mono høyre.

### 4.5 Add-sheet (+)
*Fil: `screens.jsx → AddSheet`*

Bottom-sheet med backdrop. 5 valg: Vaktforespørsel, Ny oppgave, Booking, Rapporter avvik, Notat. Hver rad: 40px farget ikon-ramme + label + sub.

### 4.6 Detail-sheet
*Fil: `screens.jsx → DetailSheet`*

Full-screen overlay. Type-spesifikk:
- **Avvik** øverst: rød badge «AVVIK · KREVER HANDLING»
- Stor serif-tittel (30px) + beskrivelse
- Meta-strip: Tid (mono) · Avdeling · Rolle · Gjester
- **Task med evidence**: grid av kamera-rammer, fylt = bilde tatt
- **Booking**: kontakt-card (avatar + navn + Ring-knapp), bord, spesielle behov
- **Shift**: kollegaliste
- **Footer**: «Detaljer» (sekundær) + primær CTA («Marker fullført» / «Bekreft mottak» / «Stempel inn»)

---

## 5. Design tokens

Kopier disse direkte inn i deres tema-filer.

### Farger — Mørk modus (default)
```
--c-bg:        #0e0c0a  /* canvas */
--c-surface:   #1a1612  /* cards */
--c-surface-2: #25201a  /* chips, inset */
--c-fg:        #f1ece2  /* primary text */
--c-fg-soft:   #c9c2b5  /* secondary text */
--c-muted:     #847e74  /* labels, captions */
--c-border:    rgba(241,236,226,0.10)

--c-orange:    #ea7a3b  /* primary accent */
--c-success:   #2dd4a5
--c-warning:   #f0b14a
--c-error:     #ef6a4d
--c-info:      #6aa6ef
```

### Farger — Lys modus
```
--c-bg:        #fbf9f4
--c-surface:   #ffffff
--c-surface-2: #f1ede5
--c-fg:        #1a1815
--c-fg-soft:   #3a342d
--c-muted:     #847e74
--c-border:    rgba(26,24,21,0.10)

--c-orange:    #ea7a3b
--c-success:   #1f9d6e
--c-warning:   #c18200
--c-error:     #d8492a
--c-info:      #2a7fd8
```

### Avdelings-farger (begge moduser, ingen variasjon)
```
kjokken: #ee560c
sal:     #00ab93
bar:     #864ad2
event:   #c18200
```

### Typografi
| Stil | Family | Weight | Bruk |
|---|---|---|---|
| **Display / Title** | Instrument Serif | 400 | Skjerm-titler 22–30px, datoer i kalender, tall i stat-cards |
| **Body / UI** | Geist | 400/500/600/700 | All vanlig tekst |
| **Mono / Numerisk** | JetBrains Mono (eller Geist Mono) | 400/500/600 | Tider, counts, IDs, datoer i metadata |

Tracking-konvensjoner:
- Display: `letter-spacing: -0.01em` (eller `-0.02em` for 30px+)
- ALL CAPS labels: `letter-spacing: 1.3–1.5px`, weight 700, 9.5–11px
- Body: default

### Spacing
4px grid. Vanligste: 4, 6, 8, 10, 12, 14, 16, 18, 24, 36 px.

### Radius
- Item-cards, summary-cards: **14–16px**
- Sheets (top): **26px**
- Pills/chips: **999px** (full)
- Mini event-blokker (måned): **4–6px**
- Ikon-rammer: **10–12px**
- Buttons: **10–14px**

### Shadows
- Phone bezel: `0 0 0 12px #1c63d8, 0 0 0 14px #0e3a87, 0 40px 70px rgba(0,0,0,.45)` (kun for prototype)
- FAB (orange + i tab bar): `0 8px 24px rgba(249,115,22,.45)`
- Bottom-sheet: `0 -10px 40px rgba(0,0,0,.4)`
- Primary CTA: `0 4px 14px <accent ved 40% transparens>`

### Color mixing
Mange transparente fyll bruker `color-mix(in oklab, <farge> 14%/22%/24%, transparent)`. I React Native: bruk hex med alpha-suffix (f.eks. `#ee560c39` ≈ 22%).

---

## 6. Datamodell

Se `source/data.js` for komplett mock. Kjernetyper:

```ts
type Department = 'kjokken' | 'sal' | 'bar' | 'event';

type CalendarItem = {
  id: string;
  type: 'shift' | 'task' | 'booking' | 'deviation' | 'note';
  date: number;            // 1..31 i den viste måneden
  title: string;
  sub?: string;            // undertekst
  desc?: string;           // lang beskrivelse (detail-view)
  time?: string;           // '15:00–23:00' eller '17:00' (single)
  dept: Department;
  status: 'upcoming' | 'todo' | 'done' | 'completed' | 'overdue' | 'confirmed';

  // shift-only
  role?: string;           // 'Sous-chef', 'Skiftleder' …
  zone?: string;           // 'Sone B'
  isShiftLead?: boolean;
  planned?: number;        // timer
  actual?: number;
  owner?: string;          // staff.id
  coworkers?: string[];

  // booking-only
  guests?: number;
  tables?: string;         // '8 · 9 · 10'
  contact?: string;        // 'Ingrid Solheim · 99 88 77 66'
  notes?: string;

  // task-only
  priority?: 'high' | 'normal' | 'low';
  evidence?: { required: number; taken: number };
};

type Staff = {
  id: string;
  name: string;            // 'Pontus L.'
  role: string;            // 'Sous-chef · Skiftleder'
  dept: Department;
  initials: string;        // 'PL' (2 tegn)
  color: string;           // hex
};
```

Utleder du fra dataene:
- `dayStats(date)` → `{ all, shifts, tasks, bookings, notes }`
- Filtrere på scope: `me | all | dept(value) | person(value)`
- Avvik = `task` med `status === 'overdue'`

---

## 7. State

### Globalt (app-nivå)
- `tab: 'kalender' | 'vakter'`
- `theme: 'dark' | 'light'`

### Kalender-tab
- `view: 'week' | 'month' | 'day'`
- `filter: 'alt' | 'oppgaver' | 'vakter' | 'bookinger' | 'avvik'`
- `selected: number` (valgt dag)

### Vakter-tab
- `scope: { kind: 'me' | 'all' | 'dept' | 'person', value? }`
- `range: 'week' | 'month'`

### Modaler
- `openItem: CalendarItem | null` — for detail-sheet
- `showAdd: boolean` — for add-sheet

### Cross-tab triggere
- Trykk på «Vakter»-chip i Kalender → set `tab='vakter'`, `scope={kind:'me'}`, `range='week'`.
- Trykk på dag i Måned-modus → set `view='day'`, `selected=date`.
- Tilbake-pil i Dag → set `view='week'`.

---

## 8. Interaksjoner

| Element | Atferd |
|---|---|
| Ukestripe-pille | Tap → `setSelected(date)` |
| Filter-chip | Tap → `setFilter(k)`, `vakter` → bytt tab |
| View toggle | Tap → `setView('week'/'month')` |
| Måned-celle | Tap → `view='day'`, `selected=date` |
| Item-card | Tap → `openItem=it` (åpner DetailSheet) |
| + (header) eller FAB (tab bar) | Tap → `showAdd=true` |
| Sheet backdrop | Tap → lukk |
| Tilbake-pil i Dag | Tap → `view='week'` |
| Scope-pill (Avdeling/Ansatt) | Tap → toggle dropdown under chips-raden |
| Chevron-rotasjon | 180° når dropdown åpen, transition 150ms |

Animasjoner: keep simple. Sheet slide opp 200ms ease-out. Chevron rotate 150ms. Ingen tunge spring-animasjoner.

---

## 9. Filer i pakken

```
source/
├── Kalender - mobil.html   ← entry, design-system page-chrome + tweaks panel
├── app.jsx                 ← App root, tab/view-state, tweaks-protokoll
├── primitives.jsx          ← Phone, TabBar, CalHeader, ViewToggle, FilterChips,
│                             WeekStrip, ItemCard, SectionLabel, C (tokens)
├── screens.jsx             ← WeekView, MonthView, DayView, AddSheet, DetailSheet,
│                             ProgressRing, ShiftCard, EmptyDay, DayStat, Meta,
│                             SelectedDaySheet
├── shiftlist.jsx           ← ShiftList, ScopeChips, ScopeSummary,
│                             DayCrewCluster, CompactShiftRow, Avatar
└── data.js                 ← CAL.* — alle mocks (departments, days, items, staff)
```

Anbefalt mappestruktur i target-app:
```
features/calendar/
├── screens/
│   ├── WeekScreen
│   ├── MonthScreen
│   ├── DayScreen
│   └── ShiftListScreen
├── components/   ← WeekStrip, FilterChips, ItemCard, DayCrewCluster, …
├── sheets/       ← AddSheet, DetailSheet
├── theme.ts      ← tokens fra §5
└── types.ts      ← types fra §6
```

---

## 10. Implementeringssjekkliste

- [ ] Tema-tokens (mørk + lys) i deres tema-system
- [ ] Avdelingsfarger som konstant
- [ ] Bottom tab bar med ⊕ FAB i midten (Kalender, Vakter, +, Chat, Min Tid)
- [ ] Kalender: WeekView med ukestripe, filter-chips, tasks summary, shift-card, item-liste
- [ ] Kalender: MonthView med 6×7 grid og mini event-blokker
- [ ] Kalender: DayView med timeline 08:00–24:00, NÅ-indikator, items posisjonert etter tid
- [ ] Vakter: ScopeChips med Avdeling/Ansatt-dropdowns
- [ ] Vakter: DayCrewCluster (alle 7 dager i uke-modus, klumpet per dag)
- [ ] CompactShiftRow med Pontus' egne rader uthevet
- [ ] AddSheet (+) med 5 typer
- [ ] DetailSheet (task/booking/shift) med type-spesifikt innhold
- [ ] Cross-tab: Vakter-chip i Kalender → bytt tab
- [ ] Lys/mørk-modus tweak

---

## 11. Åpne spørsmål til Smartout

Avklar med produkt før bygg:

1. **Datakilde** — hvilken backend feeder kalenderen? Trenger vi nye endpoints, eller ligger alt i eksisterende skift/booking/task-API?
2. **Push** — skal avvik (overdue tasks) trigge push-notifikasjon? Hvor i flowet bekreftes/lukkes de?
3. **Offline** — skal kalenderen fungere offline (krevende for restaurant-personale med dårlig dekning)?
4. **Tids-zone** — alle tider er Europe/Oslo. Bekreft.
5. **Skiftleder-rettigheter** — hva ser en skiftleder vs. vanlig ansatt i Vakter-tab? Prototypen viser alt; det reelle systemet bør respektere RBAC.
6. **«Min tid»-tab** i bottom bar — ikke designet her. Trenger egen runde.

---

## 12. Assets

Ingen bitmap-assets. Alle ikoner er inline SVG (Lucide-stil, 22–24px, stroke 1.6–2.2). Smartout-flammen i FAB er en custom SVG-path — kopier fra `primitives.jsx → TabBar`. Erstatt med deres offisielle logo om ønsket.

Fonts hentes fra Google Fonts (Instrument Serif, Geist, JetBrains Mono). Bytt ut med deres eksisterende type-stack om dere har et lokalt sett — bare hold serif/sans/mono-rollene konsistente.
