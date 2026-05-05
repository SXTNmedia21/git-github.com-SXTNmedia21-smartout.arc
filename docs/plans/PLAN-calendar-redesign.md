---
title: "Plan — calendar-redesign"
status: draft
updated: 2026-05-04
created: 2026-05-04
module: mobile
tags: [plan, mobile, calendar, vaktliste, design-handoff, nordic-split]
---

# Plan — calendar-redesign

> Branch: `feat/mobile-calendar-redesign` | Worktree: `~/dev/smartout.ai-mobile-wt-3` | Base: `campaign/mobile` | Module: mobile | Started: 2026-05-04

## Trigger

Pontus leverer hi-fi design-handoff: `docs/design/design_handoff_calendar/` (README + 5 jsx-prototype-filer + standalone HTML). Mobil personlig kalender + vaktliste for ansatt-perspektiv (sous-chef-modus). Dark default. Skal reproduseres pixel-likt i React Native + Expo med Smartout-stack.

## Goal

Implementer to nye/oppgraderte tabs i mobile-app: **Kalender** (NY) + **Vakter** (oppgradert vaktliste). Reproduser handoff pixel-likt med Nordic Split tokens. 3 visnings-modus i Kalender (Uke / Måned / Dag-timeline), 4 scope-filtre i Vakter (Mine / Hele teamet / Avdeling / Ansatt). AddSheet (+) med 5 type-grener + DetailSheet med type-spesifikt innhold. Cross-tab triggere mellom Kalender og Vakter.

## Hard constraints

- **Nordic Split design system** — alle farger fra `packages/design-tokens` (mobile native.ts), CSS-vars-pattern. Ingen hardkodet zinc/gray/black. Avdelings-farger som konstanter.
- **ADR-0133** — mobile execute-only. Calendar = lese D6 production data + filtrere. Ingen authoring (write-paths går gjennom BFF når relevant — overlapper med wt-2 + future).
- **ADR-0134** — telemetry på alle tap-events som muterer state (filter-skift, scope-skift, view-skift).
- **smartout-nordic-split skill** — motion-tokens fra `packages/design-tokens` i stedet for hardkodet stiffness/damping. Spring-physics 35/22/2.2 default.
- **Tailwind v4 / shadcn** — irrelevant for mobile (RN); bruk RN StyleSheet + theme-tokens. Spring-physics fra Reanimated/Framer-Motion-React-Native.
- **iPhone 14 Pro 390x844 baseline** — layout må fungere 360-430 px bredde.
- **Status-bar 47 px topp + home-indicator 34 px bunn** — SafeAreaView edges.
- **Dark default** — handoff er mørk modus. Lys modus er secondary tweak.
- **NO emojis** — Lucide React Native icons only (handoff bruker inline SVG; bytt til Lucide).
- **No hardcoded fonts** — Instrument Serif (heading), Geist (body), Geist Mono (data) fra `packages/design-tokens` + RN font-loader.

## Surfaces in scope

| Surface | Path (target) | Handoff-fil |
|---|---|---|
| Calendar tab root | `apps/mobile/app/(app)/(calendar)/_layout.tsx` (ny) | — |
| WeekScreen | `apps/mobile/app/(app)/(calendar)/index.tsx` (ny) | `screens.jsx → WeekView` |
| MonthScreen | `apps/mobile/app/(app)/(calendar)/month.tsx` (ny) | `screens.jsx → MonthView` |
| DayScreen | `apps/mobile/app/(app)/(calendar)/day.tsx` (ny) | `screens.jsx → DayView` |
| ShiftListScreen (oppgrader) | `apps/mobile/app/(app)/(shifts)/index.tsx` (refaktor) | `shiftlist.jsx → ShiftList` |
| AddSheet | `apps/mobile/src/components/calendar/AddSheet.tsx` (ny) | `screens.jsx → AddSheet` |
| DetailSheet | `apps/mobile/src/components/calendar/DetailSheet.tsx` (ny) | `screens.jsx → DetailSheet` |
| WeekStrip | `apps/mobile/src/components/calendar/WeekStrip.tsx` (ny) | `primitives.jsx → WeekStrip` |
| FilterChips | `apps/mobile/src/components/calendar/FilterChips.tsx` (ny) | `primitives.jsx → FilterChips` |
| ItemCard | `apps/mobile/src/components/calendar/ItemCard.tsx` (ny) | `primitives.jsx → ItemCard` |
| ScopeChips | `apps/mobile/src/components/shift/ScopeChips.tsx` (ny) | `shiftlist.jsx → ScopeChips` |
| DayCrewCluster | `apps/mobile/src/components/shift/DayCrewCluster.tsx` (ny) | `shiftlist.jsx → DayCrewCluster` |
| CompactShiftRow | `apps/mobile/src/components/shift/CompactShiftRow.tsx` (ny) | `shiftlist.jsx → CompactShiftRow` |
| TabBar (oppgrader) | `apps/mobile/app/(app)/_layout.tsx` | `primitives.jsx → TabBar` (5 tabs: Kalender · Vakter · ⊕ FAB · Chat · Min Tid) |
| Calendar data hooks | `apps/mobile/src/hooks/queries/use-calendar-items.ts` (ny) | — |
| Theme tokens (avdelings-farger) | `packages/design-tokens/src/native.ts` | handoff §5 |

