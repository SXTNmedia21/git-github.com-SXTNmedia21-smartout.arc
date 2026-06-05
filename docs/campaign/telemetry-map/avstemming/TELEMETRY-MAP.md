---
title: Telemetry Map — avstemming domain
status: draft
updated: 2026-05-31
created: 2026-05-31
domain: avstemming
tags: [telemetry, avstemming, reconciliation, map]
---

# Telemetry Map — avstemming (reconciliation / day-session)

All interactive elements across the five design files, mapped to telemetry events, backend mutations, and reuse hooks.

Legend:

- **noop**: navigation / filter / visual-only — no backend mutation, no required event
- **MISSING**: event required but not found in `packages/telemetry/src/registry.ts`

---

## Global / Top-level (avstemming.jsx)

| #   | Element                   | Design file:loc    | Type           | Mutation                      | Telemetry event           | In registry? | Reuse hook                     | Noop?     |
| --- | ------------------------- | ------------------ | -------------- | ----------------------------- | ------------------------- | ------------ | ------------------------------ | --------- |
| 1   | **Eksport** button (head) | avstemming.jsx:153 | button/onClick | CSV export of reconciled days | `reconciliation exported` | MISSING      | `_lib/csv-export.ts` (no emit) | no        |
| 2   | Tab: Daglig               | avstemming.jsx:160 | button/onClick | none                          | —                         | —            | —                              | yes (nav) |
| 3   | Tab: Yrke                 | avstemming.jsx:160 | button/onClick | none                          | —                         | —            | —                              | yes (nav) |
| 4   | Tab: Sesong               | avstemming.jsx:160 | button/onClick | none                          | —                         | —            | —                              | yes (nav) |
| 5   | Tab: Handoffs             | avstemming.jsx:160 | button/onClick | none                          | —                         | —            | —                              | yes (nav) |
| 6   | Tab: Innstillinger        | avstemming.jsx:160 | button/onClick | none                          | —                         | —            | —                              | yes (nav) |

---

## DayList — left panel (avstemming-daglig.jsx)

| #   | Element                                  | Design file:loc | Type           | Mutation                                                   | Telemetry event                | In registry? | Reuse hook                                       | Noop?           |
| --- | ---------------------------------------- | --------------- | -------------- | ---------------------------------------------------------- | ------------------------------ | ------------ | ------------------------------------------------ | --------------- |
| 7   | Search input (Søk dag …)                 | daglig.jsx:37   | input/onChange | none                                                       | —                              | —            | —                                                | yes (filter)    |
| 8   | Status filter chip: Alle                 | daglig.jsx:39   | button/onClick | none                                                       | —                              | —            | —                                                | yes (filter)    |
| 9   | Status filter chip: Krever handling      | daglig.jsx:39   | button/onClick | none                                                       | —                              | —            | —                                                | yes (filter)    |
| 10  | Status filter chip: Venter               | daglig.jsx:39   | button/onClick | none                                                       | —                              | —            | —                                                | yes (filter)    |
| 11  | Status filter chip: Låst                 | daglig.jsx:39   | button/onClick | none                                                       | —                              | —            | —                                                | yes (filter)    |
| 12  | Day row select (click to open detail)    | daglig.jsx:62   | div/onClick    | none (UI state)                                            | —                              | —            | —                                                | yes (nav)       |
| 13  | Checkbox (toggle day selection for bulk) | daglig.jsx:64   | span/onClick   | none (UI state)                                            | —                              | —            | —                                                | yes (selection) |
| 14  | **Godkjenn valgte** (bulk bar)           | daglig.jsx:47   | button/onClick | bulk approve → `daily_reconciliation.status=approved` (×N) | `reconciliation bulk_approved` | MISSING      | `useApproveReconciliation` (×N, no bulk variant) | no              |

---

## DayDetail — center panel (avstemming-daglig.jsx)

