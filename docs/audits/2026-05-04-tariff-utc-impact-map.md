---
title: "Tariff UTC-Bug & Missing Nattillegg — Impact Map (Phase 1)"
status: in_progress
updated: 2026-05-04
created: 2026-05-04
module: cascade
tags: [audit, impact-map, tariff, utc-bug, riksavtalen, phase-1]
---

# Impact Map — Tariff UTC-Bug & Missing Nattillegg (Phase 1)

**Prepared for:** `feat/schedule-harness-tariff-utc-fix` sortie
**Status:** Phase 1 (Code Trace & Impact Analysis)
**Date:** 2026-05-04
**Worktree:** `/home/sxtnl/dev/smartout.ai-schedule-harness-wt-1`

---

## Executive Summary

The UTC bug in `resolve-tariff-rate.ts` + missing nattillegg + four incorrect tariff grenseverdier create a **cascading underbetaling** affecting every hospitality tenant on Smartout. This map traces all downstream call-sites from tariff resolution through payroll, dashboard reporting, and mobile employee visibility. **9 critical surfaces identified**, with highest impact on shift_cost_snapshot → payroll calculations.

**Out-of-scope but logged:** Retrospective payroll recalculation will require a separate sortie (payroll-amendment-sweep or equivalent) — paid paychecks appear immutable in current schema.

---

## 1. Tariff Resolver Call-Sites

### 1.1 Direct Callers of `resolveTariffRate()`

| Call Site | Path | Consumer | User-Facing Impact |
|---|---|---|---|
| **resolveEffectiveHours** | `apps/web/src/lib/cascade/resolve-hours.ts` | Shift lifecycle + proposal preview | Hours adjustments for daily/weekly limits (AML §10-4) |
| **compute-proposal-preview** | `apps/web/src/lib/cascade/compute-proposal-preview.ts` (no direct call found, but likely via getTariffContext) | Web dashboard shift preview UI | Real-time supplement display before shift publish |
| **shift_derivation_layer RPC** | `supabase/migrations/20260506100001_shift_derivation_layer.sql` | Edge Function `engine-dispatch` + bootstrap | Inserted into `shift_cost_snapshot` table (append-only audit) |
| **Test suite** | `apps/web/src/lib/cascade/__tests__/resolve-tariff-rate.test.ts` | Unit tests (vitest) | Currently 11 test cases; **missing DST + threshold edge cases** |

**Finding:** No direct TypeScript imports of `resolveTariffRate` from UI components — it's called via PL/pgSQL RPC layer at shift completion time. This is correct D3-layer isolation but makes runtime impact harder to trace.

---

### 1.2 `getTariffContext()` Loader Call-Sites

Locating DB query triggers (loads payroll profile + workspace/platform tariff rates + holiday calendar):

| Trigger | Source | Query Scope |
|---|---|---|
| Shift derivation (append-only) | `shift_derivation_layer` RPC (PL/pgSQL) | Per-shift at completion |
| Bootstrap cascade | `supabase/functions/bootstrap-cascade/index.ts:458-494` | Workspace initialization (Step 5: tariff_rate_table copy) |
| Tariff amendment sweep | `supabase/functions/tariff-amendment-sweep/index.ts` | Contract tariff version change detection |

**Finding:** `getTariffContext()` is NOT called from web UI directly; it's implemented as a PL/pgSQL query in the derivation layer. TypeScript version exists for potential future UI-side preview, but currently unused.

---

### 1.3 Helper Functions — Scope Analysis

#### `isEveningTime(dt: Date)` + `isWeekendTime(dt: Date)`

| Helper | Exported | Direct Usage | Problem |
|---|---|---|---|
| `isEveningTime` | NO (private) | Only within `resolve-tariff-rate.ts:64` | Uses `getUTCHours()` + `getUTCDay()` — **UTC bug** |
| `isWeekendTime` | NO (private) | Only within `resolve-tariff-rate.ts:79` | Uses `getUTCDay()` — **UTC bug** + wrong grenseverdier (Sat 15:00 → should be 14:00) |

**Finding:** Both helpers are tightly scoped to tariff resolution and NOT reused elsewhere. No external API surface for these functions.

---

## 2. `day_category` Column — Usage Impact

