---
title: "Year Wheel — Shell Redesign + Season Route"
status: draft
created: 2026-04-20
updated: 2026-04-20
module: year-wheel
tags: [year-wheel, season, cascade, d4, d5, ui, redesign]
---

# Year Wheel — Shell Redesign + Season Route

> **Scope:** Replace the current `/dashboard/year-wheel` page shell with the linear-timeline design bundle (sidebar + canvas + companion rail). Split season editing out to a new route `/dashboard/season/[seasonId]` whose primary submenu is Budsjett / Dag / Time / Åpningstider / Oversikt. Retire the season drawer and the Machine-Room sheet.
>
> **Design source:** `smartout/project/yearwheel/{Year Wheel.html, app.jsx, canvas.jsx, drawer.jsx, data.js}` from the Claude-Design handoff bundle.
>
> **Reference architecture:** ADR-0085 (Year-Wheel governance), spec `2026-04-19-year-wheel-holistic-design.md`, spec `2026-04-10-season-year-wheel-gap-closure-design.md`. Cascade dimensions D1 (envelope) × D4 (demand) × D5 (concept).

---

## 1. Intent

Today's year-wheel page stuffs every season-editing surface into one client component — canvas, drawer, tabs, and the Machine-Room sheet all live together, with a two-column list under the canvas. The new design moves to a **three-column shell** that treats the canvas as the spatial overview and pushes editing out of modals into a **dedicated season route**.

The shift:

| Today | New |
|---|---|
| Canvas + drawer + modal all on one page | Canvas is overview. Season editing = own route. |
| Click season → right-side drawer with 4 tabs + Machine-Room sheet-in-drawer | Click season → `/dashboard/season/[id]` full page with submenu. |
| Create season → modal form | Create season → draw on canvas → quick-create sheet → redirect to the new page. |
| Empty state = blank canvas | Empty state = "NORMAL DRIFT" watermark — the year is inherited ops unless a season overrides it. |
| No peripheral context | Left sidebar (season list, filter pills, gap counts). Right rail (active-now snapshot, upcoming events, draft gaps). |

---

## 2. Architecture

### 2.1 Route layout

```
apps/web/src/app/dashboard/
├── year-wheel/
│   ├── page.tsx                         (server, unchanged — calls resolveDashboardContext)
│   ├── loading.tsx                      (reuse, minor updates)
│   ├── year-wheel-page-client.tsx       REBUILD
│   └── _components/
│       ├── canvas/
│       │   ├── YearCanvas.tsx           NEW
│       │   ├── TimelineBlock.tsx        REWORK
│       │   ├── TimelinePin.tsx          REWORK
│       │   └── DrawPhantom.tsx          NEW
│       ├── shell/
│       │   ├── YearWheelTopbar.tsx      NEW
│       │   ├── SeasonSidebar.tsx        NEW
│       │   ├── CompanionRail.tsx        NEW
│       │   ├── LegendChip.tsx           NEW
│       │   └── AiSuggestionCard.tsx     NEW (static placeholder)
│       └── SeasonQuickCreateSheet.tsx   NEW (Sheet from shadcn/ui, right-anchored)
│
└── season/
    └── [seasonId]/
        ├── page.tsx                     NEW (server — resolveDashboardContext, loads season by id)
        ├── loading.tsx                  NEW
        ├── season-page-client.tsx       NEW
        └── _components/
            ├── SeasonSubmenu.tsx        NEW (tab strip + ?tab= URL sync)
            ├── SeasonBreadcrumb.tsx     NEW (← Årshjul 2026 / Sommer · Utkast)
            ├── BudgetSetupTab.tsx       MOVED from year-wheel
            ├── DayFactorsTab.tsx        MOVED from year-wheel
            ├── HourFactorsTab.tsx       MOVED from year-wheel
            ├── SeasonHoursTab.tsx       MOVED from year-wheel
            └── SeasonOverviewTab.tsx    MOVED from year-wheel (header card stripped)
```

