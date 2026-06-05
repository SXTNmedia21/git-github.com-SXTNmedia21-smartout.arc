---
title: Telemetry Map — Lønn (lonn + min-lonn)
status: draft
created: 2026-05-31
updated: 2026-05-31
module: payroll
tags: [telemetry, lonn, payroll, mapping]
---

# Telemetry Map — Lønn / Min-Lønn

All interactive elements in the lonn domain (6 design files). Each element is
classified as **mutation** (writes DB / triggers backend) or **noop** (local
state / read-only navigation). Every mutation is assigned a registry event and
a backend hook or flagged as missing.

---

## Admin surface (`lonn.jsx` + views/config/overlays)

### HEAD ACTIONS

| #   | Element                                   | File     | Event                     | Hook                                         | Status |
| --- | ----------------------------------------- | -------- | ------------------------- | -------------------------------------------- | ------ |
| 1   | PeriodSwitcher chip — toggle dropdown     | lonn.jsx | noop (local state)        | —                                            | NOOP   |
| 2   | PeriodSwitcher row — select period        | lonn.jsx | noop (local state)        | —                                            | NOOP   |
| 3   | Button: Rapport (open report PDF)         | lonn.jsx | noop (window.open)        | —                                            | NOOP   |
| 4   | Button: Eksport (A-melding + bankfil)     | lonn.jsx | `payroll.csv_exported`    | `use-payroll-exports.ts → useExportPeriod()` | MAPPED |
| 5   | Button: Lås periode (open LockModal)      | lonn.jsx | noop (opens modal)        | —                                            | NOOP   |
| 6   | Button: Åpne på nytt (locked banner undo) | lonn.jsx | noop (local state toggle) | —                                            | NOOP   |

### TABS

| #   | Element            | File     | Event          | Hook | Status |
| --- | ------------------ | -------- | -------------- | ---- | ------ |
| 7   | Tab: Oversikt      | lonn.jsx | noop (tab nav) | —    | NOOP   |
| 8   | Tab: Linjer        | lonn.jsx | noop (tab nav) | —    | NOOP   |
| 9   | Tab: Avvik         | lonn.jsx | noop (tab nav) | —    | NOOP   |
| 10  | Tab: Regler        | lonn.jsx | noop (tab nav) | —    | NOOP   |
| 11  | Tab: Innstillinger | lonn.jsx | noop (tab nav) | —    | NOOP   |

### CLOSED PERIOD (ClosedPeriod component)

| #   | Element                          | File     | Event              | Hook | Status |
| --- | -------------------------------- | -------- | ------------------ | ---- | ------ |
| 12  | Button: Til April 2026 (go back) | lonn.jsx | noop (local state) | —    | NOOP   |

---

### TAB: OVERSIKT (lonn-views.jsx — Oversikt)

| #   | Element                                            | File           | Event                                     | Hook                                                       | Status |
| --- | -------------------------------------------------- | -------------- | ----------------------------------------- | ---------------------------------------------------------- | ------ |
| 13  | PULSE button: Brutto (no-op go)                    | lonn-views.jsx | noop                                      | —                                                          | NOOP   |
| 14  | PULSE button: Netto (no-op go)                     | lonn-views.jsx | noop                                      | —                                                          | NOOP   |
| 15  | PULSE button: Krever handling → go to Avvik tab    | lonn-views.jsx | noop (tab nav)                            | —                                                          | NOOP   |
| 16  | PULSE button: Manuelle tillegg → go to Linjer tab  | lonn-views.jsx | noop (tab nav)                            | —                                                          | NOOP   |
| 17  | PULSE button: Klar til lås → onLock or go to Avvik | lonn-views.jsx | noop (opens modal / tab nav)              | —                                                          | NOOP   |
| 18  | Botsson assist: Bekreft rød dag ×N                 | lonn-views.jsx | `payroll.deviation_acknowledged` (per id) | `use-acknowledge-deviation.ts → useAcknowledgeDeviation()` | MAPPED |
| 19  | Botsson assist: Lås periode (when lockable)        | lonn-views.jsx | noop (opens modal)                        | —                                                          | NOOP   |
| 20  | Botsson assist: Vis avvik                          | lonn-views.jsx | noop (tab nav)                            | —                                                          | NOOP   |
| 21  | Botsson assist: Avvis (dismiss)                    | lonn-views.jsx | noop (local state)                        | —                                                          | NOOP   |
| 22  | Featured period: Åpne periode (go to Linjer)       | lonn-views.jsx | noop (tab nav)                            | —                                                          | NOOP   |
| 23  | Action queue: Vis vakt button (per deviation)      | lonn-views.jsx | noop (opens Drilldown)                    | —                                                          | NOOP   |
| 24  | Action queue: Bekreft button (per deviation)       | lonn-views.jsx | `payroll.deviation_acknowledged`          | `use-acknowledge-deviation.ts → useAcknowledgeDeviation()` | MAPPED |
| 25  | Earlier periods table row — select period          | lonn-views.jsx | noop (local state)                        | —                                                          | NOOP   |

