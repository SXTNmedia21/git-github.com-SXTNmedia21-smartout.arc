---
title: Mobile Payroll UI Design
status: approved
updated: 2026-03-22
created: 2026-03-22
module: payroll
tags: [mobile, payroll, absence, timebank, supplements, payslip, react-native]
---

# Mobile Payroll UI Design

## Overview

Employee-facing payroll screens for the Smartout mobile app (React Native + Expo). Six surfaces that give employees visibility into their compensation, absence balances, overtime bank, and earned supplements — integrated into the existing shift-phase-driven home screen.

**Data source:** `payroll` schema tables created in the payroll-foundation feature (23 tables, 16 enums, dedicated schema per ADR-0057).

## Trust Model

Payroll is a trust domain. Every number shown to an employee carries an implicit promise about what they will be paid. The UI must make the epistemic status of every figure explicit.

### Three-Tier Trust Labels

| Tier         | Norwegian Label     | Meaning                                                                                    | Visual Treatment                              |
| ------------ | ------------------- | ------------------------------------------------------------------------------------------ | --------------------------------------------- |
| **Estimate** | `Foreløpig estimat` | Computed client-side from shift time × hourly rate × rules. May differ from final payroll. | Muted color + "~" prefix + disclaimer caption |
| **Recorded** | `Registrert tid`    | Based on approved time entries. Actual punched hours × rate. Not yet processed by payroll. | Normal color, no prefix                       |
| **Settled**  | `Avregnet i lønn`   | From a closed/exported payroll period. This IS what was paid.                              | Bold, green, high confidence                  |

**Rule:** Every monetary figure on every screen must belong to exactly one tier. No ambiguous numbers.

**Disclaimer text (shown on estimate screens):**

> "Foreløpig estimat basert på planlagt tid og gjeldende satser. Endelig beløp kan avvike."

### When Estimates Differ from Settled

If an employee views the home card estimate during a shift and later sees a different number on their payslip, the payslip screen should show the settled amount without referencing the estimate. Estimates are ephemeral — they don't persist and are never compared to final figures in the UI.

## Design Decisions

| Decision                | Choice                                   | Reason                                                                             |
| ----------------------- | ---------------------------------------- | ---------------------------------------------------------------------------------- |
| Navigation placement    | Inside Meg tab + Home card               | No tab bar changes. Actions on home, detail in Meg.                                |
| Absence detail style    | Compact list + ledger                    | Information-dense, accountant-friendly (over visual ring)                          |
| Absence request pattern | Balance-first (Planday)                  | Show what you have before requesting. Live projection.                             |
| Payslip pattern         | Net pay hero (Tripletex)                 | Lead with utbetalt. Vacation days integrated.                                      |
| Home card priority      | Action on top, payroll below             | Confirm shift / punch out / confirm hours are primary. Earnings info is secondary. |
| Supplement display      | Color-coded badges                       | Purple (kveld), orange (helg), red (helligdag). On ShiftCard + home card.          |
| Trust labeling          | Three-tier (estimat/registrert/avregnet) | Payroll numbers must never create false confidence.                                |
| PDF download            | Only when real document exists           | No stub buttons in trust-sensitive areas.                                          |

## Screen 1: Home Payroll Card (`PayrollHomeCard`)

A single adaptive card on the Home screen that changes content based on shift phase. Always rendered BELOW any action card (confirm shift, punch out, confirm hours).

### Phase Modes

**no_shift** — Relaxed overview

- Feriedager remaining (green): "18 av 25" — **Tier: Settled** (from `absence_quota.remaining_days`)
- Timebank balance (blue): "12.5 timer" — **Tier: Settled** (from server-canonical balance)
- Sist utbetalt: "kr 21 146" — **Tier: Settled** (latest period where `status = 'exported'` AND `payment_date <= now()`)
- "Se alt >" link to Meg payroll section
- Gradient: green → blue top border
- **Empty state (new employee):** "Ingen lønnsdata ennå" with link to Meg

**before_shift** — Contextual supplement preview