### 2.2 Retired

Deleted after move:

- `year-wheel/_components/YearWheelTimeline.tsx` (replaced by `canvas/YearCanvas.tsx`)
- `year-wheel/_components/SeasonDrawer.tsx` (route takes over)
- `year-wheel/_components/MachineRoomSheet.tsx` (Machine-Room is now the season page itself)
- `year-wheel/_components/SeasonCreateSheet.tsx` (replaced by `SeasonQuickCreateSheet`)
- `year-wheel/_components/YearNavigation.tsx` (logic absorbed into `YearWheelTopbar`)
- `year-wheel/_components/TimelineBlock.tsx`, `TimelinePin.tsx` (reworked in `canvas/`)

Deferred (not rendered in P1 but kept in repo for future use):

- `SeasonGoalsTab.tsx`, `SeasonProceduresTab.tsx` — moved to `season/[seasonId]/_components/_deferred/` and excluded from the submenu. Resurrected in a later P2 sweep.

### 2.3 Hook reuse (unchanged)

The year-wheel context hooks in `year-wheel/_hooks/index.ts` stay put. The new season-route client re-imports them:

- `useSeasons`, `useSeasonBudget`, `useDayFactors`, `useHourFactors`, `useSeasonOperatingHours` — unchanged.
- Add `useSeason(seasonId)` as a derived selector over `useSeasons` (no new network call — same query, filtered).

Hooks in `year-wheel/_hooks/` are **shared** between `year-wheel/` and `season/[seasonId]/`. If they grow mobile-facing requirements, they move into `packages/` per the Mobile Parity rule — out of scope for this change.

### 2.4 Data model touchpoints

Strictly a UI / routing change. No schema migrations, no new tables, no new enums.

Dimensions consumed:

- **D1** — `department_operating_hours`, `department_hours_override` (via `useSeasonOperatingHours` in `SeasonHoursTab`)
- **D4** — `season_budget`, `day_factor`, `hour_factor`, `planning_event` (Budget / Dag / Time / canvas pins)
- **D5** — workspace + niche config (read-only surface info in topbar: "Seeded fra Riksavtalen")
- **C4** — `engine_authority_config` (`activateSeason` mutation is gate-guarded as today)

No cascade-produces-events wiring changes in this spec. The activation flow (`activateSeason` → engine triggers → D6 session upsert) stays as-is. If it is currently incomplete (per `2026-04-19-year-wheel-holistic-design.md` §9.2), that remains a separate follow-up; this redesign does not depend on it.

---

## 3. Year-Wheel Page Shell

### 3.1 Layout

```
┌──────────────────────────────────────────────────────────────────────────┐
│ YearWheelTopbar                                                           │
│  SMARTOUT / PLANLEGGING   Årshjul   ◀ 2026 ▶    [Seeded …]  [+ Ny sesong] │
├──────────────┬──────────────────────────────────────┬─────────────────────┤
│ SeasonSidebar│ Main                                 │ CompanionRail       │
│  Filter pills│  <h2 italic>Hele året i ett blikk</h2>│  Aktiv nå snapshot  │
│  Season list │  /X sesonger · Y hendelser            │  Neste hendelser    │
│  gap-badges  │                                      │  Gaps før aktivering│
│              │  ┌──────── YearCanvas ────────────┐  │                     │
│              │  │  NORMAL DRIFT watermark         │  │                     │
│              │  │  month guides · today marker    │  │                     │
│              │  │  pins (dots/ranges)             │  │                     │
│              │  │  lane-packed blocks (seasons)   │  │                     │
│              │  │  draw-to-create phantom         │  │                     │
│              │  └─────────────────────────────────┘  │                     │
│              │  LegendChip                          │                     │
│              │  AiSuggestionCard (static)           │                     │
└──────────────┴──────────────────────────────────────┴─────────────────────┘
```

