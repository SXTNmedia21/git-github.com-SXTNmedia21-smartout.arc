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

**Activation mechanism (factual note, corrected in Phase 5):** `activateSeason` today writes directly via `supabase.from('season').update()` — it does **not** route through `cascade_gate_write`. ADR-0091 gate-client migration for `activateSeason` is tracked separately and is out of scope. On the DB side, the Postgres trigger at `supabase/migrations/20260428100001_season_activation_trigger.sql:9-38` (`AFTER UPDATE OF status ON season`) already emits `season.activated` into `engine_event` and dispatches to `department_session_lifecycle`. Activation is *not* silent today; whether the downstream `department_session_lifecycle` is complete is a separate concern (see L-0060 "theatre has layers"). This redesign does not alter the trigger or the gate-client question.

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

1. **NORMAL DRIFT watermark** — diagonal hatched gradient + centered italic "Normal drift" text using `font-heading`. Rendered behind blocks, masked so it fades near top. Always visible; no tweak. **Dark-mode override:** the `color-mix(in oklab, var(--muted) 6%, transparent)` recipe collapses to invisible in dark because `--muted` already sits at low L*; use `color-mix(in oklab, var(--muted) 10%, transparent)` via a `:where([data-theme='dark']) &` wrapper or a CSS-var-scoped override token.
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
- **AI card: subdued empty-state only.** Muted border, `Sparkles` icon, copy "Ingen AI-forslag ennå — kommer når forslagsmotoren er koblet på". **No Accept/Avvis buttons. No emit. No registered event.** The card exists as a reserved surface in the layout so the future AI-suggestion engine can occupy it without shell rework. When a real suggestion capability lands, a separate ADR introduces the event, the buttons, and the handler together. Per L-0046 (theatre-provider rule): stub no-ops behind real-looking interfaces are forbidden.

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

1. Call `createSeason` mutation. **Hook extension required** — today `CreateSeasonInput` is `{ name, startDate?, endDate? }` and the INSERT omits `color` and `planning_cycle_id`. Extend the input to `{ name, startDate, endDate, color?: string | null, planningCycleId?: string | null }`. `startDate` and `endDate` become required on the sheet path (pre-filled from the drag), but remain *optional in the type* to preserve the existing `duplicateYear` callsite which passes them in a separate shape. `color` and `planningCycleId` are optional — the DB columns are nullable; a missing value INSERTs `null`. Extend the INSERT to write `color` and `planning_cycle_id` (both columns exist; verified in the current SELECT clause at `use-seasons.ts:59-61`). No DB migration.
2. **Telemetry interface update (blocking).** Extend `SeasonCreated.properties.data` in `packages/telemetry/src/registry.ts:1120-1126` from `{ name: string; status: string }` to `{ name: string; status: string; color?: string | null; planning_cycle_id?: string | null }`. The hook's existing emit at `use-seasons.ts:104-117` adds the two new fields to `properties.data`. Event name stays `"season created"`, destinations stay `["posthog","logger","activity_trail"]`.
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
| `overview` | Oversikt | `SeasonOverviewTab` | moved, unchanged (KPI+charts) |

URL: `?tab=<key>` is canonical. Default fallback = `budget`.

**Tab-nav history behavior — `router.push`.** Tab clicks use `router.push`, not `replace`. Rationale: five tabs of editing context are meaningful steps; the user who moves Budsjett → Dag → Time and presses Back expects to return to Dag, not exit the season route entirely. The trade-off is a slightly longer history stack; acceptable for a season-planning flow where back-navigation through tabs is an explicit user task.

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

Convention (verified against `packages/telemetry/src/registry.ts`): event names are **space-separated**, domain-prefixed. Existing events in this domain use prefix `"season "` (`"season created"`, `"season activated"`, `"season archived"`, `"season updated"`, `"season block_clicked"`, `"season pin_clicked"`, `"season year_navigated"`). **All new events in this spec use the same `"season "` prefix.** The widget-context (year-wheel canvas) does not define a telemetry namespace; the domain does. See ADR-0164 for the reasoning and L-0073 for the underlying principle.

### 7.1 Strongly-typed contract — dual registration

Every event requires **both** (missing either causes untyped `emit()` at call sites; see L-0072):

1. A TypeScript `export interface X extends BaseEvent` declaration in `registry.ts` (added to the event discriminated union).
2. A `registerEvent()` runtime entry in the same file with `destinations` + `category`.

### 7.2 Existing emit points — extend payload only