- Shows which supplements this shift will earn
- "Kveldstillegg etter 21:00" with supplement badges
- "~kr 31" — **Tier: Estimate** with `Foreløpig estimat` caption
- Gradient: purple → orange top border

**during_shift** — Live earnings counter

- Pulsing dot indicator
- Running grunnlønn based on elapsed time — **Tier: Estimate**
- Running supplement amount — **Tier: Estimate**
- Total: "~kr 1 162" with `Foreløpig estimat` caption
- Updates every 60 seconds
- Orange top border

**after_shift** — Shift earnings summary

- Grunnlønn for actual hours worked — **Tier: Recorded** (from `time_entry.punch_in/punch_out`)
- Supplements earned with duration — **Tier: Recorded**
- Total: "kr 1 443" (no ~ prefix, based on registered time)
- Green top border

### Data: Single Aggregated Hook

The home card must NOT trigger multiple cross-schema queries on every app open.

`usePayrollSummary(profileId: string)` — single hook returning:

```typescript
type PayrollSummary = {
  absenceBalances: { category: string; remaining: number; total: number }[] | null;
  timebankHours: number | null;
  lastSettledPay: { amount: number; periodName: string; paymentDate: string } | null;
  supplementRules: SupplementRule[];
  holidays: string[];
  hourlyRate: number | null;
};
```

**Implementation:** One RPC or aggregated query. Detail screens fetch independently only when entered. Home card should feel instant.

**Stale time:** 5 minutes for balances, `Infinity` for rules/holidays.

## Screen 2: Absence Balance (`AbsenceBalanceScreen`)

Accessed from Meg → Fraværssaldo.

### Layout

**Top section: Balance rows**

- One row per absence type with quota
- Format: "Ferie — 18 av 25 dager"
- Color-coded: green for sufficient, amber when < 20% remaining, red when 0
- **Tier: Settled** — `absence_quota.remaining_days` is a generated column, canonical source

**Bottom section: "Siste bevegelser" ledger**

- `payroll.absence_ledger` entries ordered by `effective_date DESC`
- Each entry: description, date, +/- days
- Green for entitlement/carry_over, red for usage/expiry
- "Sist oppdatert" timestamp at bottom

**Empty state:** "Ingen fraværskvoter er satt opp ennå. Kontakt din leder."

### Hook

`useAbsenceBalance(profileId: string)`

- Queries `payroll.absence_quota` WHERE `profile_id` AND `year = current_year`
- Queries `payroll.absence_ledger` WHERE `profile_id` ORDER BY `effective_date DESC` LIMIT 20
- Returns `{ quotas, ledgerEntries, isLoading, error }`

## Screen 3: Timebank (`TimebankScreen`)

Accessed from Meg → Timebank.

### Layout

**Top: Blue balance banner**

- Big number: available hours
- Label: "Tilgjengelig for avspasering"
- **Tier: Settled** — server-canonical balance
- "Sist oppdatert" timestamp

**Bottom: Ledger entries**

- `payroll.timebank_entry` ordered by `effective_date DESC`
- Accruals (+green), withdrawals (-red), carry-overs (+green)
- Description + source date

**Empty state:** "Ingen timer i timebanken ennå."

### Hook

`useTimebankBalance(profileId: string)`

- Queries `payroll.timebank_entry` WHERE `profile_id`
- **MVP:** Computes balance client-side from entry types (tech debt — see note below)
- Returns `{ balance, entries, isLoading, error }`

### Tech Debt: Server-Canonical Balance

Client-side balance computation is acceptable for MVP but architecturally weak:

- Future entry types can break old clients
- Inconsistent logic across mobile/web becomes likely
- Finance-like balances should be reproducible from one canonical function

**Target architecture:** Database view or RPC returns `current_balance`. Client renders ledger locally. Server owns financial truth. Track as tech debt and resolve before payroll calculation engine ships.

## Screen 4: Absence Request (`AbsenceRequestScreen`)