Widths: sidebar 260px, rail 280px, main fluid. Rail hides at `<1280px` (`.yw-rail { display:none }`), sidebar narrows to 220px at `<1024px`. Below 768px the rail stays hidden and the sidebar collapses to a top-anchored select (or — if out-of-scope — hidden with a button-to-open, fallback to desktop-first for P1).

### 3.2 `YearWheelTopbar`

- Breadcrumb text: `SMARTOUT · PLANLEGGING` (uppercase, letter-spacing 2px, muted)
- Title: "Årshjul" (Instrument Serif, 28px, fontWeight 400)
- Year ± nav + year label (font-mono, bold)
- "Seeded fra Riksavtalen" pill — static in P1, driven by `workspace.industry === 'hospitality'` (simple check; reads a single constant — no new table).
- "Ny sesong" button (brand orange). Clicking it does **not** open a form — it shows a toast: *"Dra i lerretet for å tegne en sesong."* Draw-to-create is the primary entry.

### 3.3 `SeasonSidebar`

Props: `seasons`, `selectedId`, `filter`, `onSelect`, `onFilterChange`.

- Header: "Sesonger {year}" (10px, letter-spacing 2, muted)
- Filter pills: Alle / Aktiv / Utkast / Arkivert with counts. Selected pill is solid fg/bg-inverted.
- List item: colored status bar (3px wide) + name + dates (mono, muted) + optional gap-count badge. Active season shows a success-dot. Selected row has `bg-sidebar-active` + border.
- Footer: info block "Tegn nye sesonger — klikk og dra i lerretet for å skissere en sesong."

### 3.4 `YearCanvas` (replaces `YearWheelTimeline`)

Same date math module we already have at `apps/web/src/app/dashboard/year-wheel/_lib/timeline-date.ts` — keep it. `getDayOfYear`, `daysInYear`, `clientXToIsoDate` logic still applies.

Visual elements (from `canvas.jsx`):

1. **NORMAL DRIFT watermark** — diagonal hatched gradient + centered italic "Normal drift" text using `font-heading`. Rendered behind blocks, masked so it fades near top. Always visible; no tweak.
2. **Month guides** — 12 vertical lines + uppercase month labels top-left of each column. First line transparent (canvas edge).
3. **Today marker** — 1.5px vertical line + "I DAG" pill. Uses existing post-mount defer (the hydration fix committed earlier) — carried forward.
4. **Pins row** (`pinsY = 28`) — event dots (12px) or multi-day range bars. Category color (internal=muted, cultural_commercial=orange, business_critical=error). AI-suggested = dashed 2px border. High-multiplier = solid ring. `hoursOverride` marker = `◷` glyph next to pin.
5. **Lane-packed season blocks** — auto-pack overlapping seasons into horizontal lanes (`assignLanes`). Each block status gets distinct treatment: active = filled + shadow + white dot, draft = dashed border + tinted background, archived = grey/muted. Edge handles (6px each side) for resize.
6. **Draw-to-create** (see §4.1).
7. **Hover tooltip** — date pill at cursor (`yyyy-mm-dd`, mono, muted) when hovering empty canvas.
8. **Pin popover** — on pin hover, card showing name, date range, multiplier, and AI confidence percentage if applicable.

Dimensions:

- `laneH = 44`
- `pinsY = 28`
- `blocksStartY = pinsY + 32 = 60`
- `canvasH = blocksStartY + laneCount * laneH + 24`

### 3.5 `CompanionRail`

Three cards stacked, each `bg-card` with `border-border` radius-14.

1. **Aktiv nå** (only if an active season exists): serif season name, dates (mono), MiniStat bars:
   - Omsetning progress (currently `0 / target` — revenue-actual not yet tracked; renders a flat bar with a "—" numerator label until reconciliation surfaces a value).
   - Labor-mål (static percent).
2. **Neste hendelser**: top 4 upcoming planning events (date ≥ today, sorted ascending) with category color-dot + name + date + multiplier. AI-suggested events show dashed dot.
3. **Gaps før aktivering**: drafts where `missing?.length > 0`. Warning-tinted card.