| #   | Element                                        | Design file:loc | Type           | Mutation                                                     | Telemetry event                                   | In registry?    | Reuse hook                           | Noop?     |
| --- | ---------------------------------------------- | --------------- | -------------- | ------------------------------------------------------------ | ------------------------------------------------- | --------------- | ------------------------------------ | --------- |
| 15  | Detail tab: Oversikt                           | daglig.jsx:146  | button/onClick | none                                                         | —                                                 | —               | —                                    | yes (nav) |
| 16  | Detail tab: Omsetning                          | daglig.jsx:146  | button/onClick | none                                                         | —                                                 | —               | —                                    | yes (nav) |
| 17  | Detail tab: Vakter                             | daglig.jsx:146  | button/onClick | none                                                         | —                                                 | —               | —                                    | yes (nav) |
| 18  | Detail tab: Avvik                              | daglig.jsx:146  | button/onClick | none                                                         | —                                                 | —               | —                                    | yes (nav) |
| 19  | Detail tab: Oppgaver                           | daglig.jsx:146  | button/onClick | none                                                         | —                                                 | —               | —                                    | yes (nav) |
| 20  | Detail tab: Revisjonslogg                      | daglig.jsx:146  | button/onClick | none                                                         | —                                                 | —               | —                                    | yes (nav) |
| 21  | Preflight blocker row (click → jump to tab)    | daglig.jsx:136  | div/onClick    | none                                                         | —                                                 | —               | —                                    | yes (nav) |
| 22  | **Be om avklaring** (action bar)               | daglig.jsx:162  | button/onClick | creates handoff / session_note                               | `handoff submitted`                               | yes (line 2223) | MISSING hook                         | no        |
| 23  | **Avvis** (action bar)                         | daglig.jsx:163  | button/onClick | opens DayReject overlay → `daily_reconciliation.status=open` | `reconciliation admin_action` (action:"rejected") | yes (line 1586) | `useRejectReconciliation`            | no        |
| 24  | **Godkjenn dagen** (action bar, gate-disabled) | daglig.jsx:166  | button/onClick | `daily_reconciliation.status=approved`                       | `reconciliation admin_action` (action:"approved") | yes (line 1586) | `useApproveReconciliation`           | no        |
| 25  | **Lås dag** (action bar, post-approve)         | daglig.jsx:165  | button/onClick | opens DayLock overlay → `daily_reconciliation.status=locked` | `reconciliation locked`                           | yes (line 1623) | `lockDayMutation` (DayDetail.tsx:97) | no        |
| 26  | **Eksporter** (action bar, post-lock)          | daglig.jsx:170  | button/onClick | CSV export of day                                            | `reconciliation exported`                         | MISSING         | `_lib/csv-export.ts` (no emit)       | no        |

### Oversikt tab — Botsson assist widget

| #   | Element                                  | Design file:loc | Type           | Mutation     | Telemetry event                                   | In registry? | Reuse hook                 | Noop?     |
| --- | ---------------------------------------- | --------------- | -------------- | ------------ | ------------------------------------------------- | ------------ | -------------------------- | --------- |
| 27  | **Vis avvik** (Botsson assist, blocking) | daglig.jsx:199  | button/onClick | none (goTab) | —                                                 | —            | —                          | yes (nav) |
| 28  | **Godkjenn** (Botsson assist, clean)     | daglig.jsx:200  | button/onClick | same as #24  | `reconciliation admin_action` (action:"approved") | yes          | `useApproveReconciliation` | no        |

### Omsetning tab

| #   | Element                               | Design file:loc | Type           | Mutation                                                              | Telemetry event                   | In registry? | Reuse hook                            | Noop?               |
| --- | ------------------------------------- | --------------- | -------------- | --------------------------------------------------------------------- | --------------------------------- | ------------ | ------------------------------------- | ------------------- |
| 29  | OCR-bilag thumbnail (click → preview) | daglig.jsx:253  | div/onClick    | toast only (no mutation)                                              | —                                 | —            | —                                     | yes (preview toast) |
| 30  | **Juster manuelt** (revenue adjust)   | daglig.jsx:259  | button/onClick | opens RevenueAdjust overlay → `daily_reconciliation.revenue_*` fields | `reconciliation revenue_adjusted` | MISSING      | MISSING hook (needs useAdjustRevenue) | no                  |

### Vakter tab

| #   | Element                                        | Design file:loc | Type           | Mutation                                                      | Telemetry event               | In registry?    | Reuse hook             | Noop? |
| --- | ---------------------------------------------- | --------------- | -------------- | ------------------------------------------------------------- | ----------------------------- | --------------- | ---------------------- | ----- |
| 31  | **Godkjenn** (shift pending/disputed)          | daglig.jsx:289  | button/onClick | opens ShiftApprove overlay → `shift_approval.status=approved` | `reconciliation admin_action` | yes (line 1586) | `useApproveShiftHours` | no    |
| 32  | **Sliders** (shift approved — re-open approve) | daglig.jsx:290  | button/onClick | opens ShiftApprove overlay                                    | `reconciliation admin_action` | yes             | `useApproveShiftHours` | no    |
| 33  | **Pen** (edit shift hours)                     | daglig.jsx:291  | button/onClick | opens ShiftEdit overlay → `shift_approval.approved_hours`     | `reconciliation admin_action` | yes (line 1586) | `useApproveShiftHours` | no    |
| 34  | **Message** (handoff for disputed shift)       | daglig.jsx:292  | button/onClick | creates handoff for shift                                     | `handoff submitted`           | yes (line 2223) | MISSING hook           | no    |

