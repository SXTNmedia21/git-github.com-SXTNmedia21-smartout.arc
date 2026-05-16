---
title: "Golden-Month Compute Worksheet — Pontus Fill-In"
status: draft
updated: 2026-05-16
created: 2026-05-16
module: payroll
tags: [payroll, golden-month, worksheet, compute, pontus]
---

# 01 — Pontus Compute Worksheet

**Purpose:** Pre-computed formulas for every pay cell. Pontus fills `amount_ore` column.
**Note:** Cells where formula is fully determined are pre-computed to øre. Mark with `[COMPUTED]`. Cells requiring external lookup (monthly salary from contract) are marked `[CONTRACT]`.

**Conversion law (cents.ts):**
- `orePerMin(rate_nok) = floor(round(rate_nok × 100) / 60)` — bigint floor at per-minute level
- `nokToOre(nok) = round(nok × 100)`
- `feriepenger_ore = round(gross_ore × pct / 100)`

**UUID resolution:** All `supplementRuleId` and `tariffRateTableId` values below are the **fixture-scope IDs** from `rules.json` and `tariff.json`. These are NOT real database UUIDs — they are the golden-month fixture identifiers. The follow-on agent filling `expected/*.json` must resolve these to real DB UUIDs from `supplement_rule` and `tariff_rate_table` seed tables, or flag as `<seed-uuid-placeholder>` if not yet seeded.

---

## Profile: prof-001

**Contract:** salary_type=hourly, baseHourlyRateNok=215.00, FTE-equivalent=37.5h/wk, holiday_allowance_pct=12.0%, overtime_mode=paid_out, seniority_start=2022-01-15, tier=4_aar
**Shifts in period:** 6 (sh-001 to sh-006)
**Total worked minutes:** 450+570+600+720+450+450 = 3240 min = 54.0h

### Cells to compute

| Cell # | file | ruleLabel | supplementRuleId | paragrafRef | formula | amount_ore (Pontus fills) | tariffRateTableId | tariffLawVersion |
|---|---|---|---|---|---|---|---|---|
| 1 | shift_snapshots/sh-001 | base_hourly | (n/a — base) | Riksavtalen §3 minstelonn 4_aar (no floor row — rate 215 > any floor) | 450 min × 358 øre/min = 161100 øre | [COMPUTED] 161100 | (n/a) | 2025 |
| 2 | shift_snapshots/sh-001 | drikkepenger_manual | null | (manual supplement) | 150.00 NOK × 100 = 15000 øre | [COMPUTED] 15000 | (n/a) | (n/a) |
| 3 | shift_snapshots/sh-002 | base_hourly | (n/a) | — | 570 min × 358 øre/min = 204060 øre | [COMPUTED] 204060 | (n/a) | 2025 |
| 4 | shift_snapshots/sh-002 | kveldstillegg | rule-kveldstillegg-001 | Riksavtalen §6 | 179 min × 70 øre/min = 12530 øre | [COMPUTED] 12530 | trt-supp-001 | 2025 |
| 5 | shift_snapshots/sh-003 | base_hourly | (n/a) | — | 600 min × 358 øre/min = 214800 øre | [COMPUTED] 214800 | (n/a) | 2025 |
| 6 | shift_snapshots/sh-003 | helgetillegg | rule-helgetillegg-001 | Riksavtalen §6 | 600 min × 93 øre/min = 55800 øre | [COMPUTED] 55800 | trt-supp-005 | 2025 |
| 7 | shift_snapshots/sh-004 | base_hourly | (n/a) | — | 720 min × 358 øre/min = 257760 øre | [COMPUTED] 257760 | (n/a) | 2025 |
| 8 | shift_snapshots/sh-005 | base_hourly | (n/a) | — | 450 min × 358 øre/min = 161100 øre | [COMPUTED] 161100 | (n/a) | 2025 |
| 9 | shift_snapshots/sh-005 | helgetillegg | rule-helgetillegg-001 | Riksavtalen §6 | 450 min × 93 øre/min = 41850 øre | [COMPUTED] 41850 | trt-supp-005 | 2025 |
| 10 | shift_snapshots/sh-006 | base_hourly | (n/a) | — | 450 min × 358 øre/min = 161100 øre | [COMPUTED] 161100 | (n/a) | 2025 |
| 11 | shift_snapshots/sh-006 | helgetillegg | rule-helgetillegg-001 | Riksavtalen §6 | 450 min × 93 øre/min = 41850 øre | [COMPUTED] 41850 | trt-supp-005 | 2025 |
| 12 | aggregated_periods/prof-001 | gross_pay | (n/a aggregate) | — | Σ base+supp all shifts = 161100+0 + (204060+12530) + (214800+55800) + 257760 + (161100+41850) + (161100+41850) = 1311950 øre | [COMPUTED] 1311950 | (n/a) | — |
| 13 | aggregated_periods/prof-001 | manual_supplement | (n/a) | — | ms-001: 150.00 NOK = 15000 øre | [COMPUTED] 15000 | (n/a) | — |
| 14 | aggregated_periods/prof-001 | total | (n/a) | — | 1311950 + 15000 = 1326950 øre | [COMPUTED] 1326950 | (n/a) | — |
| 15 | timebank_entries/prof-001 | feriepenger_accrual | (n/a) | Ferieloven §10 | gross_amount_ore × 12% = round(1311950 × 0.12) = 157434 øre | [COMPUTED] 157434 | (n/a) | — |

---

## Profile: prof-002

**Contract:** salary_type=hourly, baseHourlyRateNok=200.00, holiday_allowance_pct=12.0%, overtime_mode=paid_out, seniority_start=2023-06-01, tier=2_aar
**Shifts in period:** 6 (sh-007 to sh-012)
**Total worked minutes:** 480+540+540+690+450+480 = 3180 min = 53.0h

### Cells to compute