Accessed from Meg → Fravær (or "Søk om fravær" button on balance screen).

### Layout (balance-first, Planday pattern)

**Top: Balance cards grid**

- 3 compact cards: Ferie, Egenmelding, Omsorgsdager
- Each shows: remaining / total
- Color-coded top borders (green, amber, purple)

**Middle: Request form**

- Type picker (select from `payroll.absence_type`)
- Date range (start + end date pickers)
- Live balance projection: "5 virkedager · Saldo etter: 13 dager"
  - Green when sufficient balance
  - Red when would go negative (submit disabled)
- Comment field (optional)
- "Send søknad" button

**Bottom: "Mine søknader" history**

- `schedule_absence` entries for current profile
- Status badges: Venter (orange), Godkjent (green), Avslått (red)
- Cancel option for pending requests (only if status = "pending")

### Hooks

`useRequestAbsence()` — mutation

- Inserts into `schedule_absence` with status "pending"
- On approval (by manager on web): triggers `payroll.absence_ledger` entry

`useMyAbsenceRequests(profileId: string)`

- Queries `schedule_absence` WHERE `employee_id` ORDER BY `start_date DESC`
- Returns requests with status

`useCancelAbsenceRequest()` — mutation

- Updates `schedule_absence` status to "cancelled" (only if currently "pending")

### Balance Projection Logic

The projection function must handle real-world Norwegian absence math, not just `currentBalance - requestedDays`.

```typescript
type ProjectionInput = {
  currentBalance: number;
  startDate: string; // ISO date
  endDate: string; // ISO date
  absenceType: AbsenceType; // includes count_weekends, max_days_per_instance, etc.
  holidays: string[]; // public holidays in the date range
  existingRequests: { startDate: string; endDate: string; status: string }[];
  // Future: workSchedule for employees not on Mon-Fri
};

type ProjectionResult = {
  requestedDays: number; // computed from date range
  balanceAfter: number; // projected remaining
  isAllowed: boolean; // sufficient balance + no overlap + within limits
  warnings: string[]; // "Overlapper med eksisterende ferie 3.-5. mars"
};

function projectAbsenceBalance(input: ProjectionInput): ProjectionResult;
```

**What the function checks:**

- **Calendar days vs workdays:** Vacation counts weekdays by default. `count_weekends` flag on absence type overrides.
- **Public holidays:** Days falling on public holidays are excluded from vacation count (unless `count_weekends` is true).
- **Overlapping requests:** Warns if date range overlaps an existing pending/approved request.
- **Instance limits:** Egenmelding has `max_days_per_instance` (3) and `max_instances_per_year` (4). Function checks both.
- **Cross-year splits:** If request spans Dec 31 → Jan 1, days are attributed to the year they fall in.

**What the function does NOT check (deferred):**

- Work schedule patterns (assumes Mon-Fri for MVP)
- Half-day absences
- Graded sick leave
- Carry-over ordering and expiry application
- Negative-balance policy exceptions

These edge cases are documented as known limitations and will be addressed when the full absence engine ships.

## Screen 5: Min Lønn / Payslip (`PayslipScreen`)

Accessed from Meg → Min lønn.

### Layout (Tripletex-inspired)

**Top: Net pay hero**

- Period name: "Mars 2026"
- Big number: "kr 21 146" — **Tier: Settled**
- Label: "Utbetalt"
- Status badge: "Utbetalt 25. mars" (from `period.payment_date`)
- PDF download button — **only shown when `period.status = 'exported'` AND document URL exists.** No stub buttons.

**Vacation strip**

- "Feriedager igjen i 2026: 18 av 25"
- Links to AbsenceBalanceScreen

**Breakdown: "Spesifikasjon"**

All figures are **Tier: Settled** — from closed payroll period.

- Arbeidstimer: total hours
- Grunnlønn: base salary
- Tillegg: supplement total + supplement type badges (kveld, helg, helligdag)
- Overtid: overtime amount
- (divider)
- Bruttolønn: gross total
- Skattetrekk: tax deduction (red)
- (divider)
- Utbetalt: net pay (green, bold)