Revenue-actual acceptance: we render "—" and a 0%-filled bar. We do **not** block this spec on a reconciliation plumbing change.

### 3.6 `LegendChip` + `AiSuggestionCard`

- Legend: horizontal chip listing block-status swatches, pin-category dots, AI-suggested dashed swatch, `◷` marker. Purely visual reference, no state.
- AI card: static hand-built placeholder matching the design ("AI foreslår: legg til «Systembytte POS» 18. juni"). Accept/Avvis buttons log a telemetry event but do not mutate. This is a scaffold for a future AI-suggestion flow (out of scope).

---

## 4. Create-Season Flow

### 4.1 Draw-to-create

Interaction on `YearCanvas`:

1. `mousedown` on empty canvas (below the pins row, not on a block/pin) starts a draw. Snap lane to `Math.floor((y - blocksStartY) / laneH)`.
2. `mousemove` updates `currentX` and renders `DrawPhantom` — a dashed orange rectangle with live `yyyy-mm-dd → yyyy-mm-dd` label inside.
3. `mouseup` fires `onDrawCreate({ start, end })` if `|Δx| > 12px`. Shorter drags are treated as deselect clicks.

Keyboard: `Esc` cancels an in-progress draw. No keyboard-only create path in P1 (tracked as a11y follow-up).

### 4.2 `SeasonQuickCreateSheet` (from right)

Built on shadcn/ui `Sheet` with `side="right"`. Fields, in order:

- **Navn** (required, default "Ny sesong")
- **Start** / **Slutt** (date pickers, pre-filled from drag)
- **Farge** (swatch picker — 6 presets using OKLCH hues, plus freeform input)
- **Planning cycle** (select; defaults to active cycle for the current year)

Buttons: **Avbryt** / **Opprett sesong**.

On submit:

1. Call `createSeason` mutation. **Hook extension required** — today `CreateSeasonInput` is `{ name, startDate?, endDate? }` and the INSERT omits `color` and `planning_cycle_id`. The new UX needs the sheet to pass `color` and `planning_cycle_id`, and `startDate`/`endDate` become required. Extend the type to `{ name, startDate, endDate, color, planningCycleId }` and extend the INSERT to write those columns (both already exist on `season` — verified in the current SELECT clause). No DB migration.
2. Emit `"season created"` telemetry (space-separated — current convention in `packages/telemetry/src/registry.ts`). The hook already emits this event; extend the `properties.data` payload to include `color` and `planning_cycle_id`.
3. `router.push('/dashboard/season/' + newSeasonId + '?tab=budget')` — no intermediate state, no drawer.

On error: sheet stays open, inline error message. No destructive side effects.

### 4.3 Abandon semantics

If the user closes the quick-create sheet without submitting (Avbryt / Esc / backdrop click), **no record is written**. No zombie drafts. This is the reason we chose quick-create-sheet-then-persist (Q1 option A) over draw-then-immediately-persist.

---

## 5. Season Route — `/dashboard/season/[seasonId]`

### 5.1 Page shell

```
┌────────────────────────────────────────────────────────┐
│ SeasonBreadcrumb                                        │
│  ← Årshjul 2026 / Sommer  · Utkast                      │
├────────────────────────────────────────────────────────┤
│ SeasonSubmenu                                           │
│  [ Budsjett ] [ Dag ] [ Time ] [ Åpningstider ] [ Oversikt ]  │
├────────────────────────────────────────────────────────┤
│                                                         │
│  ...active tab content (full-width, not drawer-sized)...│
│                                                         │
└────────────────────────────────────────────────────────┘
```

**No large header card** — no status pill, no name-as-hero, no dates-as-hero. That information surfaces inside the breadcrumb and the Oversikt tab only.

### 5.2 Submenu

Primary tab strip with 5 tabs, default `?tab=budget`:

