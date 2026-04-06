# Smartout Design Spec — Nordic Split

> Komplett visuell referanse for prototyper og mockups. Dekker web-dashboard og mobilapp.

---

## 1. Identity

**Smartout** er et Employee Readiness System for skiftbaserte bedrifter i Norge. Primært restaurant, hotell og servicevirksomheter.

**Visuell filosofi: "Nordic Split"**
Elegant nordisk renhet møter varme, glødende toner. Hvitrom, fjærbevegelse og tyngde. Systemet føles levende — aldri flatt, aldri kaldt. Tenk skandinavisk minimalisme med et varmt, organisk hjerte.

**Tone:** Profesjonell men menneskelig. Aldri korporat. Aldri lekent. Rolig autoritet med varme.

**Signaturtrekk:**

- Varme nøytralfarger (aldri kald grå eller blå-grå)
- Oransje som primær merkefarge
- Serif-headings (Instrument Serif) som gir editorial authority
- Dype, myke skygger — aldri harde kanter
- Bevegelse med spring physics — aldri lineær

---

## 2. Colors

Alle farger bruker varme undertoner. Nøytralfarger har hue 45-60 (gylden/beige), aldri 200+ (blå/kald).

### Brand

| Navn         | Hex       | Bruk                                |
| ------------ | --------- | ----------------------------------- |
| Orange       | `#f97316` | Primær CTA, aktive elementer, merke |
| Orange Light | `#fb923c` | Hover-tilstander, lys variant       |
| Orange Dark  | `#c2410c` | Pressed-tilstander, mørk variant    |
| Purple       | `#8b5cf6` | Sekundær aksent, feature-seksjoner  |
| Purple Light | `#a78bfa` | Lys variant                         |
| Purple Dark  | `#6d28d9` | Mørk variant                        |

### Semantisk

| Navn    | Hex       | Bruk                          |
| ------- | --------- | ----------------------------- |
| Success | `#11ad32` | Fullført, godkjent, aktiv     |
| Warning | `#c18200` | Advarsel, venter, offboarding |
| Error   | `#e7000b` | Feil, destruktiv handling     |
| Info    | `#2784d5` | Informasjon, trainee-status   |

### Light Mode — Overflater

| Rolle      | Hex       | Beskrivelse                 |
| ---------- | --------- | --------------------------- |
| Background | `#fdfcfa` | Varm krem (IKKE kald hvit)  |
| Foreground | `#1c1814` | Varm svart                  |
| Card       | `#fdfcfa` | Samme som background        |
| Secondary  | `#f5f3f0` | Subtil varm grå             |
| Muted text | `#7a756e` | Sekundær tekst              |
| Border     | `#e8e5e1` | Varm kantlinje              |
| Ring/Focus | `#f97316` | Brand orange for fokus-ring |

### Dark Mode — Overflater

| Rolle      | Hex                      | Beskrivelse                 |
| ---------- | ------------------------ | --------------------------- |
| Background | `#151210`                | Varm mørk (IKKE kald svart) |
| Foreground | `#f0eeeb`                | Varm hvit                   |
| Card       | `#1e1a15`                | Litt lysere enn bakgrunn    |
| Secondary  | `#262626`                | Dempet overflate            |
| Muted text | `#908a82`                | Sekundær tekst              |
| Border     | `rgba(255,255,255,0.08)` | Hvit ved 8% opacity         |

### Sidebar (Web)

| Rolle       | Light     | Dark                     |
| ----------- | --------- | ------------------------ |
| Background  | `#f7f5f2` | `#1e1a15`                |
| Border      | `#e5e2de` | `rgba(255,255,255,0.08)` |
| Active item | `#f2f0ec` | `#262626`                |

### Avdelingsfarger

| Avdeling | Hex       | Bruk                       |
| -------- | --------- | -------------------------- |
| Kjøkken  | `#ee560c` | Avdelingsmerking, aksenter |
| Sal      | `#00ab93` | —                          |
| Bar      | `#864ad2` | —                          |
| Event    | `#c18200` | —                          |
| Lager    | `#008388` | —                          |

### Statusfarger

| Status      | Hex       | Bruk                      |
| ----------- | --------- | ------------------------- |
| Trainee     | `#2784d5` | Ny ansatt under opplæring |
| Active      | `#11ad32` | Fullt operativ            |
| Inactive    | `#717171` | Midlertidig ute           |
| Offboarding | `#c18200` | Slutter snart             |

### Prioritet

| Nivå   | Hex       |
| ------ | --------- |
| Urgent | `#e7000b` |
| High   | `#f97316` |
| Normal | `#2784d5` |
| Low    | `#717171` |

