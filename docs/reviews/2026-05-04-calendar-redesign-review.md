---
title: "Calendar Redesign Phase 4 Review"
status: in_progress
updated: 2026-05-04
created: 2026-05-04
module: mobile
tags: [review, code-review, calendar, phase-4]
---

# Phase 4 Code Review — `feat/mobile-calendar-redesign`

**Reviewing sortie diff from `campaign/mobile` to `HEAD` across:**
- 3ff7a7a36 Phase 3a (theme + tokens)
- cddc227b6 Phase 3b (10 primitives + types)
- 38bcb2cb0 Phase 3c (3 calendar screens + useCalendarItems)
- 6243bed8b Phase 3d (ShiftList DayCrewCluster + useTeamShifts)
- 283f93b03 Phase 3e (AddSheet + DetailSheet)
- 9aaae67e8 Phase 3f (5-tab TabBar)

---

## VERDICT: APPROVE WITH CHANGES

3 BLOCKING items must be resolved before merge to `campaign/mobile`. 2 HIGH items are fix-in-next-sortie. The structural design (ADR-0133, ADR-0151, ADR-0266, spring physics, icon library, TabBar, wt-2 boundary) is sound.

---

## BLOCKING — Must fix before merge

### BLOCKING-1: Calendar telemetry events unregistered in registry.ts (ADR-0134)

- **Confidence:** 100
- **Files:** `apps/mobile/app/(app)/(calendar)/index.tsx` (lines 195–255), `apps/mobile/app/(app)/(shifts)/index.tsx`, `packages/telemetry/src/registry.ts`
- **Issue:** Events emitted by the sortie — `calendar filter_changed`, `calendar day_selected`, `calendar tab_switched`, `calendar view_changed`, `calendar scope_changed` — are called via `emit()` but none are declared as typed interfaces in `packages/telemetry/src/registry.ts`. The registry is the single source of truth per CLAUDE.md. These events have no routing destinations, no TypeScript safety, and will be silently dropped or malformed at the `engine_event` destination.
- **Phase 2 steward condition:** "register all calendar mutation events in `packages/telemetry/src/registry.ts` BEFORE Phase 3c hook implementation."
- **Fix:** Add five new interfaces to `packages/telemetry/src/registry.ts` with `category: "navigation"` and `destinations: ["posthog", "logger"]` for read-only navigation events.

### BLOCKING-2: ADR-0267 PII gate not implemented in `useCalendarItems` hook

- **Confidence:** 95
- **Files:** `apps/mobile/src/hooks/queries/use-calendar-items.ts`, `apps/mobile/src/components/calendar/types.ts`, `apps/mobile/src/components/calendar/DetailSheet.tsx`
- **Issue:** ADR-0267 §Implementation contract mandates that `useCalendarItems` fetch `profile.role` and populate `contact: null` / `contactRedacted: true` for employee roles before returning booking items. The actual hook (line 136–199) calls only `useOperationsFeed(date)` — there is no profile role fetch, no `contactRedacted` population.
- `DetailSheet.tsx:318` evaluates `item.contactRedacted === true` to gate the Ring button. When items flow through `useCalendarItems`, `contactRedacted` is never set, so it evaluates to `undefined` (falsy) — the PII gate never fires on the normal data path.
- `CalendarItem` in `types.ts` has `contact?: string` but no `contactRedacted?: boolean`. The `contactRedacted` field only exists on `CalendarItemExtended` (DetailSheet-local type).
- **Result:** an employee role who receives a booking item from `useCalendarItems` will see unredacted contact info if the caller doesn't manually populate `contactRedacted`. This is the GDPR art. 5(1)(f) gap that ADR-0267 was written to close.
- **Fix:** (a) Add `contactRedacted?: boolean` to base `CalendarItem` in `types.ts`. (b) Add `useMyProfile()` call in `useCalendarItems`. (c) In the `allItems` useMemo, for `type === "booking"` items, apply: `contact: canSeeContact ? b.contact : null, contactRedacted: !canSeeContact` per ADR-0267.

### BLOCKING-3: Workspace timezone condition not met (Lovsen F-09/F-11, Phase 2 condition)

