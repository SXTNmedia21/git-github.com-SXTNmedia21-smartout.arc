# Year Wheel Design Debt Cleanup — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove all Nordic Split design system violations from the Year Wheel module — replace 231 `isDark` ternaries with CSS variable classes, fix spring constants, migrate ~25 hardcoded Norwegian strings to i18n keys, and fix accessibility touch targets.

**Architecture:** Mechanical refactoring. No new features, no schema changes, no business logic changes. Every `isDark ? "dark-class" : "light-class"` ternary becomes a single CSS variable class. Spring constants become design-token imports. Norwegian strings get i18n keys. The `isDark` prop is removed from all component signatures.

**Tech Stack:** Tailwind v4 (CSS variable config), `@smartout/design-tokens` (motion tokens), `@smartout/i18n` (translations), React 19

**Branch:** `fix/year-wheel-design-debt`

**Parallel with:** `feat/year-wheel-cascade-resolution` (zero file overlap — this plan touches `_components/`, that plan touches `lib/cascade/` and `stage-engine/`)

---

## Reference: CSS Variable Mapping Table

Every `isDark ? X : Y` ternary in the Year Wheel maps to one of these CSS variable classes. Use this table for ALL file tasks below.

### Surface / Background

| isDark value | Light value | CSS variable class |
|---|---|---|
| `bg-zinc-800`, `bg-zinc-900`, `bg-zinc-950`, `bg-[#0c0c0e]`, `bg-[#121216]` | `bg-white`, `bg-zinc-50` | `bg-card` |
| `bg-zinc-900/30`, `bg-zinc-900/20`, `bg-zinc-900/40` | `bg-zinc-50/50`, `bg-zinc-100/60` | `bg-muted/50` |
| `bg-zinc-800/50`, `bg-zinc-800/60` | `bg-zinc-200/60`, `bg-zinc-200` | `bg-muted` |
| `bg-zinc-800/30` | `bg-zinc-50` | `bg-accent` |
| `bg-white/5` | `bg-black/5` | `bg-accent` |

### Text

| isDark value | Light value | CSS variable class |
|---|---|---|
| `text-white` | `text-zinc-900` | `text-card-foreground` |
| `text-zinc-300`, `text-zinc-200` | `text-zinc-700`, `text-zinc-600` | `text-foreground` |
| `text-zinc-400`, `text-zinc-500` | `text-zinc-500`, `text-zinc-600` | `text-muted-foreground` |
| `text-zinc-100` | `text-zinc-800` | `text-foreground` |

### Border

| isDark value | Light value | CSS variable class |
|---|---|---|
| `border-zinc-800`, `border-zinc-700` | `border-zinc-200`, `border-zinc-300` | `border-border` |
| `border-zinc-800/50`, `border-zinc-800/80` | `border-zinc-200/50` | `border-border` |
| `border-zinc-600` | `border-zinc-400` | `border-border` |

### Input / Form

| isDark value | Light value | CSS variable class |
|---|---|---|
| `border-zinc-700 bg-zinc-900 text-white` | `border-zinc-300 bg-zinc-50 text-zinc-900` | `border-input bg-background text-foreground` |
| `focus:border-blue-500` | same | `focus:border-ring` |

### Semantic Status Colors

| Hardcoded | CSS variable replacement |
|---|---|
| `text-emerald-400/500/600`, `bg-emerald-500/10`, `border-emerald-500/20` | `text-success`, `bg-success/10`, `border-success/20` |
| `text-amber-400/600`, `bg-amber-500/10`, `border-amber-500/20` | `text-warning`, `bg-warning/10`, `border-warning/20` |
| `text-red-400/500/600`, `bg-red-500/10`, `border-red-500/10` | `text-destructive`, `bg-destructive/10`, `border-destructive/10` |
| `text-orange-400/600`, `from-orange-600 to-rose-600` | `text-brand-orange`, `from-brand-orange to-destructive` |
| `text-blue-400/600`, `bg-blue-600`, `bg-blue-500/10` | `text-primary`, `bg-primary`, `bg-primary/10` |
| `focus-visible:ring-emerald-500` | `focus-visible:ring-ring` |