**Bottom: "Tidligere" period list**

- Previous periods as tappable cards
- Each shows: period name, date range, net amount
- Tapping navigates to same detail view for that period
- **Only periods with `status IN ('closed', 'exported')` are shown.** Open/draft periods are never exposed.

**Empty state (new employee):** "Ingen lønnsslipp tilgjengelig ennå. Din første lønnsslipp vises her etter første lønnskjøring."

### Data

- `payroll.period` — period metadata, status, dates, payment_date
- `payroll.calculation` — per-employee calculation summary
- `payroll.calculation_line` — individual line items
- `payroll.absence_quota` — for vacation strip

### Hook

`usePayslips(profileId: string)`

- Queries `payroll.period` with status IN ('closed', 'exported') joined with `payroll.calculation`
- For detail: `payroll.calculation_line` for selected period
- Returns `{ currentPeriod, previousPeriods, isLoading, error }`

## Screen 6: Supplement Badges (`SupplementBadges`)

Added to the existing `ShiftCard` component in the Vakter (shifts) tab.

### Appearance

A horizontal strip below the shift details row, showing color-coded badges:

- **Kveldstillegg** — purple (`#a78bfa` on `rgba(139,92,246,0.15)`)
- **Helgetillegg** — orange (`#fb923c` on `rgba(249,115,22,0.15)`)
- **Helligdagstillegg** — red (`#f87171` on `rgba(239,68,68,0.15)`)

Only shown when the shift qualifies for at least one supplement.

### Supplement Stacking & Precedence Rules

These rules are the canonical contract for how supplements combine. The UI badges reflect this, and the future calculation engine must implement the same logic.

| Combination              | Rule                              | Rationale                                                            |
| ------------------------ | --------------------------------- | -------------------------------------------------------------------- |
| Kveld + Helg             | **Stack (additive)**              | Both apply simultaneously. Saturday evening shift earns both.        |
| Kveld + Helligdag        | **Stack (additive)**              | Christmas Eve evening earns both.                                    |
| Helg + Helligdag         | **Helligdag wins (highest rate)** | Sunday that is also a public holiday: helligdag rate only, not both. |
| Kveld + Helg + Helligdag | **Kveld + Helligdag**             | Helligdag replaces helg, kveld still stacks.                         |

**Cross-midnight shifts:** Split at 00:00. Hours before midnight belong to the start date; hours after belong to the next date. Each segment is evaluated independently for day-of-week and holiday status.

**Unpaid breaks:** Excluded from supplement hour calculations. Only paid time qualifies.

**Approved vs scheduled time:** Badges on the shift list use scheduled shift times (pre-shift estimate). The home card after_shift mode uses actual punched time from `time_entry`.

### Logic

Pure function in `lib/supplements.ts`:

```typescript
type ShiftSupplement = {
  type: "kveld" | "helg" | "helligdag";
  label: string;
  hours: number; // qualifying hours for this supplement
  estimatedAmount?: number; // hourly rate × hours (optional, for home card)
};

type SupplementInput = {
  shiftDate: string; // YYYY-MM-DD
  startTime: string; // HH:MM:SS
  endTime: string; // HH:MM:SS
  breakMinutes: number; // unpaid break duration
  rules: SupplementRule[];
  holidays: string[]; // ISO date strings
};

function getShiftSupplements(input: SupplementInput): ShiftSupplement[];
```

- Checks shift time against each active supplement rule's time window
- Applies stacking/precedence rules from the table above
- Splits cross-midnight shifts at 00:00
- Excludes break time from qualifying hours
- Returns array of applicable supplements (empty = no badges shown)

Rules are fetched once per workspace session and cached via TanStack Query `staleTime: Infinity`.

### Hook

`useSupplementRules(workspaceId: string)`

- Queries `payroll.supplement_rule` WHERE `workspace_id` AND active
- `staleTime: Infinity` (rules rarely change)
- Also fetches `payroll.holiday_entry` for current + next year