### Avvik tab

| #   | Element                                          | Design file:loc | Type           | Mutation                                                             | Telemetry event      | In registry?    | Reuse hook            | Noop?        |
| --- | ------------------------------------------------ | --------------- | -------------- | -------------------------------------------------------------------- | -------------------- | --------------- | --------------------- | ------------ |
| 35  | Deviation row expand (click title w/ suggestion) | daglig.jsx:328  | div/onClick    | none                                                                 | —                    | —               | —                     | yes (expand) |
| 36  | **Handoff** button (deviation row)               | daglig.jsx:334  | button/onClick | creates handoff                                                      | `handoff submitted`  | yes             | MISSING hook          | no           |
| 37  | **Løs / Vakt / Bekreft** (deviation resolve)     | daglig.jsx:335  | button/onClick | opens DeviationResolve or ShiftApprove → `deviation.status=resolved` | `deviation resolved` | yes (line 1407) | `useResolveDeviation` | no           |
| 38  | **Godkjenn vakt** (expanded suggestion)          | daglig.jsx:342  | button/onClick | same as #37                                                          | `deviation resolved` | yes             | `useResolveDeviation` | no           |
| 39  | **Handoff** (expanded suggestion)                | daglig.jsx:342  | button/onClick | creates handoff                                                      | `handoff submitted`  | yes             | MISSING hook          | no           |

---

## ContextRail — right panel (avstemming-daglig.jsx)

| #   | Element                                      | Design file:loc | Type        | Mutation       | Telemetry event | In registry? | Reuse hook | Noop?     |
| --- | -------------------------------------------- | --------------- | ----------- | -------------- | --------------- | ------------ | ---------- | --------- |
| 40  | Handoff rail item (click → open handoff tab) | daglig.jsx:420  | div/onClick | none (tab nav) | —               | —            | —          | yes (nav) |

---

## Forms / Overlays (avstemming-forms.jsx)

### F-03 ShiftEdit

| #   | Element                  | Design file:loc | Type              | Mutation                               | Telemetry event               | In registry? | Reuse hook             | Noop?             |
| --- | ------------------------ | --------------- | ----------------- | -------------------------------------- | ----------------------------- | ------------ | ---------------------- | ----------------- |
| 41  | Hours input              | forms.jsx:42    | input/onChange    | none (local state)                     | —                             | —            | —                      | yes (form input)  |
| 42  | Begrunnelse textarea     | forms.jsx:47    | textarea/onChange | none (local state)                     | —                             | —            | —                      | yes (form input)  |
| 43  | Omtvistet toggle         | forms.jsx:49    | label/onClick     | none (local state)                     | —                             | —            | —                      | yes (form toggle) |
| 44  | Avbryt                   | forms.jsx:55    | button/onClick    | none (close)                           | —                             | —            | —                      | yes (close)       |
| 45  | **Lagre timer** (submit) | forms.jsx:57    | button/onClick    | `shift_approval.approved_hours` update | `reconciliation admin_action` | yes          | `useApproveShiftHours` | no                |

### F-04 RevenueAdjust

| #   | Element                      | Design file:loc | Type              | Mutation                                                  | Telemetry event                   | In registry? | Reuse hook   | Noop?            |
| --- | ---------------------------- | --------------- | ----------------- | --------------------------------------------------------- | --------------------------------- | ------------ | ------------ | ---------------- |
| 46  | Total omsetning input        | forms.jsx:78    | input/onChange    | none (local state)                                        | —                                 | —            | —            | yes (form input) |
| 47  | Talt kontant input           | forms.jsx:79    | input/onChange    | none (local state)                                        | —                                 | —            | —            | yes (form input) |
| 48  | Begrunnelse textarea         | forms.jsx:80    | textarea/onChange | none (local state)                                        | —                                 | —            | —            | yes (form input) |
| 49  | Avbryt                       | forms.jsx:82    | button/onClick    | none (close)                                              | —                                 | —            | —            | yes (close)      |
| 50  | **Lagre justering** (submit) | forms.jsx:82    | button/onClick    | `daily_reconciliation.revenue_total, cash_counted` update | `reconciliation revenue_adjusted` | MISSING      | MISSING hook | no               |