## Boundary med wt-2 (mobile-shift-system-polish)

Wt-2 jobber parallelt mot vaktliste-redesign-overlapp. Konfliktmønster:
- Wt-2 Phase 3c skulle polish `(shifts)/index.tsx` (filter-chips, status-pills, error-states)
- Denne sortien (wt-3) overskriver `(shifts)/index.tsx` med full handoff-redesign

**Boundary-løsning:** Wt-2 Phase 3c re-scoped til **kun punch-clock + create-shift-skjerm**. Vaktliste-redesign eies av wt-3.

| Surface | Eier | Status |
|---|---|---|
| `(shifts)/index.tsx` (vaktliste) | wt-3 | full handoff-redesign |
| `(shifts)/create.tsx` | wt-2 | BFF-wrap + form-refaktor |
| `(home)/punch-clock.tsx` | wt-2 | S6 pause-knapp + UI-feedback |
| `_layout.tsx` (TabBar) | wt-3 | 5-tab redesign per handoff |

Når wt-3 lander først (lite sannsynlig — wt-2 er lengre fremme): wt-2 Phase 3c får ren slate på `_layout.tsx` etc.
Når wt-2 lander først: wt-3 må rebase mot ny `campaign/mobile` HEAD som inkluderer wt-2-endringer på create.tsx + punch-clock.tsx (ikke konflikt — wt-3 rører ikke disse).

Coordinator-orkestrering tar ansvar for rebase-rekkefølge ved merge.

## Phases

### Phase 0 — Discovery (Explore agent, haiku)

Map current mobile state vs handoff:
1. Eksisterende `(shifts)/index.tsx` + ShiftCard struktur — hva kan resirkuleres?
2. TabBar `_layout.tsx` — antall tabs nå vs 5 i handoff (vs 4 fra ADR-0133-restore-plan; sjekk hvilken som vinner)
3. Eksisterende `useMyShifts` + `useOperationsFeed` data shape — matcher handoff-Item-typen?
4. Avdelings-farger — eksisterer i `native.ts`? Eller må seedes?
5. Reanimated + framer-motion-react-native availability — hvilken brukes for spring-physics?
6. Inline SVG fra handoff vs Lucide-React-Native — mapping per ikon
7. Sheet-komponent — eksisterer mobile bottom-sheet pattern? `@gorhom/bottom-sheet`?

**Output:** `docs/audits/2026-05-04-calendar-redesign-discovery.md`

### Phase 1 — Lov-sjekk (lovsen, sonnet, read-only)

Spørsmål:
1. **Vaktliste-tilgangsstyring** — handoff viser scope `Hele teamet` med navn/roller på alle ansatte. Aml personvern? GDPR ansattliste-visning på tvers? Trengs C4 capability-gate per scope-mode?
2. **Skiftleder-rettigheter** — README §11 åpent spørsmål. Hvem ser hva? Kan vanlig ansatt se "Hele teamet" / "Ansatt"-dropdown? Eller bare skiftleder + manager?
3. **Tids-zone** — handoff sier "alle tider Europe/Oslo. Bekreft." For workspace med annen tz: hvilken vinner i kalender-rendering?
4. **Booking-data** — handoff `booking`-type viser gjeste-navn + telefon. PII. Hvilke roller skal se contact-info? ADR-0078 channel guards?
5. **Avvik (overdue tasks)** — push-notifikasjon-trigger? Aml §10-9 hvis avvik er pause-relatert?

**Output:** `docs/audits/2026-05-04-lovsen-calendar-rapport.md`

### Phase 2 — ADR + plan-verify (system-steward, opus)

Verifiser plan + lovsen-rapport. Skriv ADRer:
- `00XX-mobile-calendar-tab-architecture.md` — Kalender som ny tab vs. dagens shift-hub
- `00XX-vaktliste-scope-rbac.md` — RBAC per scope-mode (Mine / Team / Avdeling / Ansatt)
- `00XX-tabbar-canonical-layout.md` — 5-tab vs 4-tab (avklare overlap med ADR-0133-restore-plan)

### Phase 3a — Theme + tokens (frontend-designer, sonnet)

Add avdelings-farger til `packages/design-tokens/src/native.ts` + `tokens.ts`. Sync til mobile theme-loader. Add motion-tokens hvis manglende per Nordic Split-skill audit.

### Phase 3b — Primitives (frontend-designer, sonnet)

Bygg shared primitives: WeekStrip, FilterChips, ItemCard, ScopeChips, CompactShiftRow, ProgressRing, Avatar. Hver komponent får et test-eksempel + Storybook-pendant hvis Smartout har det (sjekk).

### Phase 3c — Calendar-screens (frontend-designer + walkai-bridge-builder, sonnet)