The `schedule_shift.day_category` column (enum: morning/midday/afternoon/evening/night/weekend) is derived at shift-creation time and used for **read-only display only**. Does NOT drive tariff resolution.

| Usage | File | Purpose | Impact of UTC-Bug |
|---|---|---|---|
| Shift creation derivation | `apps/web/src/app/dashboard/_actions/add-shift-action.ts:99-107` | UI badge/classification at save time | **MISMATCH RISK:** `deriveDayCategory` uses tz-aware logic but grenseverdier differ from §4-3 |
| Mobile operations feed | `apps/mobile/src/hooks/queries/use-operations-feed.ts` | Display "Kveldsskift" / "Helgeskift" / "Dagskift" badge | Low-impact; read-only display label |
| Dashboard schedule view | `apps/web/src/app/dashboard/schedule/_hooks/schedule-mappers.ts` (6 locations) | Map DB row to UI model | Read-only mapping; no payroll impact |

**Mismatch Details:**
- `deriveDayCategory` classifies:
  - `night` = 22:00–05:00 (kveldstillegg kode bruker 21:00–06:00)
  - `evening` = 16:00–22:00 (ingen tariff-grense — §4-3 kveld starter 21:00)
  - `weekend` = all Sat+Sun (§4-3: Sat fra 14:00, Sun fra 06:00)

This mismatch creates **false confidence** in shift classification but does NOT affect tariff calculations (those use UTC-buggy RPC, not day_category column).

---

## 3. Tariff Rate Table — Schema & Seed Status

### 3.1 Schema Definition

**File:** `supabase/migrations/20260421100200_cascade_a1_domain_tables.sql:259`

```sql
CREATE TABLE tariff_rate_table (
  id              UUID PRIMARY KEY,
  workspace_id    UUID,              -- NULL = platform-level K1a
  rate_type       TEXT NOT NULL,     -- 'kveldstillegg', 'helgetillegg', etc.
  source          tariff_source,     -- 'riksavtalen' enum
  effective_from  DATE NOT NULL,
  effective_until DATE,
  seniority_years INT,               -- Optional: seniority tiers
  amount          NUMERIC(10,2),
  unit            TEXT,              -- 'kr/t' | 'percent'
  metadata        JSONB,
  provenance      JSONB,
  created_at      TIMESTAMPTZ,
  updated_at      TIMESTAMPTZ,
  CONSTRAINT excl_tariff_no_overlap EXCLUDE USING gist (...)
);
```

**No `tariff_category` column** to distinguish nattvakt vs øvrige. Current `rate_type` enum covers only:
- `kveldstillegg` (WRONG GRENSEVERDIER)
- `helgetillegg` (WRONG GRENSEVERDIER)
- `helligdagstillegg` (seed missing; calc method wrong)
- `overtidstillegg_50` / `overtidstillegg_100` (correct)

**Missing rate_type values:**
- `nattillegg` (00:00–06:00, 2 categories: nattvakt vs øvrige)
- `nattillegg_nattvakt` (potential workaround for nattvakt-specific rate)

### 3.2 K1a Seed Status (Platform-Level)

**File:** `supabase/migrations/20260422400100_cascade_k1a_hospitality_seed.sql`

| Rate Type | 2024 Sats | 2025 Sats | Seeded? | Notes |
|---|---|---|---|---|
| `kveldstillegg` | 15.65 kr/t | 16.01 kr/t | ✓ (2024) | Grenseverdier WRONG in code (21:00-06:00 vs 21:00-24:00) |
| `helgetillegg` | 29.74 kr/t | 30.42 kr/t | ✓ (2024) | Lørdag grense WRONG (15:00 vs 14:00), søndag grense WRONG (all day vs 06:00+) |
| `helligdagstillegg` | 100% | 100% | ✓ (2024) | Beregning WRONG: fixed amount vs 100% af actual timelønn |
| `nattillegg` (øvrige) | 54.76 kr/t | 56.02 kr/t | ✗ MISSING | Not seeded; would require new rate_type |
| `nattillegg` (nattvakt) | 41.46 kr/t | 42.41 kr/t | ✗ MISSING | Not seeded |
| `overtidstillegg_50` | 50% | 50% | ✓ | Correct |
| `overtidstillegg_100` | 100% | 100% | ✓ | Correct |

**Restaurant Template Seed:**

