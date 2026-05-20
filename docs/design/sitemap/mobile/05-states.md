---
title: Mobile Screen States
status: draft
updated: 2026-05-15
created: 2026-05-15
module: mobile
tags: [mobile, states, loading, error, empty, sitemap]
---

# Screen States

Per screen: loading UI, empty UI, error UI, and which hooks drive the state. Flags silent-fail hooks.

## Home Screen (`(home)/index.tsx`)

| Hook | Loading UI | Empty UI | Error UI |
|------|-----------|---------|---------|
| `useShiftPhase` | — | `NoShiftView` (phase === "no_shift") | none — silent |
| `useMyProfile` | — | firstName = "" gracefully | none — silent |
| `useMyTasks` | — | tasks = [] gracefully | none — silent |
| `useShiftColleagues` | — | colleagues = [] gracefully | none — silent |

Phase edge cases:
- `before_shift` + `nextShift === null` → spinner with "Laster vaktdata..." (`ActivityIndicator`)
- `during_shift` + `activeTimeEntry === null` → spinner with "Kobler til vaktdata..."

**Silent fail flag:** `useShiftPhase` (store, not query) — no error surface if phase store is stale.

## Shifts List Screen (`(shifts)/index.tsx`)

| Hook | Loading UI | Empty UI | Error UI |
|------|-----------|---------|---------|
| `useTeamShifts` | Text: "Laster vakter…" | **None — silent fail gap** | Text: "Kunne ikke laste vakter. Prøv igjen." |

**Silent fail flag:** When `!isLoading && !error && shifts.length === 0`, 7 empty `DayCrewCluster` boxes render with "Ingen vakter." in each cluster. This is the "vakter laster ikke" symptom — the query may have returned 0 rows (no published shifts in seed) rather than truly loading. No "no shifts this week" state is distinct from a loading/empty-data scenario.

## Shift Detail Screen (`(shifts)/[id].tsx`)

| Hook | Loading UI | Empty UI | Error UI |
|------|-----------|---------|---------|
| `useMyShifts` | — | "Vakt ikke funnet" + back button | none — silent |
| `useShiftColleagues` | — | colleagues section hidden | none — silent |

## Chat Screen (`(chat)/index.tsx`)

| Hook | Loading UI | Empty UI | Error UI |
|------|-----------|---------|---------|
| `useGroupedConversations` | `ActivityIndicator` | `EmptyState` component | shown inline |
| `useMyQueue` | `ActivityIndicator` | "Ingen åpne saker" | shown inline |

## Min Tid Screen (`(me)/index.tsx`)

| Hook | Loading UI | Empty UI | Error UI |
|------|-----------|---------|---------|
| `useMyProfile` | greeting shows blank name | graceful | none — silent |

**Silent fail flag:** Payslip section uses hardcoded `PAYSLIPS` array — no hook, no loading state, no real data.

## Payroll Hub (`(me)/payroll/index.tsx`)

| Hook | Loading UI | Empty UI | Error UI |
|------|-----------|---------|---------|
| `usePayrollSummary` | — | fallback values | `PayrollErrorBoundary` catch |
| `usePayslips` | `ActivityIndicator` | "Ingen lønnsgrunnlag" | `PayrollErrorBoundary` catch |

`PayrollErrorBoundary` in `payroll/_layout.tsx` provides a global fallback: "Ingen data tilgjengelig. Prøv igjen."

## Payroll Sub-Screens

| Screen | Hook | Loading | Empty | Error |
|--------|------|---------|-------|-------|
| `timebank` | `useTimebankBalance` | spinner | "Ingen bevegelser" | inline |
| `absence-balance` | `useAbsenceBalance` | spinner (in `AbsenceBalanceScreen`) | graceful | inline |
| `absence-request` | `useAbsenceBalance`, `useAbsenceTypes`, `useMyAbsenceRequests` | spinners | graceful | inline |
| `payslip` | `usePayslips` | `ActivityIndicator` | "Ingen lønnsslipper ennå" | inline |
| `supplements` | `useMySupplementClaims` | — | "Ingen krav registrert" | inline |
| `payslip-detail` | `usePayslips` (find by id) | spinner | "Ikke funnet" | `PayrollErrorBoundary` |
| `lonnsgrunnlag-detail` | no hook (opens system browser) | — | "Ingen PDF URL" | inline text |

## Training Screen (`(home)/training.tsx`)

| Hook | Loading | Empty | Error |
|------|---------|-------|-------|
| `useTrainingData` | `ActivityIndicator` | shows empty sections | inline |

**Silent fail flag:** Comment in file: "Data is placeholder until training hooks are wired to protocol_assignment and knowledge_test tables." `useTrainingData` likely returns stub/empty data — real DB not yet wired.

## Calendar Screen (hidden)

| Hook | Loading | Empty | Error |
|------|---------|-------|-------|
| `useCalendarItems` | loading skeleton (`loadingPlaceholder` style) | `EmptyDay` component | shown inline |

## Contract Screens

| Screen | Hook | Loading | Empty | Error |
|--------|------|---------|-------|-------|
| `contract/index` | direct `supabase` call (no useQuery) | `ActivityIndicator` | "Ingen kontrakter" | inline |
| `contract/[id]` | direct `supabase` call | `ActivityIndicator` | "Kontrakt ikke funnet" | inline |

**Silent fail flag:** Both contract screens call `supabase` directly in `useEffect` without TanStack Query — no query key, no cache, manual loading/error state management.