## Meg Tab Changes

New "Lønn & fravær" section in the SettingsSheet / me screen:

```
Profil
Innstillinger
--- Lønn & fravær ---
Fravær            (→ AbsenceRequestScreen — balance + request + history)
Fraværssaldo      (→ AbsenceBalanceScreen — balance list + ledger)
Timebank          (→ TimebankScreen — TOIL balance + ledger)
Min lønn          (→ PayslipScreen — payslips + breakdown)
---
Varsler
Logg ut
```

## New Files Summary

| File                                          | Purpose                                                    |
| --------------------------------------------- | ---------------------------------------------------------- |
| `components/payroll/PayrollHomeCard.tsx`      | Adaptive home card (4 phase modes)                         |
| `components/payroll/AbsenceBalanceScreen.tsx` | Balance list + ledger                                      |
| `components/payroll/TimebankScreen.tsx`       | TOIL balance + ledger                                      |
| `components/payroll/AbsenceRequestScreen.tsx` | Balance-first request form                                 |
| `components/payroll/PayslipScreen.tsx`        | Min lønn detail + period list                              |
| `components/payroll/SupplementBadges.tsx`     | Badge strip for ShiftCard                                  |
| `hooks/queries/use-payroll-summary.ts`        | Aggregated home card data (single query)                   |
| `hooks/queries/use-absence-balance.ts`        | Absence quota + ledger query                               |
| `hooks/queries/use-timebank-balance.ts`       | Timebank aggregation                                       |
| `hooks/queries/use-supplement-rules.ts`       | Cached workspace rules + holidays                          |
| `hooks/queries/use-payslips.ts`               | Period + calculation data                                  |
| `hooks/queries/use-my-absence-requests.ts`    | Employee's schedule_absence                                |
| `hooks/mutations/use-request-absence.ts`      | Submit absence request                                     |
| `hooks/mutations/use-cancel-absence.ts`       | Cancel pending request                                     |
| `lib/supplements.ts`                          | Pure: shift → applicable supplements (with stacking rules) |
| `lib/payroll-calc.ts`                         | Pure: live earnings estimate for during_shift              |
| `lib/absence-projection.ts`                   | Pure: balance projection with edge case handling           |

## Strings (Norwegian)

New `payroll` section in `constants/strings.ts`:

```typescript
payroll: {
  title: "Lønn & fravær",
  absence: "Fravær",
  absenceBalance: "Fraværssaldo",
  timebank: "Timebank",
  myPay: "Min lønn",
  seeAll: "Se alt",
  // Trust labels
  preliminaryEstimate: "Foreløpig estimat",
  registeredTime: "Registrert tid",
  settledInPayroll: "Avregnet i lønn",
  estimateDisclaimer: "Foreløpig estimat basert på planlagt tid og gjeldende satser. Endelig beløp kan avvike.",
  // Absence types
  vacation: "Ferie",
  selfReported: "Egenmelding",
  careDays: "Omsorgsdager",
  // Balance
  daysRemaining: "dager igjen",
  of: "av",
  balanceAfter: "Saldo etter",
  workdays: "virkedager",
  available: "Tilgjengelig",
  lastUpdated: "Sist oppdatert",
  // Request
  requestAbsence: "Søk om fravær",
  absenceType: "Type fravær",
  period: "Periode",
  comment: "Kommentar",
  commentOptional: "Kommentar (valgfritt)",
  sendRequest: "Send søknad",
  myRequests: "Mine søknader",
  pending: "Venter",
  approved: "Godkjent",
  rejected: "Avslått",
  cancelled: "Kansellert",
  cancelRequest: "Kanseller",
  overlapWarning: "Overlapper med eksisterende fravær",
  insufficientBalance: "Ikke nok dager tilgjengelig",
  // Payslip
  lastPaid: "Sist utbetalt",
  netPay: "Utbetalt",
  grossPay: "Bruttolønn",
  baseSalary: "Grunnlønn",
  supplements: "Tillegg",
  overtime: "Overtid",
  taxDeduction: "Skattetrekk",
  workHours: "Arbeidstimer",
  absenceDeduction: "Fraværstrekk",
  downloadPdf: "Last ned PDF",
  previousPeriods: "Tidligere",
  specification: "Spesifikasjon",
  // Supplements
  eveningSupplement: "Kveldstillegg",
  weekendSupplement: "Helgetillegg",
  holidaySupplement: "Helligdagstillegg",
  todaysSupplements: "Dagens tillegg",
  // Home card
  earnedToday: "Opptjent i dag",
  earnedThisShift: "Opptjent denne vakten",
  totalSoFar: "Totalt så langt",
  totalEarned: "Totalt opptjent",
  // Timebank
  availableForToil: "Tilgjengelig for avspasering",
  recentMovements: "Siste bevegelser",
  hours: "timer",
  // Empty states
  noPayData: "Ingen lønnsdata ennå",
  noPayslips: "Ingen lønnsslipp tilgjengelig ennå. Din første lønnsslipp vises her etter første lønnskjøring.",
  noQuotas: "Ingen fraværskvoter er satt opp ennå. Kontakt din leder.",
  noTimebank: "Ingen timer i timebanken ennå.",
},
```