### Diagramfarger

| Light mode         | Dark mode           |
| ------------------ | ------------------- |
| `#f97316` (orange) | `#6366f1` (indigo)  |
| `#0d9488` (teal)   | `#34d399` (emerald) |
| `#475569` (slate)  | `#fbbf24` (amber)   |
| `#eab308` (yellow) | `#a855f7` (purple)  |
| `#f59e0b` (amber)  | `#ef4444` (red)     |

---

## 3. Typography

### Fontfamilier

| Font                 | Bruk                                                                           |
| -------------------- | ------------------------------------------------------------------------------ |
| **Instrument Serif** | Overskrifter, hero-tekst, merke-øyeblikk. Gir varme og redaksjonell autoritet. |
| **Geist Sans**       | Standard UI-tekst, labels, knapper, brødtekst. Ren og moderne.                 |
| **Geist Mono**       | Tall, KPI-er, timer, beløp, data. Presis og tillitvekkende.                    |

### Typeskala

| Navn         | Størrelse           | Vekt | Font             | Bruk                            |
| ------------ | ------------------- | ---- | ---------------- | ------------------------------- |
| Hero         | 56-96px (responsiv) | 400  | Instrument Serif | Landing, store merke-øyeblikk   |
| Page Heading | 32px                | 700  | Instrument Serif | Sideoverskrift i dashboard      |
| Section      | 24px                | 700  | Geist Sans       | Seksjonsoverskrift              |
| Card Title   | 20px                | 600  | Geist Sans       | Kortoverskrift                  |
| Body Large   | 16px                | 400  | Geist Sans       | Ledetekst, viktige beskrivelser |
| Body         | 15px                | 400  | Geist Sans       | Standard brødtekst              |
| UI Text      | 14px                | 500  | Geist Sans       | Labels, navigasjon, knapper     |
| Caption      | 12px                | 400  | Geist Sans       | Sekundær metadata               |
| Badge        | 9px, uppercase      | 600  | Geist Sans       | Statuschips, tags               |
| KPI Number   | 28-36px             | 900  | Geist Mono       | Store tall, dashboardverdier    |
| Data         | 14px                | 400  | Geist Mono       | Tabelltall, beløp, timer        |

### Bokstavmellomrom

- Overskrifter: `-0.02em` (tight)
- Seksjonslabels og badges: `2px` (tracking-widest, uppercase)
- Brødtekst: normal

### Mobilfonter

Samme hierarki, men systemfonter i V1:

- iOS: SF Pro (body), New York (headings fallback)
- Android: Roboto (body), Roboto Serif (headings fallback)

---

## 4. Spacing & Radius

### Spacing — Web

| Token   | Verdi | Bruk                       |
| ------- | ----- | -------------------------- |
| Page    | 32px  | Horisontal sidemargin      |
| Section | 24px  | Mellom seksjoner           |
| Card    | 20px  | Intern kortpadding         |
| Element | 12px  | Mellom relaterte elementer |
| Tight   | 8px   | Kompakt elementavstand     |

### Spacing — Mobile

| Token   | Verdi | Bruk               |
| ------- | ----- | ------------------ |
| Page    | 32px  | Skjermmargin       |
| Section | 24px  | Mellom seksjoner   |
| Card    | 20px  | Intern kortpadding |
| Element | 12px  | Mellom elementer   |
| Tight   | 8px   | Kompakt avstand    |
| XS      | 4px   | Minimal avstand    |

### Border Radius

| Token | Web    | Mobile | Bruk                       |
| ----- | ------ | ------ | -------------------------- |
| SM    | 6px    | 6px    | Badges, små elementer      |
| MD    | 8px    | 8px    | Inputfelter, chips         |
| LG    | 10px   | 10px   | Standard kort, knapper     |
| XL    | 14px   | 14px   | Store kort, modale vinduer |
| Full  | 9999px | 9999px | Piller, avatarer           |
| Card  | 16px   | 16px   | Alle standard kort         |

### Skygger

| Nivå       | Verdi                              | Bruk                             |
| ---------- | ---------------------------------- | -------------------------------- |
| SM         | `0 1px 2px rgba(0,0,0,0.05)`       | Subtile elementer                |
| MD         | `0 4px 6px rgba(0,0,0,0.1)`        | Kort, dropdown                   |
| LG         | `0 10px 15px rgba(0,0,0,0.1)`      | Modale vinduer, flytende paneler |
| Brand glow | `0 2px 12px rgba(249,115,22,0.25)` | CTA-knapper                      |
| Card hover | `0 8px 24px rgba(0,0,0,0.15)`      | Kort ved hover                   |

