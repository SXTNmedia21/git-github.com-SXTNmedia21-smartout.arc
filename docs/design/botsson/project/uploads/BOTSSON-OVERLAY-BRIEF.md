---
title: "Botsson Arena — Overlay brief til designteamet"
status: draft
updated: 2026-04-22
created: 2026-04-22
module: MODULE_BOTSSON
tags: [design, overlay, botsson, arena, brief, animations]
---

# Botsson Arena — Overlay brief til designteamet

> Portalen mellom menneske og AI-agent. Én `<div>` som morfer gjennom fire tettheter. Emma (agenten) lever i samtalen; Stage Engine er usynlig infrastruktur.

---

## 1. Konsept — hva overlayen ER

Botsson er ikke en chatbot-widget. Det er **én sammenhengende, flytende shell** som lever på toppen av hele dashboardet (`z-index: 65`). Den er **kanal-agnostisk** (stemme, chat, hybrid) og **oppdrag-agnostisk** (samme shell håndterer onboarding, admin-oppgaver, notater, beregninger, logger, minne).

Shellen har én identitet på tvers av tettheter — samme avatar, samme farge (brand-orange `oklch(0.65 0.22 40)`), samme personlighet (Emma som standard). Alt den gjør er å **endre form** basert på hvor mye den trenger fra brukerens oppmerksomhet.

**Designfilosofi:** "Enabled, ikke scripted." Shellen skal føles som en kollega som sitter i hjørnet — du ser på henne når du trenger henne, ellers puster hun rolig ved siden av deg.

---

## 2. Fire tettheter (densities) — én shell som morfer

| Density | Størrelse | Posisjon | Trigger | Intensjon |
|---------|-----------|----------|---------|-----------|
| **Orb** | 50×50px, sirkulær | Drag-bar, magnetisk til kant (10px gap, 40px snap-sone) | Default / ESC fra sticky / tap når inaktiv | Passiv — "her om du trenger meg" |
| **Sticky** | 250×200px, radius 12 | Snappet til venstre eller høyre kant | Klikk på orb / bakgrunnsklikk i arena | Perifert vindu — "ser hva jeg jobber med uten å forstyrre" |
| **Arena** | 600×500px (320×300 min, 900×800 maks), radius 16 | Flytende, dragbar, resizable | Klikk på sticky / klikk på orb | Aktivt arbeid — full funksjonsflate |
| **Immersive** | 100vw × 100vh, radius 0 | Inset-0 | Eksplisitt expand i arena | Full konsentrasjon — stemme-sesjon, video |

**Morph-animasjon mellom alle fire:** `280ms cubic-bezier(0.4, 0, 0.2, 1)` på width, height, border-radius, box-shadow, transform. Top/left 80% av denne varigheten for svak stagger.

**ESC-tasten trapper nedover:** immersive → arena → sticky → orb.

---

## 3. Orb — den levende sirkelen

Orben har **6 statuser**, hver med sin visuelle identitet. Alle kjører på brand-orange med warm OKLCH-gradient.

| Status | Visuelt | Animasjon |
|--------|---------|-----------|
| `idle` | Orange gradient, subtil breathing-ring inne | `botsson-breathe 3s` — scale 1 → 1.06, opacity 0.25 → 0.5 |
| `listening` | Hul sirkel innvendig (1.5px border) | Statisk, ring puster |
| `thinking` | Liten prikk som pulserer | `botsson-pulse 1.5s` — scale 1 → 1.15 |
| `speaking` | 5 vertikale bars (lydbølge) | `botsson-bar 0.8s`, stagger 0.07s per bar |
| `notification` | **Showstopperen** — mørk core, roterende halo, rippler, partikler, bjelle | Se under |
| Ulest badge | Liten orange sirkel (16×16) med antall | Øvre høyre, 9+ ved mange |