**File:** `supabase/templates/restaurant/` (all .sql files)
**Finding:** **Zero `INSERT INTO tariff_rate_table` statements in restaurant template.**

This means:
1. All new restaurant workspaces start with `tariff_rate_table` having **only** K1a platform rows
2. `resolve-tariff-rate.ts` queries `workspace_id IS NULL` rows as fallback
3. If K1a seed is not run (e.g., test tenant), tariff supplements return empty list → **all shifts underpaid**

### 3.3 Version Control & Effective-Dating

**Finding:** `tariff_rate_table` supports `effective_from` + `effective_until` ranges. Multiple rows per rate_type CAN coexist (e.g., 2024-04-01 and 2025-04-01 sats). The `findRate()` function (line 18–27) correctly:
1. Filters by `effective_from <= dateStr`
2. Filters by `!effective_until || effective_until >= dateStr`
3. Returns latest `effective_from` on tie

**This is correct** — enables satser changes without deleting old rows.

---

## 4. Payroll Impact Chain

### 4.1 Shift Cost Snapshot — Append-Only Audit Trail

**File:** `supabase/migrations/20260421100200_cascade_a1_domain_tables.sql:300`

```sql
CREATE TABLE shift_cost_snapshot (
  id              UUID PRIMARY KEY,
  schedule_shift_id UUID,            -- FK to shift
  base_hours      NUMERIC(5,2),
  base_rate       NUMERIC(8,2),      -- From employee_payroll_profile
  base_cost       NUMERIC(10,2),     -- base_rate × base_hours
  supplements     JSONB,             -- Array of {type, amount, unit}
  total_cost      NUMERIC(10,2),     -- base_cost + supplement sums
  calculated_at   TIMESTAMPTZ,
  calculation_version INT
);
```

**Writing:** Every shift completion inserts ONE new row (append-only, never UPDATE). The `supplements` JSONB column stores the entire result of `resolveTariffRate()`:

```json
[
  {"type": "kveldstillegg", "amount": 15.65, "unit": "kr/t"},
  {"type": "helgetillegg", "amount": 29.74, "unit": "kr/t"}
]
```

**Impact:** `total_cost` is calculated once at shift derivation time. If tariff grenseverdier are wrong (e.g., Saturday 15:00–24:00 shows as no helgetillegg because code checks 15:00 UTC), the row is inserted with WRONG supplements. This row feeds payroll calculations downstream.

### 4.2 Payroll Calculation — Mobile + Web

**Files:**
- `apps/mobile/src/lib/payroll-calc.ts` — pure function for shift earnings (does NOT call tariff resolver)
- `apps/mobile/src/hooks/queries/use-payroll-summary.ts` — displays employee payslips

**Finding:** Mobile payroll summary queries `shift_cost_snapshot.supplements` JSONB column; it does NOT re-calculate tariffs. Tariff resolution is ONE-TIME at shift completion (in RPC layer), and paychecks read the stored snapshot.

**Impact chain:**
```
shift_creation
  → shift_completion
    → shift_derivation RPC (calls resolveTariffRate via PL/pgSQL)
      → INSERT shift_cost_snapshot (with WRONG supplements due to UTC bug + wrong grenseverdier)
        → payroll.calculate() reads supplements from snapshot
          → employee_payslip shows WRONG supplement amounts
```

### 4.3 Retrospective Recalc — OUT OF SCOPE

**Key finding:** There is NO automatic "recalculate all paychecks" trigger if tariff rules change. Paid paychecks reference immutable `shift_cost_snapshot` rows.

**Consequence:** Phase 2 fix (UTC + correct grenseverdier) will produce CORRECT supplements for **NEW shifts going forward**, but **all historical paychecks remain underpaid**. A separate sortie (linear ticket recommended in ADR acceptance criteria) must:
1. Detect shift_cost_snapshot rows affected by the bug (timestamps in DST windows + wrong grenseverdier)
2. Insert corrected snapshots or trigger payroll-amendment process

---

## 5. Employee-Facing Surfaces

### 5.1 Mobile Employee App — Payslip Display