### Category Colors (PlanningEventsTab, SeasonGoalsTab, SeasonSelector)

These per-category color maps (`CATEGORY_COLORS`) should use `chart-1` through `chart-5` CSS variables:

| Category | Old pattern | New pattern |
|---|---|---|
| External / scraped | blue-* | `chart-1` |
| Cultural / commercial | purple-* | `chart-4` |
| Internal | emerald-* | `chart-2` |
| Weather | amber-* | `chart-3` |
| Recurring | zinc-* (neutral) | `chart-5` |

### Hover

| isDark value | Light value | CSS variable class |
|---|---|---|
| `hover:bg-zinc-800`, `hover:bg-zinc-800/80` | `hover:bg-zinc-100`, `hover:bg-zinc-200` | `hover:bg-accent` |
| `hover:text-white` | `hover:text-zinc-900` | `hover:text-accent-foreground` |

### Button (primary action)

| Old pattern | New pattern |
|---|---|
| `bg-blue-600 hover:bg-blue-500 text-white` | `bg-primary hover:bg-primary/90 text-primary-foreground` |

---

## Reference: Spring Token Import

Replace all spring animation configs with design-token imports:

```typescript
import { motion as motionTokens } from "@smartout/design-tokens";

// Before:
transition={{ type: "spring", stiffness: 300, damping: 25 }}
transition={{ type: "spring", stiffness: 400, damping: 20 }}

// After:
transition={{ type: "spring", ...motionTokens.springSnappy }}
```

Available tokens:
- `motionTokens.springGentle` — `{ stiffness: 30, damping: 20, mass: 2.5 }` — for entrances, drawer open
- `motionTokens.spring` — `{ stiffness: 35, damping: 22, mass: 2.2 }` — default panel transitions
- `motionTokens.springSnappy` — `{ stiffness: 45, damping: 24, mass: 2 }` — for interactive feedback (drag, toggle)

---

## Reference: i18n Pattern

```typescript
// Before (file without useTranslation):
import { useTranslation } from "@smartout/i18n";

// Inside component:
const { t } = useTranslation("dashboard");

// Strings:
// Before: "Opprett ny sesong"
// After: t("yearWheel.create_new_season")

// Before: "Lagre"
// After: t("common.save")

// Before: "Avbryt"
// After: t("common.cancel")
```

---

## Task 1: Add i18n keys to translation files

**Files:**
- Modify: `packages/i18n/src/locales/nb/dashboard.json`
- Modify: `packages/i18n/src/locales/en/dashboard.json`

- [ ] **Step 1: Add Year Wheel i18n keys to Norwegian locale**

Add these keys under the `yearWheel` namespace in `packages/i18n/src/locales/nb/dashboard.json`:

```json
{
  "yearWheel": {
    "title": "Årshjul",
    "create_new_season": "Opprett ny sesong",
    "edit_event": "Rediger hendelse",
    "create_from_wheel": "Opprett fra årshjul",
    "training_slot": "Opplæringstidspunkt",
    "season_start": "Sesongstart",
    "important_event": "Viktig hendelse",
    "special_day": "Spesiell dag",
    "event_name_placeholder": "Navn på hendelse eller sesong",
    "season_end": "Sesongslutt",
    "type": "Type",
    "title_label": "Tittel",
    "date": "Dato",
    "save": "Lagre",
    "create": "Opprett",
    "cancel": "Avbryt",
    "today": "I dag",
    "june_first": "1. juni",
    "seasons": "Sesonger",
    "events": "Hendelser",
    "start_date_asc": "Startdato stigende",
    "start_date_desc": "Startdato synkende",
    "name_az": "Navn A-Å",
    "date_asc": "Dato stigende",
    "date_desc": "Dato synkende",
    "confirm_copy_year": "{{year}} har allerede sesonger. Vil du fortsatt kopiere fra {{sourceYear}}?",
    "season_name_required": "Sesongnavn er påkrevd",
    "end_date_invalid": "Sluttdato kan ikke være før startdato",
    "new_season": "Ny sesong",
    "season_name": "Sesongnavn",
    "start_date_optional": "Startdato (valgfri)",
    "end_date_optional": "Sluttdato (valgfri)",
    "creating": "Oppretter...",
    "create_season": "Opprett sesong",
    "budget_setup": "Budsjettoppsett",
    "budget_locked": "Budsjettet er låst",
    "total_revenue_target": "Total omsetningsmål",
    "saving": "Lagrer...",
    "save_budget": "Lagre budsjett",
    "day_factors": "Dagfaktorer",
    "save_day_factors": "Lagre dagfaktorer",
    "hour_factors": "Timefaktorer",
    "save_hour_factors": "Lagre timefaktorer",
    "template_restaurant": "Restaurant",
    "template_hotel": "Hotell",
    "template_event": "Event",
    "template_flat": "Flat",
    "template_dinner_peak": "Middagstopp",
    "machine_room": "Maskinrom",
    "machine_room_description": "Budsjett, dagfaktorer og timefaktorer for sesongen.",
    "edit_weighting": "Rediger vekting",
    "active": "Aktiv",
    "draft": "Utkast",
    "archived": "Arkivert",
    "no_dates_set": "Ingen datoer satt",
    "season_goals": "Sesongmål",
    "new_goal": "Nytt mål",
    "goal_title": "Tittel",
    "goal_description": "Beskrivelse",
    "goal_metric_key": "Nøkkeltall",
    "goal_target_value": "Målverdi",
    "goal_unit": "Enhet",
    "goal_status_active": "Aktiv",
    "goal_status_completed": "Fullført",
    "goal_status_cancelled": "Avbrutt",
    "mark_completed": "Marker som fullført",
    "cancel_goal": "Avbryt mål",
    "reactivate_goal": "Reaktiver mål",
    "delete_goal": "Slett mål",
    "confirm_delete": "Er du sikker?",
    "procedures_hms": "Prosedyrer & HMS",
    "no_procedures": "Ingen prosedyrer",
    "globally_disabled": "(Globalt deaktivert)",
    "planning_period": "Planperiode",
    "none": "Ingen",
    "new_planning_period": "Ny planperiode",
    "name": "Navn",
    "from": "Fra",
    "to": "Til",
    "revenue_target_nok": "Omsetningsmål (NOK, valgfritt)",
    "no_planning_periods": "Ingen planperioder opprettet.",
    "archive_planning_period": "Arkivere denne planperioden?",
    "activate_planning_period": "Aktiver planperiode",
    "archive": "Arkiver planperiode",
    "no_seasons_yet": "Ingen sesonger opprettet ennå.",
    "select_season": "Velg sesong...",
    "events_tab": "Hendelser",
    "show_all": "Vis alle",
    "upcoming_30_days": "Kommende hendelser (30 dager)",
    "new_event": "Ny hendelse",
    "add_event": "Legg til en hendelse",
    "event_name": "Navn",
    "event_date": "Dato",
    "event_end_date": "Sluttdato (valgfri)",
    "event_category": "Kategori",
    "demand_factor": "Etterspørselsfaktor",
    "confidence": "Konfidensgrad",
    "expected_covers": "Forventet antall (valgfri)",
    "demand_help": "Multipliserer forventet trafikk",
    "recurring": "Gjentakende",
    "save_changes": "Lagre endringer",
    "category_external": "Ekstern",
    "category_cultural": "Kulturell",
    "category_internal": "Intern",
    "category_weather": "Vær",
    "category_recurring": "Gjentakende",
    "season_overview_avg_day": "Snitt/dag",
    "season_overview_peak_staff": "Topp bemanning",
    "season_overview_guests_day": "Gjester/dag",
    "monthly_distribution": "Månedsfordeling",
    "weekly_distribution": "Ukentlig fordeling (første uke)",
    "hourly_distribution": "Timefordeling (toppdag)",
    "setup_budget_first": "Sett opp budsjett først",
    "drag_start_date": "Dra for å endre startdato",
    "drag_end_date": "Dra for å endre sluttdato",
    "policy_type_operational": "Drift",
    "policy_type_payroll": "Lønn",
    "policy_type_custom": "Egendefinert",
    "policy_type_haccp": "HACCP",
    "policy_type_hr": "HR",
    "policy_type_safety": "Sikkerhet",
    "policy_type_access": "Tilgang"
  }
}
```