### Notification-orb (jaw-dropper)
Når Emma har noe *til brukeren* (ikke bare responderer):
- **Mørk core** (zinc-900 → black gradient) — kontrast mot resten
- **Roterende conic halo** — `botsson-notify-rotate 3s linear` — transparent → brand-orange → transparent
- **3 ripple-ringer** — `botsson-notify-ripple 2.4s`, stagger 0.8s — scale 0.8 → 2.2, opacity 0.6 → 0
- **Throb** — `botsson-notify-throb 2s` — scale 1 → 1.08 med økende box-shadow
- **Shimmer sweep** — `botsson-notify-shimmer 3s` — lyssveip over overflaten
- **5 svevende partikler** rundt orben (radius 14px, 30/110/200/280/340°) — `botsson-particle-float 2s`
- **Bjelle-ikon** i senter, drop-shadow med brand-orange

Hover: scale 1.1. Active: scale 0.95. Shadow: `oklch(0.65 0.22 40 / 0.25)` → `0.4` på hover.

---

## 4. Sticky — post-it med personlighet

Sticky er en **peking-lapp** i venstre eller høyre kant. Den har **3 oppførselsmodi**:

1. **Extended (åpen)** — 250×200, viser innhold
2. **Retracted (trukket inn)** — kun 10px sliver synlig med neon-indikator, etter 4 sekunder uten aktivitet
3. **Hover** — scale 1.05, rolige voice-kontroller vokser ut på innsiden

### Retract-animasjon
`400ms cubic-bezier(0.22, 1, 0.36, 1)` — translateX ut av skjermen, lar 10px være igjen. Opacity på innhold `0 → 1`.

### Retracted sliver
- Vertikal 3×28px pille i midten av kanten
- `botsson-neon-blink 2.5s` — opacity 0.25 → 0.85, box-shadow pulserer (`0 0 6px currentColor, 0 0 14px currentColor`)
- Brand-orange når tilkoblet, muted ellers
- Unread badge (14×14) flyter ved siden av når det er noe nytt

### Innhold i sticky (prioriteringsrekkefølge)
1. **Live speech** — når Emma snakker, 5 linjer av currentText, fade som hun prater
2. **Gjøremål** — pending tasks med checkbox-preview (maks 4, "+X til")
3. **Notater** — siste notat med markdown-rendering (headings, bullets, checkboxes)
4. **Siste chat-melding** — "Du"/"Emma"-label + 4 linjer
5. **Empty state** — kun "Emma" i ekstremt muted text (opacity 0.25)

### Voice-kontroller (hover)
Flyter ut **på innsiden** (mot skjermsenter) — 40×40px rund knapp, stagger:
- Ikke tilkoblet: Mic (start) — brand-orange
- Tilkoblet: Mic (mute, bytter mellom orange/card) + Hangup (destructive border)
Alle: scale 1.1 på hover, 0.9 på active.

---

## 5. Arena — den flytende arbeidsflaten

Arena er **hovedshowet**. 600×500 default, resizable via 8 edge handles + synlig diagonal grip nede til høyre.

### Entrance-koreografi (stagger)
1. **Header** — `botsson-slide-down 250ms` fra -12px
2. **Content** — `botsson-scale-up 280ms` fra 0.92 (60ms delay)
3. **Footer (voice)** — `botsson-slide-up 220ms` fra +10px (120ms delay)
4. **FAB-knapper** — `botsson-pop-in 300ms` med 60% overshoot til 1.08 (180ms delay)

### Anatomi

```
┌─────────────────────────────────────────────┐
│ [E]  Emma  persona            VIEW    [v]  │  ← Header (draggable)
├─────────────────────────────────────────────┤
│                                             │
│              ACTIVE VIEW                    │  ← 12 mulige views
│         (visualizer / chat / notes /        │
│          tasks / calc / log / memory …)     │
│                                             │
├─────────────────────────────────────────────┤
│  [💤]        [🎤]          ▁▃▅▃             │  ← Voice footer
├─────────────────────────────────────────────┤
│[+]                                      [+] │  ← FAB-er + resize-grip
└─────────────────────────────────────────────┘
   ↑ Tools                            Context ↑
```