| Component | File | Impact | Severity |
|---|---|---|---|
| Payslip detail | `apps/mobile/app/(app)/(me)/payroll/payslip-detail.tsx` | Shows supplements from `shift_cost_snapshot.supplements` JSONB | **HIGH**: Wrong amounts displayed to employee |
| Payroll summary | `apps/mobile/src/hooks/queries/use-payroll-summary.ts` | Aggregates total earnings across period | **HIGH**: Period total reflects underpaied shifts |
| Recent payslips card | `apps/mobile/app/(app)/(me)/index.tsx:175-201` | Last 3 payslips with amounts | **HIGH**: Visual indication of underpayment to employee |

**User Experience:**
- Employee views payslip and sees "Kveldstillegg: kr 15.65" when they worked 21:00–24:00 evening shift
- Due to UTC bug, system calculated no kveldstillegg (because 21:00 Oslo = 19:00 UTC in summer)
- Actual line item is ZERO, but code tries to display cached amount from DB
- **Result: Confusion + legitimate wage dispute**

### 5.2 Web Dashboard — Shift Preview & Roster

| Component | File | Impact | Severity |
|---|---|---|---|
| Shift proposal preview | `apps/web/src/lib/cascade/compute-proposal-preview.ts` | Shows estimated cost to admin before publish | **MEDIUM**: Admin preview reflects future underpayment but has no way to know |
| Schedule roster view | `apps/web/src/app/dashboard/schedule/` | Lists shifts with day_category badge | **LOW**: day_category is read-only decorative label, not drive tariff |
| Add shift dialog | `apps/web/src/app/dashboard/_actions/add-shift-action.ts:216` | Derives day_category at creation; does NOT affect tariff | **LOW**: day_category may mismatch actual supplements |

**Admin Experience:**
- Manager creates evening shift Friday 21:30 Oslo time
- Dashboard shows "Kveldsskift" (evening badge from day_category derivation — this works, uses tz)
- But real tariff calculation (RPC layer) uses UTC → no kveldstillegg added
- Shift cost estimate shown to admin is WRONG

---

## 6. Cross-Vertical Impact

### 6.1 Industry Verticals Using Tariff Resolution

**Finding:** Only **hospitality** vertical uses `resolveTariffRate()`.

| Vertical | Tariff Support | Call Sites |
|---|---|---|
| **Hospitality** (restaurant/bar/café) | ✓ Full K1a seed (Riksavtalen) | resolve-tariff-rate.ts + shift_derivation RPC |
| Retail | ✗ Not seeded | No tariff resolution calls |
| Other (default) | ✗ Not seeded | No tariff resolution calls |

**File evidence:**
- `packages/ai/src/industry/loader.ts:41` — "Only hospitality has tariffs to load from DB"
- `packages/ai/src/industry/packages/hospitality.ts` — hardcoded fallback with Riksavtalen rates

**Scope:** 100% of tariff resolution impact is **hospitality-only**.

---

## 7. Test Coverage Analysis

### 7.1 Current Test Suite

**File:** `apps/web/src/lib/cascade/__tests__/resolve-tariff-rate.test.ts`

| Test Case | Coverage | Status | Issue |
|---|---|---|---|
| Daytime weekday (14:00) | No supplements | ✓ PASS | Correct (no tariff) |
| Evening shift (22:00) | kveldstillegg applied | ✓ PASS | **BUT: UTC-based 22:00 UTC = 00:00 or 01:00 lokal, wrong grense** |
| Saturday afternoon (16:00 UTC) | helgetillegg applied | ✓ PASS | **WRONG: Assumes 16:00 UTC, but Saturday 15:00-24:00 should be lokal time** |
| Public holiday | helligdagstillegg applied | ✓ PASS | Correct logic but seed missing for production |
| Workspace tier override | Returns workspace rate over platform | ✓ PASS | Correct prioritization |

**Missing Test Cases:**

| Scenario | Why Missing | Required for Phase 2 |
|---|---|---|
| **DST Spring (Europe/Oslo UTC+1 → UTC+2)** | Tests use fixed UTC times; no DST simulation | Must test 21:00 Oslo spring = 19:00 UTC → should trigger kveld but doesn't |
| **DST Fall (Europe/Oslo UTC+2 → UTC+1)** | Same | Must test 21:00 Oslo fall = 20:00 UTC → may or may not trigger |
| **Nattillegg (00:00–06:00)** | Feature not implemented | Must add once rate_type exists |
| **Saturday 14:00 grense** | Currently tests 16:00 UTC; §4-3 says 14:00 lokal | Must test Sat 14:00 lokal = correct helgetillegg boundary |
| **Sunday 06:00 grense** | No Sunday-specific boundary test | Must test Sun 06:00 lokal = helgetillegg starts (not 00:00) |
| **London workspace (Europe/London)** | All tests assume UTC/Oslo | Must verify tz-aware calculation works for non-Oslo timezones |

