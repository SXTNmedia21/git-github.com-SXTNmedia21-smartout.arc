---
title: "Golden-Month Shift Inventory — April 2026"
status: draft
updated: 2026-05-16
created: 2026-05-16
module: payroll
tags: [payroll, golden-month, worksheet, shift-inventory]
---

# 00 — Shift Inventory

**Period:** April 2026 (2026-04-01 – 2026-04-30)
**Workspace:** ws-golden-001 (is_tariff_bound=true, stacking=category_exclusive)
**Actual shift count: 43** (matches ADR-0341 claim of 43 shifts — exact match)
**Profile count: 12** (matches ADR-0341 claim of 12 profiles — exact match)

## sh-018 Date Correction (B3 council)

**sh-018** was previously shift_date=2026-04-04 (Saturday) with a misleading `_note: "Skjærtorsdag"`.
**Fixed per B3 council:** shift_date moved to 2026-04-02, the actual Skjærtorsdag.
Public holidays in fixture: 2026-04-02 (Skjærtorsdag), 2026-04-03 (Langfredag), 2026-04-05 (1. påskedag), 2026-04-06 (2. påskedag).
2026-04-02 = Thursday. Engine classifies this as `holiday` → helligdagstillegg applies (not helgetillegg).
This gives rule-helligdag-001 its first regression coverage in the golden-month fixture.

## Tariff Context

All times are UTC. Oslo is CEST (UTC+2) for all April 2026. Key conversion:
- Oslo 21:00 = UTC 19:00, Oslo 23:59 = UTC 21:59, Oslo 00:00 = UTC 22:00 (previous calendar day)
- Kveldstillegg window: Oslo 21:00–23:59 (1260–1439 min since midnight Oslo)
- Nattillegg window: Oslo 00:00–06:00 (0–360 min since midnight Oslo)

interpret-shift.ts subtracts unpaid breaks from the **end** of the shift for bucket-building.
`punch_rounding_minutes=0` → no rounding applied in this fixture.

## Supplement Rules (from rules.json)

| rule_id | type | rate | tariff_rate_table_id | paragraf |
|---|---|---|---|---|
| rule-kveldstillegg-001 | normal | 42.41 kr/t | trt-supp-001 | Riksavtalen §6 |
| rule-natt-nattvakt-001 | normal | 42.41 kr/t | trt-supp-002 | Riksavtalen §6 |
| rule-natt-manuelt-001 | normal | 24.01 kr/t | trt-supp-003 | Riksavtalen §6 |
| rule-natt-ordinaer-001 | normal | 56.02 kr/t | trt-supp-004 | Riksavtalen §6 |
| rule-helgetillegg-001 | week_based | 56.02 kr/t | trt-supp-005 | Riksavtalen §6 |
| rule-helligdag-001 | holiday | 100.00 kr/t | trt-supp-006 | Riksavtalen §6 |

**Note on rule ID typo:** `rule-kveldstillegg-001` has double-i — this is the actual ID in rules.json.

**Stacking logic (category_exclusive):** Within same supplement_type, only highest fires. Different types stack freely. Practical effect:
- `normal` + `week_based` → both fire (kveldstillegg + helgetillegg CAN stack)
- `normal` + `holiday` → both fire
- `week_based` + `holiday` → both fire
- Two `normal` rules on same bucket → only highest fires (relevant when natt + kveld might overlap — but natt fires only if null:no 00:00-06:00 falls outside 21:00-23:59, so they cannot co-fire on same minute)

## Øre/Minute Rates

| Rate NOK/t | Øre/t | Øre/min (floor) |
|---|---|---|
| 42.41 | 4241 | 70 |
| 56.02 | 5602 | 93 |
| 24.01 | 2401 | 40 |
| 100.00 | 10000 | 166 |
| 195.00 | 19500 | 325 |
| 200.00 | 20000 | 333 |
| 210.00 | 21000 | 350 |
| 215.00 | 21500 | 358 |
| 220.00 | 22000 | 366 |

Formula: `orePerMin = floor(round(rate_nok × 100) / 60)` — bigint floor division per cents.ts.

---

## Shift Table (43 rows)

Columns: shift_id | profile_id | date (Oslo) | start UTC | end UTC | break_min | worked_min | day_type | time_buckets | applicable_supplements | timebank_emissions | deviations

### prof-001 (hourly, 215 NOK/h, paid_out OT, seniority 2022-01-15, tier=4_aar)