### Header
- Emma-avatar (36×36 rund gradient, initialen "E") — klikkes → dropdown-meny
- Status-dot nede til høyre på avatar (2.5×2.5px, bordered 2px) — grønn (tilkoblet) / orange (snakker, med ping) / muted (av)
- Navn + persona-label + status-tekst ("Snakker" / "Tenker…" / "Lytter" / "Tilkoblet")
- 3 mini voice-bars når hun snakker (`botsson-bar`, stagger)
- View-tittel badge høyre (skjult under 640px)
- Chevron-down knapp (minimer)
- Dra hele headeren → drar shellen

### FAB — Tools (nede venstre)
Bloom pattern — 4 knapper folder seg **oppover** ved hover (BLOOM_SPACING 44px):
- Voice (visualizer)
- Notepad
- Gjøremål (tasks)
- Kalkulator

Plus-knappen roterer 45° når åpen. Hver knapp får 30ms ekstra delay og 40ms lengre transition (stagger).

### FAB — Context (nede høyre)
Samme mønster, men for meta-views:
- Chat (admin-chat)
- Logg (tool calls + telemetri)
- Minne (lagrede memories)
- Historikk (samtalelogg)

### Resize
- Diagonal grip nede-høyre — 3 SVG-streker, synlig med opacity 0.2 → 0.5 på hover
- Tynne hoverbare kanter (2px) på bottom/right — brand-orange/5% på hover
- Minimum 320×300, maks 900×800
- Ved aktiv resize: fullscreen overlay capturer pointer events

### Throw-to-dismiss
I arena-modus: dra med fart > 500px/s **mot en kant** (allerede nær kanten, <2px) → kollapser til orb. Klassisk iOS-følelse.

### Bakgrunnsklikk
Klikk utenfor shellen i arena → kollapser til sticky (på nærmeste side).

---

## 6. Immersive — full fokus

- Hele viewporten, radius 0
- Brukes til stemme-sesjon (stor visualizer), video-avspilling
- ESC → tilbake til arena
- Blur og mørk backdrop bak shellen (pending design-input)

---

## 7. Alle 12 views — innhold og logikk

| View | Norsk | Formål | Nøkkelelementer |
|------|-------|--------|------------------|
| `visualizer` | Stemme | Voice session | Multi-layered orb, rings, waveform, partikler |
| `chat` | Samtale | Transkripsjon | Bubble-stil, Emma-avatar per melding, typing indicator |
| `admin-chat` | Botsson | Typed-input assist for admin | Workspace-scoped capability chat med prime context |
| `notepad` | Notater | Rich-text notater med tags | Sidebar med note-liste, markdown blocks, checkbox, @profile-tags |
| `calculator` | Kalkulator | Regning | Display + expression, 4-kolonners button grid, keyboard support |
| `settings` | Innstillinger | Persona, stemme, temperatur | **Expander arena til 75% viewport når åpnet, restorer ved lukking** |
| `tasks` | Gjøremål | Task management | Priority badges (low/med/high/urgent), deadline picker, completed section |
| `log` | Logg | Debug | 2 tabs: Tool Calls + Telemetri. Fargekodede per type |
| `memory` | Minne | Stored memories | Type-badges (preferanse/fakta/instruks/relasjon/observasjon) |
| `history` | Historikk | Samtalelogg | Bubble-stil, Emma=orange, Bruker=neutral |
| `form` | Skjema | Placeholder | Ikke implementert |
| `video` | Video | Placeholder | Ikke implementert |

### Visualizer — premium voice-orb (hovedshowet)

**4 konsentriske lag:**
1. **Outer ring** (200×200) — conic gradient halo, `botsson-orb-ring-slow 8s linear` (rotasjon)
2. **Middle ring** (150×150) — `botsson-orb-ring-reverse 12s` (motroter), når speaking: + `botsson-orb-speak-pulse 1.2s`
3. **Inner glow ring** (96×96) — radial gradient, listening: `botsson-orb-listen 3s`
4. **Core orb** (64×64) — radial gradient med boksskygge, scale 1.08 når speaking