| Cell # | file | ruleLabel | supplementRuleId | paragrafRef | formula | amount_ore (Pontus fills) | tariffRateTableId | tariffLawVersion |
|---|---|---|---|---|---|---|---|---|
| 16 | shift_snapshots/sh-007 | base_hourly | (n/a) | — | 480 min × 333 øre/min = 159840 øre | [COMPUTED] 159840 | (n/a) | 2025 |
| 17 | shift_snapshots/sh-007 | kveldstillegg | rule-kveldstillegg-001 | Riksavtalen §6 | 179 min × 70 øre/min = 12530 øre | [COMPUTED] 12530 | trt-supp-001 | 2025 |
| 18 | shift_snapshots/sh-007 | drikkepenger_manual | null | (manual) | 200.00 NOK = 20000 øre | [COMPUTED] 20000 | (n/a) | — |
| 19 | shift_snapshots/sh-008 | base_hourly | (n/a) | — | 540 min × 333 øre/min = 179820 øre | [COMPUTED] 179820 | (n/a) | 2025 |
| 20 | shift_snapshots/sh-009 | base_hourly | (n/a) | — | 540 min × 333 øre/min = 179820 øre | [COMPUTED] 179820 | (n/a) | 2025 |
| 21 | shift_snapshots/sh-009 | kveldstillegg | rule-kveldstillegg-001 | Riksavtalen §6 | 179 min × 70 øre/min = 12530 øre | [COMPUTED] 12530 | trt-supp-001 | 2025 |
| 22 | shift_snapshots/sh-010 | base_hourly | (n/a) | — | 690 min × 333 øre/min = 229770 øre | [COMPUTED] 229770 | (n/a) | 2025 |
| 23 | shift_snapshots/sh-010 | helgetillegg | rule-helgetillegg-001 | Riksavtalen §6 | 690 min × 93 øre/min = 64170 øre | [COMPUTED] 64170 | trt-supp-005 | 2025 |
| 24 | shift_snapshots/sh-011 | base_hourly | (n/a) | — | 450 min × 333 øre/min = 149850 øre | [COMPUTED] 149850 | (n/a) | 2025 |
| 25 | shift_snapshots/sh-011 | helgetillegg | rule-helgetillegg-001 | Riksavtalen §6 | 450 min × 93 øre/min = 41850 øre | [COMPUTED] 41850 | trt-supp-005 | 2025 |
| 26 | shift_snapshots/sh-012 | base_hourly | (n/a) | — | 480 min × 333 øre/min = 159840 øre | [COMPUTED] 159840 | (n/a) | 2025 |
| 27 | shift_snapshots/sh-012 | helgetillegg | rule-helgetillegg-001 | Riksavtalen §6 | 480 min × 93 øre/min = 44640 øre | [COMPUTED] 44640 | trt-supp-005 | 2025 |
| 28 | shift_snapshots/sh-012 | kveldstillegg | rule-kveldstillegg-001 | Riksavtalen §6 | 179 min × 70 øre/min = 12530 øre (Sat 21:00–23:59, different type from helge → stacks) | [COMPUTED] 12530 | trt-supp-001 | 2025 |
| 29 | aggregated_periods/prof-002 | gross_pay | (n/a) | — | (159840+12530)+(179820)+(179820+12530)+(229770+64170)+(149850+41850)+(159840+44640+12530) = 1247190 øre | [COMPUTED] 1247190 | (n/a) | — |
| 30 | aggregated_periods/prof-002 | manual_supplement | (n/a) | — | ms-002: 200.00 NOK = 20000 øre | [COMPUTED] 20000 | (n/a) | — |
| 31 | aggregated_periods/prof-002 | total | (n/a) | — | 1247190 + 20000 = 1267190 øre | [COMPUTED] 1267190 | (n/a) | — |
| 32 | timebank_entries/prof-002 | feriepenger_accrual | (n/a) | Ferieloven §10 | round(1247190 × 0.12) = 149663 øre | [COMPUTED] 149663 | (n/a) | — |

---

## Profile: prof-003

**Contract:** salary_type=hourly, baseHourlyRateNok=220.00, holiday_allowance_pct=12.0%, overtime_mode=**banked** (toil_agreement_signed=2026-01-10), toil_max=80h, seniority_start=2021-03-01, tier=4_aar, night_worker_category=night_watch
**Shifts in period:** 5 (sh-013 to sh-017)
**Total worked minutes:** 450+450+450+450+450 = 2250 min = 37.5h
**OT banked minutes:** None (all shifts 7.5h < 9h daily threshold)

### Cells to compute