---

## 5. Motion

### Prinsipper

- Alltid spring physics for inn/ut-animasjoner — aldri lineær
- Bevegelse føles tung og bevisst, som et tungt pendelurverk — aldri sprettig
- Minimumstid: 250ms ut, 500ms inn
- Hover-effekter kan bruke enkel easing

### Spring-konfigurasjoner

| Navn     | Stiffness | Damping | Mass | Bruk                                 |
| -------- | --------- | ------- | ---- | ------------------------------------ |
| Standard | 35        | 22      | 2.2  | Panelskift, store overganger         |
| Snappy   | 45        | 24      | 2.0  | Innholdsbytte, steg-overganger       |
| Gentle   | 30        | 20      | 2.5  | Ekspanderende seksjoner, wizard-steg |

### Easing-kurver

| Navn        | Verdi                              | Bruk                        |
| ----------- | ---------------------------------- | --------------------------- |
| Primary     | `cubic-bezier(0.25, 0.1, 0.25, 1)` | Standard overganger         |
| Exponential | `cubic-bezier(0.16, 1, 0.3, 1)`    | Myke, kjappe innganger      |
| Elastic     | `cubic-bezier(0.22, 1, 0.36, 1)`   | Pop-effekter, skeleton load |

### Timings

| Handling            | Varighet              |
| ------------------- | --------------------- |
| Knapptrykk (scale)  | 150ms                 |
| Hover-overgang      | 300ms                 |
| Liste-stagger       | 60ms mellom elementer |
| Paneltekst ut       | 300ms                 |
| Paneltekst inn      | 500ms                 |
| Flex-endring (stor) | 1200ms                |

### Mobile

- Trykk-feedback: `scale(0.92)` eller opacity
- Ingen hover-tilstander — alt er trykk
- Overganger mellom skjermer: slide fra høyre, 300ms

---

## 6. Components

### Kort (Card)

**Basiskort:**

- Bakgrunn: card-farge (`#fdfcfa` light / `#1e1a15` dark)
- Kant: 1px, border-farge
- Radius: 16px
- Padding: 20-24px
- Hover: løftes 2px opp, skygge intensiveres

**KPI-kort:**

- Basiskort + relativ overflow hidden
- Stort tall (28-36px, Geist Mono, vekt 900)
- Undertekst (caption, muted)
- Valgfri glød: brand orange ved 15% opacity, 120px sirkel, blur 40px

**Oppgavekort / Skiftkort / Protokollkort:**

- Basiskort + 4px farget venstrekant (avdelings- eller statusfarge)
- Tittel (Card Title), beskrivelse (Body), status-badge

**Listkort (kompakt):**

- Ingen skygge, kun border-bottom
- 12px vertikal padding
- 8px statusdot til venstre
- Chevron-ikon til høyre (muted)

### Inputfelter

- Radius: 12px
- Kant: border-farge, 1px
- Fokus: 2px ring i brand orange ved 30% opacity + border i brand orange
- Høyde: 40px (standard), 48px (stor)
- Padding: 12px horisontalt
- Placeholder: muted text-farge
- Dark mode: autofill-hack for å bevare mørk bakgrunn

### Knapper

**Primær (Brand):**

- Bakgrunn: `#f97316` (brand orange)
- Tekst: hvit, 14px, vekt 600
- Radius: 10px
- Skygge: `0 2px 12px rgba(249,115,22,0.25)`
- Hover: skygge intensiveres
- Trykk: `scale(0.96)`, 150ms
- Disabled: 50% opacity

**Sekundær:**

- Bakgrunn: secondary-farge
- Tekst: foreground
- Kant: border-farge
- Hover: bakgrunn mørkner subtilt

**Ghost:**

- Bakgrunn: transparent
- Tekst: foreground
- Hover: bakgrunn secondary-farge

**Destructive:**

- Bakgrunn: error-farge
- Tekst: hvit

### Badges

- Form: pill (9999px radius)
- Padding: 2px horisontalt, 8px vertikalt
- Bakgrunn: semantisk farge ved 10% opacity
- Tekst: semantisk farge ved full opacity
- Statusvariant: 9px uppercase, vekt 600, letter-spacing 2px

### Tabeller

- Header: caption-størrelse (12px), uppercase, muted, letter-spacing 1px
- Rader: alternerende bakgrunn (transparent / secondary ved 50%)
- Tall-kolonner: Geist Mono, høyrejustert
- Hover: rad-bakgrunn mørkner subtilt
- Separatorer: 1px border-farge