**Tilstandsvarianter:**
- **Speaking:** 7 vertikale waveform-bars inni core (`botsson-waveform-1/2/3`, 0.6-1.2s), 12 partikler blåser ut radialt
- **Listening:** Pustende glow, solid sirkel i core
- **Thinking:** Dashed ring utenfor + `botsson-orb-think 3s` (180° rotasjon + scale)
- **Idle (disconnected):** **Aurora-shimmer** i bakgrunnen (`botsson-aurora 20s`) + 20 ambient partikler (glitter + skyfall)

**Live-tekst** under orben (fixed 14px høyde, `line-clamp-2`) — viser currentText, "Lytter...", eller "Tenker..." uten layout-shift.

### Tasks — mer enn bare checklist
- Priority-pille (low=muted, medium=blå, high=orange, urgent=rød) — klikkes for å sykle
- Deadline-button (inline datetime-picker ved klikk)
- Done-seksjon nederst med emerald-accent + strikethrough
- Left-accent bar per task (3px, farge matcher prioritet)

### Notepad — markdown-aware
- Sidebar 140px med mini-kort per notat (topic, timestamp, tag-badges)
- Edit/view-toggle
- Auto-topic fra første linje (maks 30 tegn)
- Rendering: `#`/`##`/`###` headings, `- [ ]`/`- [x]` tasks, `- ` bullets, `@username` pills, `**bold**`

---

## 8. Personligheter — Emma × Persona × Rank

Emma har **6 personality presets**, bygget som kombinasjoner av Persona (4) × Rank (4) × Blend (0-10):

| Preset | Persona | Rank | Blend | Temperatur | Greeting |
|--------|---------|------|-------|------------|----------|
| **Dagsjef** | Puls (tempomaker) | Admin | 8 | 0.2 | "Hei! Hva trenger du?" |
| **Mentor** | Saga (forteller) | Manager | 4 | 0.4 | — (user speaks first) |
| **Nysgjerrig kollega** | Gnist (oppfinner) | Employee | 2 | 0.7 | — |
| **Trygg start** | Vakt (observatør) | Trainee | 1 | 0.5 | "Hei og velkommen! Jeg er her for å hjelpe deg i gang." |
| **Strategisk rådgiver** | Saga | Admin | 6 | 0.3 | — |
| **Brannslukker** | Puls | Manager | 7 | 0.2 | "OK, hva brenner?" |

Blend styrer hvor mye persona-personlighet vs rank-autoritet som dominerer promptet.

**Stemmer** (Ultravox included billing):
- Lise Botsson (NO — Smartouts signaturstemme)
- Emma (NO kvinne — default)
- Johannes (NO mann)
- Sanna (SV kvinne)
- Adam (SV mann)
- Mathias (DK mann)

---

## 9. Interaksjonsmønstre — hva designet må dekke

### Drag
- Pointer capture på startX/Y, delta → clamped posisjon
- Velocity buffer (6 siste punkter, 1s window) → throw-detection
- 3px threshold før "moved" — ellers tolkes som klikk (expand)
- Magnetic edge: innen 40px → snap til 10px fra kanten (holder aldri flush)
- Position lagres i localStorage per density

### Klikk-logikk
- Klikk på orb → arena (ekspanderer)
- Klikk på sticky (ikke kontroll) → arena
- Klikk på arena-bakgrunn → sticky
- Klikk på avatar i arena-header → Emma-meny (settings, reminders)

### Keyboard
- `Escape` — steg ned (immersive → arena → sticky → orb)
- `Cmd/Ctrl + .` — toggle synlighet (reservert)
- `Cmd/Ctrl + Shift + F` — fullscreen (reservert)
- `Tab` — syklus mellom tabs (reservert)

### Responsive
- Desktop (>1024): alle moduser
- Tablet (768-1024): ingen expanded (maks arena)
- Mobile (<768): kun orb eller immersive