| Key | Label | Component | Source |
|---|---|---|---|
| `budget` | Budsjett | `BudgetSetupTab` | moved |
| `day` | Dag | `DayFactorsTab` | moved |
| `hour` | Time | `HourFactorsTab` | moved |
| `hours` | Åpningstider | `SeasonHoursTab` | moved |
| `overview` | Oversikt | `SeasonOverviewTab` | moved, header-card stripped |

URL: `?tab=<key>` is canonical. Tab clicks do `router.replace` (no scroll). Default fallback = `budget`.

### 5.3 SeasonBreadcrumb

One line, small, muted. Format: `← Årshjul {year} / {season.name} · {status}` where status is the translated pill label. The arrow is a plain link back to `/dashboard/year-wheel?year={year}`.

### 5.4 SeasonOverviewTab — no stripping needed

Phase 2.5 fact-check correction: the `SeasonOverviewTab` (344 LOC) is **not** a metadata header — it is a KPI + charts dashboard (4 KPI cards, monthly/weekly/hourly chart strips, all derived from `season_budget` + `day_factor` + `hour_factor` + operating hours). The file is kept as-is and rendered under the "Oversikt" submenu tab with **zero changes**.

The "little group at the top with start and end" Pontus wants removed lives on **`SeasonDrawer` (SheetHeader with SheetTitle + status pill + SheetDescription dates)**, not on Overview tab. Deleting `SeasonDrawer` in step 7 of the migration sequence is what removes that header — nothing to strip from the Overview tab itself.

Activation-gate, missing checklist, activate/archive/duplicate buttons, and "Seeded fra" chip from the 2026-04-19 holistic-design spec are **not implemented** in the current codebase. Rendering the existing Overview tab means those features continue to live in the spec as P2 — this redesign does not introduce them. Flagged as an out-of-scope follow-up (§12).

### 5.5 Direct-link behavior

Deep-linking to `/dashboard/season/xyz?tab=hour` loads the route with that tab active. Invalid `seasonId` → 404 via Next.js `notFound()`. `seasonId` not in current workspace → 404 (RLS already prevents the row from loading).

---

## 6. Events on canvas

Unchanged from today aside from visual treatment:

- Pins still come from `usePlanningEvents` scoped to the active planning cycle of `?year=`.
- `PlanningEventDialog` (existing) opens on pin-click. The design's click-to-select-event + toast is only a prototype shortcut; we keep the real edit dialog.
- Hover popover is an additive enhancement over current behavior.

No changes to the event scoping fix flagged in `2026-04-19-year-wheel-holistic-design.md` §6.6. If that fix lands separately, this redesign inherits the benefit transparently.

---

## 7. Telemetry

Convention (verified against `packages/telemetry/src/registry.ts`): event names are **space-separated**, e.g. `"season created"`, `"auth signed_up"`, `"button clicked"`. Dot-notation is not used.

Existing emit points preserved:

- `"season created"` — extend `properties.data` to include `color` and `planning_cycle_id` (hook change from §4.2).

New events to register (each needs a row in `registerEvent()` with destinations + category):

- `"year_wheel draw_started"` — on `mousedown` begins a valid draw. Category: `scheduling`. Destinations: `["posthog","logger"]`.
- `"year_wheel draw_completed"` — on successful `onDrawCreate`. Properties: `{ start, end, lane }`. Category: `scheduling`. Destinations: `["posthog","logger"]`.
- `"year_wheel draw_cancelled"` — on short drag or Esc. Category: `scheduling`. Destinations: `["posthog","logger"]`.
- `"year_wheel sidebar_filter_changed"` — `{ filter: 'all|active|draft|archived' }`. Category: `scheduling`. Destinations: `["posthog","logger"]`.
- `"season page_viewed"` — on route enter, properties include `{ entity: { entity_type: 'season', entity_id, entity_label } }` + `data: { tab }`. Category: `scheduling`. Destinations: `["posthog","logger","activity_trail"]`.
- `"season tab_changed"` — on submenu switch. Properties: entity + `data: { from, to }`. Category: `scheduling`. Destinations: `["posthog","logger"]`.