### F-05 DeviationResolve

| #   | Element                            | Design file:loc | Type              | Mutation                    | Telemetry event      | In registry? | Reuse hook            | Noop?            |
| --- | ---------------------------------- | --------------- | ----------------- | --------------------------- | -------------------- | ------------ | --------------------- | ---------------- |
| 51  | Løsningsnotat textarea             | forms.jsx:113   | textarea/onChange | none (local state)          | —                    | —            | —                     | yes (form input) |
| 52  | Kostnadseffekt input               | forms.jsx:114   | input/onChange    | none (local state)          | —                    | —            | —                     | yes (form input) |
| 53  | Avbryt                             | forms.jsx:116   | button/onClick    | none (close)                | —                    | —            | —                     | yes (close)      |
| 54  | **Marker løst / Bekreft** (submit) | forms.jsx:116   | button/onClick    | `deviation.status=resolved` | `deviation resolved` | yes          | `useResolveDeviation` | no               |

### F-09 HandoffRequest

| #   | Element                            | Design file:loc | Type              | Mutation                                | Telemetry event     | In registry?    | Reuse hook   | Noop?       |
| --- | ---------------------------------- | --------------- | ----------------- | --------------------------------------- | ------------------- | --------------- | ------------ | ----------- |
| 55  | Omfang radio (day/shift/deviation) | forms.jsx:138   | label/onClick     | none (local state)                      | —                   | —               | —            | yes (form)  |
| 56  | Kanal segmented (chat/telefon)     | forms.jsx:143   | Seg/onChange      | none (local state)                      | —                   | —               | —            | yes (form)  |
| 57  | Kontekst textarea                  | forms.jsx:144   | textarea/onChange | none (local state)                      | —                   | —               | —            | yes (form)  |
| 58  | Frist input                        | forms.jsx:145   | input/onChange    | none (local state)                      | —                   | —               | —            | yes (form)  |
| 59  | Avbryt                             | forms.jsx:147   | button/onClick    | none (close)                            | —                   | —               | —            | yes (close) |
| 60  | **Start handoff** (submit)         | forms.jsx:147   | button/onClick    | insert `session_note` / trigger handoff | `handoff submitted` | yes (line 2223) | MISSING hook | no          |

### F-07 DayReject

| #   | Element                           | Design file:loc | Type              | Mutation                           | Telemetry event                          | In registry? | Reuse hook                | Noop?       |
| --- | --------------------------------- | --------------- | ----------------- | ---------------------------------- | ---------------------------------------- | ------------ | ------------------------- | ----------- |
| 61  | Begrunnelse textarea              | forms.jsx:164   | textarea/onChange | none (local state)                 | —                                        | —            | —                         | yes (form)  |
| 62  | Avbryt                            | forms.jsx:166   | button/onClick    | none (close)                       | —                                        | —            | —                         | yes (close) |
| 63  | **Avvis & send tilbake** (submit) | forms.jsx:166   | button/onClick    | `daily_reconciliation.status=open` | `reconciliation admin_action` (rejected) | yes          | `useRejectReconciliation` | no          |

### F-08 DayLock

| #   | Element                     | Design file:loc | Type           | Mutation                                        | Telemetry event         | In registry? | Reuse hook                           | Noop?       |
| --- | --------------------------- | --------------- | -------------- | ----------------------------------------------- | ----------------------- | ------------ | ------------------------------------ | ----------- |
| 64  | Avbryt                      | forms.jsx:186   | button/onClick | none (close)                                    | —                       | —            | —                                    | yes (close) |
| 65  | **Lås permanent** (confirm) | forms.jsx:186   | button/onClick | `daily_reconciliation.status=locked, locked_at` | `reconciliation locked` | yes          | `lockDayMutation` (DayDetail.tsx:97) | no          |

### F-13 BulkApprove