| Cell # | file | ruleLabel | supplementRuleId | paragrafRef | formula | amount_ore (Pontus fills) | tariffRateTableId | tariffLawVersion |
|---|---|---|---|---|---|---|---|---|
| 33 | shift_snapshots/sh-013 | base_hourly | (n/a) | — | 450 min × 366 øre/min = 164700 øre | [COMPUTED] 164700 | (n/a) | 2025 |
| 34 | shift_snapshots/sh-013 | kveldstillegg (Sat bucket) | rule-kveldstillegg-001 | Riksavtalen §6 | 119 min × 70 øre/min = 8330 øre (Sat 22:00–23:59 Oslo) | [COMPUTED] 8330 | trt-supp-001 | 2025 |
| 35 | shift_snapshots/sh-013 | helgetillegg (Sat bucket) | rule-helgetillegg-001 | Riksavtalen §6 | 120 min × 93 øre/min = 11160 øre (Sat 120 min) | [COMPUTED] 11160 | trt-supp-005 | 2025 |
| 36 | shift_snapshots/sh-013 | natt_nattvakt (Holiday bucket) | rule-natt-nattvakt-001 | Riksavtalen §6 | 330 min × 70 øre/min = 23100 øre (00:00–05:30 Oslo Apr5, night_watch) | [COMPUTED] 23100 | trt-supp-002 | 2025 |
| 37 | shift_snapshots/sh-013 | helgetillegg (Holiday bucket) | rule-helgetillegg-001 | Riksavtalen §6 | 330 min × 93 øre/min = 30690 øre (1.påskedag=Sun=weekday 7) | [COMPUTED] 30690 | trt-supp-005 | 2025 |
| 38 | shift_snapshots/sh-013 | helligdagstillegg (Holiday bucket) | rule-helligdag-001 | Riksavtalen §6 | 330 min × 166 øre/min = 54780 øre | [COMPUTED] 54780 | trt-supp-006 | 2025 |
| 39 | shift_snapshots/sh-014 | base_hourly | (n/a) | — | 450 min × 366 øre/min = 164700 øre | [COMPUTED] 164700 | (n/a) | 2025 |
| 40 | shift_snapshots/sh-014 | natt_nattvakt | rule-natt-nattvakt-001 | Riksavtalen §6 | 360 min × 70 øre/min = 25200 øre (00:00–06:00 Oslo Wed, night_watch) | [COMPUTED] 25200 | trt-supp-002 | 2025 |
| 41 | shift_snapshots/sh-015 | base_hourly | (n/a) | — | 450 × 366 = 164700 øre | [COMPUTED] 164700 | (n/a) | 2025 |
| 42 | shift_snapshots/sh-015 | natt_nattvakt | rule-natt-nattvakt-001 | Riksavtalen §6 | 360 × 70 = 25200 øre | [COMPUTED] 25200 | trt-supp-002 | 2025 |
| 43 | shift_snapshots/sh-016 | base_hourly | (n/a) | — | 164700 øre | [COMPUTED] 164700 | (n/a) | 2025 |
| 44 | shift_snapshots/sh-016 | natt_nattvakt | rule-natt-nattvakt-001 | Riksavtalen §6 | 360 × 70 = 25200 øre | [COMPUTED] 25200 | trt-supp-002 | 2025 |
| 45 | shift_snapshots/sh-017 | base_hourly | (n/a) | — | 164700 øre | [COMPUTED] 164700 | (n/a) | 2025 |
| 46 | shift_snapshots/sh-017 | natt_nattvakt | rule-natt-nattvakt-001 | Riksavtalen §6 | 360 × 70 = 25200 øre | [COMPUTED] 25200 | trt-supp-002 | 2025 |
| 47 | aggregated_periods/prof-003 | gross_pay | (n/a) | — | (164700+8330+11160+23100+30690+54780)+(164700+25200)×4 = 292760+755600 = 1052360 øre | [COMPUTED] 1052360 | (n/a) | — |
| 48 | aggregated_periods/prof-003 | total | (n/a) | — | 1052360 øre (no manual supps, no tips) | [COMPUTED] 1052360 | (n/a) | — |
| 49 | timebank_entries/prof-003 | feriepenger_accrual | (n/a) | Ferieloven §10 | round(1052360 × 0.12) = 126283 øre | [COMPUTED] 126283 | (n/a) | — |
| 50 | timebank_entries/prof-003 | toil_accrual | (n/a) | Aml. §10-12 | 0 hours banked (all shifts ≤ 7.5h worked, below 9h threshold) | [COMPUTED] 0 | (n/a) | — |

---

## Profile: prof-004

**Contract:** salary_type=hourly, baseHourlyRateNok=195.00, holiday_allowance_pct=12.0%, overtime_mode=paid_out, agreed_weekly=20.0h, seniority_start=2024-09-01, tier=begynner
**Shifts in period:** 4 (sh-018 to sh-021) — sh-018 = Skjærtorsdag helligdag (B3 corrected), sh-019..021 = Saturdays
**Total worked minutes:** 360×4 = 1440 min = 24.0h

### Cells to compute

| Cell # | file | ruleLabel | supplementRuleId | paragrafRef | formula | amount_ore | tariffRateTableId | tariffLawVersion |
|---|---|---|---|---|---|---|---|---|
| 51 | shift_snapshots/sh-018 | base_hourly | (n/a) | Riksavtalen §3 minstelonn_begynner=195 NOK/t | 360 min × 325 øre/min = 117000 øre | [COMPUTED] 117000 | (n/a) | 2025 |
| 52 | shift_snapshots/sh-018 | helligdagstillegg | rule-helligdag-001 | Riksavtalen §6 | 360 min × 10000 øre/60 min = 60000 øre (Skjærtorsdag 2026-04-02, B3 corrected from helgetillegg) | [COMPUTED] 60000 | trt-supp-006 | 2025 |
| 53 | shift_snapshots/sh-019 | base_hourly | (n/a) | — | 360 × 325 = 117000 øre | [COMPUTED] 117000 | (n/a) | 2025 |
| 54 | shift_snapshots/sh-019 | helgetillegg | rule-helgetillegg-001 | Riksavtalen §6 | 360 × 93 = 33480 øre | [COMPUTED] 33480 | trt-supp-005 | 2025 |
| 55 | shift_snapshots/sh-020 | base_hourly | (n/a) | — | 117000 øre | [COMPUTED] 117000 | (n/a) | 2025 |
| 56 | shift_snapshots/sh-020 | helgetillegg | rule-helgetillegg-001 | Riksavtalen §6 | 33480 øre | [COMPUTED] 33480 | trt-supp-005 | 2025 |
| 57 | shift_snapshots/sh-021 | base_hourly | (n/a) | — | 117000 øre | [COMPUTED] 117000 | (n/a) | 2025 |
| 58 | shift_snapshots/sh-021 | helgetillegg | rule-helgetillegg-001 | Riksavtalen §6 | 33480 øre | [COMPUTED] 33480 | trt-supp-005 | 2025 |
| 59 | aggregated_periods/prof-004 | gross_pay | (n/a) | — | sh-018: (117000+60000) + sh-019..021: 3×(117000+33480) = 177000+451440 = 628440 øre | [COMPUTED] 628440 | (n/a) | — |
| 60 | aggregated_periods/prof-004 | total | (n/a) | — | 628440 øre | [COMPUTED] 628440 | (n/a) | — |
| 61 | timebank_entries/prof-004 | feriepenger_accrual | (n/a) | Ferieloven §10 | round(628440 × 0.12) = 75413 øre | [COMPUTED] 75413 | (n/a) | — |