Per ADR-0113 / L-0038: destinations that require `properties.entity` (activity_trail, engine_event) must have the entity set — verify at registration time, not at call site.

Existing `year_navigated`, `block_clicked`, `pin_clicked` carry over unchanged.

All events flow through `emit()` per CLAUDE.md "no mutation without emit" rule.

---

## 8. Accessibility

- Sidebar filter pills: `role="tablist"`, each pill `role="tab"` with `aria-selected`.
- Submenu on season page: same pattern, `aria-controls` linking to the visible tab panel.
- Draw-to-create: canvas has `aria-label` describing the year; a screen-reader-only "Add season" action points the user to an alternative create path (the Quick-create sheet opens with a "+" button on the canvas corner for keyboard users — fallback).
- Focus management on route transition: focus lands on the submenu on first render of the season page.
- Motion: respect `prefers-reduced-motion` — disable entrance animations, keep essential feedback (phantom visible during draw, tab-switch fade).

---

## 9. Performance

- `YearCanvas` is pure client component. Heaviest work is lane assignment (O(n·lanes) — negligible for n ≤ 50). Don't memoize beyond a plain `useMemo` keyed on `seasons.length + year`.
- Block and pin rendering: absolute-positioned divs. No canvas/SVG conversion yet (design prototype uses divs too).
- Resize observer for canvas width is retained from today.
- Route split: the new `season/[seasonId]` route ships its own bundle. Moving Machine-Room tabs out of year-wheel reduces the year-wheel bundle.

---

## 10. Error & empty states

- Year has zero seasons → canvas shows NORMAL DRIFT only + centered helper text on canvas "Klikk og dra for å skissere en sesong".
- Sidebar with zero seasons (after filter) → "Ingen sesonger i filteret" + link "Vis alle".
- Rail with no active season → Aktiv-nå card is hidden (rail remains, shorter).
- Rail with no upcoming events → Neste-hendelser card shows "Ingen kommende hendelser".
- Season page, season not found → Next.js 404 page.
- Season page, budget not yet set → BudgetSetupTab renders its existing empty form (already handled).
- Create mutation error → toast + sheet remains open with the form state intact.

---

## 11. Migration sequence

0. **Hook + telemetry extensions** — extend `createSeason` in `packages/year-wheel/src/hooks/use-seasons.ts` to accept `{ name, startDate, endDate, color, planningCycleId }` (all required except color which defaults to brand orange), write `color` and `planning_cycle_id` on INSERT, and extend the `"season created"` emit payload with both fields. Register the six new events listed in §7 in `packages/telemetry/src/registry.ts`. Commit.
1. **Copy tabs to the new location** — copy (do not move) `BudgetSetupTab`, `DayFactorsTab`, `HourFactorsTab`, `SeasonHoursTab`, `SeasonOverviewTab` into `season/[seasonId]/_components/`. Originals stay in place so the old drawer remains functional during steps 2–6. No content changes — `SeasonOverviewTab` is KPI/charts and ships unchanged. Commit.
2. **New season route** — create `page.tsx`, `loading.tsx`, `season-page-client.tsx`, `SeasonSubmenu.tsx`, `SeasonBreadcrumb.tsx`. Render moved tabs. Tab default = budget. Commit.
3. **Shell rebuild (part A)** — create `YearWheelTopbar`, `SeasonSidebar`, `CompanionRail`, `LegendChip`, `AiSuggestionCard` as isolated components. Commit.
4. **Canvas rebuild** — build `YearCanvas`, `DrawPhantom`, reworked `TimelineBlock` and `TimelinePin` under `_components/canvas/`. Commit.
5. **Wire into page** — rewrite `year-wheel-page-client.tsx` to use the new shell and canvas; block/pin clicks `router.push` to the season route. Commit.
6. **Quick-create sheet** — add `SeasonQuickCreateSheet`, wire to draw-to-create and to the "Ny sesong" button-as-hint. Commit.
7. **Retire old files** — delete `YearWheelTimeline`, `TimelineBlock`, `TimelinePin`, `SeasonDrawer`, `MachineRoomSheet`, `SeasonCreateSheet`, `YearNavigation`, and the **original** copies of `BudgetSetupTab` / `DayFactorsTab` / `HourFactorsTab` / `SeasonHoursTab` / `SeasonOverviewTab` from `year-wheel/_components/`. Move `SeasonGoalsTab` + `SeasonProceduresTab` into `season/[seasonId]/_components/_deferred/`. Commit.
8. **Typecheck + manual smoke on both routes.** Update `docs/reference/ROUTES.md`. Commit.