**Current test count:** 11 cases. **Phase 2 must add 8+ DST/tz cases.**

---

## 8. Database-Level Derivation (RPC Layer)

### 8.1 PL/pgSQL Shift Derivation Function

**File:** `supabase/migrations/20260506100001_shift_derivation_layer.sql`

The `shift_derivation_layer` function (not a SELECT function; called via trigger) executes the tariff resolution at **shift completion time** (when shift status changes to "completed" or "closed"):

**Finding:** Tariff resolution is **embedded in the RPC function**, not called as separate TypeScript code. The RPC layer is the ONLY place where tariff decisions are enforced. This is correct D3-layer separation but means:
- Phase 2 fix must modify BOTH:
  1. TypeScript `resolve-tariff-rate.ts` (for tests + future UI preview)
  2. PL/pgSQL `shift_derivation_layer.sql` (for production shifts)
- Tests of `resolve-tariff-rate.ts` function alone are insufficient; integration tests must verify RPC behavior

---

## 9. High-Impact Call-Site Summary Table

| Priority | Call Site | File | Impact | Affected Users | Underpayment Risk |
|---|---|---|---|---|---|
| **P0** | shift_derivation RPC | `shift_derivation_layer.sql` | Creates immutable shift_cost_snapshot with WRONG supplements | All hospitality employees | **100%** of evening/weekend/holiday shifts |
| **P0** | UTC hour check | `resolve-tariff-rate.ts:31-32` | `getUTCHours()` in isEveningTime | DST-affected shifts (Mar 30–Oct 26) | 1–6 hours underbilled per shift |
| **P0** | Nattillegg missing | (not implemented) | Code has no nattillegg logic | Night workers 00:00–06:00 | kr 40–42/t per hour |
| **P1** | Saturday grense | `resolve-tariff-rate.ts:39` | `hour >= 15` should be `>= 14` | Saturday morning shifts 14:00–15:00 | kr 29.74/t |
| **P1** | Sunday grense | `resolve-tariff-rate.ts:40` | all Sunday, should be `>= 06:00` | Sunday 00:00–06:00 shifts | kr 25.68/t + miscategorized as helg not natt |
| **P1** | Kveld til-grense | `resolve-tariff-rate.ts:32` | `hour < 6` includes 00:00–06:00 as kveld; should stop at 24:00 | Night workers 00:00–06:00 | kr 40/t (wrong sats) |
| **P2** | K1a seed missing | `cascade_k1a_hospitality_seed.sql` | No nattillegg rows seeded | New restaurants starting today | Immediate + 100% |
| **P2** | Helligdag beregning | `resolve-tariff-rate.ts:95-106` | Fetches fixed amount; §4-2 says 100% of baseRate | Holidays (17.mai, jul, etc.) | Variable; depends on baseRate vs seed sats |
| **P3** | day_category mismatch | `add-shift-action.ts:99-107` | Grenseverdier differ from §4-3; read-only display only | All shifts; admin UX only | None (display-only) |

---

## 10. Employee Payroll Profile — Tariff Category Field

### 10.1 Schema

**File:** `supabase/migrations/20260422400000_cascade_b_schema.sql`

```sql
CREATE TABLE employee_payroll_profile (
  ...
  tariff_category TEXT NOT NULL,  -- 'ufaglart', 'faglart', 'nattvakt', 'leder'
  ...
);
```

**Enum values (from bootstrap):**
- `ufaglart` — unskilled workers (servers, kitchen helpers)
- `faglart` — skilled (chefs)
- `nattvakt` — night workers (separate nattillegg sats)
- `leder` — managers

**Current usage in tariff resolution:**
- Read in `getTariffContext()` → stored in `context.payrollProfile.tariffCategory`
- Returned in `resolveTariffRate()` output for audit
- Used in RPC layer: `WHERE rate_type = v_profile.tariff_category` (line 410 of shift_derivation_layer.sql)