---

## Profile: prof-005

**Contract:** salary_type=monthly, baseHourlyRateNok=0, holiday_allowance_pct=12.0%, overtime_mode=paid_out, seniority_start=2020-05-01, tier=4_aar
**Shifts in period:** 2 (sh-022, sh-023)
**Note:** Monthly gross salary NOT in fixture — must be supplied from `employment_contract.gross_monthly` at runtime. Marked [CONTRACT].

### Cells to compute

| Cell # | file | ruleLabel | supplementRuleId | paragrafRef | formula | amount_ore | tariffRateTableId | tariffLawVersion |
|---|---|---|---|---|---|---|---|---|
| 62 | shift_snapshots/sh-022 | base_monthly | (n/a) | — | 0 øre per shift (monthly) | [COMPUTED] 0 | (n/a) | — |
| 63 | shift_snapshots/sh-022 | helgetillegg | rule-helgetillegg-001 | Riksavtalen §6 | 570 min × 93 øre/min = 53010 øre | [COMPUTED] 53010 | trt-supp-005 | 2025 |
| 64 | shift_snapshots/sh-022 | kveldstillegg | rule-kveldstillegg-001 | Riksavtalen §6 | 150 min × 70 øre/min = 10500 øre (Oslo 21:00–23:30) | [COMPUTED] 10500 | trt-supp-001 | 2025 |
| 65 | shift_snapshots/sh-022 | drikkepenger_manual | null | — | 175.00 NOK = 17500 øre | [COMPUTED] 17500 | (n/a) | — |
| 66 | shift_snapshots/sh-023 | base_monthly | (n/a) | — | 0 øre | [COMPUTED] 0 | (n/a) | — |
| 67 | shift_snapshots/sh-023 | helgetillegg | rule-helgetillegg-001 | Riksavtalen §6 | 570 × 93 = 53010 øre | [COMPUTED] 53010 | trt-supp-005 | 2025 |
| 68 | shift_snapshots/sh-023 | kveldstillegg | rule-kveldstillegg-001 | Riksavtalen §6 | 150 × 70 = 10500 øre | [COMPUTED] 10500 | trt-supp-001 | 2025 |
| 69 | aggregated_periods/prof-005 | base_monthly | (n/a) | Riksavtalen §3 | formula: 205.00 × 37.5 × 30/7 = 32946.43 NOK = 3294643 øre [PENDING_E3_VERIFY] | [COMPUTED] 3294643 | trt-min-002 | 2025 |
| 70 | aggregated_periods/prof-005 | helgetillegg_total | (n/a) | — | 53010+53010 = 106020 øre | [COMPUTED] 106020 | (n/a) | — |
| 71 | aggregated_periods/prof-005 | kveldstillegg_total | (n/a) | — | 10500+10500 = 21000 øre | [COMPUTED] 21000 | (n/a) | — |
| 72 | aggregated_periods/prof-005 | manual_supplement | (n/a) | — | ms-004: 175.00 NOK = 17500 øre | [COMPUTED] 17500 | (n/a) | — |
| 73 | aggregated_periods/prof-005 | gross_pay | (n/a) | — | 3294643 + 106020 + 21000 = 3421663 øre [PENDING_E3_VERIFY] | [COMPUTED] 3421663 | (n/a) | — |
| 74 | aggregated_periods/prof-005 | total | (n/a) | — | 3421663 + 17500 (manual) = 3439163 øre [PENDING_E3_VERIFY] | [COMPUTED] 3439163 | (n/a) | — |
| 75 | timebank_entries/prof-005 | feriepenger_accrual | (n/a) | Ferieloven §10 | round(3421663 × 0.12) = 410600 øre [PENDING_E3_VERIFY] | [COMPUTED] 410600 | (n/a) | — |

---

## Profile: prof-006

**Contract:** salary_type=monthly, baseHourlyRateNok=0, holiday_allowance_pct=**12.5%** (has_fagbrev=true), overtime_mode=paid_out, seniority_start=2016-08-01, tier=8_aar
**Shifts in period:** 2 (sh-024, sh-025)
**Note:** Monthly salary [CONTRACT]

### Cells to compute

| Cell # | file | ruleLabel | supplementRuleId | paragrafRef | formula | amount_ore | tariffRateTableId | tariffLawVersion |
|---|---|---|---|---|---|---|---|---|
| 76 | shift_snapshots/sh-024 | base_monthly | (n/a) | — | 0 øre | [COMPUTED] 0 | (n/a) | — |
| 77 | shift_snapshots/sh-024 | helgetillegg | rule-helgetillegg-001 | Riksavtalen §6 | 690 min × 93 øre/min = 64170 øre | [COMPUTED] 64170 | trt-supp-005 | 2025 |
| 78 | shift_snapshots/sh-024 | kveldstillegg | rule-kveldstillegg-001 | Riksavtalen §6 | 30 min × 70 øre/min = 2100 øre (21:00–21:30 Oslo) | [COMPUTED] 2100 | trt-supp-001 | 2025 |
| 79 | shift_snapshots/sh-025 | base_monthly | (n/a) | — | 0 øre | [COMPUTED] 0 | (n/a) | — |
| 80 | shift_snapshots/sh-025 | helgetillegg | rule-helgetillegg-001 | Riksavtalen §6 | 540 min × 93 øre/min = 50220 øre | [COMPUTED] 50220 | trt-supp-005 | 2025 |
| 81 | aggregated_periods/prof-006 | base_monthly | (n/a) | Riksavtalen §3 | formula: 205.00 × 37.5 × 30/7 = 32946.43 NOK = 3294643 øre [PENDING_E3_VERIFY — voksen_faglart rate may differ; E1 fixed: tariff_category corrected to voksen_faglart] | [COMPUTED] 3294643 | trt-min-002 | 2025 |
| 82 | aggregated_periods/prof-006 | helgetillegg_total | (n/a) | — | 64170+50220 = 114390 øre | [COMPUTED] 114390 | (n/a) | — |
| 83 | aggregated_periods/prof-006 | kveldstillegg_total | (n/a) | — | 2100 øre | [COMPUTED] 2100 | (n/a) | — |
| 84 | aggregated_periods/prof-006 | gross_pay | (n/a) | — | 3294643 + 114390 + 2100 = 3411133 øre [PENDING_E3_VERIFY] | [COMPUTED] 3411133 | (n/a) | — |
| 85 | aggregated_periods/prof-006 | total | (n/a) | — | 3411133 øre [PENDING_E3_VERIFY] | [COMPUTED] 3411133 | (n/a) | — |
| 86 | timebank_entries/prof-006 | feriepenger_accrual | (n/a) | Ferieloven §10 | round(3411133 × **0.125**) = 426392 øre [PENDING_E3_VERIFY] | [COMPUTED] 426392 | (n/a) | — |