| #   | Element                    | Design file:loc | Type           | Mutation                                  | Telemetry event                | In registry? | Reuse hook                                     | Noop?       |
| --- | -------------------------- | --------------- | -------------- | ----------------------------------------- | ------------------------------ | ------------ | ---------------------------------------------- | ----------- |
| 66  | Avbryt                     | forms.jsx:233   | button/onClick | none (close)                              | —                              | —            | —                                              | yes (close) |
| 67  | **Godkjenn N dager** (run) | forms.jsx:233   | button/onClick | `daily_reconciliation.status=approved` ×N | `reconciliation bulk_approved` | MISSING      | `useApproveReconciliation` (×N, no bulk event) | no          |

### ShiftApprove (rich)

| #   | Element                                 | Design file:loc | Type              | Mutation                                                            | Telemetry event                      | In registry? | Reuse hook             | Noop?            |
| --- | --------------------------------------- | --------------- | ----------------- | ------------------------------------------------------------------- | ------------------------------------ | ------------ | ---------------------- | ---------------- |
| 68  | Mode radio: Godkjenn beregnet           | forms.jsx:298   | label/onClick     | none (local state)                                                  | —                                    | —            | —                      | yes (form)       |
| 69  | Mode radio: Foreslå ny tid              | forms.jsx:299   | label/onClick     | none (local state)                                                  | —                                    | —            | —                      | yes (form)       |
| 70  | Foreslåtte timer input (propose mode)   | forms.jsx:305   | input/onChange    | none (local state)                                                  | —                                    | —            | —                      | yes (form)       |
| 71  | Melding textarea (propose mode)         | forms.jsx:306   | textarea/onChange | none (local state)                                                  | —                                    | —            | —                      | yes (form)       |
| 72  | Supplement type select                  | forms.jsx:323   | select/onChange   | none (local state)                                                  | —                                    | —            | —                      | yes (form)       |
| 73  | Supplement amount input                 | forms.jsx:326   | input/onChange    | none (local state)                                                  | —                                    | —            | —                      | yes (form)       |
| 74  | **+** (add supplement)                  | forms.jsx:327   | button/onClick    | none (local state append)                                           | —                                    | —            | —                      | yes (local only) |
| 75  | **×** (remove supplement)               | forms.jsx:317   | span/onClick      | none (local state remove)                                           | —                                    | —            | —                      | yes (local only) |
| 76  | Avbryt                                  | forms.jsx:332   | button/onClick    | none (close)                                                        | —                                    | —            | —                      | yes (close)      |
| 77  | **Godkjenn vakt** (approve mode submit) | forms.jsx:335   | button/onClick    | `shift_approval.status=approved`, supplements→`shift_cost_snapshot` | `reconciliation admin_action`        | yes          | `useApproveShiftHours` | no               |
| 78  | **Send forslag** (propose mode submit)  | forms.jsx:336   | button/onClick    | `shift_approval.status=proposed`                                    | `reconciliation shift_proposal_sent` | MISSING      | MISSING hook           | no               |

---

## Yrke wizard (avstemming-more.jsx — RecMore.Yrke)

| #   | Element                                  | Design file:loc | Type           | Mutation                                                         | Telemetry event                      | In registry? | Reuse hook   | Noop?            |
| --- | ---------------------------------------- | --------------- | -------------- | ---------------------------------------------------------------- | ------------------------------------ | ------------ | ------------ | ---------------- |
| 79  | Yrkesgruppe radio (select profession)    | more.jsx:29     | label/onClick  | none (local state)                                               | —                                    | —            | —            | yes (form)       |
| 80  | Periode read-only input                  | more.jsx:34     | input          | none                                                             | —                                    | —            | —            | yes (display)    |
| 81  | **Tilbake** (wizard nav)                 | more.jsx:77     | button/onClick | none                                                             | —                                    | —            | —            | yes (wizard nav) |
| 82  | **Neste** (wizard nav steps 0–2)         | more.jsx:80     | button/onClick | none                                                             | —                                    | —            | —            | yes (wizard nav) |
| 83  | **Lukk perioden** (wizard step 3 submit) | more.jsx:81     | button/onClick | closes occupational period → `shift_cost_snapshot` or equivalent | `reconciliation occupational_closed` | MISSING      | MISSING hook | no               |

---

## Sesong wizard (avstemming-more.jsx — RecMore.Sesong)