- **Confidence:** 90
- **Files:** `apps/mobile/src/hooks/queries/use-calendar-items.ts` line 151, `apps/mobile/app/(app)/(calendar)/index.tsx` `dateToISO()`, `apps/mobile/app/(app)/(calendar)/month.tsx` `buildMonthGrid()`, `apps/mobile/app/(app)/(shifts)/index.tsx` `mondayOf()`
- **Phase 2 steward condition:** "`useCalendarItems` MUST resolve `workspace.timezone` from workspace context and use `date-fns-tz` for rendering. No hardcoded `Europe/Oslo`."
- **Current state:** every day-boundary calculation uses JavaScript's local `Date` constructor / `getDate()` / `getDay()` / `getMonth()` — these all use device timezone. No `date-fns-tz` import exists anywhere in the sortie. No `workspace.timezone` is fetched from profile.
- **Impact:** an employee with phone set to UTC+1 (or any non-Europe/Oslo tz) will see incorrect day boundaries — a shift starting at 23:00 Oslo time may appear on the wrong date.
- **Fix:** Install (verify already present) `date-fns-tz`; resolve `workspace.timezone` from `useMyProfile()` or workspace store; wrap `getDate()`/`getDay()` calls with `toZonedTime(date, timezone)` from `date-fns-tz`; replace `new Date(year, month, 1)` in `buildMonthGrid` with timezone-aware construction.

---

## HIGH — Fix in next sortie (post-merge OK)

### HIGH-1: Hardcoded hex colors violate Nordic Split constraint

- **Confidence:** 88
- **Files:** `apps/mobile/src/components/calendar/AddSheet.tsx` (lines ~309–321, ~466, ~907), `apps/mobile/src/components/calendar/DetailSheet.tsx` (lines ~273, ~279, ~909)
- **Specific violations:** `"#f0b14a"` (task accent), `"#6aa6ef"` (booking accent), `"#2dd4a5"` (evidence slot success), `"#fff"` in `footerPrimaryLabel` StyleSheet and priority/severity chip selected text
- **PLAN hard constraint:** "Ingen hardkodet zinc/gray/black. Avdelings-farger som konstanter."
- **Fix:** Add `taskYellow: "#f0b14a"`, `bookingBlue: "#6aa6ef"`, `evidenceGreen: "#2dd4a5"` to `nativeTheme` in `packages/design-tokens/src/native.ts` (both light and dark variants). Replace `"#fff"` with `theme.colors.primaryForeground`.

### HIGH-2: AddSheet hardcoded month + weekday "Mandag X. mai"

- **Confidence:** 85
- **File:** `apps/mobile/src/components/calendar/AddSheet.tsx` line ~641
- **Code:** `` const selectedDay = selectedDate ? `Mandag ${selectedDate}. mai` : "valgt dag"; ``
- **Issue:** Month is hardcoded as `"mai"` regardless of actual calendar month. `"Mandag"` is hardcoded regardless of actual day-of-week. Functional bug + CLAUDE.md violation (never hardcode Norwegian text without i18n keys).
- **Fix:** Build a proper date from the `selectedDate` (day-of-month) plus a reference month/year from parent, or pass a full `Date` object as prop. Format using `date.toLocaleDateString("nb-NO", { weekday: "long", day: "numeric", month: "long" })`.

---

## MEDIUM — Backlog

### MEDIUM-1: DayCrewCluster inlined in screen, not extracted to component file

- **Confidence:** 80
- **File:** `apps/mobile/app/(app)/(shifts)/index.tsx` line ~164–280
- **Plan target:** `apps/mobile/src/components/shift/DayCrewCluster.tsx` — file does not exist
- **Severity:** MEDIUM — backlog refactor, not a merge blocker

---

## ADR Compliance Matrix

| ADR | Verdict | Notes |
|-----|---------|-------|
| ADR-0133 Web composes / mobile executes | PASS | Calendar is read-only D6; AddSheet write paths route via BFF |
| ADR-0134 Mobile telemetry contract | FAIL — BLOCKING | 5 events emitted, 0 registered in registry.ts |
| ADR-0151 Server-derived workspace_id | PASS | AddSheet BFF sends Bearer auth; no workspace_id in body |
| ADR-0267 Booking PII access control | FAIL — BLOCKING | Hook does not apply role-check mask; contactRedacted never set |
| ADR-0266 Vaktliste scope RBAC | PASS | Client-filter per ADR-0266 R1; profile.role as canonical differentiator |
| ADR-0268 TabBar canonical layout | PASS | 5-tab order correct; FAB not a route; i18n via strings.tabs |
| ADR-0132 Mobile thin client | PASS | AddSheet routes through BFF wrappers |

---

## Lovsen F-01 to F-14 closure status

