---
title: "Calendar Redesign Discovery — Phase 0"
status: in_progress
updated: 2026-05-04
created: 2026-05-04
module: mobile
tags: [audit, mobile, calendar, vaktliste, discovery, design-handoff]
---

# Calendar Redesign Discovery Audit — 2026-05-04

## 1. Existing Shift List Structure

**File:** `apps/mobile/app/(app)/(shifts)/index.tsx` (wt-3 scope) + `apps/mobile/src/components/shift/ShiftCard.tsx`

| Aspect | Current State | Confidence |
|--------|---|---|
| **Component name** | `MyShiftsScreen` | HIGH |
| **Data hook** | `useMyShifts()` — queries `schedule_shift` for next 7 days | HIGH |
| **Return type** | `ScheduleShift[]` from Supabase — includes `shift_date`, `start_time`, `end_time`, `role`, `zone`, `breaks` | HIGH |
| **Grouping** | By week number (ISO 8601); calculates total hours per week | HIGH |
| **ShiftCard props** | `shift: ScheduleShift`, `onPress?`, `onConfirm?`, `confirming`, `showPhaseStrip` | HIGH |
| **Existing formatting** | `formatShiftDate()`, `formatTime()`, `formatWorkHours()` — reusable across calendar | HIGH |
| **Reusability** | **Moderate.** ShiftCard is tightly bound to lifecycle phase display + supplement badge rendering. Calendar's ItemCard is simpler (icon, title, time). Can extract time formatting; card layout will need redesign per handoff visual. | MEDIUM |
| **Hooks used** | `useMyShifts()`, `useMyProfile()`, `useSwapRequests()`, `useSupplementRules()`, `useShiftLifecycle()` | HIGH |

**Boundary:** wt-2 (`feat/mobile-shift-system-polish`) is only modifying `(shifts)/create.tsx`, not `index.tsx`. No direct conflict on the vaktliste redesign.

---

## 2. TabBar Layout

**File:** `apps/mobile/app/(app)/_layout.tsx` + `apps/mobile/src/components/navigation/TabBar.tsx`

| Aspect | Current | Handoff Target | Diff |
|--------|---------|---|---|
| **Current tab count** | 6 tabs | 5 tabs | Reduce/rename |
| **Current order** | Hjem, Digest, Vakter (Kalender), Min kø, Chat, Min side | Kalender, Vakter, ⊕ FAB, Chat, Min Tid | Major restructure |
| **FAB placement** | Center AI FAB (Botsson sheet) | Orange ⊕ with Smartout flame | Same position, new icon |
| **Active state** | Orange icon + label + 4px orange dot | Orange icon + label + 4px orange dot | **MATCH** ✓ |
| **Icon library** | `lucide-react-native` (v0.577.0) | Lucide inline SVGs → Lucide-RN | **MATCH** ✓ |

**Current labels/icons in code:**
```typescript
TAB_ICONS = {
  "(home)": Home,
  digest: Sun,
  "(shifts)": CalendarDays,
  "(komm)": LifeBuoy,
  "(chat)": MessageCircle,
  "(me)": User,
};
```

**Handoff mapping needed:**
- `Kalender` → Calendar (Calendar icon ✓)
- `Vakter` → Users (People icon ✓)
- `Chat` → MessageCircle (Chat icon ✓)
- `Min Tid` → Clock/Watch (Lucide: `Clock` or `Clock3` ✓)
- Remove: `Hjem` (Home), `Digest` (Sun), `Min kø` (LifeBuoy)

**Plan flag:** The plan mentions **4-tab restore (ADR-0133)** vs **5-tab redesign per handoff**. Plan §2 states: "vs 4 from ADR-0133-restore-plan; sjekk hvilken som vinner." Current state has 6 tabs. **This is a gate item before Phase 3f.** Confirm with steward: does "Min Tid" exist in backend or is it placeholder?

---

## 3. Data Hooks for Calendar

### Current Hooks

| Hook | Returns | Matches Handoff? | Notes |
|------|---------|---|---|
| `useMyShifts()` | `ScheduleShift[]` (next 7 days) | Partial | Scope: only current user's shifts. Handoff needs dept, crew, scope filters. |
| `useOperationsFeed(date)` | `FeedItem[]` (shift/task/booking/note/overdue) | **YES** | Combines shifts, tasks, bookings, deviations — nearly matches handoff data shape. |
| `useMyTasks()` | `SessionTask[]` (today only) | Partial | Tasks scoped to today; handoff shows week-long tasks. |
| `useDayInfo()` | Bookings, deviations, messages (today only) | Partial | Only today; handoff shows entire selected day. |