- [ ] **Step 2: Add English translations**

Add the same structure in `packages/i18n/src/locales/en/dashboard.json` with English values. Use the Norwegian keys as identifiers, English as values. Example:

```json
{
  "yearWheel": {
    "title": "Year Wheel",
    "create_new_season": "Create new season",
    "edit_event": "Edit event",
    "today": "Today",
    "june_first": "June 1",
    "seasons": "Seasons",
    "events": "Events",
    "save": "Save",
    "cancel": "Cancel",
    "create": "Create"
  }
}
```

(Complete all keys — match the Norwegian structure 1:1.)

- [ ] **Step 3: Commit**

```bash
git add packages/i18n/
git commit -m "feat(i18n): add year-wheel translation keys for design debt cleanup"
```

---

## Task 2: Migrate TimelineBlock.tsx (highest isDark density + spring fix)

**Files:**
- Modify: `apps/web/src/app/dashboard/year-wheel/_components/TimelineBlock.tsx`

- [ ] **Step 1: Add imports**

Add at top of file:

```typescript
import { motion as motionTokens } from "@smartout/design-tokens";
```

- [ ] **Step 2: Remove `isDark` from props**

Remove `isDark` from the component props type and destructuring. Remove any `isDark={isDark}` passes to child components.

- [ ] **Step 3: Replace all isDark ternaries with CSS variable classes**

Apply the mapping table. Pattern:

```typescript
// Before:
className={`... ${isDark ? "bg-zinc-800/60" : "bg-zinc-200/60"} ${isDark ? "border-zinc-600" : "border-zinc-400"} ...`}

// After:
className="... bg-muted border-border border-dashed ..."
```

For status-specific colors:
- Draft: `border-dashed border-border bg-muted`
- Active: `border-success bg-success/5`
- Archived: `border-border bg-muted/60`

Replace emerald-based active colors:
```typescript
// Before: isDark ? "bg-emerald-950/60" : "bg-emerald-50"
// After: "bg-success/5"

// Before: isDark ? "border-emerald-700" : "border-emerald-400"
// After: "border-success"

// Before: isDark ? "text-emerald-300" : "text-emerald-700"
// After: "text-success"
```

- [ ] **Step 4: Fix spring constant**

```typescript
// Before:
transition={{ type: "spring", stiffness: 300, damping: 25 }}

// After:
transition={{ type: "spring", ...motionTokens.springSnappy }}
```

- [ ] **Step 5: Replace Norwegian aria-labels with i18n**

```typescript
// Before: aria-label="Dra for å endre startdato"
// After: aria-label={t("yearWheel.drag_start_date")}

// Before: aria-label="Dra for å endre sluttdato"
// After: aria-label={t("yearWheel.drag_end_date")}
```

Add `useTranslation` import if not present.

- [ ] **Step 6: Fix touch target on drag handles**

```typescript
// Before: className="... w-3 ..."
// After: className="... w-3 before:absolute before:inset-y-0 before:-inset-x-4 before:content-[''] ..."
```

This adds a 44px invisible hit area around the 12px visible handle.

- [ ] **Step 7: Verify and commit**