## Loading, Error & Offline Behavior

| State                    | Behavior                                                                                                           |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| **Loading**              | Skeleton placeholders matching card dimensions. No spinners.                                                       |
| **Error**                | Error card with message + "Prøv igjen" retry button.                                                               |
| **Offline**              | Show cached data (TanStack Query cache) with "Sist oppdatert" timestamp. Mutations queue via existing sync system. |
| **Empty (new employee)** | Dedicated empty state per screen (see strings above). Never show "kr 0" or empty lists without explanation.        |

## What We Don't Build

- No new navigation tabs
- No manager approval flow (admin-side, web only)
- No push notifications for new payslip (future)
- No PDF generation (no stub button — only real documents)
- No half-day absence (web-only, like Planday)
- No payroll calculation engine (data is cherry-picked / seeded — payslip screen only shows finalized periods)
- No work schedule-based workday counting (assumes Mon-Fri for MVP)
- No graded sick leave in mobile request flow
- No supplement "why" explanation drill-down (nice-to-have, not MVP)

## Known Limitations & Tech Debt

| Item                                     | Status         | Resolution                                                   |
| ---------------------------------------- | -------------- | ------------------------------------------------------------ |
| Timebank balance computed client-side    | MVP acceptable | Move to DB view/RPC before calc engine ships                 |
| Absence projection assumes Mon-Fri       | MVP acceptable | Add work schedule support when schedule patterns ship        |
| No half-day absences on mobile           | Intentional    | Add when web supports it (Planday also mobile-excludes this) |
| Supplement stacking rules in client code | MVP acceptable | Canonical engine should own these; client consumes result    |
| "Sist utbetalt" requires exported period | By design      | New employees see empty state until first payroll run        |

## Theme & Patterns

All components follow existing mobile app conventions:

- `createStyles()` with theme access
- `expo-haptics` for all touch feedback
- `expo-router` for navigation
- `@smartout/supabase/database.types` for type safety
- `@smartout/design-tokens/native` via theme
- TanStack Query for all data fetching
- Norwegian strings from `constants/strings.ts`
- Supabase client from `lib/supabase.ts`
- Cross-schema queries: `supabase.schema("payroll").from("table")`

## Visual Reference

Mockups saved in `.superpowers/brainstorm/3630-1774138606/`:

- `navigation-v2.html` — Navigation placement options (chose A: Meg tab)
- `absence-detail.html` — Absence balance styles (chose B: list + ledger)
- `timebank-and-supplements.html` — Timebank + supplement badges (approved)
- `absence-request-v2.html` — Balance-first request (Planday-inspired)
- `payslip-v2.html` — Min lønn (Tripletex-inspired)
- `home-cards-v2.html` — Home card with 4 phase modes (action-first priority)