---

### TAB: LINJER (lonn-views.jsx — Linjer)

| #   | Element                                              | File           | Event               | Hook | Status |
| --- | ---------------------------------------------------- | -------------- | ------------------- | ---- | ------ |
| 26  | Search input: Søk navn                               | lonn-views.jsx | noop (local filter) | —    | NOOP   |
| 27  | Dept chip (cycle dept filter)                        | lonn-views.jsx | noop (local filter) | —    | NOOP   |
| 28  | Filter chip: Alle                                    | lonn-views.jsx | noop (local filter) | —    | NOOP   |
| 29  | Filter chip: Med avvik                               | lonn-views.jsx | noop (local filter) | —    | NOOP   |
| 30  | Filter chip: Uten avvik                              | lonn-views.jsx | noop (local filter) | —    | NOOP   |
| 31  | Employee row click (open Drilldown)                  | lonn-views.jsx | noop (opens drawer) | —    | NOOP   |
| 32  | Button: Manuelt tillegg (open SupplementForm no emp) | lonn-views.jsx | noop (opens modal)  | —    | NOOP   |

---

### TAB: AVVIK (lonn-views.jsx — Avvik + DevRow)

| #   | Element                                     | File           | Event                                    | Hook                                                       | Status  |
| --- | ------------------------------------------- | -------------- | ---------------------------------------- | ---------------------------------------------------------- | ------- |
| 33  | Banner (lockable): Lås periode button       | lonn-views.jsx | noop (opens modal)                       | —                                                          | NOOP    |
| 34  | Banner (not lockable): Bekreft alle rød-dag | lonn-views.jsx | `payroll.deviation_acknowledged` (batch) | `use-acknowledge-deviation.ts → useAcknowledgeDeviation()` | MAPPED  |
| 35  | Group header — collapse/expand              | lonn-views.jsx | noop (local state)                       | —                                                          | NOOP    |
| 36  | DevRow: suggestion area click (expand)      | lonn-views.jsx | noop (local expand)                      | —                                                          | NOOP    |
| 37  | DevRow: Vis vakt button                     | lonn-views.jsx | noop (opens Drilldown)                   | —                                                          | NOOP    |
| 38  | DevRow: Bekreft button                      | lonn-views.jsx | `payroll.deviation_acknowledged`         | `use-acknowledge-deviation.ts → useAcknowledgeDeviation()` | MAPPED  |
| 39  | DevRow expanded: Bekreft tillegg button     | lonn-views.jsx | `payroll.deviation_acknowledged`         | `use-acknowledge-deviation.ts → useAcknowledgeDeviation()` | MAPPED  |
| 40  | DevRow expanded: Vis vakt button            | lonn-views.jsx | noop (opens Drilldown)                   | —                                                          | NOOP    |
| 41  | DevRow expanded: Avvis vakten button        | lonn-views.jsx | MISSING EVENT                            | MISSING HOOK                                               | MISSING |

---

### TAB: REGLER (lonn-config.jsx — Regler)

