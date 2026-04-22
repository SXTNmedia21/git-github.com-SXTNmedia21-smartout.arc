---
title: "User Journeys — Year Wheel Redesign"
status: done
updated: 2026-04-20
created: 2026-04-20
module: year-wheel
tags: [year-wheel, season, planning, cascade, d4, journeys]
---

# User Journeys — Year Wheel Redesign

> Feature: 2026-04-20 year-wheel redesign (commit range `66e24295` → `e5d45a18` on `feat/year-wheel`).
> Only admins author seasons. Managers and employees consume downstream artifacts (shifts, budgets) but do not touch this surface. Mobile is read-only per ADR-0133 — journeys below are desktop web only.

---

## Journey: Admin — View the Year at a Glance

**Precondition:** Admin is logged in and their workspace has completed cascade bootstrap.

1. Admin navigates to `/dashboard/year-wheel` → System renders the 3-column shell
2. System displays topbar (`SMARTOUT · PLANLEGGING` breadcrumb + "Årshjul" heading + year nav + "Ny sesong" hint button)
3. System displays left sidebar (filter pills — Alle / Aktiv / Utkast / Arkivert — and list of seasons with status bars + dates)
4. System displays main canvas: NORMAL DRIFT diagonal-hatch watermark + italic "Hele året i ett blikk" headline + month guides + today marker + lane-packed season blocks + event pins
5. System displays right companion rail (≥1280px only): "Aktiv nå" snapshot (if active season exists), "Neste hendelser" list, "Gaps før aktivering" warnings
6. System displays legend chip + AI-suggestion empty-state card below the canvas
7. System emits `"season year_wheel_viewed"` telemetry with `{ year, seasons_count }` (navigation category, posthog + logger)

**Postcondition:** Admin sees the full year overview. No mutations performed.

**Error paths:**
- No active planning_cycle for the year → Canvas renders empty (NORMAL DRIFT watermark visible across whole year), sidebar shows "Ingen sesonger" state, rail hides the Aktiv-nå card.
- Viewport `<1280px` → Companion rail is hidden via CSS, sidebar remains visible.
- Viewport `<1024px` → Sidebar narrows to 220px.
- Viewport `<768px` → Sidebar collapses behind a trigger (future responsive work; desktop-first for P1).

---

## Journey: Admin — Create Season by Drawing on Canvas

**Precondition:** Admin is on `/dashboard/year-wheel` with at least one empty horizontal lane visible below the pins row.

1. Admin presses-and-drags on an empty part of the canvas → System starts a draw (emits `"season draw_started"` with `{ year, lane }`)
2. System renders `DrawPhantom` — a dashed brand-orange rectangle that tracks the cursor, with live `{startDate} → {endDate}` label inside
3. System updates an `aria-live="polite"` region so screen readers announce the range
4. Admin releases mouse after moving more than 12px → System commits the draw, computes the end date from pixel-X, calls `onDrawCreate({ start, end })`, emits `"season draw_completed"` with `{ start, end, lane }`
5. System opens `SeasonQuickCreateSheet` from the right side with `start` / `end` pre-filled, name defaulting to "Ny sesong", first color swatch selected, and active `planning_cycle` for the year auto-selected (or a warning if none exists)
6. Admin tweaks the name, picks a color swatch, adjusts dates if needed, submits (Enter or "Opprett sesong" button)
7. System calls `createSeason` mutation → INSERT row in `season` with `workspace_id`, `name`, `slug` (auto-derived), `start_date`, `end_date`, `status='draft'`, `color`, `planning_cycle_id`
8. System emits `"season created"` telemetry (operations category; posthog + logger + activity_trail; entity set to the new season)
9. System invalidates the seasons TanStack query, closes the sheet, routes to `/dashboard/season/[newId]?tab=budget` via `router.push`

**Postcondition:** New season exists as a draft row. Admin lands on the Budsjett tab of the season page, ready to set inntektsmål + factors.