| shift_id | date | start UTC | end UTC | break_min | worked_min | day_type | time_buckets (Oslo) | supplements | timebank |
|---|---|---|---|---|---|---|---|---|---|
| sh-001 | 2026-04-07 Tue | 06:00 | 14:00 | 30 | 450 | weekday | day_normal 06:00–13:30 Oslo (450 min) | none | feriepenger accrual at period end |
| sh-002 | 2026-04-08 Wed | 13:00 | 23:00 | 30 | 570 | weekday | day_normal 15:00–21:00 Oslo (360 min); evening 21:00–23:59 Oslo (179 min); night 00:00–00:30 Oslo Thu (30 min, no natt — category=null) | kveldstillegg 179 min | — |
| sh-003 | 2026-04-11 Sat | 04:00 | 14:30 | 30 | 600 | saturday | weekend_sat 06:00–16:00 Oslo (600 min) | helgetillegg 600 min | W02 warning (10.0h) |
| sh-004 | 2026-04-14 Tue | 06:00 | 18:30 | 30 | 720 | weekday | day_normal 08:00–20:00 Oslo (720 min) | none | W02 warning (12.0h) |
| sh-005 | 2026-04-18 Sat | 06:00 | 14:00 | 30 | 450 | saturday | weekend_sat 08:00–15:30 Oslo (450 min) | helgetillegg 450 min | — |
| sh-006 | 2026-04-25 Sat | 06:00 | 14:00 | 30 | 450 | saturday | weekend_sat 08:00–15:30 Oslo (450 min) | helgetillegg 450 min | — |

### prof-002 (hourly, 200 NOK/h, paid_out OT, seniority 2023-06-01, tier=2_aar)

| shift_id | date | start UTC | end UTC | break_min | worked_min | day_type | time_buckets (Oslo) | supplements | deviations |
|---|---|---|---|---|---|---|---|---|---|
| sh-007 | 2026-04-07 Tue | 14:00 | 22:30 | 30 | 480 | weekday | day_normal 16:00–21:00 Oslo (300 min); evening 21:00–00:00 Oslo Wed (179 min); [midnight exactly = 0 min night] | kveldstillegg 179 min | — |
| sh-008 | 2026-04-08 Wed | 22:00 | +09T07:30 | 30 | 540 | weekday (Thu) | night [Oslo 00:00–06:00 Thu Apr9, 360 min, category=null → no nattillegg]; day_normal 06:00–09:00 Oslo Thu (180 min) | none (category=null) | — |
| sh-009 | 2026-04-09 Thu | 16:30 | +10T02:00 | 30 | 540 | weekday | day_normal 18:30–21:00 Oslo Thu (150 min); evening 21:00–23:59 Oslo Thu (179 min); night 00:00–03:30 Oslo Fri (210 min, category=null) | kveldstillegg 179 min | W01 ERROR (9.0h rest after sh-008) |
| sh-010 | 2026-04-11 Sat | 06:00 | 18:00 | 30 | 690 | saturday | weekend_sat 08:00–19:30 Oslo (690 min) | helgetillegg 690 min | W02 warning (11.5h) |
| sh-011 | 2026-04-18 Sat | 06:00 | 14:00 | 30 | 450 | saturday | weekend_sat 08:00–15:30 Oslo (450 min) | helgetillegg 450 min | — |
| sh-012 | 2026-04-25 Sat | 14:00 | 22:00 | 0 | 480 | saturday | weekend_sat 16:00–00:00 Oslo Sun (480 min); [midnight exactly=Sun] | helgetillegg 480 min; kveldstillegg 179 min (21:00–23:59 Oslo Sat, both types stack) | — |

### prof-003 (hourly, 220 NOK/h, banked OT, night_watch, seniority 2021-03-01, tier=4_aar)

| shift_id | date | start UTC | end UTC | break_min | worked_min | day_type | time_buckets (Oslo) | supplements | notes |
|---|---|---|---|---|---|---|---|---|---|
| sh-013 | 2026-04-04 Sat → 05 Sun HOLIDAY | 20:00 | +05T04:00 | 30 | 450 | saturday+holiday | Sat [22:00–00:00 Oslo, 120 min]: kveldstillegg 119 min (21:00–23:59) + helgetillegg 120 min; Holiday [00:00–05:30 Oslo Apr5, 330 min]: natt_nattvakt 330 min + helgetillegg 330 min (Sun=7) + helligdag 330 min | ALL 3 types stack on holiday bucket | BANKED shift but 450 min = 7.5h < 9h → no TOIL |
| sh-014 | 2026-04-07 Tue (→ Wed) | 22:00 | +08T06:00 | 30 | 450 | weekday (Wed) | night [00:00–06:00 Oslo Wed Apr8, 360 min]: natt_nattvakt fires; day_normal [06:00–07:30 Oslo Wed, 90 min] | natt_nattvakt 360 min | — |
| sh-015 | 2026-04-14 Tue (→ Wed) | 22:00 | +15T06:00 | 30 | 450 | weekday (Wed) | night 00:00–06:00 Oslo Wed (360 min); day_normal 06:00–07:30 Oslo Wed (90 min) | natt_nattvakt 360 min | — |
| sh-016 | 2026-04-21 Tue (→ Wed) | 22:00 | +22T06:00 | 30 | 450 | weekday (Wed) | same as sh-014/015 | natt_nattvakt 360 min | — |
| sh-017 | 2026-04-28 Tue (→ Wed) | 22:00 | +29T06:00 | 30 | 450 | weekday (Wed) | same as sh-014/015 | natt_nattvakt 360 min | — |