### Glassmorfisme (kun paneler/overlegg)

**Mørke overflater:**

- Bakgrunn: `rgba(255,255,255,0.06)`
- Blur: 20px
- Kant: `rgba(255,255,255,0.1)`

**Lyse overflater:**

- Bakgrunn: card-farge ved 70% opacity
- Blur: 20px
- Skygge: `0 4px 24px rgba(0,0,0,0.06)`

### Radioknapper

- Størrelse: 20px
- Aktiv: brand orange fylling med hvit indre prikk
- Animasjon: scale pop med lett overshoot

### Loading / Skeleton

- Form: avrundede rektangler som matcher innholdet de erstatter
- Animasjon: shimmer, venstre-til-høyre gradient, 1.8s loop
- Gradient: muted → litt lysere → muted

### Wizard Progress

- Steg i horisontal rad
- Fullført: grønn sjekk-ikon, dempet label
- Aktivt: brand-farge prikk, brand label, subtil ring-glød
- Venter: dempet kantprikk, dempet label
- Linje mellom steg: fyller seg med brand-farge etter hvert

### Avatar

- Form: sirkel (9999px)
- Størrelser: 24px (inline), 32px (liste), 40px (profil), 64px (stor)
- Fallback: initialer i Geist Sans, vekt 600, secondary bakgrunn

---

## 7. Layout — Web

### Dashboard-struktur

```
┌─────────────────────────────────────────────┐
│ Sidebar (240px)  │  Main Content            │
│                  │                           │
│ Logo             │  Page Heading (32px)      │
│ Navigation       │  ┌─────────┐ ┌─────────┐ │
│ - Hjem           │  │ KPI Card│ │ KPI Card│ │
│ - Vakter         │  └─────────┘ └─────────┘ │
│ - Ansatte        │  ┌───────────────────────┐│
│ - Opplæring      │  │                       ││
│ - HMS            │  │  Content Area         ││
│ - Innstillinger  │  │                       ││
│                  │  └───────────────────────┘│
│                  │                           │
│ User avatar      │                           │
│ Workspace name   │                           │
└─────────────────────────────────────────────┘
```

**Sidebar:**

- Bredde: 240px (kollapset: 64px med kun ikoner)
- Bakgrunn: sidebar-farge
- Kant: 1px høyre, sidebar-border
- Navigasjon: ikoner (20px, Lucide) + label (14px)
- Aktiv item: brand-farge tekst, accent bakgrunn
- Inaktiv: muted foreground

**Main Content:**

- Max-bredde: 1280px, sentrert
- Padding: 32px (page token)
- Grid: 1-4 kolonner, 24px gap

### Nordic Split (Auth/Onboarding)

```
┌─────────────────┬─────────────────┐
│                 │                 │
│  Brand Panel    │  Form Panel     │
│  (dark bg)      │  (light bg)     │
│                 │                 │
│  Headline       │  ┌───────────┐  │
│  Subtext        │  │ Form      │  │
│                 │  │ max 360px │  │
│                 │  └───────────┘  │
│                 │                 │
└─────────────────┴─────────────────┘
```

- Brand panel: `#1a1510` bakgrunn, varm glød
- Form panel: `#fdfcfa` bakgrunn
- Fleksibel ratio mellom panelene (se Motion-seksjon)
- Under 768px: stables vertikalt

### Wizard (Onboarding)

```
┌─────────────────────────────────────────────┐
│ Sidebar (steg)  │  Step Content             │
│                 │                           │
│ ● Steg 1 ✓     │  Steg-overskrift          │
│ ● Steg 2 ●     │  Beskrivelse              │
│ ○ Steg 3       │  ┌───────────────────────┐│
│ ○ Steg 4       │  │ Input / Content       ││
│                 │  └───────────────────────┘│
│                 │           ┌────────────┐  │
│                 │           │ Neste-knapp│  │
│                 │           └────────────┘  │
└─────────────────────────────────────────────┘
```

- Venstre sidebar: steg-liste med status
- Høyre: steg-innhold, 480px max-bredde
- Animasjon: spring physics mellom steg

### Responsivt

| Breakpoint | Oppførsel                                         |
| ---------- | ------------------------------------------------- |
| < 768px    | Grid → 1 kolonne, sidebar kollapser til hamburger |
| 768-1024px | 2-kolonne grid, sidebar kollapset (64px)          |
| > 1024px   | Full layout med åpen sidebar                      |

---

## 8. Layout — Mobile

### Skjermstruktur

