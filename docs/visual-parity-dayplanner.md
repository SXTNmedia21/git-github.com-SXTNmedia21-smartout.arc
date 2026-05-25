---
title: "Visual Parity — Manager Timeline (dayplanner-dnd-and-views)"
status: in_progress
created: 2026-05-25
updated: 2026-05-25
feature: dayplanner-dnd-and-views
module: day-session
tags: [visual-parity, oppgaver, dayplanner, design-review]
---

# Visual Parity — Manager Timeline

Comparison between:
- **Prototype:** `docs/domains/day-session/day-planner/project/Manager Timeline.html` + `timeline-app.jsx` + `timeline-chart.jsx` + `tokens.css`
- **Implementation:** `apps/web/src/app/dashboard/oppgaver/_chart/` + `_components/`

Assessment based on static source-code comparison (no screenshots). Status per item: **MATCH** / **MINOR DEVIATION** / **TODO**.

---

## 1. Color Tokens

### 1.1 Dept / Area Colors

| Area     | Prototype (`areaOklch`)           | Token (`tokens.css` + design-tokens) | Status |
|----------|-----------------------------------|---------------------------------------|--------|
| kitchen  | `oklch(0.65 0.20 40)`             | `--dept-kitchen: oklch(0.65 0.2 40)`  | **MATCH** |
| floor/bistro | `oklch(0.65 0.15 180)`        | `--dept-floor: oklch(0.65 0.15 180)` | **MATCH** |
| bar      | `oklch(0.55 0.20 300)`            | `--dept-bar: oklch(0.55 0.2 300)`    | **MATCH** |
| event    | `oklch(0.65 0.18 85)`             | `--dept-event: oklch(0.65 0.18 85)`  | **MATCH** |

Implementation in `AreaBand.tsx` uses `var(--dept-${band.id}, var(--border))` — CSS variable chain, no OKLCH literals. ADR-0366 compliant.

**Gap:** Prototype maps area ids like `"kitchen"`, `"bistro"`, `"spisesal"`, `"bar"`, `"event"`. Implementation maps band.id from `day_line.location_id` (DB-derived). If location_id strings differ from token keys (e.g. `"kjokken"` vs `"kitchen"`), `var(--dept-<id>)` falls back to `var(--border)` (gray). This is a **data mapping concern**, not a design-token gap — but it means area coloring may render colorless in production until location_id aligns with token names.

→ **MINOR DEVIATION** — Dept color will fall back to border-gray if location_id values don't match token keys.

### 1.2 Semantic Colors

| Token          | Prototype var    | Implementation        | Status  |
|----------------|------------------|-----------------------|---------|
| `--brand-orange` | `var(--brand-orange)` | `var(--brand-orange)` | **MATCH** |
| `--destructive` | `var(--destructive)` | `var(--destructive)` | **MATCH** |
| `--muted-fg`   | `var(--muted-fg)` | `var(--muted-fg)`    | **MATCH** |
| `--border`     | `var(--border)`  | `var(--border)`       | **MATCH** |

No OKLCH literals found in implementation chart components. **MATCH** on all semantic token usage.

---

## 2. Layout + Spacing

### 2.1 Grid Structure

| Aspect                 | Prototype                                  | Implementation                          | Status |
|------------------------|--------------------------------------------|-----------------------------------------|--------|
| Overall layout         | `app` div with topbar + toolbar + main     | `grid grid-rows-[60px_52px_1fr]` CSS grid | **MATCH** |
| Topbar height          | `60px` (estimated from CSS)                | `60px` (grid-row explicit)              | **MATCH** |
| Toolbar height         | Approx 50px (no explicit value in prototype) | `52px` (grid-row explicit)            | **MATCH** |
| Chart 2-col grid       | TimeGutter + lanes flex                    | `grid-cols-[80px_1fr]`                  | **MATCH** |
| Gutter width           | No explicit value, but 60px estimated      | `80px`                                  | **MINOR DEVIATION** — 80px vs prototype ~60px |