**Error paths:**
- Drag distance ≤12px → Treated as cancel (`"season draw_cancelled"` with `reason: 'short_drag'`). Phantom disappears; no sheet opens.
- `Esc` during draw → Cancel (`"season draw_cancelled"` with `reason: 'esc'`). Phantom disappears.
- Mouse leaves canvas mid-draw → Cancel (`"season draw_cancelled"` with `reason: 'mouse_exit'`). Phantom disappears.
- Admin closes the sheet without submitting (Avbryt, Esc, or backdrop click) → No season created (`"season draw_cancelled"` with `reason: 'sheet_abandoned'`). No zombie draft.
- `createSeason` mutation fails (RLS / validation / network) → Sheet stays open, inline toast error, form state preserved.
- No `planning_cycle` for the year → Sheet shows inline note "Ingen planning cycle for {year}. Sesongen opprettes uten cycle-binding." Submit remains enabled; `planning_cycle_id` inserted as null.

---

## Journey: Admin — Create Season via Keyboard Shortcut

**Precondition:** Admin is on `/dashboard/year-wheel` with no quick-create sheet currently open. Keyboard focus is outside any text input.

1. Admin presses `Alt+N` → System intercepts the keydown before browser default
2. System computes `start = today` (local UTC date), `end = today + 7 days`
3. System opens `SeasonQuickCreateSheet` with those dates pre-filled; focus lands on the Navn input
4. (Steps 6–9 of the draw-to-create journey follow identically)

**Postcondition:** New season exists; admin lands on `/dashboard/season/[newId]?tab=budget`.

**Error paths:**
- A quick-create sheet is already open → `Alt+N` is a no-op (guarded by state check).
- Admin cancels the sheet → Behaves as the sheet-abandon path above.

---

## Journey: Admin — Open an Existing Season for Editing

**Precondition:** At least one season exists in the current year. Admin is on `/dashboard/year-wheel`.

1. Admin clicks a season block on the canvas OR a row in the left sidebar → System emits `"season block_clicked"` with the season entity
2. System calls `router.push('/dashboard/season/[id]?tab=budget')`
3. `page.tsx` runs `resolveDashboardContext()` server-side → Auth + workspace resolved
4. `season-page-client.tsx` renders: breadcrumb "← Årshjul {year} / {name} · {status}" + submenu tab strip + active tab body
5. System loads the season via `useSeasons()` + filters by id, loads the season budget via `useSeasonBudget(seasonId)`
6. System emits `"season year_wheel_viewed"` with `{ year, seasons_count }` on mount (navigation category)
7. System renders `BudgetSetupTab` as the default `?tab=budget`

**Postcondition:** Admin is editing the season. No mutation performed yet — the page is a read + edit surface, each tab drives its own mutations.

**Error paths:**
- `seasonId` does not exist in `season` table → Next.js `notFound()` renders the 404 page.
- `seasonId` belongs to another workspace → RLS filters the row out; hook returns empty; client calls `notFound()`; 404 renders.

---

## Journey: Admin — Navigate Between Season Tabs

**Precondition:** Admin is on `/dashboard/season/[seasonId]?tab=budget`.

1. Admin clicks "Dag" in the submenu → System emits `"season tab_changed"` with `{ from: 'budget', to: 'day' }` + the season entity
2. System calls `router.push` updating the URL to `?tab=day` (history entry added, not replaced)
3. System swaps the rendered tab body to `DayFactorsTab`
4. Admin continues through `?tab=hour` → `HourFactorsTab`, `?tab=hours` → `SeasonHoursTab`, `?tab=overview` → `SeasonOverviewTab`
5. Admin presses the browser Back button → Browser pops to the previous tab (because `router.push`, not `replace`)

**Postcondition:** Admin has walked through each tab. The URL is always the current tab key; deep-linking preserved.

**Error paths:**
- Unknown `?tab=` value → Falls back to `budget` (validated against the `VALID_TABS` tuple).
- No `?tab=` at all → Defaults to `budget`.

---

## Journey: Admin — Adjust an Hour-Factor via Popover

**Precondition:** Admin is on `/dashboard/season/[seasonId]?tab=hour`. The hour-factor bar chart is rendered with 24 bars (one per hour 0–23).