```bash
pnpm --filter web typecheck
git add apps/web/src/app/dashboard/year-wheel/_components/TimelineBlock.tsx
git commit -m "fix(year-wheel): migrate TimelineBlock to CSS variables + fix springs"
```

---

## Task 3: Migrate TimelinePin.tsx (spring fix + touch targets)

**Files:**
- Modify: `apps/web/src/app/dashboard/year-wheel/_components/TimelinePin.tsx`

- [ ] **Step 1: Add design-token import**

```typescript
import { motion as motionTokens } from "@smartout/design-tokens";
```

- [ ] **Step 2: Remove `isDark` from props and replace all ternaries**

Apply mapping table. Key replacements:
- Category colors → `chart-1` through `chart-5` mapping
- Tooltip: `bg-card text-card-foreground shadow-md border border-border`
- Focus ring: `focus-visible:ring-ring`

- [ ] **Step 3: Fix both spring constants**

```typescript
// Before (×2 instances):
transition={{ type: "spring", stiffness: 400, damping: 20 }}

// After:
transition={{ type: "spring", ...motionTokens.springSnappy }}
```

- [ ] **Step 4: Fix pin touch target**

Ensure the pin clickable area is minimum 44x44px:

```typescript
// Add to pin container:
className="... min-w-[44px] min-h-[44px] flex items-center justify-center ..."
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/dashboard/year-wheel/_components/TimelinePin.tsx
git commit -m "fix(year-wheel): migrate TimelinePin to CSS variables + fix springs + touch targets"
```

---

## Task 4: Migrate PlanningEventsTab.tsx (highest isDark count: 38)

**Files:**
- Modify: `apps/web/src/app/dashboard/year-wheel/_components/PlanningEventsTab.tsx`

- [ ] **Step 1: Add i18n import and remove isDark**

```typescript
import { useTranslation } from "@smartout/i18n";
// Inside component:
const { t } = useTranslation("dashboard");
```

Remove `isDark` from props.

- [ ] **Step 2: Replace CATEGORY_COLORS map with chart variables**

```typescript
// Before:
const CATEGORY_COLORS = {
  external_scraped: { bg: isDark ? "bg-blue-500/10" : "bg-blue-50", ... },
  cultural_commercial: { bg: isDark ? "bg-purple-500/10" : "bg-purple-50", ... },
  ...
};

// After:
const CATEGORY_COLORS = {
  external_scraped: { bg: "bg-chart-1/10", border: "border-chart-1/20", text: "text-chart-1" },
  cultural_commercial: { bg: "bg-chart-4/10", border: "border-chart-4/20", text: "text-chart-4" },
  internal: { bg: "bg-chart-2/10", border: "border-chart-2/20", text: "text-chart-2" },
  weather: { bg: "bg-chart-3/10", border: "border-chart-3/20", text: "text-chart-3" },
  recurring: { bg: "bg-chart-5/10", border: "border-chart-5/20", text: "text-chart-5" },
};
```

- [ ] **Step 3: Replace all cardClass/inputClass patterns**

```typescript
// Before:
const cardClass = isDark ? "border-zinc-800 bg-[#0c0c0e]" : "border-zinc-200 bg-white";
const inputClass = isDark ? "border-zinc-700 bg-zinc-900 text-white" : "border-zinc-300 bg-zinc-50 text-zinc-900";

// After:
const cardClass = "border-border bg-card";
const inputClass = "border-input bg-background text-foreground";
```

- [ ] **Step 4: Replace all remaining isDark ternaries with mapping table**

Apply surface, text, border, hover, and button mappings systematically.

- [ ] **Step 5: Replace Norwegian strings with i18n keys**