- `"season created"` — extend `SeasonCreated.properties.data` (at `registry.ts:1120-1126`) from `{ name: string; status: string }` to `{ name: string; status: string; color?: string | null; planning_cycle_id?: string | null }`. Hook emit call updated to match (`use-seasons.ts:104-117`). No change to event name, category (`operations`), or destinations (`["posthog","logger","activity_trail"]`).

### 7.3 New events to register

All new events use the `"season "` prefix and match existing category conventions (mutations → `operations`; clicks/views → `navigation`):

| Event | Category | Destinations | Properties |
|---|---|---|---|
| `"season draw_started"` | `navigation` | `["posthog","logger"]` | `data: { year: number, lane: number }` |
| `"season draw_completed"` | `operations` | `["posthog","logger"]` | `data: { start: string, end: string, lane: number }` |
| `"season draw_cancelled"` | `navigation` | `["posthog","logger"]` | `data: { reason: 'short_drag' \| 'esc' \| 'mouse_exit' }` |
| `"season sidebar_filter_changed"` | `navigation` | `["posthog","logger"]` | `data: { filter: 'all' \| 'active' \| 'draft' \| 'archived' }` |
| `"season year_wheel_viewed"` | `navigation` | `["posthog","logger"]` | `data: { year: number, seasons_count: number }` |
| `"season tab_changed"` | `navigation` | `["posthog","logger"]` | `entity: { entity_type: 'season', entity_id, entity_label }` + `data: { from: TabKey, to: TabKey }` |

Notes:

- `"season draw_completed"` is categorized as `operations` because it *will* result in a `season created` row once the sheet submits — it represents a committed user intent to mutate. The other draw events are exploratory UI gestures.
- `"season tab_changed"` includes `entity` because tab changes happen in the context of a specific season (audit value: knowing which season a user was inspecting). It does **not** route to `activity_trail`; the entity is there for PostHog enrichment.
- **No event routes to `activity_trail` except mutations.** The `"season year_wheel_viewed"` + sidebar filter + draw exploratory events are explicitly excluded (per Supervisor C2). View/navigation audit is not a product requirement.
- Per ADR-0113 / L-0038 (activity_trail silent-drop): destinations that require `properties.entity` must have it set at the call site. Only `"season tab_changed"` carries entity among the new events, and it does not route to `activity_trail`. Contract preserved.

Existing `"season year_navigated"`, `"season block_clicked"`, `"season pin_clicked"` carry over unchanged.

All events flow through `emit()` per CLAUDE.md "no mutation without emit" rule.

---

## 8. Motion + Accessibility

### 8.1 Two-tier motion system

The canonical Nordic spring (stiffness 35 / damping 22 / mass 2.2) is correct for ambient motion but drags behind cursor input on direct-manipulation surfaces. Spec defines two tiers:

- **Tier A — ambient** (page entrance, rail mount, sheet open, route transition, card animate-in): spring `{ stiffness: 35, damping: 22, mass: 2.2 }`. Entrance ≥ 500ms, exit ≥ 250ms. Default.
- **Tier B — direct manipulation** (draw phantom tracking the cursor, block hover-ring, pin hover-scale, sidebar collapse, drag-resize handles): spring `{ stiffness: 400, damping: 30, mass: 0.8 }`. Must feel 1:1 with pointer input (< 200ms to settle).

Quick-create sheet open uses Tier A (right-slide `x: 400 → 0` + opacity `0 → 1`). Draw phantom uses Tier B. Bar-chart animate-in uses Tier A.

### 8.2 Canvas interactions — concrete specs

- **Hour-factor editor** — replace the prototype's `prompt()` (a Nordic violation) with a shadcn `Popover` anchored to the clicked bar, containing an inline number `<Input>` + Enter-to-commit + Esc-to-cancel. Popover motion: Tier A scale+fade from 0.95.
- **Bar-fill gradient** — the prototype's `color-mix(in oklab, var(--orange) X%, var(--border))` reads as muddy brown-grey in dark mode. Switch the base to `var(--muted)`: `color-mix(in oklab, var(--orange) X%, var(--muted))`. Verify in both themes before merge.
- **Pin / range-bar hit areas** — visual dot is 12px (event pins) and 10px-tall (range bars), below the WCAG 24×24 target. Add a transparent 24×24 hit-area wrapper; keep the visual unchanged. Applies in `TimelinePin`.
- **Canvas draw gestures** — `mouseleave` on the canvas cancels the in-progress draw (same effect as Esc). `mouseup` outside the canvas is treated as cancel, not commit. `draw_cancelled` telemetry fires with `reason: 'mouse_exit'` in that case.
- **Quick-create sheet keyboard** — `<form onSubmit>` wraps the fields so Enter submits. Esc closes (shadcn Sheet default). Both trigger `season draw_cancelled` with appropriate `reason` when abandoned.