Each step leaves the app in a working state. Step 1 keeps the old drawer still functional; steps 2–6 run in parallel to it; step 7 is the cutover.

---

## 11.5. Activation / missing / seeded-from features (not this spec)

The 2026-04-19 holistic-design spec envisioned activation gates, "hva mangler" checklists, Activate/Archive/Duplicate buttons, and a Seeded-from-Riksavtalen provenance chip inside the Overview tab. **None of these are implemented today.** This redesign keeps them out of scope — the new "Oversikt" tab renders the current KPI+charts file as-is. If Pontus wants any of them before activation-engine wiring lands, it's a separate, later change on top of this redesign.

## 12. Out of scope (explicit)

- Week-factor and month-factor grids. Confirmed — user wants existing Budget/Day/Hour (today's three submenus).
- Mobile surface. Mobile year-wheel remains read-only per ADR-0133. Sidebar + rail hide below 1280px; below 768px the sidebar collapses behind a button (spec-level only; P1 ships desktop-first).
- Engine-event wiring for activation. Stays as-is; separate follow-up.
- AI suggestion backend. Placeholder card only.
- Revenue-actual plumbing for rail Aktiv-nå. Placeholder value only.
- Seeded-from-provenance persistence. Static badge only.
- Team-faktorer UI. Out.
- `SeasonGoalsTab` and `SeasonProceduresTab`. Hidden in P1.
- Draw-to-create keyboard path beyond Esc-cancel. Deferred a11y follow-up.
- Canvas SVG/canvas rendering migration. Div-based throughout.

---

## 13. Open items / assumptions

- **Color swatch presets** — six OKLCH hues. Exact values to align with `packages/design-tokens/src/tokens.ts`. Needs a 10-line lookup, not a new token.
- **Quick-create cycle picker** — default to the active `planning_cycle` for the selected year. If none exists, show an inline "Opprett planning_cycle for {year}" link to create one (reuses existing hook if present; otherwise emit a warning and disable submit).
- **No Overview-tab modification.** Phase 2.5 fact-check established that the overview tab is a KPI/charts dashboard — the drawer owns the status/name/dates header and disappears when the drawer is deleted. No stripping, no content edit.
- **Sidebar / rail responsive behavior below 1280px** — CSS-only rules modeled on the prototype. Keyboard-only users below 1280px retain access via the topbar (Ny-sesong button is visible at all breakpoints).

---

## 14. Acceptance

- `/dashboard/year-wheel` renders the new 3-column shell.
- `/dashboard/season/[seasonId]?tab=budget` renders the submenu with Budsjett landing by default; all five tabs load their moved content.
- Dragging on the canvas creates a phantom and, on release, opens the quick-create sheet with start/end pre-filled.
- Submitting the sheet creates the season and redirects to `/dashboard/season/[newId]?tab=budget` without intermediate drawer.
- Clicking an existing season block on the canvas routes to the season page.
- `pnpm turbo typecheck` passes.
- Sidebar, rail, topbar, canvas, legend, AI-suggestion card all render and respond at 1440px and 1280px viewports.
- Retired files no longer present in the repo.
- New telemetry events emit (visible in PostHog + activity_trail in dev).