Bygg WeekScreen + MonthScreen + DayScreen. Hooks for data: `useCalendarItems({date, scope, filter})`. Navigation cross-tab triggere.

### Phase 3d — ShiftList-redesign (walkai-bridge-builder, sonnet)

Refaktor `(shifts)/index.tsx` til DayCrewCluster-pattern. ScopeChips + Avdelings-dropdown + Ansatt-grid. Pontus' egne rader uthevet.

### Phase 3e — Sheets + AddFlow (walkai-bridge-builder, sonnet)

AddSheet (+) med 5 type-grener (vakt / oppgave / booking / avvik / notat). DetailSheet type-spesifikt innhold.

### Phase 3f — TabBar redesign (frontend-designer, sonnet)

5-tab layout med ⊕ FAB i midten. Aktiv-state styling per handoff.

### Phase 4 — Review (code-reviewer, sonnet)

Diff-review hele sortien. Pixel-paritet med handoff.

## Acceptance criteria

- [ ] `pnpm --filter @smartout/mobile typecheck` grønn
- [ ] `pnpm --filter @smartout/mobile test` grønn
- [ ] PWA-test (port 8083): alle 3 calendar-views render uten warnings
- [ ] PWA-test: scope-skift Mine → Hele teamet → Avdeling: dropdown chevron-rotasjon 150ms
- [ ] PWA-test: cross-tab — `Vakter`-chip i kalender → bytter tab + setter scope=me + range=week
- [ ] PWA-test: tap måned-celle → bytter til Dag-modus med valgt dato
- [ ] PWA-test: tap dag-pille i Uke → setSelected oppdaterer ItemList
- [ ] PWA-test: AddSheet åpnes fra både header `+` og FAB
- [ ] PWA-test: DetailSheet rendrer ulikt for task vs booking vs shift
- [ ] Dark + lys modus tweak fungerer
- [ ] Pixel-paritet: side-ved-side vs prototype HTML — manuell visuell sjekk
- [ ] Ingen hardkodede farger (grep `bg-zinc\|text-gray\|#[0-9a-f]{6}` returnerer 0)
- [ ] ADRer proposed + registrert
- [ ] HANDOFF skrevet med decisions + learnings + next steps

## Journeys (declared up front)

1. **Pontus-checks-day** — Pontus åpner kalender → ser dagens vakter + oppgaver + bookinger → tap shift-card → DetailSheet med skiftleder-info + oppgaver knyttet til shift.
2. **Pontus-checks-week-team** — Pontus bytter til Vakter-tab → scope `Hele teamet` → ser alle 7 dager med DayCrewCluster → finner Marius på torsdag → tap rad → DetailSheet.
3. **Pontus-creates-via-add** — Pontus tap FAB → AddSheet → velger "Avvik" → fyller ut avvik-form → submit (out of scope: backend wiring; UI-flow only).
4. **Pontus-month-overview** — Pontus tap Måned-toggle → ser 6×7 grid med mini-event-blokker → tap dag → DayView med timeline.
5. **Cross-tab-trigger** — Pontus i Kalender Uke-modus → tap `Vakter`-chip → app bytter automatisk til Vakter-tab + scope=me + range=week.

## Out of scope

- "Min tid"-tab innhold (handoff §11 q6 — egen runde)
- Booking-kontakt-info-RBAC enforcement (ADR + capability-gate ferdig først; kanskje egen sortie)
- AddSheet write-paths (calendar viser UI-flow; faktisk write går via wt-2 BFF eller fremtidig)
- Push-notifikasjoner ved avvik (handoff §11 q2; egen sortie)
- Offline-cache (handoff §11 q3; egen sortie)
- Calendar-export / iCal (ikke i handoff)

## Risks

- **Boundary-konflikt med wt-2** — wt-2 og wt-3 begge på campaign/mobile. Wt-2 har skrevet `(shifts)/create.tsx`; wt-3 skriver `(shifts)/index.tsx`. Disjoint files men samme dir. Merge-rekkefølge påvirker rebase-effort.
- **TabBar-konflikt** — `_layout.tsx` røres potensielt av både wt-3 (5-tab redesign) og campaign/mobile-wt-1 (4-tab restore). Sjekk wt-1 status før Phase 3f.
- **Avdelings-farger ADR** — handoff bruker `dept.color` som hex pr ansatt/avdeling. Må mappe til OKLCH-warm-palette uten å bryte handoff-fidelity. Worst case: eksplisitt aksept fra Pontus om at avdelings-farger er utenfor Nordic Split warm-only-policy (egen ADR).
- **Spring-physics i RN** — Reanimated har annen tuning enn framer-motion. Verifiser at 35/22/2.2-tokens føles likt på iOS+Android.
- **Sheet-component-availability** — om `@gorhom/bottom-sheet` ikke er installert: install + ADR. Om eksisterende mobile-sheet-mønster: gjenbruk.

## Mantra

> "Pixel-likt, men i vår grammatikk." Handoff er den visuelle kontrakten; Nordic Split er paletten; React Native er språket.