---

## 10. Design-tokens (Nordic Split)

| Token | Verdi | Bruk |
|-------|-------|------|
| Brand orange | `oklch(0.65 0.22 40)` | Emma, active states, accent |
| Background | `var(--background)` | Shell base |
| Card | `var(--card)` | Sticky/arena fill |
| Border | `var(--border)` | Edge lines |
| Accent | `var(--accent)` | Hover states |
| Muted-foreground | `var(--muted-foreground)` | Secondary text, inactive indicators |

**Shadow-hierarki:**
- Orb: `oklch(0.65 0.22 40 / 0.25)` base, `0.4` hover
- Sticky inactive: `0 4px 20px -4px rgba(0,0,0,0.1)`
- Sticky active (Emma pratende): `0 4px 24px -4px rgba(255,140,50,0.15)`
- Arena inactive: `0 8px 32px -8px rgba(0,0,0,0.15)`
- Arena active: `0 8px 40px -8px rgba(255,140,50,0.12)`
- Dragging: `0 25px 60px -12px rgba(0,0,0,0.25)`

**Typografi:**
- Headings: Instrument Serif (`font-heading`)
- Body: Geist Sans
- Logger/kode: Geist Mono
- Small labels: 10-11px uppercase tracking-wider

**Easing:** `cubic-bezier(0.4, 0, 0.2, 1)` standard, `cubic-bezier(0.22, 1, 0.36, 1)` for spring-følelse (sticky retract).

---

## 11. Animasjonskatalog (samlet)

| Keyframe | Varighet | Bruk |
|----------|----------|------|
| `botsson-breathe` | 3s ∞ | Orb idle ring |
| `botsson-pulse` | 1.5s ∞ | Thinking dot |
| `botsson-bar` | 0.8s ∞ | Voice bars (5 stk, 0.07s stagger) |
| `botsson-fade-in` | 120-180ms | Generell entry |
| `botsson-neon-blink` | 2.5s ∞ | Retracted sticky sliver |
| `botsson-notify-rotate` | 3s linear ∞ | Notification halo |
| `botsson-notify-ripple` | 2.4s ∞ (×3, stagger 0.8s) | Notification ripples |
| `botsson-notify-throb` | 2s ∞ | Notification core |
| `botsson-notify-shimmer` | 3s ∞ | Notification surface |
| `botsson-particle-float` | 2s ∞ (×5) | Notification partikler |
| `botsson-slide-down` | 250ms | Arena header entry |
| `botsson-scale-up` | 280ms (60ms delay) | Arena content entry |
| `botsson-slide-up` | 220ms (120ms delay) | Arena footer entry |
| `botsson-pop-in` | 300ms (180ms delay) | FAB entry, 60% overshoot |
| `botsson-orb-ring-slow` | 8s linear ∞ | Visualizer outer ring |
| `botsson-orb-ring-reverse` | 12s / 5s linear ∞ | Visualizer middle ring |
| `botsson-orb-speak-pulse` | 1.2s ∞ | Speaking middle ring |
| `botsson-waveform-1/2/3` | 0.6-1.2s ∞ | Voice bars inni core |
| `botsson-orb-particle` | 1.2-2s ∞ (×12) | Speaking partikler (radial burst) |
| `botsson-orb-listen` | 3s ∞ | Listening breathing glow |
| `botsson-orb-think` | 3s ∞ | Thinking shimmer |
| `botsson-glitter` | 6-16s ∞ (×~7) | Idle ambient sparkle |
| `botsson-skyfall` | 6-16s ∞ (×~13) | Idle ambient drift |
| `botsson-aurora` | 20s ∞ | Idle bakgrunn-sveip |
| `botsson-check` | varierende | Task complete |

---

## 12. Hva som trengs videre — designoppdrag