### 8.3 Instrument Serif italic

Spec italic h2 ("Hele året i ett blikk") and italic "Normal drift" watermark require the italic face to be loaded. Verify `apps/web/src/app/layout.tsx` `next/font` loader for Instrument Serif includes `style: ['normal', 'italic']`. Without it, Tailwind's `italic` utility falls back to synthetic oblique (visually ugly). Fix the loader config if missing — one-line change — in step 1 or 2 of the migration.

### 8.4 Accessibility

- Sidebar filter pills: `role="tablist"`, each pill `role="tab"` with `aria-selected`.
- Submenu on season page: same pattern, `aria-controls` linking to the visible tab panel.
- Canvas: `role="application"` with `aria-label="Årshjul for {year}"`. Season blocks are `role="button"` with `aria-label="{name}, {startDate} til {endDate}, status {status}"`.
- Right rail: `role="complementary"` with `aria-label="Kontekst og varsler"`.
- `aria-live="polite"` region for the draw-phantom's live date label so screen readers hear the range as it's drawn.
- Focus management on route transition: focus lands on the active submenu tab on first render of the season page.
- **Keyboard create path** — `N` (or `Alt+N` to avoid single-key collisions) on the year-wheel page opens `SeasonQuickCreateSheet` with `start = today`, `end = today + 7`, focus on name field. A visible "Ny sesong" button in the topbar remains the discoverable affordance for keyboard and mouse users alike.
- Focus rings on blocks/pins use the Nordic focus-ring token, never browser default. Visible in both themes.
- **`prefers-reduced-motion`** — disable entrance animations (opacity-only), phantom draw collapses to instant rect with no spring, block-select ring uses static outline, sidebar collapse skips width animation, bar chart fades in without per-bar stagger.

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

0a. **Widen `createSeason` tolerant-first** — in `packages/year-wheel/src/hooks/use-seasons.ts`, extend `CreateSeasonInput` to `{ name, startDate?, endDate?, color?: string | null, planningCycleId?: string | null }` (all new fields optional). Extend the INSERT to write `color` and `planning_cycle_id` when provided. Existing callers (`SeasonCreateSheet.tsx`, `duplicateYear`) keep compiling unchanged. Commit.

0b. **Register the six new telemetry events** — in `packages/telemetry/src/registry.ts`, add both TS `export interface X extends BaseEvent` declarations AND runtime `registerEvent()` entries for every event listed in §7.3. Extend `SeasonCreated.properties.data` signature per §7.2. Commit.

1. **Copy tabs to the new location** — copy (do not move) `BudgetSetupTab`, `DayFactorsTab`, `HourFactorsTab`, `SeasonHoursTab`, `SeasonOverviewTab` into `season/[seasonId]/_components/`. Originals stay in place so the old drawer remains functional during steps 2–6. **Rewrite relative imports** inside each copied file (e.g. `../_hooks` → `../../year-wheel/_hooks` for now, or migrate to absolute `@/app/...` paths). No content changes — `SeasonOverviewTab` is KPI/charts and ships unchanged. Commit.
2. **New season route** — create `page.tsx`, `loading.tsx`, `season-page-client.tsx`, `SeasonSubmenu.tsx`, `SeasonBreadcrumb.tsx`. Render moved tabs. Tab default = budget. Commit.
3. **Shell rebuild (part A)** — create `YearWheelTopbar`, `SeasonSidebar`, `CompanionRail`, `LegendChip`, `AiSuggestionCard` as isolated components. Commit.
4. **Canvas rebuild** — build `YearCanvas`, `DrawPhantom`, reworked `TimelineBlock` and `TimelinePin` under `_components/canvas/`. Commit.
5. **Wire into page** — rewrite `year-wheel-page-client.tsx` to use the new shell and canvas; block/pin clicks `router.push` to the season route. Commit.
6. **Quick-create sheet** — add `SeasonQuickCreateSheet`, wire to draw-to-create and to the "Ny sesong" button-as-hint. Commit.
6.5. **Update cascade-task hrefs** — `supabase/migrations/20260503100000_update_cascade_task_hrefs_year_wheel.sql:344,353,364,375` hardcodes `'/dashboard/year-wheel'` for budget-gap tasks. Write a new migration that updates these hrefs to `/dashboard/season/[active_season_id]?tab=budget` (or `tab=day`/`tab=hour`/`tab=hours` per gap-type). For workspaces without an active season, fall back to `/dashboard/year-wheel`. Commit.