---

## Profile: prof-007

**Contract:** salary_type=monthly, baseHourlyRateNok=0, holiday_allowance_pct=12.0%, overtime_mode=paid_out, seniority_start=2019-02-15, tier=6_aar
**Shifts in period:** 2 (sh-026, sh-027)

### Cells to compute

| Cell # | file | ruleLabel | supplementRuleId | paragrafRef | formula | amount_ore | tariffRateTableId | tariffLawVersion |
|---|---|---|---|---|---|---|---|---|
| 87 | shift_snapshots/sh-026 | base_monthly | (n/a) | — | 0 øre | [COMPUTED] 0 | (n/a) | — |
| 88 | shift_snapshots/sh-026 | helgetillegg | rule-helgetillegg-001 | Riksavtalen §6 | 660 min × 93 øre/min = 61380 øre | [COMPUTED] 61380 | trt-supp-005 | 2025 |
| 89 | shift_snapshots/sh-027 | base_monthly | (n/a) | — | 0 øre | [COMPUTED] 0 | (n/a) | — |
| 90 | shift_snapshots/sh-027 | helgetillegg | rule-helgetillegg-001 | Riksavtalen §6 | 450 min × 93 øre/min = 41850 øre | [COMPUTED] 41850 | trt-supp-005 | 2025 |
| 91 | aggregated_periods/prof-007 | base_monthly | (n/a) | Riksavtalen §3 | formula: 205.00 × 37.5 × 30/7 = 32946.43 NOK = 3294643 øre [PENDING_E3_VERIFY] | [COMPUTED] 3294643 | trt-min-002 | 2025 |
| 92 | aggregated_periods/prof-007 | helgetillegg_total | (n/a) | — | 61380+41850 = 103230 øre | [COMPUTED] 103230 | (n/a) | — |
| 93 | aggregated_periods/prof-007 | gross_pay | (n/a) | — | 3294643 + 103230 = 3397873 øre [PENDING_E3_VERIFY] | [COMPUTED] 3397873 | (n/a) | — |
| 94 | aggregated_periods/prof-007 | total | (n/a) | — | 3397873 øre [PENDING_E3_VERIFY] | [COMPUTED] 3397873 | (n/a) | — |
| 95 | timebank_entries/prof-007 | feriepenger_accrual | (n/a) | Ferieloven §10 | round(3397873 × 0.12) = 407745 øre [PENDING_E3_VERIFY] | [COMPUTED] 407745 | (n/a) | — |

---

## Profile: prof-008

**Contract:** salary_type=monthly, baseHourlyRateNok=0, holiday_allowance_pct=12.0%, overtime_mode=paid_out, seniority_start=2018-11-01, tier=6_aar
**Shifts in period:** 2 (sh-028, sh-029)

### Cells to compute

| Cell # | file | ruleLabel | supplementRuleId | paragrafRef | formula | amount_ore | tariffRateTableId | tariffLawVersion |
|---|---|---|---|---|---|---|---|---|
| 96 | shift_snapshots/sh-028 | base_monthly | (n/a) | — | 0 øre | [COMPUTED] 0 | (n/a) | — |
| 97 | shift_snapshots/sh-028 | helgetillegg | rule-helgetillegg-001 | Riksavtalen §6 | 450 min × 93 øre/min = 41850 øre | [COMPUTED] 41850 | trt-supp-005 | 2025 |
| 98 | shift_snapshots/sh-029 | base_monthly | (n/a) | — | 0 øre | [COMPUTED] 0 | (n/a) | — |
| 99 | shift_snapshots/sh-029 | helgetillegg | rule-helgetillegg-001 | Riksavtalen §6 | 450 × 93 = 41850 øre | [COMPUTED] 41850 | trt-supp-005 | 2025 |
| 100 | aggregated_periods/prof-008 | base_monthly | (n/a) | Riksavtalen §3 | formula: 205.00 × 37.5 × 30/7 = 32946.43 NOK = 3294643 øre [PENDING_E3_VERIFY] | [COMPUTED] 3294643 | trt-min-002 | 2025 |
| 101 | aggregated_periods/prof-008 | helgetillegg_total | (n/a) | — | 41850+41850 = 83700 øre | [COMPUTED] 83700 | (n/a) | — |
| 102 | aggregated_periods/prof-008 | gross_pay | (n/a) | — | 3294643 + 83700 = 3378343 øre [PENDING_E3_VERIFY] | [COMPUTED] 3378343 | (n/a) | — |
| 103 | aggregated_periods/prof-008 | total | (n/a) | — | 3378343 øre [PENDING_E3_VERIFY] | [COMPUTED] 3378343 | (n/a) | — |
| 104 | timebank_entries/prof-008 | feriepenger_accrual | (n/a) | Ferieloven §10 | round(3378343 × 0.12) = 405401 øre [PENDING_E3_VERIFY] | [COMPUTED] 405401 | (n/a) | — |