1. Admin clicks a bar (e.g. the 18:00 bar) → System opens a shadcn `Popover` anchored to that bar
2. Popover renders a `<label>Faktor kl 18:00</label>` + `<Input type="number" step="0.1" min="0">` with the current value pre-filled, autofocus
3. Admin edits the value (e.g. `1.5` → `2.4`) → Component tracks the draft in local state
4. Admin presses Enter → Component commits `Math.max(0, draft)`, calls the tab's save mutation, closes the popover
5. System updates `hour_factor.factor` for that `season_budget_id` + `hour` row → TanStack invalidates and the bar fill animates to the new height

**Postcondition:** The single hour's factor is persisted. Canvas + Oversikt KPIs re-derive on next load.

**Error paths:**
- Admin presses Esc → Popover closes without committing. Bar retains original value.
- Admin clicks outside the popover → Popover closes without committing (shadcn default).
- Admin enters a negative number → Committed as `0` (`Math.max(0, draft)` guard).
- Mutation fails → Toast error; bar reverts; popover closes.

---

## Journey: Admin — Filter Seasons in the Sidebar

**Precondition:** Multiple seasons exist in the current year across different statuses.

1. Admin clicks a filter pill (Aktiv / Utkast / Arkivert / Alle) in the sidebar → Component calls `onFilterChange(next)` up to `year-wheel-page-client`
2. Page client updates local `filter` state → React re-renders the filtered seasons list in the sidebar and the filtered blocks on the canvas
3. Page client emits `"season sidebar_filter_changed"` with `{ filter }` (navigation category)

**Postcondition:** Sidebar + canvas only show seasons matching the selected filter. Filter state is session-local (resets on page reload).

**Error paths:**
- No seasons match the filter → Sidebar shows empty state. Canvas still renders the NORMAL DRIFT watermark.

---

## Journey: Admin — Navigate Years

**Precondition:** Admin is on `/dashboard/year-wheel` (default = current UTC year).

1. Admin clicks the left/right chevron in the topbar year nav → System emits `"season year_navigated"` with `{ from_year, to_year, direction }`
2. System calls `router.push` setting `?year=<next>` in the URL
3. Page re-renders with the new year → New season set (filtered by year), new event set (scoped to active `planning_cycle` of the year), canvas redraws with new month guides + today marker (if the viewed year is the current year)

**Postcondition:** Admin is viewing a different year. The season list and event pins reflect the new year's data.

**Error paths:**
- No seasons exist for the year → Canvas is empty except for watermark + month guides + optional today marker. Sidebar empty-state.
- `?year=` out of range (e.g. `2099`, `1899`) → Route still renders; date math handles any valid year; seasons query returns empty.

---

## Journey: Admin — Cascade Task Deep-Links to the Right Tab

**Precondition:** A cascade-task row exists flagging a budget-related gap (e.g. "Sett opp dag-faktorer for sesong X"). Admin sees the task in a notification or tasks panel.

1. Admin clicks the task → System follows the task's `href` attribute
2. `resolve_cascade_tasks` RPC (updated by migration `20260420120000_cascade_task_hrefs_season_route.sql`) has computed `/dashboard/season/[active-season-id]?tab=day` (or `?tab=budget` / `?tab=hour` depending on gap type)
3. Browser navigates; season page opens on the correct tab

**Postcondition:** Admin lands on the exact tab that fixes the flagged gap. No detour through year-wheel.

**Error paths:**
- Workspace has no active season → `href` falls back to `/dashboard/year-wheel`. Admin sees the overview and must pick or create a season first.
- Gap-type not in the mapping (legacy / new) → RPC defaults to `/dashboard/year-wheel`.

---

## Cross-cutting: What's explicitly out of scope for this feature

The following flows are **not** supported by this redesign and were deferred per spec §11.5:

- Activation gate card + "hva mangler" checklist
- Activate / Archive / Duplicate buttons
- Seeded-from-Riksavtalen provenance chip
- Goals tab (`SeasonGoalsTab` moved to `_deferred/`)
- Procedures tab (`SeasonProceduresTab` moved to `_deferred/`)
- Revenue-actual plumbing for "Aktiv nå" companion rail
- Real AI suggestion engine (card ships as empty-state per L-0046)
- Mobile year-wheel surface (web-only per ADR-0133)

Each of these ships as a separate later spec.
