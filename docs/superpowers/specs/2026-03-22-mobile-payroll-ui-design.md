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

## Design Decisions

| Decision                | Choice                       | Reason                                                                             |
| ----------------------- | ---------------------------- | ---------------------------------------------------------------------------------- |
| Navigation placement    | Inside Meg tab + Home card   | No tab bar changes. Actions on home, detail in Meg.                                |
| Absence detail style    | Compact list + ledger        | Information-dense, accountant-friendly (over visual ring)                          |
| Absence request pattern | Balance-first (Planday)      | Show what you have before requesting. Live projection.                             |
| Payslip pattern         | Net pay hero (Tripletex)     | Lead with utbetalt. Vacation days integrated. PDF download.                        |
| Home card priority      | Action on top, payroll below | Confirm shift / punch out / confirm hours are primary. Earnings info is secondary. |
| Supplement display      | Color-coded badges           | Purple (kveld), orange (helg), red (helligdag). On ShiftCard + home card.          |

## Screen 1: Home Payroll Card (`PayrollHomeCard`)

A single adaptive card on the Home screen that changes content based on shift phase. Always rendered BELOW any action card (confirm shift, punch out, confirm hours).

### Phase Modes

**no_shift** — Relaxed overview

- Feriedager remaining (green): "18 av 25"
- Timebank balance (blue): "12.5 timer"
- Siste lønn: "kr 21 146"
- "Se alt >" link to Meg payroll section
- Gradient: green → blue top border

**before_shift** — Contextual supplement preview

- Shows which supplements this shift earns
- "Kveldstillegg etter 21:00" with supplement badges
- Estimated supplement amount: "~kr 31"
- Gradient: purple → orange top border

**during_shift** — Live earnings counter

- Pulsing dot indicator
- Running grunnlønn based on elapsed time
- Running supplement amount
- Total so far, updates every 60 seconds
- Orange top border

**after_shift** — Shift earnings summary

- Grunnlønn for actual hours worked
- Supplements earned with duration
- Green total: "kr 1 443"
- Green top border

### Props

```typescript
type PayrollHomeCardProps = {
  phase: "no_shift" | "before_shift" | "during_shift" | "after_shift";
  shift: ScheduleShift | null;
  timeEntry: TimeEntry | null;
  absenceBalance: { type: string; remaining: number; total: number }[] | null;
  timebankHours: number | null;
  lastPayAmount: number | null;
  supplementRules: SupplementRule[];
  holidays: string[]; // ISO date strings for public holidays
  hourlyRate: number; // From employee_payroll_profile
};
```

### Data Requirements

- `payroll.absence_quota` (current year, current profile)
- `payroll.timebank_entry` (aggregated balance)
- `payroll.period` (latest closed period for "siste lønn")
- `payroll.supplement_rule` (workspace rules, cached)
- `payroll.holiday_entry` (for helligdag detection)
- `employee_payroll_profile.hourly_rate` (for live calculation)

## Screen 2: Absence Balance (`AbsenceBalanceScreen`)

Accessed from Meg → Fravaerssaldo.

### Layout

**Top section: Balance rows**

- One row per absence type with quota
- Format: "Ferie — 18 av 25 dager"
- Color-coded: green for sufficient, red when low

**Bottom section: "Siste bevegelser" ledger**

- `payroll.absence_ledger` entries ordered by `effective_date DESC`
- Each entry: description, date, +/- days
- Green for entitlement/carry_over, red for usage/expiry

### Hook

`useAbsenceBalance(profileId: string)`

- Queries `payroll.absence_quota` WHERE `profile_id` AND `year = current_year`
- Queries `payroll.absence_ledger` WHERE `profile_id` ORDER BY `effective_date DESC` LIMIT 20
- Returns `{ quotas, ledgerEntries, isLoading }`

## Screen 3: Timebank (`TimebankScreen`)

Accessed from Meg → Timebank.

### Layout

**Top: Blue balance banner**

- Big number: available hours
- Label: "Tilgjengelig for avspasering"
- Balance = SUM(hours) WHERE entry_type IN (accrual, carry_over, adjustment) - SUM(hours) WHERE entry_type IN (withdrawal, expiry, payout)

**Bottom: Ledger entries**

- `payroll.timebank_entry` ordered by `effective_date DESC`
- Accruals (+green), withdrawals (-red), carry-overs (+green)
- Description + source date

### Hook

`useTimebankBalance(profileId: string)`

- Queries `payroll.timebank_entry` WHERE `profile_id`
- Computes balance client-side from entry types
- Returns `{ balance, entries, isLoading }`

## Screen 4: Absence Request (`AbsenceRequestScreen`)

Accessed from Meg → Fravaer (or "Sok om fravaer" button on balance screen).

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
- Cancel option for pending requests

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

Pure function: `projectAbsenceBalance(currentBalance, requestedDays, countWeekends)`

- Uses `payroll.absence_type.count_weekends` to determine if weekends count
- Returns projected remaining balance after request

## Screen 5: Min Lønn / Payslip (`PayslipScreen`)

Accessed from Meg → Min lønn.

### Layout (Tripletex-inspired)

**Top: Net pay hero**

- Period name: "Mars 2026"
- Big number: "kr 21 146"
- Label: "Utbetalt"
- Status badge: "Utbetalt 25. mars"
- PDF download button (future — stub for now)

**Vacation strip**

- "Feriedager igjen i 2026: 18 av 25"
- Links to AbsenceBalanceScreen