Replace CATEGORY_OPTIONS labels, form labels, buttons, help text, empty states with `t("yearWheel.xxx")` calls.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/dashboard/year-wheel/_components/PlanningEventsTab.tsx
git commit -m "fix(year-wheel): migrate PlanningEventsTab to CSS variables + i18n"
```

---

## Task 5: Migrate SeasonOverviewTab.tsx (23 isDark + Norwegian strings)

**Files:**
- Modify: `apps/web/src/app/dashboard/year-wheel/_components/SeasonOverviewTab.tsx`

- [ ] **Step 1: Add i18n and remove isDark**

- [ ] **Step 2: Replace all isDark ternaries**

Key patterns:
- Card surfaces: `bg-card border-border`
- Inner cards: `bg-muted/50 border-border`
- Text: `text-card-foreground`, `text-muted-foreground`
- Stat colors: `text-success` (emerald), `text-primary` (blue), `text-chart-4` (purple), `text-brand-orange` (orange)
- Stat backgrounds: `bg-brand-orange/30`, `bg-primary/30`, `bg-success/40`, `bg-primary/20`

- [ ] **Step 3: Replace Norwegian strings**

Replace WEEKDAY_SHORT, section titles, stat labels with i18n keys.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/dashboard/year-wheel/_components/SeasonOverviewTab.tsx
git commit -m "fix(year-wheel): migrate SeasonOverviewTab to CSS variables + i18n"
```

---

## Task 6: Migrate SeasonGoalsTab.tsx (19 isDark + Norwegian strings)

**Files:**
- Modify: `apps/web/src/app/dashboard/year-wheel/_components/SeasonGoalsTab.tsx`

- [ ] **Step 1: Add i18n and remove isDark**

- [ ] **Step 2: Replace status color pattern**

```typescript
// Before:
const statusStyles = {
  active: isDark ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400" : "...",
  completed: isDark ? "border-zinc-500/20 bg-zinc-500/10 text-zinc-400" : "...",
  cancelled: isDark ? "border-orange-500/20 bg-orange-500/10 text-orange-400" : "...",
};

// After:
const statusStyles = {
  active: "border-success/20 bg-success/10 text-success",
  completed: "border-muted-foreground/20 bg-muted text-muted-foreground",
  cancelled: "border-warning/20 bg-warning/10 text-warning",
};
```

- [ ] **Step 3: Replace all remaining ternaries + Norwegian strings**

Replace STATUS_LABELS, form labels, button text, confirm dialog, empty state.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/dashboard/year-wheel/_components/SeasonGoalsTab.tsx
git commit -m "fix(year-wheel): migrate SeasonGoalsTab to CSS variables + i18n"
```

---

## Task 7: Migrate SeasonProceduresTab.tsx (17 isDark + Norwegian labels)

**Files:**
- Modify: `apps/web/src/app/dashboard/year-wheel/_components/SeasonProceduresTab.tsx`

Follow same pattern: remove isDark, apply mapping, replace POLICY_TYPE_LABELS and body text with i18n keys.

- [ ] **Step 1: Remove isDark, apply CSS variable mapping**
- [ ] **Step 2: Replace Norwegian strings with i18n**
- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/dashboard/year-wheel/_components/SeasonProceduresTab.tsx
git commit -m "fix(year-wheel): migrate SeasonProceduresTab to CSS variables + i18n"
```

---

## Task 8: Migrate PlanningCycleSelector.tsx (23 isDark + Norwegian)

**Files:**
- Modify: `apps/web/src/app/dashboard/year-wheel/_components/PlanningCycleSelector.tsx`

- [ ] **Step 1: Remove isDark, apply CSS variable mapping**

Status badge pattern same as SeasonGoalsTab (active=success, draft=warning, archived=muted).

- [ ] **Step 2: Replace Norwegian strings with i18n**

Replace: planning period labels, "Ingen", form labels, confirm dialog, create button.

- [ ] **Step 3: Fix touch target on icon buttons**