| #   | Element                                        | File            | Event                                                                                                 | Hook                                                                                                         | Status  |
| --- | ---------------------------------------------- | --------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ------- |
| 42  | Button: Test mot april                         | lonn-config.jsx | `payroll.supplement_rule_test_run`                                                                    | MISSING DEDICATED HOOK — `use-supplement-rules.ts` has no test-run mutation                                  | PARTIAL |
| 43  | Button: Ny regel                               | lonn-config.jsx | `supplement_rule created`                                                                             | `use-supplement-rules.ts → useCreateSupplementRule()`                                                        | MAPPED  |
| 44  | Switch: toggle rule active/inactive (per rule) | lonn-config.jsx | MISSING EVENT — no `payroll.supplement_rule_toggled` or `supplement_rule updated` emit on toggle path | `use-supplement-rules.ts → useUpdateSupplementRule()` exists but `onToggle` in design calls only local state | MISSING |

---

### TAB: INNSTILLINGER (lonn-config.jsx — Innstillinger)

| #   | Element                                     | File            | Event                                                                                   | Hook                                                                                            | Status  |
| --- | ------------------------------------------- | --------------- | --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ------- |
| 45  | Segmented control: Periode type (Måned/etc) | lonn-config.jsx | noop (local state)                                                                      | —                                                                                               | NOOP    |
| 46  | Switch: toggle policy (per policy)          | lonn-config.jsx | `payroll_settings updated` (weak — old event, space in name, no per-policy granularity) | MISSING HOOK — no `useUpdatePayrollSettings()` mutation; design calls only local `togglePolicy` | MISSING |
| 47  | Button: Lagre endringer                     | lonn-config.jsx | `payroll_settings updated`                                                              | MISSING HOOK — save path not implemented; only toasts locally                                   | MISSING |

---

### OVERLAYS

#### Drilldown drawer (lonn-overlays.jsx)

| #   | Element                                               | File              | Event                       | Hook | Status |
| --- | ----------------------------------------------------- | ----------------- | --------------------------- | ---- | ------ |
| 48  | Button: X (close drawer)                              | lonn-overlays.jsx | noop                        | —    | NOOP   |
| 49  | Button: Åpne profil                                   | lonn-overlays.jsx | noop (closes drawer — stub) | —    | NOOP   |
| 50  | Button: Manuelt tillegg (open SupplementForm for emp) | lonn-overlays.jsx | noop (opens modal)          | —    | NOOP   |

#### LockModal (lonn-overlays.jsx)

| #   | Element                    | File              | Event                           | Hook                                   | Status |
| --- | -------------------------- | ----------------- | ------------------------------- | -------------------------------------- | ------ |
| 51  | Button: X (close modal)    | lonn-overlays.jsx | noop                            | —                                      | NOOP   |
| 52  | Button: Avbryt             | lonn-overlays.jsx | noop                            | —                                      | NOOP   |
| 53  | Button: Lagre uten å låse  | lonn-overlays.jsx | noop (closes modal, toast only) | —                                      | NOOP   |
| 54  | Button: Lås (confirm lock) | lonn-overlays.jsx | `payroll.period_locked`         | `use-lock-period.ts → useLockPeriod()` | MAPPED |

#### SupplementForm (lonn-overlays.jsx)

| #   | Element                                      | File              | Event                                                | Hook                                                                                                                    | Status  |
| --- | -------------------------------------------- | ----------------- | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ------- |
| 55  | Button: X (close form)                       | lonn-overlays.jsx | noop                                                 | —                                                                                                                       | NOOP    |
| 56  | Type card click (Bonus/Forskudd/Trekk/Annet) | lonn-overlays.jsx | noop (local state)                                   | —                                                                                                                       | NOOP    |
| 57  | Amount input                                 | lonn-overlays.jsx | noop (local state)                                   | —                                                                                                                       | NOOP    |
| 58  | Description input                            | lonn-overlays.jsx | noop (local state)                                   | —                                                                                                                       | NOOP    |
| 59  | Shift picker (static mock)                   | lonn-overlays.jsx | noop (mock — not wired)                              | —                                                                                                                       | NOOP    |
| 60  | Visibility segmented: Lønnsslipp/Bare admin  | lonn-overlays.jsx | noop (local state)                                   | —                                                                                                                       | NOOP    |
| 61  | Botsson tip: Legg til 2 til (span.lo-link)   | lonn-overlays.jsx | MISSING EVENT — bulk supplement suggestion not wired | MISSING HOOK                                                                                                            | MISSING |
| 62  | Button: Avbryt                               | lonn-overlays.jsx | noop                                                 | —                                                                                                                       | NOOP    |
| 63  | Button: Legg til linje (submit supplement)   | lonn-overlays.jsx | `payroll.manual_supplement_added`                    | MISSING HOOK — design calls `onSubmit()` → local toast only; real hook `use-manual-supplements.ts` exists but not wired | MISSING |