### Handoff Data Model

```typescript
type CalendarItem = {
  id: string;
  type: 'shift' | 'task' | 'booking' | 'deviation' | 'note';
  date: number;            // 1..31
  title: string;
  time?: string;           // '15:00–23:00' or '17:00' (single)
  dept: Department;        // 'kjokken' | 'sal' | 'bar' | 'event'
  status: 'upcoming' | 'todo' | 'done' | 'completed' | 'overdue' | 'confirmed';
  // shift-specific
  role?: string;
  zone?: string;
  // booking-specific
  guests?: number;
  tables?: string;
  contact?: string;
};
```

### Gap Analysis

| Handoff field | Current DB | Status |
|---|---|---|
| `type` (shift/task/booking/deviation/note) | schedule_shift, session_task, schedule_day_booking | **NEW MAPPING** — "deviation" is `overdue` task flag |
| `date` (1..31) | shift_date (YYYY-MM-DD) | **TRANSFORM** — parse date from ISO string |
| `title` | shift.role, task.title, booking.title | **PARTIAL** — shifts show role, not title |
| `time` (range format) | start_time, end_time | **REFORMAT** — handoff wants "15:00–23:00", db has separate fields |
| `dept` (Kjøkken/Sal/Bar/Event) | shift.department? | **VERIFY** — search codebase for dept enum |
| `status` (upcoming/todo/done/overdue) | shift.confirmed_at, task.status | **MAP** — confirm status enum values match |
| `role`, `zone`, `guests`, `contact` | Present in DB | **MATCH** ✓ |

**New hook needed:** `useCalendarItems({ date, scope, filter })` — wrapper that:
1. Fetches shifts, tasks, bookings, deviations for the selected date range + filter
2. Maps to unified `Item` type
3. Applies scope filter (me / all / dept / person)
4. **Combines** `useMyShifts`, `useMyTasks`, `useDayInfo` with scope logic from handoff shiftlist

**Confidence:** HIGH that hook shape is feasible; MEDIUM that dept field exists on `schedule_shift` (needs grep).

---

## 4. Avdelings-farger (Department Colors)

**File:** `packages/design-tokens/src/native.ts`

**Status:** ✅ **PRESENT**

```typescript
department: {
  kitchen: "#ee560c",
  floor: "#00ab93",
  bar: "#864ad2",
  event: "#c18200",
  storage: "#008388",
},
```

**Handoff expects (§5):**
```
kjokken: #ee560c  ✓ matches "kitchen"
sal:     #00ab93  ✓ matches "floor"
bar:     #864ad2  ✓ matches "bar"
event:   #c18200  ✓ matches "event"
```

**Gap:** Handoff uses Norwegian keys (`kjokken`, `sal`, `bar`, `event`); mobile tokens use English. **Phase 3a task:** alias or rename to match handoff semantics (or create a `department_colors` constant at handoff level).

**Confidence:** HIGH — colors exist, just need key mapping.

---

## 5. Spring/Animation Library

**Installed:** `apps/mobile/package.json`

| Library | Version | Usage | Preference |
|---------|---------|-------|---|
| `react-native-reanimated` | ~4.2.1 | **INSTALLED** | Existing code uses for FadeIn, shift timeline spring |
| `framer-motion-react-native` | ❌ Not found | Not installed | |

**Spring physics available:**

`packages/design-tokens/src/native.ts` defines:
```typescript
motion: {
  springAmbient: { stiffness: 35, damping: 22, mass: 2.2 },
  springReactive: { stiffness: 180, damping: 20, mass: 1 },
}
```

**Handoff note:** "Keep simple. Sheet slide opp 200ms ease-out. Chevron rotate 150ms. Ingen tunge spring-animasjoner."

**Preference:** Use Reanimated's `Animated.spring()` with the pre-defined motion tokens. Do NOT reach for framer-motion-react-native (not installed, adds bundle size).

**Confidence:** HIGH — Reanimated is standard on mobile, motion tokens are declared and tested.

---

## 6. Icon Library Mapping

**Installed:** `lucide-react-native` v0.577.0 ✓

**Handoff icons (inline SVG)** → **Lucide-RN equivalents:**