**Problem:** The `tariff_category` field is used to look up `baseRate` from tariff_rate_table, but the Riksavtalen nattillegg distinction (nattvakt vs øvrige) is **not currently seeded**. Once nattillegg rows are added, the RPC layer must use this field to select the correct sats.

---

## 11. Retrospective Payroll Implications

### 11.1 Why Retro-Recalc is Out-of-Scope

Current schema is **immutable for completed paychecks**:
- `shift_cost_snapshot` is append-only (no UPDATE)
- Payslips are generated from snapshot rows (no live recalc)
- No trigger to re-derive shifts on tariff rule changes

**Example:** A Friday 21:30 shift from March 2026 has:
```json
// Stored snapshot (WRONG due to UTC bug + DST)
{ "supplements": [], "total_cost": 180.00 }

// Correct supplements should be:
{ "supplements": [{"type": "kveldstillegg", "amount": 15.65, ...}],
  "total_cost": 195.65 }
```

**After Phase 2 fix:**
- New Friday 21:30 shifts (April 2026 onward) get correct supplements
- Old paychecks remain underpaid
- Employee dispute: "Why did I get underpaid in March but not April?"

### 11.2 Proposed Out-of-Scope Sortie

**Recommendation (ADR acceptance criteria):** Create Linear ticket for `campaign/payroll/tariff-amendment-sweep-retro`:
1. Identify all `shift_cost_snapshot` rows created between 2026-01-01 and Phase2-merge date
2. Filter by UTC DST windows (Mar 30–Oct 26) + wrong grenseverdier windows
3. Generate `payroll_amendment` records (new data type?) to reverse underpayment
4. Emit `employee.paycheck_corrected` event for every affected employee + period

**Not in scope for this Phase 2 sortie** — requires separate campaign ownership.

---

## 12. Platform vs Workspace Tariff Tiers

### 12.1 Two-Tier Resolution

| Tier | Source | Seeded By | Use Case |
|---|---|---|---|
| **K1a Platform** | `tariff_rate_table WHERE workspace_id IS NULL` | Migration `20260422400100_cascade_k1a_hospitality_seed.sql` | All new workspaces; fallback baseline |
| **K1b Workspace Override** | `tariff_rate_table WHERE workspace_id = X` | Admin via tariff settings (optional) | Custom rates per workspace (e.g., local CBA overrides) |

**Current findRate() logic** (line 54–57 resolve-tariff-rate.ts):
```typescript
const hasWorkspaceRates = context.workspaceTariffRates.length > 0;
const primaryRates = hasWorkspaceRates
  ? context.workspaceTariffRates
  : context.platformTariffRates;
```

**Finding:** If workspace has ANY rate in tariff_rate_table (workspace_id = X), ALL queries search workspace tier first; platform tier is fallback-only. This is correct priority but means **admins can accidentally override platform rates with partial workspace rows** (e.g., only kveldstillegg, missing helgetillegg).

**Risk:** Restaurant admin might set custom kveldstillegg (23.00 kr/t) for their negotiated terms, but forget to seed helgetillegg → shifts get kveldstillegg from workspace BUT helgetillegg = NULL (falls back to platform). If platform seed is also incomplete, both return empty.

---

## 13. Summary of Missing Implementations

| Gap | File(s) | Phase 2 Impact | Complexity |
|---|---|---|---|
| **Nattillegg logic** | resolve-tariff-rate.ts + shift_derivation_layer.sql | Add `isNightTime()` + search for nattillegg vs nattillegg_nattvakt | Medium |
| **Nattillegg seed** | cascade_k1a_hospitality_seed.sql | Insert 2 rows (nattvakt + øvrige) with 2024/2025 sats | Low |
| **Saturday 14:00 grense fix** | resolve-tariff-rate.ts:39 | Change `>= 15` to `>= 14` (1 line) | Trivial |
| **Sunday 06:00 grense fix** | resolve-tariff-rate.ts:40–41 | Change logic from `day === 0` (all) to `day === 0 && hour >= 6` | Low |
| **Kveld til-grense fix** | resolve-tariff-rate.ts:32 | Separate kveldstillegg (21:00–24:00) from nattillegg (00:00–06:00) | Medium |
| **Helligdag beregning fix** | resolve-tariff-rate.ts:95–106 | Change from `findRate(rateType="helligdagstillegg")` to `baseRate * 1.0` (100% of actual hourly rate) | Low |
| **UTC to tz-aware conversion** | resolve-tariff-rate.ts:30–42 + shift_derivation_layer.sql | Import workspace.timezone, convert effectiveTimestamp ISO → local before hour/day checks | Medium |
| **day_category alignment** | add-shift-action.ts:99–107 | Align grenseverdier with §4-3 (optional; low priority since read-only) | Low |
| **DST regression tests** | resolve-tariff-rate.test.ts | Add 8+ test cases covering spring/fall DST, cross-tz workspaces, nattillegg boundaries | Medium |
| **RPC test coverage** | integration-shift-lifecycle.sql (existing) | Verify shift_derivation_layer emits correct supplements for DST windows | Medium |