```
┌─────────────────────┐
│ Status Bar          │
├─────────────────────┤
│ Header (56px)       │
│ Title + Actions     │
├─────────────────────┤
│                     │
│                     │
│  Content Area       │
│  (scrollable)       │
│  padding: 16px      │
│                     │
│                     │
├─────────────────────┤
│ Tab Bar (64px)      │
│ 🏠  📅  ＋  💬  👤  │
└─────────────────────┘
```

### Tab Bar

- Høyde: 64px
- 5 elementer: Hjem, Vakter, FAB (senter), Kommunikasjon, Meg
- Bakgrunn: card-farge med 1px toppkant
- Aktiv: brand-farge, vekt 600
- Inaktiv: muted foreground
- Trykk: `scale(0.92)`

### FAB (Floating Action Button)

- Størrelse: 52px sirkel
- Posisjon: hevet 20px over tab bar
- Bakgrunn: `#f97316` (brand orange)
- Skygge: `0 4px 16px rgba(249,115,22,0.4)`
- Ikon: hvit, 24px

### Header

- Høyde: 56px
- Tittel: 18px, vekt 600, sentrert
- Venstre: tilbakeknapp (chevron-left) eller meny
- Høyre: handlingsknapper (ikoner)
- Bakgrunn: background-farge

### Aktivt Skiftkort

- Bakgrunn: brand orange
- Timer: 22px, Geist Mono, bold, levende teller
- Innhold: avdelingsnavn + skifttidsrom
- Handling: "Avslutt skift"-knapp, full bredde, hvit tekst

### Chat

| Avsender     | Radiuser   | Bakgrunn                     |
| ------------ | ---------- | ---------------------------- |
| Egen melding | 16 16 4 16 | Brand orange, hvit tekst     |
| Andre / AI   | 16 16 16 4 | Card-farge, foreground tekst |

- Tidsstempel: 11px, muted, sentrert under meldingsgruppe
- Input: 44px høyde, avrundet (full), send-knapp med brand-farge

### Lønnsvisning

- Månedheader: 24px, bold
- Linjeelementer: label (venstre) + beløp (høyre, Geist Mono)
- Tilleggsbadges: inline, semantisk bakgrunn ved 10%
- Totalrad: bold, 20px, separert med border

### Safe Areas

- Alltid: hensyn til notch (topp) og home indicator (bunn)
- Tab bar: padding-bottom for home indicator
- Content: aldri skjult bak systemgrensesnitt

### Touch Targets

- Minimum: 44px høyde (Apple HIG)
- Knapper: minimum 44x44px touch area
- Listelementer: minimum 44px høyde
- Ikoner: 44px touch area selv om ikonet er 20-24px

---

## 9. Rules — Hva man ALDRI gjør

### Farger

- Aldri kald grå (`#6b7280`, `#9ca3af`) — bruk varm nøytral (`#7a756e`, `#908a82`)
- Aldri ren hvit (`#ffffff`) som bakgrunn — bruk varm krem (`#fdfcfa`)
- Aldri ren svart (`#000000`) som tekst — bruk varm svart (`#1c1814`)
- Aldri blå-grå sidebar eller overflater
- Semantiske bakgrunner: alltid farge ved 10% opacity, aldri full farge

### Typografi

- Aldri bruk mer enn 3 fontfamilier (Instrument Serif, Geist Sans, Geist Mono)
- Aldri serif for brødtekst — kun headings og merke-øyeblikk
- Aldri monospace for labels eller navigation — kun tall og data
- Aldri skipper typehierarkiet (Hero → Section uten Page Heading)

### Spacing

- Aldri ulik padding på kort innenfor samme visning
- Aldri 0px gap mellom seksjoner
- Aldri miks spacing-tokens tilfeldig

### Komponenter

- Aldri hardkodede skygger — bruk definerte nivåer (SM/MD/LG)
- Aldri glassmorfisme på vanlige kort — kun paneler og overlegg
- Aldri farge-endring alene som hover — alltid skygge eller løft
- Aldri hover-tilstander på mobile elementer

### Ikoner

- Aldri emoji i UI
- Aldri andre ikonbiblioteker enn Lucide
- Aldri ikoner større enn 24px uten grunn
- Aldri ikoner uten tilstrekkelig touch-target på mobil (44px)

### Layout

- Aldri kald/flat bakgrunn i auth-flyt — alltid Nordic Split med varm glød
- Aldri sidebar bredere enn 240px
- Aldri innhold uten max-bredde (1280px dashboard, 360px auth-form)
- Aldri ignorér safe areas på mobil