| Handoff (inline SVG) | Type | Lucide-RN | Used |
|---|---|---|---|
| Clock (time) | shift | `Clock` or `Clock3` | Calendar screens |
| Briefcase (shift) | shift type | `Briefcase` | ItemCard |
| Checklist (task) | task | `CheckSquare` | ItemCard |
| FileText (booking) | booking | `FileText` or `Calendar` | ItemCard |
| AlertTriangle (deviation) | deviation | `AlertTriangle` or `AlertCircle` | ItemCard, error accent |
| MessageSquare (note) | note | `MessageSquare` | ItemCard |
| Plus (FAB) | FAB action | `Plus` | TabBar center (⊕) |
| ChevronDown (dropdown) | UI control | `ChevronDown` | ScopeChips, filter dropdowns |
| Back arrow | navigation | `ArrowLeft` or `ChevronLeft` | DayView header |
| Calendar (month/week view toggle) | view control | `Calendar` | ViewToggle label |
| Search | not in handoff | `Search` | — |

**Flame logo (FAB Smartout mark):** Handoff uses custom SVG path. Mobile should use branded flame from design-tokens or import the SVG inline.

**Confidence:** HIGH — all core icons map cleanly to Lucide-RN. Flame is the only custom asset.

---

## 7. Bottom Sheet Component

**Installed:** `@gorhom/bottom-sheet` v5 ✓

**Usage:** Already widespread in codebase:
- `CallSheet.tsx` (features/channels)
- `SettingsSheet.tsx` (home)
- `NewConversationSheet.tsx` (chat — uses `BottomSheetTextInput`)
- `ResolveSheet.tsx` (helpdesk)
- `AdminOverrideSheet.tsx`, `UnsavedChangesSheet.tsx` (reconciliation)
- `BotssonSheet.tsx` (AI, referenced in `_layout.tsx`)

**Web fallback:** `apps/mobile/src/platform/bottom-sheet.web.tsx` provides React-only modal for web build.

**Pattern:** Ref-based (`useRef<GorhomBottomSheet>`) with `.expand()` / `.close()` methods. See `_layout.tsx:42–46` for example.

**For handoff:** AddSheet + DetailSheet can follow the same pattern:
```typescript
const sheetRef = useRef<GorhomBottomSheet>(null);
const openSheet = () => sheetRef.current?.expand();
const closeSheet = () => sheetRef.current?.close();
```

**Confidence:** HIGH — pattern is well-established, library is production-tested in this codebase.

---

## 8. Current Calendar Surface

**File:** `apps/mobile/app/(app)/(home)/index.tsx` + shift-hub screens

**Current state:** No calendar tab exists. Home redirects to shift-hub. **Vakter tab** (`(shifts)/index.tsx`) shows **weekly shift list grouped by week** — not a true calendar grid.

**Handoff alignment:** This sortie will create:
1. **New `(calendar)/` route group** with WeekScreen, MonthScreen, DayScreen
2. **Refactor `(shifts)/index.tsx`** to become the new Vaktliste with crew clustering per handoff

**No overlap concern:** The existing home/shift-hub is not a calendar surface; it's a hub. New calendar tab coexists.

**Confidence:** HIGH — clear separation; no rewrite of existing surfaces needed yet.

---

## 9. Boundary with wt-2 (mobile-shift-system-polish)

**wt-2 branch:** `feat/mobile-shift-system-polish`

**Files wt-2 touches:**
- `apps/mobile/app/(app)/(shifts)/create.tsx` ← **Only this file**
- `apps/mobile/app/(app)/(home)/punch-clock.tsx` (S6 wiring)
- `apps/mobile/src/hooks/mutations/use-create-shift.ts`
- `apps/mobile/src/hooks/mutations/use-punch.ts` (S2 fix)
- `apps/mobile/src/lib/sync/action-map.ts`

**Files wt-3 will touch:**
- `apps/mobile/app/(app)/_layout.tsx` (TabBar redesign — wt-2 does NOT touch)
- `apps/mobile/app/(app)/(shifts)/index.tsx` (vaktliste redesign — wt-2 does NOT touch)
- `apps/mobile/app/(app)/(calendar)/**` (new route group — wt-2 does NOT touch)

**Conflict status:** ✅ **DISJOINT** — wt-2 and wt-3 operate on different files. wt-2 modifies the create flow + punch + sync; wt-3 owns the list + calendar + tabbar.

**Merge sequence:** No strict dependency. wt-2 lands first (already Phase 3a/3b in flight) → wt-3 rebases if needed, but file paths don't overlap.

**Confidence:** HIGH — plan clearly delineated in PLAN-calendar-redesign.md §Boundary.

---

## 10. Pre-existing Learnings & ADRs

### Critical ADRs