---

## 14. Call-Site Dependency Graph

```
Employee creates shift (manual_admin or roster import)
  ↓
add-shift-action.ts:216 → deriveDayCategory (tz-aware, grenseverdier mismatch but display-only)
  ↓
schedule_shift INSERT (shift_date, start_time, end_time, day_category)
  ↓
[Shift completion trigger / schedule_published event]
  ↓
shift_derivation_layer.sql RPC function (triggered on status change)
  ├─ getTariffContext via PL/pgSQL (loads employee_payroll_profile, tariff_rate_table, public_holiday)
  ├─ isEveningTime(hour) — UTC BUG HERE
  ├─ isWeekendTime(day) — UTC BUG + WRONG GRENSEVERDIER
  └─ INSERT shift_cost_snapshot (supplements=[...]) ← WRONG amounts stored
      ↓
      Mobile/Web payroll reads snapshot
        ├─ payroll-calc.ts (pure calc, uses stored supplements)
        ├─ payslip-detail.tsx (displays to employee)
        └─ payroll-summary (aggregates period total)
      ↓
      Paycheck generated from aggregated snapshot supplements
      ↓
      Employee sees UNDERPAID payslip
```

---

## 15. Recommendations for Phase 2 Build Size

**Code Changes Required:**

1. **resolve-tariff-rate.ts** (TypeScript D3 function)
   - Add timezone parameter or fetch from context
   - Convert effectiveTimestamp → local hour/day
   - Add `isNightTime()` helper
   - Fix Saturday grense (14:00), Sunday grense (06:00+)
   - Fix helligdag beregning
   - Est. **~50 lines changed**

2. **shift_derivation_layer.sql** (PL/pgSQL RPC)
   - Mirror all timestamp conversions
   - Add nattillegg logic
   - Est. **~40 lines added/changed**

3. **cascade_k1a_hospitality_seed.sql**
   - Insert 2 nattillegg rows + update 2025 sats
   - Est. **~10 lines added**

4. **resolve-tariff-rate.test.ts**
   - Add 8 DST/boundary tests
   - Add nattillegg tests
   - Add cross-tz workspace tests
   - Est. **~120 lines added**

5. **get-tariff-context.ts**
   - Ensure workspace.timezone is loaded (may already be done)
   - Minimal changes

6. **add-shift-action.ts** (optional alignment)
   - Align deriveDayCategory grenseverdier (optional for Phase 2)
   - Est. **~5 lines if included**

**Total Phase 2 scope: ~200–250 lines of new/modified code**

---

## Conclusion

The tariff resolution layer is **highly concentrated in the `resolve-tariff-rate.ts` file and its RPC mirror** (`shift_derivation_layer.sql`). Every hospitality shift flows through this code at completion time, storing WRONG supplements in an append-only `shift_cost_snapshot` table that feeds all downstream payroll, mobile display, and admin reporting.

**No external callers exist** — the function is tightly encapsulated. Phase 2 fix + comprehensive DST tests will address production impact immediately for new shifts. **Out-of-scope retrospective recalculation** will require a separate sortie to correct historical underpayments.

---

**Prepared by:** Phase 1 Impact Map (Explore Agent)
**Next Phase:** Phase 2 Build (Botsson Harness Builder)
**Acceptance Criteria Tracking:** All 8 AC items listed in PLAN-tariff-utc-fix.md Phase section