---

## Employee surface (`min-lonn.jsx`)

| #   | Element                                         | File         | Event                                                                  | Hook                                                                                                               | Status  |
| --- | ----------------------------------------------- | ------------ | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ------- |
| 64  | Pending signature: Avklar button                | min-lonn.jsx | noop (toast only — "send til leder")                                   | —                                                                                                                  | NOOP    |
| 65  | Pending signature: Signér tillegg button        | min-lonn.jsx | `payroll.deviation_acknowledged` (employee path, is_self=true)         | MISSING HOOK — `sign()` is local state only; needs `useAcknowledgeDeviation()` or dedicated employee-sign endpoint | MISSING |
| 66  | Signed banner: Angre button                     | min-lonn.jsx | noop (local state toggle)                                              | —                                                                                                                  | NOOP    |
| 67  | Payslip list row click (open drawer)            | min-lonn.jsx | noop (local state)                                                     | —                                                                                                                  | NOOP    |
| 68  | Payslip drawer: X (close)                       | min-lonn.jsx | noop                                                                   | —                                                                                                                  | NOOP    |
| 69  | Payslip drawer: Last ned button                 | min-lonn.jsx | `payroll.lonnsgrunnlag_url_granted`                                    | `use-payroll-lonnsgrunnlag.ts → useLonnsgrunnlagUrl()`                                                             | MAPPED  |
| 70  | Payslip drawer: Åpne sak i #lønn (span.lo-link) | min-lonn.jsx | noop (toast only — stub)                                               | —                                                                                                                  | NOOP    |
| 71  | Timebank: Be om avspasering button              | min-lonn.jsx | MISSING EVENT — no timebank_withdrawal or time_off_request event wired | MISSING HOOK                                                                                                       | MISSING |

---

## Summary counts

| Category                                     | Count |
| -------------------------------------------- | ----- |
| Total elements                               | 71    |
| NOOP (no mutation, correctly no event)       | 41    |
| MAPPED (mutation + event + hook all present) | 13    |
| MISSING (mutation but no event or no hook)   | 8     |
| PARTIAL (event exists, hook incomplete)      | 1     |

### MISSING elements (blockers)

| #     | Element                          | Missing                                                                                   |
| ----- | -------------------------------- | ----------------------------------------------------------------------------------------- |
| 41    | DevRow: Avvis vakten             | No event in registry; no hook                                                             |
| 44    | Rule toggle Switch               | No event for active/inactive flip; `onToggle` not wired to `useUpdateSupplementRule()`    |
| 46+47 | Policy toggles + Lagre endringer | `payroll_settings updated` event malformed (space in name); no save hook                  |
| 61    | Botsson bulk-supplement tip      | No event; no hook                                                                         |
| 63    | SupplementForm submit            | No hook wired (design is local-only); `use-manual-supplements.ts` exists but disconnected |
| 65    | Employee sign supplement         | No hook; event path unclear (is_self=true `deviation_acknowledged` vs separate endpoint)  |
| 71    | Be om avspasering                | No event in registry; no hook                                                             |

---

## Critical traps

1. **`.schema("payroll")` required** — All calls to `payroll.period`, `payroll.calculation`, `payroll.deviation`, `payroll.supplement_rule` MUST use `.schema("payroll")` on the Supabase client. Missing this produces silent empty results (no error). `supplement_rule` exists in BOTH `public` and `payroll` schemas — always pin schema.

2. **min-lonn open-period seed gap** — `ML_PAY.current` (running period) shows 0 calculation rows from `payroll.calculation` for an open period because the calc-engine only seeds rows after the period is closed/recalculated (F0.4 seed required). Live-preview net/gross on min-lonn will be 0 or stale until F0.4 seed data lands.

3. **`payroll_settings updated` event malformed** — The event string in registry.ts is `"payroll_settings updated"` (space, not dot) which breaks the canonical `domain.verb_noun` naming convention used by all Phase 1+ payroll events. Treat as a missing event for implementation purposes.