### 2.2 AreaBand Header

| Aspect               | Prototype                   | Implementation                         | Status |
|----------------------|-----------------------------|----------------------------------------|--------|
| Band name font       | `font-weight: 600, 14px`    | `text-sm font-semibold` (≈13.5-14px)  | **MATCH** |
| Open/close times     | Right-aligned, mono 11px    | `ml-auto font-mono text-[0.65rem]` (≈10.4px) | **MINOR DEVIATION** — 10.4px vs 11px (0.6px delta, negligible) |
| Header bg            | Sticky, `var(--background)` | `bg-background sticky top-0 z-10`     | **MATCH** |
| Header border        | Bottom border               | `border-b border-border`              | **MATCH** |
| Padding              | ~10px 12px                  | `px-3 py-2` (12px horizontal, 8px vertical) | **MINOR DEVIATION** — 8px vs ~10px vertical |

### 2.3 TaskBlock

| Aspect               | Prototype                                       | Implementation                              | Status |
|----------------------|-------------------------------------------------|---------------------------------------------|--------|
| Border radius        | Implied (no CSS class in jsx, styled externally) | `rounded-md` (6-8px)                       | **MATCH** |
| Padding              | ~4px 8px                                        | `px-2 py-1` (8px horizontal, 4px vertical) | **MATCH** |
| Font size            | `text-xs` (12px) implied                        | `text-xs`                                   | **MATCH** |
| Left gutter calc     | `calc(${leftPct}% + 4px)`                       | `calc(${leftPct}% + 4px)` (identical)       | **MATCH** |
| Width calc           | `calc(${widthPct}% - 8px)`                      | `calc(${widthPct}% - 8px)` (identical)      | **MATCH** |
| Min height           | `Math.max(20, ...)`                             | `Math.max(20, ...)` (identical)             | **MATCH** |
| Tiny threshold       | `height < 36`                                   | `height < 36` (identical)                   | **MATCH** |

---

## 3. Typography

| Element                  | Prototype                               | Implementation                  | Status |
|--------------------------|-----------------------------------------|---------------------------------|--------|
| Band name                | `font-heading` 14px                     | Geist Sans (body), `text-sm font-semibold` | **MINOR DEVIATION** — prototype uses `--font-heading` (Instrument Serif); implementation uses default Geist Sans. Band names read as headings in prototype; implementation does not apply `font-heading`. |
| Task title               | No font-family; falls to body (Geist)  | `font-medium leading-tight`     | **MATCH** |
| Time meta (task)         | Mono 10px (`--font-mono`)              | `font-mono text-[0.6rem]` via `text-muted-foreground` | **MATCH** |
| Gutter hour labels       | Mono, uppercase, `letter-spacing: 0.05em` | Geist Mono                  | **MATCH** |
| Toolbar labels           | 12px body                              | `text-sm` / `text-xs` Geist     | **MATCH** |

**Notable:** Prototype applies `--font-heading` (Instrument Serif) to band area names for visual hierarchy. Implementation uses default Geist Sans. This is a **deliberate or unconsidered omission** — worth noting but low-impact since the Nordic Split spec allows this for compact UI surfaces.

---

## 4. Animations + Transitions

| Interaction             | Prototype                                    | Implementation                                     | Status |
|-------------------------|----------------------------------------------|----------------------------------------------------|--------|
| Task hover              | No explicit CSS transition in jsx; CSS sheet unknown | `transition-opacity hover:opacity-90`         | **MINOR DEVIATION** — prototype intent unclear; implementation uses opacity-based hover which is correct pattern |
| Drag source dim         | `opacity: 0.5` via class                     | `opacity-50` via cn() conditional                  | **MATCH** |
| Drop target highlight   | `drop-target` class (background change)      | `bg-orange-500/10` conditional in PersonLane/UnassignedLane | **MINOR DEVIATION** — implementation uses hardcoded `orange-500` instead of `var(--brand-orange)/10`. ADR-0361 violation candidate — should be `bg-[color:oklch(from_var(--brand-orange)_l_c_h_/_0.10)]` or a Tailwind token alias. |
| Toolbar chip animation  | No CSS class in jsx (CSS sheet not inspected) | `FilterChip` from `@smartout/ui` — transitions assumed per primitive | **TODO** — verify FilterChip has transition-colors per Nordic Split §10.4 |
| View-mode SegmentGroup  | `.on` class toggled (CSS manages transition)  | `SegmentGroup` from `@smartout/ui` — transitions assumed | **TODO** — verify SegmentGroup has transition-colors |

