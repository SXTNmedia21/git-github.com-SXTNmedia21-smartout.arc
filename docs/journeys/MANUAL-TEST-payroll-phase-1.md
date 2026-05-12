---
title: "Manual Test — Payroll Phase 1 MVP"
status: in_progress
updated: 2026-05-07
created: 2026-05-07
module: payroll
tags: [testing, payroll, phase-1, manual]
---

# Manual Test — Payroll Phase 1

> Covers the 5 declared journeys for Phase 1. All tests require a local Supabase instance with payroll schema migrated. Use a test workspace with at least 2 profiles.

---

## Environment

| Env | Description |
|-----|-------------|
| **LOCAL** | `pnpm dev:local` or `op run --env-file=.env.template -- pnpm dev` |
| **DB** | Supabase Local, payroll schema migrated (`npx supabase db reset`) |
| **Test workspace** | Any workspace with `payroll.workspace_settings` row |

---

## Journey 1 — Admin configures workspace payroll policy

**File:** `docs/journeys/JOURNEY-payroll-phase-1-admin-configures-workspace-policy.md`

### Preconditions
- Logged in as admin
- Navigate to `/dashboard/settings` → "Lønnsinnstillinger" tab

### Test steps

| # | Action | Expected |
|---|--------|----------|
| 1 | Open Lønnsinnstillinger tab | "Lønnsperiode" card loads; period_type selector shows current value |
| 2 | Change period_type to "Ukentlig" | Select updates |
| 3 | Toggle "Tariffbundet" | Toggle flips |
| 4 | Set supplement_stacking_policy to "Høyeste tillegg vinner" | Select updates |
| 5 | Set punch_rounding_direction to "Nærmeste" + rounding_minutes = 5 | Both fields accept values |
| 6 | Click "Lagre" | Toast "Lønnsinnstillinger lagret" appears |
| 7 | Refresh page | All changed values persisted |

### Error path
- Set period_start_day = 0 → form validation rejects (min 1)
- Set employer_social_security_pct = 101 → form validation rejects (max 100)

---

## Journey 2 — Manager closes payroll period

**File:** `docs/journeys/JOURNEY-payroll-phase-1-manager-closes-period.md`

### Preconditions
- At least one `payroll.payroll_period` row exists with status `open`
- Navigate to `/dashboard/payroll/[periodId]`

### Test steps

| # | Action | Expected |
|---|--------|----------|
| 1 | Open period detail page | Header shows period name + status badge "Åpen" |
| 2 | If deviations present, acknowledge each | Acknowledge buttons appear for errors; success toast per ack |
| 3 | All errors acknowledged → Lock button active | "Lås periode" button is not disabled |
| 4 | Click "Lås periode" | LockModal opens with period summary |
| 5 | Confirm in modal | Period status changes to "locked"; toast "Periode låst" |
| 6 | Reload page | Lock button absent; status badge "Låst" |

### Error path
- Period with unacknowledged `error` deviations → Lock button disabled, tooltip explains reason

---

## Journey 3 — Manager drills down per-employee pay

**File:** `docs/journeys/JOURNEY-payroll-phase-1-manager-drills-profile.md`

### Preconditions
- Period detail page open with at least 1 calculation row
- LinesTable shows rows

### Test steps

| # | Action | Expected |
|---|--------|----------|
| 1 | Click employee row in LinesTable | LineDrawer opens from right |
| 2 | Drawer header shows employee name + total pay | Correct name and amount |
| 3 | "Vakter" tab selected by default | List of per-shift cards |
| 4 | Each card shows Grunnlønn / Tillegg / Trekk / Totalt | Amounts summed correctly |
| 5 | Switch to "Linjer" tab | Table shows salary-code level rows |
| 6 | Each row shows kode, type, timer, sats, beløp | All cells populated |
| 7 | Click X to close | Drawer closes |

### Error path
- Period with no calculations → LinesTable shows "Ingen beregningslinjer..." empty state
- Network error fetching calcs → error message in drawer

---

## Journey 4 — Admin sets overtime mode for employee

**File:** `docs/journeys/JOURNEY-payroll-phase-1-admin-sets-overtime-mode.md`

### Preconditions
- Navigate to `/dashboard/people/[profileId]`
- Lønns og ansettelse section visible

### Test steps

| # | Action | Expected |
|---|--------|----------|
| 1 | Scroll to "Lønns og ansettelse" section | Section renders with current overtime_mode |
| 2 | Click "Rediger" | Edit state activates |
| 3 | If no TOIL agreement: try switching to "Avspasering" | Dropdown disabled with tooltip |
| 4 | Set holiday_allowance_pct = 12.5 | Field accepts |
| 5 | Set toil_max_banked_hours = 80 | Field accepts |
| 6 | Click "Lagre" | Success toast; values persist |

### Error path
- Set holiday_allowance_pct = 25 → form rejects (max 20)
- Set toil_max_banked_hours = negative → form rejects

---

## Journey 5 — Admin adjusts timebank balance

**File:** `docs/journeys/JOURNEY-payroll-phase-1-admin-adjusts-time-bank.md`

### Preconditions
- At least one profile with `payroll.timebank_entry` rows
- Navigate to `/dashboard/people/[profileId]` → Lønns section

### Test steps

| # | Action | Expected |
|---|--------|----------|
| 1 | Timebank panel visible in Lønns section | Three account cards (Ferie, TOIL, Velferd) |
| 2 | Each card shows balance + last 3 entries | Correct amounts; credit green, debit red |
| 3 | Balance = sum(credits) - sum(debits) | Computed correctly |

### Mobile timebank (supplemental)

| # | Action | Expected |
|---|--------|----------|
| 1 | Open mobile app → Min Side → Timebank | Timebank screen loads |
| 2 | "Alle" chip active by default | All entries shown |
| 3 | Tap "Ferie" chip | Only feriepenger account entries shown |
| 4 | Tap "TOIL" chip | Only TOIL entries shown |
| 5 | Chip orange when active | Visual feedback correct |

---

## Supplement rule preview (T7.2 supplemental)

### Preconditions
- `/dashboard/settings` → "Tilleggsregler" tab
- Click "Legg til" to open SupplementRuleSheet

### Test steps

| # | Action | Expected |
|---|--------|----------|
| 1 | Fill in: sats 50 kr/t, tidsvindu 21:00-23:00 | Preview panel appears at bottom of form |
| 2 | Preview shows "Sats: 50 kr/t" | Correct |
| 3 | Preview shows "Aktiv mellom kl. 21:00 – 23:00" | Correct |
| 4 | Add weekday Sunday | Preview shows "Ukedager: Søn" |
| 5 | Change to percentage 0.27 | Preview shows "27.0 % av grunnlønn" |

---

## Known gaps (documented, not blockers)

- **C1:** `expected/` fixture folder empty — structural invariants pass, cents-exact comparison deferred to Phase 2
- **C2:** 43 fixture shifts (spec'd ~600) — scope-cut accepted for Phase 1 velocity
- **I3:** W14 minstelønn auto-apply deferred — INFO + admin advisory only
- **W11:** UTC/Oslo grouping edge for 22:00 UTC shifts — pre-existing, flagged for Phase 2 fix
- **W04:** 4-week boundary test missing — flagged for Phase 2