Buttons with `h-7 w-7` (28px) → add `min-h-[44px] min-w-[44px]` wrapper or expand padding.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/dashboard/year-wheel/_components/PlanningCycleSelector.tsx
git commit -m "fix(year-wheel): migrate PlanningCycleSelector to CSS variables + i18n"
```

---

## Task 9: Migrate SeasonDrawer.tsx + MachineRoomSheet.tsx + SeasonCreateSheet.tsx

**Files:**
- Modify: `apps/web/src/app/dashboard/year-wheel/_components/SeasonDrawer.tsx`
- Modify: `apps/web/src/app/dashboard/year-wheel/_components/MachineRoomSheet.tsx`
- Modify: `apps/web/src/app/dashboard/year-wheel/_components/SeasonCreateSheet.tsx`

These three sheet/drawer components share the same surface pattern: `bg-zinc-950`/`bg-white` → `bg-card`.

- [ ] **Step 1: Migrate SeasonDrawer.tsx** — remove isDark, apply mapping. Status badges: `text-success` (active), `text-warning` (draft), `text-muted-foreground` (archived). Tab pattern: `hover:bg-accent hover:text-accent-foreground`.

- [ ] **Step 2: Migrate MachineRoomSheet.tsx** — remove isDark, apply mapping. Already has `useTranslation` — verify all strings use `t()`.

- [ ] **Step 3: Migrate SeasonCreateSheet.tsx** — remove isDark, add `useTranslation`, replace form labels and toast messages, apply mapping.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/dashboard/year-wheel/_components/SeasonDrawer.tsx \
       apps/web/src/app/dashboard/year-wheel/_components/MachineRoomSheet.tsx \
       apps/web/src/app/dashboard/year-wheel/_components/SeasonCreateSheet.tsx
git commit -m "fix(year-wheel): migrate drawer/sheet components to CSS variables + i18n"
```

---

## Task 10: Migrate BudgetSetupTab + DayFactorsTab + HourFactorsTab

**Files:**
- Modify: `apps/web/src/app/dashboard/year-wheel/_components/BudgetSetupTab.tsx`
- Modify: `apps/web/src/app/dashboard/year-wheel/_components/DayFactorsTab.tsx`
- Modify: `apps/web/src/app/dashboard/year-wheel/_components/HourFactorsTab.tsx`

These three factor tabs share identical card/input patterns.

- [ ] **Step 1: Migrate BudgetSetupTab** — remove isDark, add `useTranslation`, apply card/input mapping, replace Norwegian labels.

- [ ] **Step 2: Migrate DayFactorsTab** — same pattern. Replace template button names ("Restaurant", "Hotell", "Event", "Flat") with i18n.

- [ ] **Step 3: Migrate HourFactorsTab** — same pattern. Replace template names.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/dashboard/year-wheel/_components/BudgetSetupTab.tsx \
       apps/web/src/app/dashboard/year-wheel/_components/DayFactorsTab.tsx \
       apps/web/src/app/dashboard/year-wheel/_components/HourFactorsTab.tsx
git commit -m "fix(year-wheel): migrate factor tabs to CSS variables + i18n"
```

---

## Task 11: Migrate YearWheelTimeline + YearNavigation

**Files:**
- Modify: `apps/web/src/app/dashboard/year-wheel/_components/YearWheelTimeline.tsx`
- Modify: `apps/web/src/app/dashboard/year-wheel/_components/YearNavigation.tsx`

Both already have `useTranslation`.

- [ ] **Step 1: Migrate YearWheelTimeline** — remove isDark, apply mapping. Today marker: keep `bg-orange-500` as `bg-brand-orange`. Focus marker: `bg-primary`.

- [ ] **Step 2: Migrate YearNavigation** — remove isDark, apply mapping.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/dashboard/year-wheel/_components/YearWheelTimeline.tsx \
       apps/web/src/app/dashboard/year-wheel/_components/YearNavigation.tsx
git commit -m "fix(year-wheel): migrate timeline + navigation to CSS variables"
```

---

## Task 12: Migrate SeasonSelector.tsx