7. **Retire old files** — delete `YearWheelTimeline`, `TimelineBlock`, `TimelinePin`, `SeasonDrawer`, `MachineRoomSheet`, `SeasonCreateSheet`, `YearNavigation`, and the **original** copies of `BudgetSetupTab` / `DayFactorsTab` / `HourFactorsTab` / `SeasonHoursTab` / `SeasonOverviewTab` from `year-wheel/_components/`. Move `SeasonGoalsTab` + `SeasonProceduresTab` into `season/[seasonId]/_components/_deferred/`. Update `apps/e2e/tests/season-planning.spec.ts:39-60+` — either rewrite selectors for the new route OR mark those scenarios `test.skip` with a tracking comment pointing at the deferred P2 spec. Commit.

0c. **Tighten `CreateSeasonInput`** — after step 6 lands (new quick-create sheet uses all new fields), revisit the type and make `startDate` + `endDate` non-optional on the sheet-path input while keeping `duplicateYear`'s separate input path unchanged. This step runs after step 6 but before step 7. Commit.

8. **Typecheck + manual smoke on both routes.** Update `docs/reference/ROUTES.md`. Commit.

Each step leaves the app in a working state. Step 0a tolerant-widens so old callsites stay green. Step 1 keeps the old drawer still functional while rewriting imports in the copied tabs. Steps 2–6 run in parallel to the still-working drawer. Step 6.5 updates cascade task hrefs. Step 0c tightens the type before step 7 retires the old files.

**Drift-window discipline.** Between step 1 (copy) and step 7 (retire originals), five tabs exist in two copies. During steps 2–6, any bug fix to a copied tab must either be applied to BOTH copies or deferred to after step 7, so that step 7 doesn't silently delete a fix. Noted in PR description.

---

## 11.5. Scope reset vs. 2026-04-19 holistic-design

This spec **explicitly defers** a subset of features the 2026-04-19 holistic-design spec scheduled for P1:

- Activation gate card + "hva mangler" checklist
- Activate / Archive / Duplicate action buttons
- Seeded-from-Riksavtalen provenance chip (also — per memory `project_cascade_five_dimensions.md`: hospitality.ts rates are known-WRONG; the chip would make a false authority claim until real framework provenance lands)
- Goals tab (moved to `_deferred/`)
- Procedures tab (moved to `_deferred/`)

None of these are implemented today. Rather than carry forward a half-finished P1 target, this spec resets them to P2 pending: (a) activation-engine wiring completeness (separate ADR-scoped work), (b) real regulatory_framework provenance persistence, (c) product clarity on activation UX after the route split lands and user behavior is observed.

**This reset is logged against the 2026-04-19 holistic-design verdict** in `docs/council/COUNCIL-LOG.md` (2026-04-20 session row) per L-0074 — silent scope reduction between councils breaks the audit chain and must be surfaced.

### 7.4 "Seeded fra Riksavtalen" pill — deferred

Per L-0060 and the hospitality.ts rates issue, the pill claim is not load-bearing until provenance is persisted per workspace. The year-wheel topbar ships **without** the pill. A later spec introduces it once real framework binding lands.

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
- Tab navigation within the season page uses `router.push` (Back returns to the previous tab).
- `pnpm turbo typecheck` passes after every migration step (0a → 8), including the intermediate "both-copies" window.
- Sidebar, rail, topbar, canvas, legend, AI-suggestion card all render and respond at 1440px and 1280px viewports.
- Retired files no longer present in the repo.
- `apps/e2e/tests/season-planning.spec.ts` passes (either updated selectors or skip flags on deferred Goals/Procedures scenarios).
- All six new telemetry events emit with typed `emit()` (no `any` shape) and land in PostHog + logger. `"season created"` continues to land in `activity_trail`.
- `AiSuggestionCard` renders as empty-state; no buttons, no emit, no PostHog events.
- Hour-factor editor uses Popover + Input, not `prompt()`.
- `supabase/migrations/...` adds a new migration updating cascade-task hrefs from `/dashboard/year-wheel` to `/dashboard/season/[id]?tab=<key>` where applicable.
- Instrument Serif italic renders correctly (no synthetic oblique) — verified by visual inspection of the h2 and watermark.