| Finding | Severity | Status | Notes |
|---------|----------|--------|-------|
| F-01 it.contact no rolesjekk | HIGH | PARTIAL | UI gate correct in DetailSheet; hook never sets contactRedacted (→ BLOCKING-2) |
| F-02 Ring-knapp uncontrolled | HIGH | PARTIAL | Blocked by same root cause |
| F-03 GDPR need-to-know | HIGH | PARTIAL | Same as F-01/F-02 |
| F-04 avvik-push PII | HIGH | DEFERRED | Push out of scope per plan; documented for push-sortie |
| F-05 no server-scope gate | MEDIUM | ADDRESSED | ADR-0266 codifies client-filter as canonical |
| F-06 udokumentert GDPR-hjemmel | MEDIUM | DEFERRED | Product/legal task |
| F-07 isShiftLead not role-gate | MEDIUM | ADDRESSED | ADR-0266 R2: profile.role canonical |
| F-08 no schedule.view_team capability | MEDIUM | ADDRESSED | ADR-0266 capability table draft |
| F-09 workspace.timezone | MEDIUM | OPEN | Phase 3c condition NOT met (→ BLOCKING-3) |
| F-10 push throttle | MEDIUM | DEFERRED | Push-sortie scope |
| F-11 tz-naive DB columns | MEDIUM | OPEN | Same root as F-09 |
| F-12 hardcoded Europe/Oslo | LOW | OPEN | Covered by BLOCKING-3 fix |
| F-13 HMS-avvik push prioritet | MEDIUM | DEFERRED | Push-sortie scope |
| F-14 no cascade scope utility | MEDIUM | DEFERRED | Future cascade scope work |

---

## Wt-2 Boundary Verification

CLEAN. `apps/mobile/app/(app)/(shifts)/create.tsx` and `apps/mobile/app/(app)/(home)/punch-clock.tsx` are untouched by this sortie.

---

## Passing checks

- ADR-0133: Calendar is read-only D6 + execute surface. No authoring verbs.
- ADR-0151: AddSheet `submitToBff()` sends `Authorization: Bearer` from Supabase session; no `workspace_id` in body.
- Spring physics: `nativeTheme.motion.springReactive` used in WeekStrip; `chevronMs` (150) used in ScopeChips; `sheetSlideMs` (200) token exists in `native.ts`. No inline stiffness/damping values.
- No emojis: Lucide-RN icons throughout.
- No `any` types found. `as unknown as RawShiftRow[]` in `use-team-shifts.ts` is bounded.
- Department colors: Norwegian aliases (`kjokken`, `sal`) added to `nativeTheme.department` in `native.ts`.
- Motion tokens: `chevronMs` and `sheetSlideMs` tokens added to `nativeTheme.motion` in `native.ts`.
- TabBar: 5-tab layout per ADR-0268. `(home)`, `digest`, `(komm)` correctly hidden with `href: null`.
- `useTeamShifts`: dept link goes through `position_id → position.department_id` per ADR-0266 implementation contract.

---

## Acceptance Criteria Check (from PLAN)

| Criteria | Status |
|---|---|
| `pnpm --filter @smartout/mobile typecheck` grønn | UNKNOWN — not run (node_modules missing) |
| `pnpm --filter @smartout/mobile test` grønn | UNKNOWN |
| PWA scope-skift chevron 150ms | PASS (chevronMs token) |
| PWA AddSheet fra header + FAB | PASS (structure present; BFF routes pending downstream worktrees) |
| PWA DetailSheet task vs booking vs shift | CONDITIONAL (booking branch PII gate broken) |
| Ingen hardkodede farger (grep) | FAIL — #f0b14a, #6aa6ef, #2dd4a5, #fff violations |
| ADRer proposed + registrert | PASS (ADR-0266, ADR-0267, ADR-0268 in docs/decisions/) |
| HANDOFF skrevet | NOT YET (Phase 4 deliverable) |

---

## Fix Priority (BLOCKING)

1. **Register 5 calendar events in `packages/telemetry/src/registry.ts`** — typed interfaces, `category: "navigation"`, `destinations: ["posthog", "logger"]`
2. **Implement ADR-0267 mask in `useCalendarItems`** — fetch `profile.role`, add `contactRedacted?: boolean` to base type, populate in useMemo
3. **Apply `workspace.timezone` + `date-fns-tz`** — resolve from `useMyProfile()`, wrap all day-boundary calculations

---

## 5 Most Important Findings

1. **BLOCKING — Telemetry registry gap (ADR-0134)** — 5 events emitted, 0 registered. Phase 2 condition explicit.
2. **BLOCKING — ADR-0267 PII gate not wired in hook** — `contactRedacted` never set, gate evaluates to false everywhere.
3. **BLOCKING — Device timezone used throughout** — F-09 condition NOT met. No `date-fns-tz` imports.
4. **HIGH — Hardcoded hex colors** — `#f0b14a`, `#6aa6ef`, `#2dd4a5`, multiple `#fff` violations.
5. **HIGH — AddSheet date label hardcoded "Mandag X. mai"** — functional bug + i18n violation.

---

**Reviewer:** code-reviewer (sonnet) | **Phase:** 4 | **Sortie:** `feat/mobile-calendar-redesign` | **Date:** 2026-05-04