**Files:**
- Modify: `apps/web/src/app/dashboard/year-wheel/_components/SeasonSelector.tsx`

- [ ] **Step 1: Remove isDark, add i18n, apply mapping**

Status badge same pattern as other components.

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/dashboard/year-wheel/_components/SeasonSelector.tsx
git commit -m "fix(year-wheel): migrate SeasonSelector to CSS variables + i18n"
```

---

## Task 13: Migrate page.tsx (main page — Norwegian strings)

**Files:**
- Modify: `apps/web/src/app/dashboard/year-wheel/page.tsx`

- [ ] **Step 1: Remove isDark from all child component props**

Remove every `isDark={isDark}` prop pass. Since child components no longer accept `isDark`, these must be removed.

- [ ] **Step 2: Replace all remaining isDark ternaries in page.tsx itself**

Apply mapping table to any remaining color ternaries in the page file.

- [ ] **Step 3: Replace all hardcoded Norwegian strings with i18n keys**

Dialog titles, button labels, sort options, confirm dialogs, type labels — all use `t("yearWheel.xxx")`.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/dashboard/year-wheel/page.tsx
git commit -m "fix(year-wheel): migrate page.tsx to CSS variables + i18n"
```

---

## Task 14: Remove isDark consumption from DashboardContext (if applicable)

**Files:**
- Check: `apps/web/src/app/dashboard/_components/DashboardShell.tsx` or wherever `isDark` originates

- [ ] **Step 1: Verify isDark is no longer consumed by any year-wheel component**

```bash
cd apps/web && rg "isDark" src/app/dashboard/year-wheel/
```

Expected: ZERO results. If any remain, fix them.

- [ ] **Step 2: Commit if changes needed**

---

## Task 15: Add `prefers-reduced-motion` handling

**Files:**
- Modify: `apps/web/src/app/dashboard/year-wheel/_components/TimelineBlock.tsx`
- Modify: `apps/web/src/app/dashboard/year-wheel/_components/TimelinePin.tsx`

- [ ] **Step 1: Add reduced motion check**

```typescript
import { useReducedMotion } from "framer-motion";

// Inside component:
const prefersReducedMotion = useReducedMotion();

// On animated elements:
transition={prefersReducedMotion ? { duration: 0 } : { type: "spring", ...motionTokens.springSnappy }}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/dashboard/year-wheel/_components/TimelineBlock.tsx \
       apps/web/src/app/dashboard/year-wheel/_components/TimelinePin.tsx
git commit -m "fix(year-wheel): add prefers-reduced-motion handling"
```

---

## Task 16: Final verification

- [ ] **Step 1: Run typecheck**

```bash
pnpm --filter web typecheck
```

Expected: PASS with zero year-wheel errors.

- [ ] **Step 2: Verify zero isDark references remain**

```bash
cd apps/web && rg "isDark" src/app/dashboard/year-wheel/
```

Expected: ZERO results.

- [ ] **Step 3: Verify zero hardcoded zinc/emerald/blue palette classes**

```bash
cd apps/web && rg "bg-zinc-|text-zinc-|border-zinc-|bg-emerald-|text-emerald-|bg-\[#" src/app/dashboard/year-wheel/
```

Expected: ZERO results (or very few intentional ones like brand-orange).

- [ ] **Step 4: Verify spring constants are all from tokens**

```bash
cd apps/web && rg "stiffness:" src/app/dashboard/year-wheel/
```

Expected: ZERO results (all springs now use `motionTokens.*`).

- [ ] **Step 5: Visual check — open Year Wheel in browser**

Run the dev server and verify:
- Light mode looks correct (warm tones, not cold zinc)
- Dark mode looks correct (warm OKLCH backgrounds, not cold zinc-800/900)
- Animations are smooth and gentle (not snappy/jarring)
- All text is readable

- [ ] **Step 6: Final commit if any fixes needed, then push**

```bash
git push -u origin fix/year-wheel-design-debt
```