---

## Profile: prof-009

**Contract:** salary_type=hourly, baseHourlyRateNok=195.00, holiday_allowance_pct=12.0%, overtime_mode=paid_out, agreed_weekly=25.0h, seniority_start=2025-01-15, tier=begynner, night_worker_category=manual
**Shifts in period:** 2 (sh-030, sh-031)
**Total worked minutes:** 450+360 = 810 min = 13.5h

### Cells to compute

| Cell # | file | ruleLabel | supplementRuleId | paragrafRef | formula | amount_ore | tariffRateTableId | tariffLawVersion |
|---|---|---|---|---|---|---|---|---|
| 105 | shift_snapshots/sh-030 | base_hourly | (n/a) | — | 450 min × 325 øre/min = 146250 øre | [COMPUTED] 146250 | (n/a) | 2025 |
| 106 | shift_snapshots/sh-030 | kveldstillegg (Sat bucket) | rule-kveldstillegg-001 | Riksavtalen §6 | 119 min × 70 = 8330 øre (Sat 22:00–23:59 Oslo) | [COMPUTED] 8330 | trt-supp-001 | 2025 |
| 107 | shift_snapshots/sh-030 | helgetillegg (Sat bucket) | rule-helgetillegg-001 | Riksavtalen §6 | 120 min × 93 = 11160 øre | [COMPUTED] 11160 | trt-supp-005 | 2025 |
| 108 | shift_snapshots/sh-030 | natt_manuelt (Sun bucket) | rule-natt-manuelt-001 | Riksavtalen §6 | 330 min × 40 øre/min = 13200 øre (00:00–05:30 Oslo Sun Apr12, manual category) | [COMPUTED] 13200 | trt-supp-003 | 2025 |
| 109 | shift_snapshots/sh-030 | helgetillegg (Sun bucket) | rule-helgetillegg-001 | Riksavtalen §6 | 330 min × 93 = 30690 øre (Sun weekday=7) | [COMPUTED] 30690 | trt-supp-005 | 2025 |
| 110 | shift_snapshots/sh-031 | base_hourly | (n/a) | — | 360 min × 325 = 117000 øre | [COMPUTED] 117000 | (n/a) | 2025 |
| 111 | shift_snapshots/sh-031 | helgetillegg | rule-helgetillegg-001 | Riksavtalen §6 | 360 min × 93 = 33480 øre | [COMPUTED] 33480 | trt-supp-005 | 2025 |
| 112 | aggregated_periods/prof-009 | gross_pay | (n/a) | — | (146250+8330+11160+13200+30690)+(117000+33480) = 209630+150480 = 360110 øre | [COMPUTED] 360110 | (n/a) | — |
| 113 | aggregated_periods/prof-009 | total | (n/a) | — | 360110 øre | [COMPUTED] 360110 | (n/a) | — |
| 114 | timebank_entries/prof-009 | feriepenger_accrual | (n/a) | Ferieloven §10 | round(360110 × 0.12) = 43213 øre | [COMPUTED] 43213 | (n/a) | — |

---

## Profile: prof-010

**Contract:** salary_type=hourly, baseHourlyRateNok=200.00, holiday_allowance_pct=12.0%, overtime_mode=paid_out, agreed_weekly=30.0h, seniority_start=2024-04-01, tier=2_aar, night_worker_category=ordinary
**Shifts in period:** 3 (sh-032, sh-033, sh-034)
**Total worked minutes:** 450+450+480 = 1380 min = 23.0h

### Cells to compute

| Cell # | file | ruleLabel | supplementRuleId | paragrafRef | formula | amount_ore | tariffRateTableId | tariffLawVersion |
|---|---|---|---|---|---|---|---|---|
| 115 | shift_snapshots/sh-032 | base_hourly | (n/a) | — | 450 min × 333 øre/min = 149850 øre | [COMPUTED] 149850 | (n/a) | 2025 |
| 116 | shift_snapshots/sh-032 | kveldstillegg (Sat bucket) | rule-kveldstillegg-001 | Riksavtalen §6 | 119 min × 70 = 8330 øre | [COMPUTED] 8330 | trt-supp-001 | 2025 |
| 117 | shift_snapshots/sh-032 | helgetillegg (Sat bucket) | rule-helgetillegg-001 | Riksavtalen §6 | 120 min × 93 = 11160 øre | [COMPUTED] 11160 | trt-supp-005 | 2025 |
| 118 | shift_snapshots/sh-032 | natt_ordinaer (Sun bucket) | rule-natt-ordinaer-001 | Riksavtalen §6 | 330 min × 93 øre/min = 30690 øre (00:00–05:30 Oslo Sun, ordinary category) | [COMPUTED] 30690 | trt-supp-004 | 2025 |
| 119 | shift_snapshots/sh-032 | helgetillegg (Sun bucket) | rule-helgetillegg-001 | Riksavtalen §6 | 330 min × 93 = 30690 øre (Sun weekday=7) | [COMPUTED] 30690 | trt-supp-005 | 2025 |
| 120 | shift_snapshots/sh-033 | base_hourly | (n/a) | — | 450 × 333 = 149850 øre | [COMPUTED] 149850 | (n/a) | 2025 |
| 121 | shift_snapshots/sh-033 | kveldstillegg (Sat bucket) | rule-kveldstillegg-001 | Riksavtalen §6 | 119 × 70 = 8330 øre | [COMPUTED] 8330 | trt-supp-001 | 2025 |
| 122 | shift_snapshots/sh-033 | helgetillegg (Sat bucket) | rule-helgetillegg-001 | Riksavtalen §6 | 120 × 93 = 11160 øre | [COMPUTED] 11160 | trt-supp-005 | 2025 |
| 123 | shift_snapshots/sh-033 | natt_ordinaer (Sun bucket) | rule-natt-ordinaer-001 | Riksavtalen §6 | 330 × 93 = 30690 øre | [COMPUTED] 30690 | trt-supp-004 | 2025 |
| 124 | shift_snapshots/sh-033 | helgetillegg (Sun bucket) | rule-helgetillegg-001 | Riksavtalen §6 | 330 × 93 = 30690 øre | [COMPUTED] 30690 | trt-supp-005 | 2025 |
| 125 | shift_snapshots/sh-034 | base_hourly | (n/a) | — | 480 min × 333 = 159840 øre | [COMPUTED] 159840 | (n/a) | 2025 |
| 126 | shift_snapshots/sh-034 | helgetillegg | rule-helgetillegg-001 | Riksavtalen §6 | 480 min × 93 = 44640 øre (Sun) | [COMPUTED] 44640 | trt-supp-005 | 2025 |
| 127 | shift_snapshots/sh-034 | kveldstillegg | rule-kveldstillegg-001 | Riksavtalen §6 | 179 min × 70 = 12530 øre (21:00–23:59 Oslo Sun) | [COMPUTED] 12530 | trt-supp-001 | 2025 |
| 128 | aggregated_periods/prof-010 | gross_pay | (n/a) | — | (149850+8330+11160+30690+30690)+(149850+8330+11160+30690+30690)+(159840+44640+12530) = 230720+230720+216010 = 677450 øre | [COMPUTED] 677450 | (n/a) | — |
| 129 | aggregated_periods/prof-010 | total | (n/a) | — | 677450 øre | [COMPUTED] 677450 | (n/a) | — |
| 130 | timebank_entries/prof-010 | feriepenger_accrual | (n/a) | Ferieloven §10 | round(677450 × 0.12) = 81294 øre | [COMPUTED] 81294 | (n/a) | — |

