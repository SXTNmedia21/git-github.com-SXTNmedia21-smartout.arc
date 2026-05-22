# Smartout Task Manager — Handoff

> **Til utvikler:** Dette er en spec for Task Manager-modulen i Smartout. Alt visuelt språk, alle komponentnavn, alle datamodeller og hele interaksjonsmønsteret er **hentet fra Smartout** — det er allerede etablert i prototypen som ligger i `source/`. **Ingenting skal designes eller bygges på nytt.** Hent komponenter, tokens og logikk derfra og port til mobil-stacken.
>
> **Bygges stykkevis.** Vi starter med Fase 1 (Min dag + TaskKortet). Resten kommer etter hvert. Ikke implementér noe utenfor Fase 1 før det blir bestilt.

---

## Innhold

1. [Hva er Task Manager?](#1-hva-er-task-manager)
2. [Faser — bygges stykkevis](#2-faser--bygges-stykkevis)
3. [Fase 1 — Min dag (forsiden)](#3-fase-1--min-dag-forsiden) ← **start her**
4. [Datamodell](#4-datamodell)
5. [State & interaksjoner (Fase 1)](#5-state--interaksjoner-fase-1)
6. [Designsystem (tokens hentet fra Smartout)](#6-designsystem-tokens-hentet-fra-smartout)
7. [Senere faser (referanse, ikke bygg ennå)](#7-senere-faser-referanse-ikke-bygg-ennå)
8. [Filoversikt i `source/`](#8-filoversikt-i-source)

---

## 1. Hva er Task Manager?

Task Manager er den operative kjernen i Smartout — der ansatte ser hva som skal gjøres i dag, hvem som gjør det, og hva som er kritisk akkurat nå. Den erstatter sjekklister på papir, tavler i bakrommet og uoversiktlige meldingstråder.

En oppgave (**Task**) i Smartout er ikke bare "noe å gjøre". Den har **opphav** (kommer fra en rutine, et avvik, en protokoll, eller ad-hoc), **struktur** (subtasks, krav om bevis/godkjenning), og kan være knyttet til en **manual** (instruksjonsbok ansatte kan slå opp i mens de jobber).

**Botsson** er Smartouts AI-assistent. På Min dag dukker hen opp som en liten foreslående stemme ("start med X, så er du klar når Y") — i senere faser også som manualskaper og quizmaster.

---

## 2. Faser — bygges stykkevis

| Fase | Innhold | Status |
|---|---|---|
| **1** | **Min dag (forsiden) — TaskKortet, filterrad, seksjoner, Botsson-nudge** | 👈 **Start her** |
| 2 | Task-detaljvisning (drawer/sheet) — subtasks, bevis, aktivitet | Senere |
| 3 | Sidebar / mobil-tabbar — navigasjon mellom views | Senere |
| 4 | Manual-bibliotek + manual-leser | Senere |
| 5 | Botsson Manualskaper (AI genererer manualer fra stemmeopptak) | Senere |
| 6 | Botsson Quizmaster (AI lager quizer fra manualer + meny) | Senere |

**Hver fase bygger på den forrige.** Ikke hopp over.

---

## 3. Fase 1 — Min dag (forsiden)

### 3.1 Hva skjermen viser

Min dag er det første en ansatt ser når de åpner Smartout. Den svarer på ett spørsmål: **"Hva må jeg gjøre nå?"**

Layout fra topp til bunn:

1. **Topbar** — dato-eyebrow ("Mandag · 4. mai"), tittel ("Min dag"), dag-meter ("3 av 12 fullført · 3 må løses før 12:00"), søkeknapp, "Ny oppgave"-knapp
2. **Botsson-nudge** — ett kort med ett konkret forslag fra AI ("Start med Avvik #214, så er du klar når Bama leverer 09:30"). Én CTA: *Følg*.
3. **Filterrad** — chips: *Alle · Tildelt meg · Kritisk · Pågår · Ferdig* — hver med tellverk
4. **Seksjon: Må løses nå** — kritiske og forsinkede oppgaver (rød aksent)
5. **Seksjon: I dag** — alle andre åpne oppgaver
6. **Seksjon: Fullført i dag** — visuelt nedtonet

Hver seksjon består av en stack med **TaskKort**.

### 3.2 TaskKortet (komponentens hjerte)

> **Kilde:** `source/components/min-dag.jsx` → `function TaskCard`. **Ikke redesign.** Port direkte.

Hvert TaskKort har følgende elementer, fra venstre til høyre:

| # | Element | Beskrivelse | Datafelt |
|---|---|---|---|
| 1 | **State-toggle** (sirkel) | Trykk for å markere ferdig / gjenåpne. Visuell variant: tom sirkel = todo, blå med pulse = pågår, rød = forsinket, grønn ✓ = ferdig | `task.status` |
| 2 | **Origin-badge** | "Rutine" / "Ad-hoc" / "Protokoll" / "Avviks-oppfølging" — viser hvor oppgaven kom fra | `task.origin` |
| 3 | **Tittel** | Kort, handlingsorientert ("Temperaturkontroll – kjøl & frys") | `task.title` |
| 4 | **Deadline** (mono-font) | "08:00 · 32 min forsinket" — fargekodet rød/oransje/nøytral | `task.deadline`, `deadlineRel` |
| 5 | **Folder-chip** | Folderens farge + navn (HMS, Drift, Kjøkken …) | `task.folder` |
| 6 | **Lokasjon** | "Kjøkken – sone A" med pin-ikon | `task.location` |
| 7 | **Subtask-progress** | "2/5" — antall ferdige av totale | `task.subtasks` |
| 8 | **Manual-ikon** | Bok-ikon hvis oppgaven har tilknyttet manual | `task.manual` |
| 9 | **Bevis-ikon** | Kamera-ikon hvis bevis kreves | `task.requiresEvidence` |
| 10 | **Avatar** | Hvem oppgaven er tildelt | `task.assignee` |

**Trykk på kortet (utenfor state-toggle):** Åpner Task-drawer (Fase 2). I Fase 1 kan dette være en stub som logger eller åpner en placeholder.

**Visuelle states (på `<div class="task-card">`):**
- `data-priority="critical|high|normal|low"` — styrer venstre-kant og tonen
- `data-status="overdue|inprogress|todo|done"` — styrer state-toggle og opacity (done = nedtonet)

### 3.3 Filter & sortering

**Filter-chips** (radio, ikke multi):
- `all` — alle åpne + ferdige i dag
- `me` — kun `task.assignee === ME.id`
- `critical` — `priority === 'critical' || status === 'overdue'`
- `inprogress` — `status === 'inprogress'`
- `done` — `status === 'done'`

**Sortering** (etter filter, før seksjonering):
1. Status (overdue → inprogress → awaiting → todo → done)
2. Priority (critical → high → normal → low)
3. Deadline (tidligst først)

Se `source/components/shared.jsx` → `sortTasks()`.

**Seksjonering** (etter sortering):
- "Må løses nå" — `status !== 'done' && (priority === 'critical' || status === 'overdue')`
- "I dag" — alt annet åpent
- "Fullført i dag" — `status === 'done'`

### 3.4 Botsson-nudge

> **Kilde:** `source/components/min-dag.jsx` → `function BotssonNudge`.

Ett kort, én stemme, én CTA. Innholdet er statisk i Fase 1 (server-rendret tekst). AI-logikken bak kommer senere — men UI-komponenten skal allerede finnes så vi kan plugge den inn.

Skjules hvis tweak `showBotsson === false`.

### 3.5 Topbar — dag-meter

`"3 av 12 fullført · 3 må løses før 12:00"` — beregnes fra task-listen:
- Fullført = `tasks.filter(t => t.status === 'done').length`
- Total = `tasks.length`
- "Må løses før X" = antall kritiske/overdue + tidligste deadline blant dem

Progress-bar bredde: `(fullført / total) * 100%`.

### 3.6 Akseptansekriterier — Fase 1

- [ ] TaskKort rendrer alle 10 elementene over, korrekt fargekodet
- [ ] State-toggle: trykk → status flipper mellom `todo` ↔ `done`
- [ ] Trykk på kort: kaller `onOpen(task.id)` (drawer kan være stub)
- [ ] Filter-chips fungerer + viser tellverk
- [ ] Tre seksjoner rendres betinget (skjul hvis tom)
- [ ] Sortering matcher `sortTasks()` i shared.jsx
- [ ] Botsson-nudge rendres (statisk tekst)
- [ ] Dag-meter teller riktig
- [ ] Fungerer på mobil (kortene er hovedmålet — sidebar/drawer kommer senere)
- [ ] Norsk språk overalt — ingen engelsk leakage

---

## 4. Datamodell

> **Kilde:** `source/data.js`. Bruk denne formen 1:1 i mobil-appen — ikke finn på nye feltnavn.

### Task

```js
{
  id: 't1',
  title: 'Temperaturkontroll – kjøl & frys',
  description: 'Sjekk alle kjøleskap og frysere…',
  priority: 'critical' | 'high' | 'normal' | 'low',
  status: 'todo' | 'inprogress' | 'awaiting' | 'overdue' | 'done',
  origin: 'session' | 'adhoc' | 'protocol' | 'deviation',
  folder: 'hms',                   // FK → FOLDERS[].id
  tags: ['morgenrutine', 'kjøling'],
  deadline: '08:00',               // klokkeslett eller "I dag" / "I går"
  deadlineRel: '32 min forsinket', // relativ streng (kan være null)
  estimate: 10,                    // minutter
  location: 'Kjøkken – sone A',
  assignee: 'ma',                  // FK → USERS[].id
  requiresEvidence: true,
  requiresApproval: false,
  manual: 'm-temp' | null,         // FK → MANUALS[].id
  subtasks: [
    { id: 's1', title: 'Kjøl 1', done: true, value: '+3,2°C', user: 'ma' }
  ],
  activity: [
    { type: 'create'|'start'|'check'|'comment'|'assign', user: 'ma', text: '…', time: '08:14' }
  ],
  completedAt: 'I går 16:42'       // kun hvis status === 'done'
}
```

### Lookup-tabeller

- **USERS** — `{id, name, initials, color, role}`
- **FOLDERS** — `{id, name, icon, color, count}` (HMS, Drift, Onboarding, Vedlikehold, Kjøkken, Salg)
- **PRIORITY** — fargekoder + sorteringsorden for de 4 nivåene
- **STATUS** — labels + farger for de 5 statusene
- **ORIGIN** — labels + farger for de 4 opphavene

### Mock-bruker (jeg)

`ME = USERS.ma` — Maria A., Driftsleder. Brukes til "Tildelt meg"-filteret og kommentar-input.

---

## 5. State & interaksjoner (Fase 1)

### Lokal state

```js
const [tasks, setTasks] = useState(SmartoutData.TASKS);
const [filter, setFilter] = useState('all');     // chip-filter
const [openTaskId, setOpenTaskId] = useState(null); // for drawer (Fase 2)
```

### Mutasjoner

```js
// Toggle ferdig/gjenåpne
onToggleStatus(taskId)
  → setTasks(ts => ts.map(t =>
      t.id === id
        ? { ...t, status: t.status === 'done' ? 'todo' : 'done',
            completedAt: t.status === 'done' ? null : 'Nå' }
        : t
    ));
```

I Fase 1 trenger vi ikke persistens — data lever i minnet. Backend-integrasjon kommer i en senere fase.

---

## 6. Designsystem (tokens hentet fra Smartout)

> **Kilde:** `source/styles.css`. Disse tokens er allerede kanon i Smartout — ikke finn på nye verdier.

### Farger

```css
--bg: #fdfcfa            /* sand-hvit bakgrunn */
--surface: #ffffff
--ink: #1c1814           /* primær tekst */
--muted: #7a756e         /* sekundær tekst */
--line: #e8e3db          /* skille-linjer */
--orange: #f97316        /* primær aksent */
--green: #11ad32         /* ferdig/positiv */
--red: #dc2626           /* kritisk/forsinket */
--amber: #ea580c         /* høy prioritet */
--blue: #2563eb          /* pågår/info */
```

### Typografi

- **Brødtekst:** Geist (400 / 500 / 600 / 700)
- **Display / sitater:** Instrument Serif
- **Mono (deadline, tellverk, tall):** Geist Mono

### Origin-farger

| Origin | Farge | Bakgrunn |
|---|---|---|
| Rutine (`session`) | `#2563EB` | `#DBEAFE` |
| Ad-hoc (`adhoc`) | `#7C3AED` | `#EDE9FE` |
| Protokoll (`protocol`) | `#0F766E` | `#CCFBF1` |
| Avvik (`deviation`) | `#DC2626` | `#FEE2E2` |

### Folder-farger

HMS rød `#DC2626` · Drift blå `#2563EB` · Onboarding lilla `#7C3AED` · Vedlikehold cyan `#0891B2` · Kjøkken oransje `#EA580C` · Salg rosa `#DB2777`

---

## 7. Senere faser (referanse, ikke bygg ennå)

### Fase 2 — Task-drawer
Trykk på et TaskKort åpner en sheet/drawer med: header (origin + status + tittel + chips), tilknyttet manual-link, subtask-liste med interaktive checks og verdier, bevis-knapper (kamera/vedlegg/signer), aktivitets-feed med kommentarer, footer-actions (tildel, følg, pause, marker ferdig). **Kilde:** `source/components/task-drawer.jsx`.

### Fase 3 — Navigasjon
Sidebar (desktop): Min dag, Alle, Tildelt meg, Følger, Foldere, Bibliotek, Maler, Brukerprofil. Bunntabbar (mobil): Min dag, Alle, [+], Bibliotek, Meg. **Kilde:** `source/components/sidebar.jsx`.

### Fase 4 — Manual-bibliotek
Liste over manualer (instruksjonsbøker) gruppert på folder. Trykk → manual-leser med seksjoner (tekst, video, bilde, sjekkliste). Manualer knyttes til tasks via `task.manual`. **Kilde:** `source/components/library.jsx`, `manual-viewer.jsx`.

### Fase 5 — Botsson Manualskaper
AI-flyt: ansatt tar opp en stemmeforklaring → Botsson genererer en manual-draft med blokker og confidence-score per blokk → leder gjennomgår, redigerer, publiserer. **Kilde:** `source/components/manual-builder.jsx`, `manual-guide.jsx`. Datamodell: `MANUAL_DRAFT` i `data.js`.

### Fase 6 — Botsson Quizmaster
AI-flyt: Botsson leser eksisterende manualer + meny → genererer et quiz-utkast med 11 spørsmål av varierte typer (single, multi, true/false, kort/lang tekst, sortér, match, skala, hotspot, tall, bilde-valg) → leder finpusser → publiserer som onboarding-quiz. **Kilde:** `source/components/quiz-master.jsx`, `quiz-guide.jsx`. Datamodell: `QUIZ_DRAFT` i `data.js`.

---

## 8. Filoversikt i `source/`

```
source/
├── Task Manager.html         # Entry — laster alle scripts i riktig rekkefølge
├── app.jsx                   # Root <App> — view-routing, state, tweaks
├── data.js                   # All mock-data (TASKS, USERS, FOLDERS, MANUALS, …)
├── styles.css                # Komplett designsystem — tokens, layout, komponenter
├── tweaks-panel.jsx          # In-design tweaks-panel (kan ignoreres i prod)
└── components/
    ├── shared.jsx            # Avatar, Icon, OriginBadge, sortTasks – delte primitiver
    ├── sidebar.jsx           # Sidebar + MobileTabbar          [Fase 3]
    ├── min-dag.jsx           # MinDag + TaskCard + BotssonNudge [Fase 1] ⭐
    ├── task-drawer.jsx       # Task-detalj-overlay              [Fase 2]
    ├── library.jsx           # Manual-bibliotek                 [Fase 4]
    ├── manual-viewer.jsx     # Manual-leser                     [Fase 4]
    ├── manual-builder.jsx    # Botsson Manualskaper             [Fase 5]
    ├── manual-guide.jsx      # Manual-draft → publisert flow    [Fase 5]
    ├── quiz-master.jsx       # Botsson Quizmaster               [Fase 6]
    └── quiz-guide.jsx        # Quiz-gjennomføring               [Fase 6]
```

### Slik kjører du prototypen lokalt

Åpne `source/Task Manager.html` direkte i en nettleser (eller via en hvilken som helst statisk server). Alt er CDN-basert — ingen build-step.

---

## 9. Funksjoner hentet fra Smartout

Disse er allerede definert i prototypen — **bygg dem på nytt med det visuelle språket og logikken som ligger i `source/`, ikke fra scratch**:

- ✅ **TaskKortet** med 10 elementer (state-toggle, origin-badge, tittel, deadline, folder, lokasjon, subtask-progress, manual-ikon, bevis-ikon, avatar)
- ✅ **Filterrad** med 5 chips og tellverk
- ✅ **Tre-seksjon-layout** (Må løses nå / I dag / Fullført)
- ✅ **Sortering** etter status → prioritet → deadline
- ✅ **Origin-badge-system** (Rutine / Ad-hoc / Protokoll / Avvik)
- ✅ **Folder-system** med 6 farge-kodede kategorier
- ✅ **Priority-system** med 4 nivåer
- ✅ **Status-system** med 5 tilstander
- ✅ **Bruker- og avatar-system** med initialer + farger
- ✅ **Botsson-nudge** — én AI-stemme, én CTA, én plass
- ✅ **Dag-meter** — progresjon + kritisk-frist på toppen
- ✅ **Designsystem** — farger, typografi, spacing, ikoner

> Hvis noe mangler her, er det ikke spec'et ennå. Spør før du finner på.

---

**Kontakt:** Maria A. (Driftsleder, Bistro Nord — fiktiv mock-bruker brukt gjennom hele prototypen).