**Breakdown: "Spesifikasjon"**

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

### Data

Cherry-picked from payroll tables:

- `payroll.period` — period metadata, status, dates
- `payroll.calculation` — per-employee calculation summary
- `payroll.calculation_line` — individual line items (grunnlønn, tillegg, etc.)
- `payroll.absence_quota` — for vacation strip

### Hook

`usePayslips(profileId: string)`

- Queries `payroll.period` with status IN ('closed', 'exported') joined with `payroll.calculation`
- For detail: `payroll.calculation_line` for selected period
- Returns `{ currentPeriod, previousPeriods, isLoading }`

## Screen 6: Supplement Badges (`SupplementBadges`)

Added to the existing `ShiftCard` component in the Vakter (shifts) tab.

### Appearance

A horizontal strip below the shift details row, showing color-coded badges:

- **Kveldstillegg** — purple (`#a78bfa` on `rgba(139,92,246,0.15)`)
- **Helgetillegg** — orange (`#fb923c` on `rgba(249,115,22,0.15)`)
- **Helligdagstillegg** — red (`#f87171` on `rgba(239,68,68,0.15)`)

Only shown when the shift qualifies for at least one supplement.

### Logic

Pure function in `lib/supplements.ts`:

```typescript
type ShiftSupplement = {
  type: "kveld" | "helg" | "helligdag";
  label: string;
  hours?: number; // how many hours qualify
};

function getShiftSupplements(
  shift: ScheduleShift,
  rules: SupplementRule[],
  holidays: string[],
): ShiftSupplement[];
```

- Checks shift time against each active supplement rule's time window
- Checks shift date against day-of-week for helg rules
- Checks shift date against holiday list for helligdag rules
- Returns array of applicable supplements (empty = no badges shown)

Rules are fetched once per workspace session and cached via TanStack Query `staleTime: Infinity`.

### Hook

`useSupplementRules(workspaceId: string)`

- Queries `payroll.supplement_rule` WHERE `workspace_id` AND active
- `staleTime: Infinity` (rules rarely change)
- Also fetches `payroll.holiday_entry` for current + next year

## Meg Tab Changes

New "Lonn & fravær" section in the SettingsSheet / me screen:

```
Profil
Innstillinger
--- Lønn & fravær ---
Fravær            (→ AbsenceRequestScreen — balance + request + history)
Fravaerssaldo     (→ AbsenceBalanceScreen — balance list + ledger)
Timebank          (→ TimebankScreen — TOIL balance + ledger)
Min lønn          (→ PayslipScreen — payslips + breakdown)
---
Varsler
Logg ut
```

## New Files Summary

| File                                          | Purpose                                          |
| --------------------------------------------- | ------------------------------------------------ |
| `components/payroll/PayrollHomeCard.tsx`      | Adaptive home card (4 phase modes)               |
| `components/payroll/AbsenceBalanceScreen.tsx` | Balance list + ledger                            |
| `components/payroll/TimebankScreen.tsx`       | TOIL balance + ledger                            |
| `components/payroll/AbsenceRequestScreen.tsx` | Balance-first request form                       |
| `components/payroll/PayslipScreen.tsx`        | Min lønn detail + period list                    |
| `components/payroll/SupplementBadges.tsx`     | Badge strip for ShiftCard                        |
| `hooks/queries/use-absence-balance.ts`        | Absence quota + ledger query                     |
| `hooks/queries/use-timebank-balance.ts`       | Timebank aggregation                             |
| `hooks/queries/use-supplement-rules.ts`       | Cached workspace rules + holidays                |
| `hooks/queries/use-payslips.ts`               | Period + calculation data                        |
| `hooks/queries/use-my-absence-requests.ts`    | Employee's schedule_absence                      |
| `hooks/mutations/use-request-absence.ts`      | Submit absence request                           |
| `hooks/mutations/use-cancel-absence.ts`       | Cancel pending request                           |
| `lib/supplements.ts`                          | Pure: shift → applicable supplements             |
| `lib/payroll-calc.ts`                         | Pure: live earnings calculation for during_shift |

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
  // Payslip
  netPay: "Utbetalt",
  grossPay: "Bruttolønn",
  baseSalary: "Grunnlønn",
  supplements: "Tillegg",
  overtime: "Overtid",
  taxDeduction: "Skattetrekk",
  workHours: "Arbeidstimer",
  absenceDeduction: "Fravæstrekk",
  downloadPdf: "Last ned PDF",
  previousPeriods: "Tidligere",
  // Supplements
  eveningSupplement: "Kveldstillegg",
  weekendSupplement: "Helgetillegg",
  holidaySupplement: "Helligdagstillegg",
  todaysSupplements: "Dagens tillegg",
  estimatedSupplement: "Estimert tillegg",
  // Home card
  earnedToday: "Opptjent i dag",
  earnedThisShift: "Opptjent denne vakten",
  totalSoFar: "Totalt så langt",
  totalEarned: "Totalt opptjent",
  lastPay: "Siste lønn",
  // Timebank
  availableForToil: "Tilgjengelig for avspasering",
  recentMovements: "Siste bevegelser",
  hours: "timer",
},
```

## What We Don't Build

- No new navigation tabs
- No manager approval flow (admin-side, web only)
- No push notifications for new payslip (future)
- No PDF generation (button exists, stubbed — needs server-side rendering)
- No half-day absence (web-only, like Planday)
- No payroll calculation engine (data is cherry-picked / seeded)

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