| #   | Element                                  | Design file:loc | Type           | Mutation                                | Telemetry event                | In registry? | Reuse hook   | Noop?              |
| --- | ---------------------------------------- | --------------- | -------------- | --------------------------------------- | ------------------------------ | ------------ | ------------ | ------------------ |
| 84  | Season cycle radio (select season)       | more.jsx:109    | label          | none (display only — no onChange)       | —                              | —            | —            | yes (display/noop) |
| 85  | **Tilbake** (wizard nav)                 | more.jsx:170    | button/onClick | none                                    | —                              | —            | —            | yes (wizard nav)   |
| 86  | **Neste** (wizard nav steps 0–3)         | more.jsx:172    | button/onClick | none                                    | —                              | —            | —            | yes (wizard nav)   |
| 87  | Factor toggle (R.Switch) × N             | more.jsx:160    | Switch/onClick | none (local state)                      | —                              | —            | —            | yes (local toggle) |
| 88  | **Lukk sesongen** (wizard step 4 submit) | more.jsx:174    | button/onClick | closes season; updates planning factors | `reconciliation season_closed` | MISSING      | MISSING hook | no                 |

---

## Handoffs inbox (avstemming-more.jsx — RecMore.Handoffs)

| #   | Element                                       | Design file:loc | Type           | Mutation                          | Telemetry event         | In registry? | Reuse hook   | Noop?        |
| --- | --------------------------------------------- | --------------- | -------------- | --------------------------------- | ----------------------- | ------------ | ------------ | ------------ |
| 89  | Filter chip: Alle/Aktive/Venter/Eskalert/Løst | more.jsx:196    | button/onClick | none                              | —                       | —            | —            | yes (filter) |
| 90  | Handoff list row (select handoff)             | more.jsx:204    | div/onClick    | none (UI state)                   | —                       | —            | —            | yes (nav)    |
| 91  | **Godkjenn handoff** (HandoffDetail)          | more.jsx:244    | button/onClick | resolves handoff / `session_note` | `handoff resolved`      | MISSING      | MISSING hook | no           |
| 92  | **Eskaler til telefon**                       | more.jsx:245    | button/onClick | escalate handoff status           | `handoff escalated`     | MISSING      | MISSING hook | no           |
| 93  | **Send påminnelse**                           | more.jsx:246    | button/onClick | sends reminder message            | `handoff reminder_sent` | MISSING      | MISSING hook | no           |
| 94  | **Avvis** (handoff)                           | more.jsx:247    | button/onClick | rejects handoff                   | `handoff rejected`      | MISSING      | MISSING hook | no           |

---

## Innstillinger (avstemming-more.jsx — RecMore.Settings)

| #   | Element                             | Design file:loc | Type           | Mutation                    | Telemetry event                 | In registry? | Reuse hook   | Noop? |
| --- | ----------------------------------- | --------------- | -------------- | --------------------------- | ------------------------------- | ------------ | ------------ | ----- |
| 95  | Policy toggle (R.Switch) × N fields | more.jsx:275    | Switch/onClick | persists policy field value | `reconciliation policy_updated` | MISSING      | MISSING hook | no    |
| 96  | Policy number input × N fields      | more.jsx:276    | input/onChange | persists policy field value | `reconciliation policy_updated` | MISSING      | MISSING hook | no    |
| 97  | Policy segment (R.Seg) × N fields   | more.jsx:277    | Seg/onChange   | persists policy field value | `reconciliation policy_updated` | MISSING      | MISSING hook | no    |

---

## Summary counts

- **Total interactive elements**: 97
- **Noop / nav / filter / form-input only** (no mutation): 57
- **Mutation-bearing elements**: 40
- **Events in registry**: 8 (`reconciliation admin_action`, `reconciliation locked`, `deviation resolved`, `handoff submitted`, `reconciliation submitted`, `reconciliation step_completed`, `reconciliation pending_signoff`, `reconciliation admin_override`)
- **Events MISSING from registry**: 11 (`reconciliation exported`, `reconciliation bulk_approved`, `reconciliation revenue_adjusted`, `reconciliation shift_proposal_sent`, `reconciliation occupational_closed`, `reconciliation season_closed`, `handoff resolved`, `handoff escalated`, `handoff reminder_sent`, `handoff rejected`, `reconciliation policy_updated`)
- **Hooks found (reuse)**: 5 (`useApproveReconciliation`, `useRejectReconciliation`, `useApproveShiftHours`, `useResolveDeviation`, `lockDayMutation`)
- **Hooks missing** (mutations that need new hooks): 8 (`useAdjustRevenue`, `useHandoffSubmit`, `useHandoffResolve`, `useHandoffEscalate`, `useHandoffReminder`, `useHandoffReject`, `useCloseOccupationalPeriod`, `useCloseSeasonPeriod` + `useUpdateReconciliationPolicy`)