### prof-004 (hourly, 195 NOK/h, paid_out OT, part-time 20h/wk, seniority 2024-09-01, tier=begynner)

| shift_id | date | start UTC | end UTC | break_min | worked_min | day_type | supplements | notes |
|---|---|---|---|---|---|---|---|---|
| sh-018 | 2026-04-02 **Thu Skjærtorsdag** (helligdag — B3 corrected from 2026-04-04) | 08:00 | 14:00 | 0 | 360 | **holiday** | helligdagstillegg 360 min | rule-helligdag-001 coverage |
| sh-019 | 2026-04-11 Sat | 08:00 | 14:00 | 0 | 360 | saturday | helgetillegg 360 min | — |
| sh-020 | 2026-04-18 Sat | 08:00 | 14:00 | 0 | 360 | saturday | helgetillegg 360 min | — |
| sh-021 | 2026-04-25 Sat | 08:00 | 14:00 | 0 | 360 | saturday | helgetillegg 360 min | — |

### prof-005 (monthly salary, baseHourlyRateNok=0, paid_out OT, seniority 2020-05-01, tier=4_aar)

| shift_id | date | start UTC | end UTC | break_min | worked_min | day_type | supplements | notes |
|---|---|---|---|---|---|---|---|---|
| sh-022 | 2026-04-11 Sat | 12:00 | 22:00 | 30 | 570 | saturday | helgetillegg 570 min; kveldstillegg 150 min (21:00–23:30 Oslo) | base=0 per shift; monthly gross from contract |
| sh-023 | 2026-04-18 Sat | 12:00 | 22:00 | 30 | 570 | saturday | helgetillegg 570 min; kveldstillegg 150 min | same pattern |

### prof-006 (monthly salary, has_fagbrev=true, 12.5% holiday, paid_out OT, seniority 2016-08-01, tier=8_aar)

| shift_id | date | start UTC | end UTC | break_min | worked_min | day_type | supplements | deviations |
|---|---|---|---|---|---|---|---|---|
| sh-024 | 2026-04-11 Sat | 08:00 | 20:30 | 60 | 690 | saturday | helgetillegg 690 min; kveldstillegg 30 min (21:00–21:30 Oslo) | W02 warning (11.5h) |
| sh-025 | 2026-04-25 Sat | 08:00 | 18:00 | 60 | 540 | saturday | helgetillegg 540 min | — |

### prof-007 (monthly salary, paid_out OT, seniority 2019-02-15, tier=6_aar)

| shift_id | date | start UTC | end UTC | break_min | worked_min | day_type | supplements | deviations |
|---|---|---|---|---|---|---|---|---|
| sh-026 | 2026-04-11 Sat | 06:00 | 17:30 | 30 | 660 | saturday | helgetillegg 660 min | W02 warning (11.0h) |
| sh-027 | 2026-04-18 Sat | 06:00 | 14:00 | 30 | 450 | saturday | helgetillegg 450 min | — |

### prof-008 (monthly salary, paid_out OT, seniority 2018-11-01, tier=6_aar)

| shift_id | date | start UTC | end UTC | break_min | worked_min | day_type | supplements | notes |
|---|---|---|---|---|---|---|---|---|
| sh-028 | 2026-04-11 Sat | 06:00 | 14:00 | 30 | 450 | saturday | helgetillegg 450 min | — |
| sh-029 | 2026-04-18 Sat | 06:00 | 14:00 | 30 | 450 | saturday | helgetillegg 450 min | — |

### prof-009 (hourly, 195 NOK/h, paid_out OT, night_worker=manual, seniority 2025-01-15, tier=begynner)

| shift_id | date | start UTC | end UTC | break_min | worked_min | day_type | time_buckets (Oslo) | supplements |
|---|---|---|---|---|---|---|---|---|
| sh-030 | 2026-04-11 Sat → 12 Sun | 20:00 | +12T04:00 | 30 | 450 | saturday+sunday | Sat [22:00–00:00 Oslo, 120 min]: kveldstillegg 119 min + helgetillegg 120 min; Sun [00:00–05:30 Oslo Apr12, 330 min]: natt_manuelt 330 min + helgetillegg 330 min | All stack (different types) |
| sh-031 | 2026-04-18 Sat | 06:00 | 12:00 | 0 | 360 | saturday | weekend_sat 08:00–14:00 Oslo (360 min) | helgetillegg 360 min |