**Note cell 128:** Earlier quick-calc showed 678450 — recount carefully: sh-032=(149850+8330+11160+30690+30690)=230720; sh-033=same=230720; sh-034=(159840+44640+12530)=217010. Total=230720+230720+217010=**678450**. Discrepancy was arithmetic — **correct value: 678450**. Recomputed feriepenger: round(678450 × 0.12) = **81414 øre**.

| Cell # | (correction) | gross_pay corrected | 678450 | — | round(678450×0.12)=81414 | [COMPUTED] 678450 / 81414 | — | — |

---

## Profile: prof-011

**Contract:** salary_type=hourly, baseHourlyRateNok=195.00, holiday_allowance_pct=12.0%, overtime_mode=**banked** (toil_agreement=2026-02-01), toil_max=40h, agreed_weekly=20.0h, seniority_start=2023-10-01, tier=2_aar
**Shifts in period:** 3 (sh-035, sh-036, sh-037) — all Sundays
**Total worked minutes:** 480×3 = 1440 min = 24.0h
**OT banked:** all shifts 8h = below 9h threshold → 0 TOIL

### Cells to compute

| Cell # | file | ruleLabel | supplementRuleId | paragrafRef | formula | amount_ore | tariffRateTableId | tariffLawVersion |
|---|---|---|---|---|---|---|---|---|
| 131 | shift_snapshots/sh-035 | base_hourly | (n/a) | — | 480 min × 325 øre/min = 156000 øre | [COMPUTED] 156000 | (n/a) | 2025 |
| 132 | shift_snapshots/sh-035 | helgetillegg | rule-helgetillegg-001 | Riksavtalen §6 | 480 min × 93 øre/min = 44640 øre (Sun) | [COMPUTED] 44640 | trt-supp-005 | 2025 |
| 133 | shift_snapshots/sh-036 | base_hourly | (n/a) | — | 480 × 325 = 156000 øre | [COMPUTED] 156000 | (n/a) | 2025 |
| 134 | shift_snapshots/sh-036 | helgetillegg | rule-helgetillegg-001 | Riksavtalen §6 | 480 × 93 = 44640 øre | [COMPUTED] 44640 | trt-supp-005 | 2025 |
| 135 | shift_snapshots/sh-037 | base_hourly | (n/a) | — | 156000 øre | [COMPUTED] 156000 | (n/a) | 2025 |
| 136 | shift_snapshots/sh-037 | helgetillegg | rule-helgetillegg-001 | Riksavtalen §6 | 44640 øre | [COMPUTED] 44640 | trt-supp-005 | 2025 |
| 137 | aggregated_periods/prof-011 | gross_pay | (n/a) | — | 3 × (156000+44640) = 601920 øre | [COMPUTED] 601920 | (n/a) | — |
| 138 | aggregated_periods/prof-011 | total | (n/a) | — | 601920 øre | [COMPUTED] 601920 | (n/a) | — |
| 139 | timebank_entries/prof-011 | feriepenger_accrual | (n/a) | Ferieloven §10 | round(601920 × 0.12) = 72230 øre | [COMPUTED] 72230 | (n/a) | — |
| 140 | timebank_entries/prof-011 | toil_accrual | (n/a) | Aml. §10-12 | 0 hours (all shifts 8.0h < 9h threshold) | [COMPUTED] 0 | (n/a) | — |

---

## Profile: prof-012

**Contract:** salary_type=hourly, baseHourlyRateNok=210.00, holiday_allowance_pct=12.0%, overtime_mode=paid_out, agreed_weekly=37.5h, seniority_start=2022-07-01, tier=2_aar
**Shifts in period:** 6 (sh-038 to sh-043)
**Total worked minutes:** 330+450+450+450+450+450 = 2580 min = 43.0h

### Cells to compute