| ID | Title | Impact on Redesign | Status |
|---|---|---|---|
| **ADR-0133** | Web Composes, Mobile Executes | **HARD CONSTRAINT** — Mobile owns D6 (execution) + C4 (acceptance). Calendar is READ-ONLY + D6 execution (punch, swap, mark task done). No authoring. Plan §Hard Constraints §ADR-0133 flags this. | Applied |
| **ADR-0134** | Mobile Telemetry Contract Enforcement | New mutations (mark task done, confirm shift detail) MUST emit with `workspace_id` + `actor_id` resolved via `getProfileContext()`. No empty strings. | Must follow |
| **L-0100** | Tabs-in-hub vs split-IA | Pattern: split at route, unify at entry. Suggests calendar + vaktliste should be **separate routes** (not tabs within one hub). Aligns with handoff (two tabs, not nested). | Aligns |

### Other Learnings

- **L-0044** — "mobile-parity-framing-creates-feature-graveyards" — do NOT try to make mobile a smaller web. Calendar is mobile-native execution, not a port of web.
- **L-0141** — "universal-web-mobile-packages-violate-adr-0133" — keep calendar primitives in `apps/mobile` only, do NOT share with web.

### Team Constraints

- ADR-0078: voice forbidden for critical data → calendar cannot offer voice-to-text task entry
- ADR-0136: camera evidence governance (deviations) — already established pattern, use in DetailSheet

**Confidence:** HIGH — all constraints are front-and-center in the codebase; plan already references them.

---

## Summary: Reuse vs. Redesign

| Component | Reuse Potential | Notes |
|---|---|---|
| **Time formatting** (formatTime, formatWorkHours) | ✅ **REUSE** | Extract to `@/lib/formatting` or inline in calendar primitives |
| **ShiftCard visual** | ⚠️ **PARTIAL** | Lifecycle strip + supplements are wt-3-specific. ItemCard for calendar is simpler. Share time formatting only. |
| **useMyShifts hook** | ✅ **REUSE** | Core data source for calendar week view. Wrap with `useCalendarItems` to add scope/filter logic. |
| **useOperationsFeed** | ✅ **REUSE** | Already combines shifts + tasks + bookings + deviations. May need scope expansion (all team, dept, person). |
| **Sheet modal pattern** | ✅ **REUSE** | `@gorhom/bottom-sheet` established. AddSheet + DetailSheet follow existing pattern. |
| **Motion tokens** | ✅ **REUSE** | `nativeTheme.motion.springReactive` for 150ms chevron rotate, 200ms sheet slide. |
| **Department colors** | ✅ **REUSE** | Keys need aliasing (English → Norwegian), but hex values are exact match. |
| **Lucide-RN icons** | ✅ **REUSE** | All icons map cleanly. No new library needed. |
| **TabBar layout logic** | ⚠️ **REFACTOR** | Current 6-tab midpoint FAB logic works; 5-tab target requires parameter adjustment. |

---

## Open Gates Before Phase 1

1. **Tab count clarification** — Plan mentions "5 tabs (handoff) vs 4 from ADR-0133-restore-plan". Confirm with steward which wins. Does backend support "Min Tid" tab, or is it UI-only placeholder?
2. **Department enum mapping** — Grep `schedule_shift` table definition to confirm `department` column exists and uses `'kjokken' | 'sal' | 'bar' | 'event'` enum. If not, add migration Phase 3a.
3. **Scope filter RBAC** — Handoff shows "Hele teamet" scope visible to all users. ADR-0078 / C4 capability gates may restrict who sees team-wide view. Verify in Phase 1 lovsen-check.
4. **Sheet anchor snapPoints** — `@gorhom/bottom-sheet` requires `snapPoints` array. Decide: is AddSheet full-screen, half-screen, or drag-dismissible? Set in Phase 3e.

---

## Estimated Complexity by Phase

- **Phase 1 (Lovsen):** Moderate — RBAC for team-wide scope, booking contact PII, task overdue handling
- **Phase 2 (ADR + plan-verify):** Low — most ADRs already exist; just cross-reference
- **Phase 3a (Tokens):** Low — department key aliasing only
- **Phase 3b (Primitives):** Moderate — WeekStrip, FilterChips, ItemCard, ScopeChips, CompactShiftRow, ProgressRing, Avatar (some exist, some new)
- **Phase 3c (Calendar screens):** High — three view modes + cross-tab state management + `useCalendarItems` hook
- **Phase 3d (ShiftList redesign):** High — DayCrewCluster pattern, scope dropdown, reuse ShiftCard or build new
- **Phase 3e (Sheets):** Moderate — AddSheet + DetailSheet type-specific branching
- **Phase 3f (TabBar):** Low — parameter tweak to current code
- **Phase 4 (Review):** Moderate — pixel-parities, animation tuning

---

> **Report generated by Phase 0 Discovery Agent, 2026-05-04. Ready for Phase 1 (Lovsen check) entry.**