### prof-010 (hourly, 200 NOK/h, paid_out OT, night_worker=ordinary, seniority 2024-04-01, tier=2_aar)

| shift_id | date | start UTC | end UTC | break_min | worked_min | day_type | time_buckets (Oslo) | supplements | deviations |
|---|---|---|---|---|---|---|---|---|---|
| sh-032 | 2026-04-11 Sat → 12 Sun | 20:00 | +12T04:00 | 30 | 450 | saturday+sunday | Sat [22:00–00:00 Oslo, 120 min]: kveldstillegg 119 min + helgetillegg 120 min; Sun [00:00–05:30 Oslo Apr12, 330 min]: natt_ordinaer 330 min + helgetillegg 330 min | All stack | — |
| sh-033 | 2026-04-18 Sat → 19 Sun | 20:00 | +19T04:00 | 30 | 450 | saturday+sunday | same as sh-032 | same supplements | — |
| sh-034 | 2026-04-19 Sun | 14:00 | 22:00 | 0 | 480 | sunday | weekend_sun 16:00–00:00 Oslo (480 min) | helgetillegg 480 min; kveldstillegg 179 min (21:00–23:59 Oslo Sun) | W01 ERROR (10h rest after sh-033) |

### prof-011 (hourly, 195 NOK/h, banked OT, seniority 2023-10-01, tier=2_aar)

| shift_id | date | start UTC | end UTC | break_min | worked_min | day_type | supplements | notes |
|---|---|---|---|---|---|---|---|---|
| sh-035 | 2026-04-12 Sun | 06:00 | 14:00 | 0 | 480 | sunday | helgetillegg 480 min | 8.0h < 9h → no TOIL |
| sh-036 | 2026-04-19 Sun | 06:00 | 14:00 | 0 | 480 | sunday | helgetillegg 480 min | — |
| sh-037 | 2026-04-26 Sun | 06:00 | 14:00 | 0 | 480 | sunday | helgetillegg 480 min | — |

### prof-012 (hourly, 210 NOK/h, paid_out OT, seniority 2022-07-01, tier=2_aar)

| shift_id | date | start UTC | end UTC | break_min | worked_min | day_type | supplements |
|---|---|---|---|---|---|---|---|
| sh-038 | 2026-04-11 Sat | 08:00 | 14:00 | 30 | 330 | saturday | helgetillegg 330 min |
| sh-039 | 2026-04-12 Sun | 08:00 | 16:00 | 30 | 450 | sunday | helgetillegg 450 min |
| sh-040 | 2026-04-18 Sat | 14:00 | 22:00 | 30 | 450 | saturday | helgetillegg 450 min; kveldstillegg 150 min (21:00–23:30 Oslo) |
| sh-041 | 2026-04-19 Sun | 08:00 | 16:00 | 30 | 450 | sunday | helgetillegg 450 min |
| sh-042 | 2026-04-25 Sat | 06:00 | 14:00 | 30 | 450 | saturday | helgetillegg 450 min |
| sh-043 | 2026-04-26 Sun | 08:00 | 16:00 | 30 | 450 | sunday | helgetillegg 450 min |

---

## Manual Supplements

| id | shift_id | profile_id | amount NOK | salary_code | supplement_rule_id |
|---|---|---|---|---|---|
| ms-001 | sh-001 | prof-001 | 150.00 | drikkepenger | null |
| ms-002 | sh-007 | prof-002 | 200.00 | drikkepenger | null |
| ms-003 | sh-038 | prof-012 | 300.00 | drikkepenger | null |
| ms-004 | sh-022 | prof-005 | 175.00 | drikkepenger | null |

## Expected Deviations

| check | severity | profile | shift | description |
|---|---|---|---|---|
| W01 | ERROR | prof-002 | sh-009 | 9.0h rest after sh-008 (Aml. §10-8 requires ≥ 11h) |
| W01 | ERROR | prof-010 | sh-034 | 10.0h rest after sh-033 (Aml. §10-8 requires ≥ 11h) |
| W02 | WARNING | prof-001 | sh-003 | 10.0h worked (Aml. §10-4 daily max 9h) |
| W02 | WARNING | prof-001 | sh-004 | 12.0h worked |
| W02 | WARNING | prof-002 | sh-010 | 11.5h worked |
| W02 | WARNING | prof-006 | sh-024 | 11.5h worked |
| W02 | WARNING | prof-007 | sh-026 | 11.0h worked |