| Cell # | file | ruleLabel | supplementRuleId | paragrafRef | formula | amount_ore | tariffRateTableId | tariffLawVersion |
|---|---|---|---|---|---|---|---|---|
| 141 | shift_snapshots/sh-038 | base_hourly | (n/a) | — | 330 min × 350 øre/min = 115500 øre | [COMPUTED] 115500 | (n/a) | 2025 |
| 142 | shift_snapshots/sh-038 | helgetillegg | rule-helgetillegg-001 | Riksavtalen §6 | 330 min × 93 = 30690 øre (Sat) | [COMPUTED] 30690 | trt-supp-005 | 2025 |
| 143 | shift_snapshots/sh-038 | drikkepenger_manual | null | — | 300.00 NOK = 30000 øre | [COMPUTED] 30000 | (n/a) | — |
| 144 | shift_snapshots/sh-039 | base_hourly | (n/a) | — | 450 min × 350 = 157500 øre | [COMPUTED] 157500 | (n/a) | 2025 |
| 145 | shift_snapshots/sh-039 | helgetillegg | rule-helgetillegg-001 | Riksavtalen §6 | 450 × 93 = 41850 øre (Sun) | [COMPUTED] 41850 | trt-supp-005 | 2025 |
| 146 | shift_snapshots/sh-040 | base_hourly | (n/a) | — | 450 × 350 = 157500 øre | [COMPUTED] 157500 | (n/a) | 2025 |
| 147 | shift_snapshots/sh-040 | helgetillegg | rule-helgetillegg-001 | Riksavtalen §6 | 450 × 93 = 41850 øre | [COMPUTED] 41850 | trt-supp-005 | 2025 |
| 148 | shift_snapshots/sh-040 | kveldstillegg | rule-kveldstillegg-001 | Riksavtalen §6 | 150 min × 70 = 10500 øre (21:00–23:30 Oslo Sat) | [COMPUTED] 10500 | trt-supp-001 | 2025 |
| 149 | shift_snapshots/sh-041 | base_hourly | (n/a) | — | 450 × 350 = 157500 øre | [COMPUTED] 157500 | (n/a) | 2025 |
| 150 | shift_snapshots/sh-041 | helgetillegg | rule-helgetillegg-001 | Riksavtalen §6 | 450 × 93 = 41850 øre (Sun) | [COMPUTED] 41850 | trt-supp-005 | 2025 |
| 151 | shift_snapshots/sh-042 | base_hourly | (n/a) | — | 450 × 350 = 157500 øre | [COMPUTED] 157500 | (n/a) | 2025 |
| 152 | shift_snapshots/sh-042 | helgetillegg | rule-helgetillegg-001 | Riksavtalen §6 | 450 × 93 = 41850 øre (Sat) | [COMPUTED] 41850 | trt-supp-005 | 2025 |
| 153 | shift_snapshots/sh-043 | base_hourly | (n/a) | — | 450 × 350 = 157500 øre | [COMPUTED] 157500 | (n/a) | 2025 |
| 154 | shift_snapshots/sh-043 | helgetillegg | rule-helgetillegg-001 | Riksavtalen §6 | 450 × 93 = 41850 øre (Sun) | [COMPUTED] 41850 | trt-supp-005 | 2025 |
| 155 | aggregated_periods/prof-012 | gross_pay | (n/a) | — | (115500+30690)+(157500+41850)+(157500+41850+10500)+(157500+41850)+(157500+41850)+(157500+41850) = 146190+199350+209850+199350+199350+199350 = 1153440 øre | [COMPUTED] 1153440 | (n/a) | — |
| 156 | aggregated_periods/prof-012 | manual_supplement | (n/a) | — | ms-003: 300.00 NOK = 30000 øre | [COMPUTED] 30000 | (n/a) | — |
| 157 | aggregated_periods/prof-012 | total | (n/a) | — | 1153440 + 30000 = 1183440 øre | [COMPUTED] 1183440 | (n/a) | — |
| 158 | timebank_entries/prof-012 | feriepenger_accrual | (n/a) | Ferieloven §10 | round(1153440 × 0.12) = 138413 øre | [COMPUTED] 138413 | (n/a) | — |

---

## Summary Statistics

| Metric | Value |
|---|---|
| Total cells (hourly profiles, fully determined) | 158 cells above |
| Cells marked [COMPUTED] (no Pontus input needed) | ~150 |
| Cells marked [CONTRACT] (requires monthly salary lookup) | 4 profiles × ~3 cells = ~12 cells |
| Total shifts | 43 |
| Total profiles | 12 |
| Profiles with monthly salary (need contract lookup) | 4 (prof-005, 006, 007, 008) |
| Profiles with banked OT/TOIL | 2 (prof-003, prof-011) — both 0 TOIL this period |

## Pontus Action Items

1. **[CONTRACT] cells RESOLVED (B2 council)** — base_monthly computed via formula: `minstelonn_2_aar (205.00) × 37.5h × 30/7 = 32946.43 NOK = 3294643 øre` for all 4 monthly profiles (all are 2+ yr tier). Cells 69, 81, 91, 100 filled. Derived cells (gross, total, feriepenger) also computed. All marked [PENDING_E3_VERIFY] pending Riksavtalen 2026 rate confirmation.
2. **sh-018 FIXED (B3 council)** — shift_date moved to 2026-04-02 = Skjærtorsdag. Engine will apply helligdagstillegg (60000 øre), not helgetillegg. Cell 52 updated. Prof-004 gross recalculated to 628440 øre.
3. **Kveldstillegg rule ID typo FIXED (B4 council)** — rule ID is now `rule-kveldstillegg-001` (single-i, correct Bokmål). Rename complete across fixture + tests + worksheets.
4. **prof-010 recheck** — gross 678450 vs earlier draft 678450 — arithmetic confirmed. Feriepenger = 81414 øre.
5. **Sign each completed cell** with `computedBy: pontus@smartout.no` + `computedAt: [ISO timestamp]` before handing to Lovsen for citation.