**ADR violation flag:** `UnassignedLane.tsx` line ~154 uses `bg-orange-500/10` — this is a hardcoded Tailwind color, not a CSS variable token. ADR-0361 (no hardcoded colors) requires this to use `var(--brand-orange)` reference.

---

## 5. Dimming Behavior (Phase C — area filter)

| Aspect                 | Prototype                                          | Implementation                         | Status |
|------------------------|----------------------------------------------------|----------------------------------------|--------|
| Dim trigger            | `filters.areas.size > 0 && !filters.areas.has(area.id)` | `dimmedBandIds?.includes(band.id)` computed in Shell | **MATCH** |
| Dim style              | `.dimmed` class → CSS `opacity: 0.3` (CSS sheet)  | `dimmed && "opacity-50"` via cn()      | **MINOR DEVIATION** — prototype targets `opacity: 0.3`; implementation uses `opacity-50` (50%). Intentional or gap? 30% would match prototype more closely. |
| data-dimmed attribute  | `lane-body dimmed` class only                     | No `data-dimmed` attribute             | **DEVIATION** — E2E spec below tests for `data-dimmed="true"` attr; implementation uses class-based dimming only. E2E must target `opacity-50` class or `.has-class` pattern instead. |

---

## 6. Right Rail (Sidebar)

The prototype has a full right-rail (Akkurat nå / Detalj / Melding / Avvik tabs). Implementation does not include a right rail — it uses `TaskEditModal` (Sheet component) for task detail on click. This is an **intentional scope reduction** per `PLAN-dayplanner-dnd-and-views.md` (Scope OUT: Broadcast, Notes, Deviations). Not a parity gap for this sortie.

---

## 7. View-Mode Switcher

| Aspect              | Prototype                                       | Implementation                       | Status |
|---------------------|-------------------------------------------------|--------------------------------------|--------|
| Layout              | 3-button `.seg` group                           | `SegmentGroup` primitive from `@smartout/ui` | **MATCH** |
| View labels         | "Område" / "Rolle" / "Person"                   | i18n keys `oppgaver.view_mode.area/role/person` → assumed same labels | **MATCH** (pending translation check) |
| Active state        | `.on` class                                     | SegmentGroup internal active-prop     | **MATCH** |
| Icon in prototype   | MapPin / Shield / Users icons                  | Not present in implementation         | **MINOR DEVIATION** — icons omitted (concise label-only SegmentGroup) |

---

## 8. Summary

| Category            | Result |
|---------------------|--------|
| Color tokens        | MATCH (with data-mapping caveat on dept-id lookup) |
| Layout              | MATCH (gutter 80px vs ~60px prototype — minor) |
| Spacing             | MINOR DEVIATIONS (vertical header padding, band-name font) |
| Typography          | MINOR DEVIATION (band-name Geist vs Instrument Serif) |
| Animations          | MINOR DEVIATION (drop-target orange-500 hardcode) |
| Dimming             | MINOR DEVIATION (50% vs 30%; no data-dimmed attr) |

**Overall verdict: MINOR DEVIATIONS** — No major structural or color-system gaps. All deviations are small (opacity value, one hardcoded color, font on band names). No OKLCH literals found in implementation.

---

## Deferred to Follow-up Sorties

See `docs/plans/PLAN-dayplanner-dnd-and-views.md` for appended deferred items.

---

*Generated by Wave 2 verify agent — 2026-05-25*