### Prioritet 1 — helhetsidentitet
- **Signature-illustrasjon av Emma** (ikke bare "E" på gradient). Må fungere i 36×36 (arena-avatar) og 50×50 (orb) og bære stemningen "trygg kollega". I dag er det kun en bokstav.
- **Notification-tilstand — kunstnerisk polish.** Mekanikken er der (roterende halo, rippler, partikler, bjelle) men bell-ikonet er generisk. Vil ha et ikon-system som kan bytte per notification-type (f.eks. task due, mention, help needed).
- **Immersive modus — bakgrunn/backdrop.** Har ikke en helhetlig bakgrunnsdesign når shellen tar over hele viewporten. I dag bare radius 0 på shellen.

### Prioritet 2 — views med placeholders
- **Form view** — kun en placeholder-streng "Skjema" i dag. Skal kunne rendere dynamiske skjemaer Emma leder brukeren gjennom.
- **Video view** — kun placeholder "Video". Kommer til å vise onboarding-klipp, introer, tutorials.
- **Settings view** — finnes (i kode), men layouten bør pusses. Expander til 75% viewport når åpnet, det må se *designet* ut, ikke bare "arena blir stor".

### Prioritet 3 — mikrointeraksjoner
- **Transition mellom views** — i dag bare fade/scale på content-bytter. Kunne hatt shared-element transitions (Emma-avatar som beveger seg, bar som morfer).
- **Task complete** — `botsson-check` keyframe finnes, men satisfying "ding" (visuell) mangler.
- **Drag preview / ghost** — shellen har ingen visuell feedback på hva den "faller på" når du drar (snap zones, dock targets).
- **Voice controls i sticky** — fungerer, men kunne vært mer koreografert (f.eks. enter/exit med stagger).

### Prioritet 4 — states designteamet må definere visuelt
- **Offline / error state** for Emma — hva ser brukeren når nettverk dør midt i samtale?
- **Multi-session** — hva om Emma har 2 samtidige oppgaver gående (én passiv, én aktiv)?
- **Workspace switch** — shellen persister posisjon i localStorage, men identiteten? Bør Emma "pakke sammen" visuelt når man bytter workspace?

### Prioritet 5 — mobil-parity (ADR-0133)
- Mobile får kun orb og immersive. Ingen floating panel, ingen docking. Designteamet bør lage immersive-modus mobil-først, siden det blir primærflaten.
- Voice-UX på mobil (LiveKit, ikke Ultravox) — kanskje egen shell-variant?

---

## 13. Filreferanser (for designteamet ved spørsmål)

| Filsti | Hva |
|--------|-----|
| `apps/web/src/app/Botsson/_components/BotssonShell.tsx` | Den morfende div-en, drag/resize, magnetic edges |
| `apps/web/src/app/Botsson/_components/BotssonOrb.tsx` | Orb + notification-orb |
| `apps/web/src/app/Botsson/_components/BotssonSticky.tsx` | Post-it, retract, hover-kontroller |
| `apps/web/src/app/Botsson/_components/BotssonArena.tsx` | Alle 12 views, FAB-er, header, voice-footer |
| `apps/web/src/app/Botsson/_components/Botsson.css` | Alle keyframes |
| `apps/web/src/app/Botsson/_components/types.ts` | DENSITY_DIMENSIONS, TIMING, EASING, voice-register, personlighets-presets |
| `apps/web/src/app/Botsson/_components/persona-engine.ts` | 4 persona × 4 rank × blend |
| `packages/Botsson/concepts/VISION.md` | Designfilosofi |
| `packages/Botsson/blueprints/floating-panel-patterns.md` | Panel-mønstre referanse |

---

**Kort oppsummert for designteamet:** Botsson er én agent som lever i fire former. Den trenger å *puste* i alle — fra den lille orben nede i hjørnet til immersive-modus. Emma må kjennes som *samme person* uansett tetthet. Animasjonene er mekanisk på plass, men den visuelle identiteten, notification-polish, immersive-bakgrunn og de tomme placeholder-viewene er det som skiller "fungerer" fra "verdensklasse."
