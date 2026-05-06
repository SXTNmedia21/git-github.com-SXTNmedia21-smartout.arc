---
title: Payroll Module — Design Mockups
status: shipped
updated: 2026-05-06
created: 2026-05-06
module: payroll
sidebar_group: administration
tags: [payroll, design, mockups, html, jsx, ui-spec]
---

# Payroll Design Folder

> Sofia / produkt-team levert komplett design-pakke 2026-05-06. Build-agent bruker `Payroll Prototype.html` + JSX-source som visuell SoT. Følg `IMPLEMENTATION.md` for sprint-rekkefølge. Hver surface har formål, hovedhandling, datakilde, og link til USER-FLOWS.md.

## Status

✅ **SHIPPED** — Design-pakke levert 2026-05-06. 14 skjermer mappet til 5 sprint.

## Hva som ligger i mappen

```
design/
├── IMPLEMENTATION.md           ← Sofia's handoff til Claude Code (les først!)
├── Payroll Prototype.html      ← målbildet, åpne i nettleser
├── README.md                   ← denne filen, surface-katalog
└── source/                     ← JSX per komponent + tokens.css
    ├── design-canvas.jsx       ← canvas/wrapper (alle 14 skjermer)
    ├── shared.jsx              ← kanoniske komponenter (Btn, Pill, Avatar, Switch, Icon)
    ├── tokens.css              ← Nordic Split tokens — bruk direkte
    ├── payroll-web.jsx         ← skjerm 01 lønnsperioder
    ├── payroll-period-detail.jsx ← skjerm 02 periode-detalj
    ├── payroll-drilldown.jsx   ← skjerm 03 drilldown per ansatt
    ├── payroll-deviations.jsx  ← skjerm 04 avvik + ack
    ├── payroll-supplement-form.jsx ← skjerm 06 manuelt tillegg
    ├── payroll-settings.jsx    ← skjerm 08+09 innstillinger + regler
    └── payroll-mobile.jsx      ← skjerm 11-14 mobile-flyten
```

## Sofia's 14 skjermer → 5 sprint (per IMPLEMENTATION.md)

| Sprint | Skjerm | Tittel | Min W-ID | JSX-source |
|---|---|---|---|---|
| **Sprint 1** | — | Engine + data-modell (ingen UI før calc-engine + snapshot-tester står) | — | — |
| **Sprint 2** | 01 | Lønnsperioder | W1 | payroll-web.jsx |
| Sprint 2 | 02 | Periode-detalj · Linjer | W2 | payroll-period-detail.jsx |
| Sprint 2 | 03 | Drilldown · per ansatt | W3 | payroll-drilldown.jsx |
| Sprint 2 | 04 | Avvik · ack | W4 | payroll-deviations.jsx |
| Sprint 2 | 05 | Lås periode (modal) | W5 | (innen period-detail.jsx) |
| **Sprint 3** | 06 | Manuelt tillegg modal | W6 | payroll-supplement-form.jsx |
| Sprint 3 | 07 | Lønnsprofil + Timebank per ansatt | W7+W9+W19 | (innen drilldown.jsx + settings.jsx) |
| **Sprint 4** | 08 | Innstillinger | W14 (settings) | payroll-settings.jsx |
| Sprint 4 | 09 | Tillegg-regler + tester (trace-rute PÅKREVD) | DYNAMIC-SUPPLEMENTS UI | payroll-settings.jsx |
| Sprint 4 | 10 | Bot-Sson chat (payroll-context wrapper) | **NEW** — ikke i UI-PLAN.md | (innen settings.jsx) |
| **Sprint 5** | 11 | Lønn (ny mobile tab) | M1+ | payroll-mobile.jsx |
| Sprint 5 | 12 | Lønnsslipp · detalj | M2 | payroll-mobile.jsx |
| Sprint 5 | 13 | Timebank · historikk | M1 | payroll-mobile.jsx |
| Sprint 5 | 14 | Bekreft OT (manager push) | **NEW** — ikke i UI-PLAN.md | payroll-mobile.jsx |

**To NYE surfaces Sofia introduserte (UI-PLAN.md trenger update):**
- Skjerm 10: **Botsson payroll-chat** — wrapper rundt eksisterende lønnsdata, ikke ny LLM-stack
- Skjerm 14: **Bekreft OT på mobile** — manager-on-the-go push-handling for OT-godkjenning

## Sofia's ikke-forhandlbare designprinsipper

Disse er bakt inn i prototypen:

1. **Calc-engine deriverer alt.** Mennesket bekrefter avvik og låser. Aldri manuell editering av deriverte linjer — bare add-on `manualSupplements`.
2. **Avvik må null før lås.** Lås-knappen er disabled (grå) helt til `deviations.unacked === 0`. Hard rule.
3. **Trace alt.** Hver derivert linje må kunne forklares: hvilken regel, hvilken vakt, hvilke timer. Trace-panelet i skjerm 09 er **påkrevd** — det er hovedmekanismen for å bygge tillit til engine.
4. **Lås er irreversibel.** Etter lås: bare manuelle korrigeringer i neste periode + audit-log. Ingen "unlock" knapp.
5. **Tipspott er skattepliktig** og går gjennom samme A-melding-pipe som annen lønn.
6. **Rød dag ≠ automatisk +100%.** Ansatt må signere i appen, leder må bekrefte. To distincte handlinger.

Stemmer overens med Q1–Q7 RESOLVED i UI-PLAN.md.

## Build-agent regler

1. Les HTML-mockup som visuell SoT
2. Konverter til React/TSX m/ shadcn + Tailwind v4 + Nordic Split design tokens
3. Pixel-parity ikke krav; struktur/hierarki/spacing skal matche
4. Erstatt mockup-strings m/ TanStack Query hooks (eller server-action mutations)
5. Apply Nordic Split design tokens (smartout-nordic-split skill MÅ load)
6. Mobile mockups: konverter til React Native + Expo komponenter
7. Sidebar-plassering: alle admin-surfaces under sidebar-group **Administration** (Q1 RESOLVED 2026-05-06)
8. Telemetry emit() per mutation, registry events per UI-PLAN.md §10
9. Empty/loading/error states obligatorisk per Nordic Split standard

---

## Surface-katalog — Beskrivelser

Hver surface: **formål** (hvorfor finnes den), **hovedhandling** (hva man gjør), **funksjoner** (key features), **datakilde** (tabeller + hooks), **lenker**.

---

### Phase 1 — Web Admin (MVP)

#### W1 — Period list / payroll hub

- **Status:** [ ] mockup pending — `W1-period-list.html`
- **Route:** `/dashboard/payroll/` (sidebar-group: **Administration**)
- **Audience:** admin / owner
- **Formål:** Admin-landingsside for hele payroll-modulen. Førsteinntrykk når admin klikker "Payroll" i sidebar. Viser status på alle perioder + raske aksjoner. Dette er post-event admin-arbeid (ikke operativt) — derfor under Administration.
- **Hovedhandling:** Velg en periode → drill ned til W2. Eller initiér ny periode (manuell hvis policy tillater).
- **Funksjoner:**
  - Liste over alle perioder, default sort `end_date DESC`
  - Per rad: periode-dato, status-badge (open/locked/approved/exported/paid), gross-total, deviation-count, avg-net-per-employee, employee-count
  - Filter: status, year, department
  - Quick-actions per rad: "Run", "Lock", "Approve", "Export", "Mark paid" (kontekst-avhengig per status)
  - Empty state: "Ingen perioder ennå" m/ first-run-CTA
- **Datakilde:** `payroll.period` (alle rows for workspace) + aggregate joins. Hook: `usePayrollPeriods()`.
- **Lenker:** USER-FLOWS.md §3 Flow A, ARCHITECTURE.md §1.

#### W2 — Period detail (Lines / Deviations / Manual / Tip / Export tabs)

- **Status:** [ ] mockup pending — `W2-period-detail.html`
- **Route:** `/dashboard/payroll/[periodId]/`
- **Audience:** admin / manager (read-only på Lines)
- **Formål:** Det workspacet bruker daglig under periodelukking. Manager review → admin approve i samme surface. Den primære skjermen i hele payroll-modulen.
- **Hovedhandling:** Gå gjennom hver ansatts beregning, acknowledge eventuelle avvik, lås perioden, godkjenn, eksporter, marker betalt.
- **Funksjoner:**
  - Header: periode-dato + total gross + employee-count + deviation-count + status-progression-bar (open → locked → approved → exported → paid)
  - 5 tabs: Lines | Deviations | Manual | Tip | Export
  - **Lines-tab:** per-profile rader m/ totals-row øverst (Planday-mønster). Kolonner: navn, scheduled-hrs, actual-hrs, OT, kvelds, helg, helligdag, manual, deductions, gross, net
  - **Deviations-tab:** liste m/ severity-badges (error/warning/info), check_id (W01–W12), profile-link
  - **Manual-tab:** liste over admin-added supplement-rader, "Legg til ny" CTA
  - **Tip-tab:** tip-pool status + per-employee fordeling
  - **Export-tab:** CSV / PDF / A-melding / Tripletex / Mark-as-paid actions m/ status pr type
  - Filter: avdeling, deviation-flagg, wage_type, search
  - Click rad → opens W3 LineDrawer
  - "Lock period"-knapp → opens W5 (gated på severity=error ack)
  - "Approve period"-knapp (locked → approved)
  - Stacking-policy info-banner
- **Datakilde:** `payroll.calculation` + `payroll.calculation_line` + `payroll.deviation` + `tip_distribution` + `payroll.export_event`. Hooks: `usePayrollPeriod`, `usePayrollLines`, `usePayrollDeviations`.
- **Lenker:** USER-FLOWS.md §3 Flow A, DYNAMIC-SUPPLEMENTS.md §4.2.

#### W3 — Line drawer (drill-down per ansatt per periode)

- **Status:** [ ] mockup pending — `W3-line-drawer.html`
- **Komponent (ikke route):** Mounted over W2 ved row-click
- **Audience:** admin / manager
- **Formål:** Gi admin full transparens på HVORFOR en ansatt har den lønnen — hvilke vakter, hvilke regler, hvilken tariff. Krever provenance-mønster for å bygge tillit.
- **Hovedhandling:** Drill ned per shift → se interpretation + cost-snapshot → forstå provenance. Optionally trigger override-flow (Phase 2 W13).
- **Funksjoner:**
  - 3 tabs: Shifts | Lines | Audit
  - **Shifts-tab:** liste over alle vakter i perioden, planlagt vs faktisk + breakdown (regular/OT/night/holiday/weekend)
  - **Lines-tab:** per-line-view (worked, supplement, deduction). Click → source-info: framework_rule + tariff-rate + source_text_applied
  - **Audit-tab:** `shift_pay_calculation_event` chain (versions). Supersession-history visible
  - Action: "Add manual supplement" → opens W6 modal
  - Action: "Override line" (Phase 2 W13)
  - Action: "Reveal bank account" / "Reveal personnummer" (audit-emit ved trykk)
- **Datakilde:** `shift_hour_interpretation` + `shift_cost_snapshot` + `shift_pay_calculation_event` + `payroll.calculation_line`. Hooks: `useShiftBreakdown`.
- **Lenker:** USER-FLOWS.md §5 Flow C, ARCHITECTURE.md §3.

#### W4 — Deviation drawer

- **Status:** [ ] mockup pending — `W4-deviation-drawer.html`
- **Komponent (ikke route):** Mounted over W2 deviations-tab ved row-click
- **Audience:** manager / admin
- **Formål:** Gi konteksten manager trenger for å avgjøre: er denne deviation reell, er den dokumentert, eller blokkerer den approve? Paragraf-sitat skal være eksplisitt — ikke "noe i §10".
- **Hovedhandling:** Se paragraf-ref + computed values → acknowledge m/ begrunnelse → unblock approve.
- **Funksjoner:**
  - Header: profile + shift_date + check_id (W01–W12)
  - Paragraf-ref m/ direkte-sitat (e.g. "Aml. §10-8 første ledd — hviletid 11t")
  - Computed values (e.g. "Rest period: 9.5h, required: 11h")
  - Linked schedule_shift_id (click → opens schedule editor i ny tab)
  - Source data snapshot (time_entry punch_in/out)
  - Acknowledge-form: Reason (required min 10 char), Optional: linked change_proposal
  - Cannot-acknowledge-list: W11 (Bokf. §13), W03 (lønn under min), W08 (prøvetid > 6 mnd) — krever amendment ikke ack
- **Datakilde:** `payroll.deviation` + `framework_rule` + `schedule_shift` + `timesheet.time_entry`. Hook: `useAcknowledgeDeviation`.
- **Lenker:** USER-FLOWS.md §4 Flow B, LEGAL-FRAMEWORK.md §6 (W-codes).

#### W5 — Lock modal

- **Status:** [ ] mockup pending — `W5-lock-modal.html`
- **Komponent (ikke route):** Triggered fra W2 header
- **Audience:** admin
- **Formål:** Gi admin trygghet ved lås — vis exact hva som blir låst, og BLOCK ved unack errors. Lock er reversible til open; approve er ikke reversible.
- **Hovedhandling:** Bekreft lås → status open → locked.
- **Funksjoner:**
  - Confirmation modal m/ totals: periode-dato, total gross, locked rows, employee-count
  - Pre-check: BLOCKS hvis severity=error deviation un-acknowledged. Vis blokkert-melding m/ liste over blockers + link til W4
  - "Action is reversible to 'open' but not after 'approved'" disclaimer
  - Confirm-button → triggers `lock_period` capability tool
  - Tip-pool merge-info: viser hvilke tip-distributions som låses inn ved lock
- **Datakilde:** `payroll.deviation WHERE severity='error' AND acknowledged_by IS NULL`. Hook: `useLockPeriod`.
- **Lenker:** USER-FLOWS.md §3 Flow A step 7, ARCHITECTURE.md §4.3.

#### W6 — Manual supplement form

- **Status:** [ ] mockup pending — `W6-manual-supplement-form.html`
- **Komponent (ikke route):** Triggered fra W3 LineDrawer eller W2 Manual-tab
- **Audience:** admin (Q3 RESOLVED — admin baseline; workspace kan elevate via approver-list)
- **Formål:** Legge til ad-hoc tillegg som ikke fanges av automatic supplement-rules — drikkepenger fra spesiell kilde, bonus, glemt-å-rapportere-tillegg.
- **Hovedhandling:** Velg salary-code → angi beløp eller timer → begrunnelse → submit.
- **Funksjoner:**
  - Form fields: Salary code (select fra `payroll.salary_code`, filter by category), Hours OR amount (mutually exclusive), Effective shift_id (optional), Reason (required min 10 char)
  - Sum-check: warn hvis added supplement > 20% av rad-total
  - Period-check: kun lov hvis `period.status='open'`. Ellers vis admin-melding "Unlock period eller lag corrective period"
  - Submit triggers `add_manual_supplement` capability → recalc per profile
  - Toast feedback: "Tillegg lagt til. Total for [navn] er nå kr X."
- **Datakilde:** Inserts `payroll.manual_supplement`. Hook: `useAddManualSupplement`.
- **Lenker:** USER-FLOWS.md §7 Flow E.

#### W10 — Run payroll modal

- **Status:** [ ] mockup pending — `W10-run-payroll.html`
- **Komponent (ikke route):** Q6 RESOLVED = modal (ikke full-page), triggered fra W2 header
- **Audience:** admin
- **Formål:** Kjør hele beregnings-pipelinen for en periode. Step-by-step progress slik at admin ser hvor det henger seg opp ved feil. Modal er non-blocking — admin kan navigere mens beregning fortsetter.
- **Hovedhandling:** Trykk "Run" → modal viser 4-step progress → resultat-summary.
- **Funksjoner:**
  - 4-step progress bar: derive_shift_hours → snapshot_period_costs → aggregate_period → run_deviation_checks
  - Per-step: pending / running / completed / failed indicator + duration
  - Live-streaming logs (siste 10 linjer per step) — collapsible
  - Result summary: X ansatte beregnet, Y deviations populert, Z minutes elapsed
  - Non-blocking: admin kan navigere annet UI mens beregning fortsetter (matcher M2 clockout-wizard)
  - Cancel-knapp (kun før første step starter; etter det = log-only)
  - Failure: link til problematisk shift / profile
- **Datakilde:** RPCs `payroll.derive_shift_hours`, `payroll.snapshot_period_costs`, `payroll.aggregate_period`, `payroll.run_deviation_checks`. Hook: `useRunPayroll`.
- **Lenker:** ARCHITECTURE.md §1 + §2.

---

### Phase 1.5 — Web Admin (workspace-overview)

#### W7 — Team registry

- **Status:** [ ] mockup pending — `W7-team-registry.html`
- **Route:** `/dashboard/payroll/team-registry/`
- **Audience:** admin
- **Formål:** Workspace-bredt cockpit over alle ansattes payroll-status. Admin kan på ett blikk se: hvem mangler skattekort, hvem har deviation, hvem nærmer seg OT-cap, hvem har overtime_mode=banked uten signed agreement. Erstatter behovet for å åpne hver ansatt for å sjekke status.
- **Hovedhandling:** Scan tabell, identifiser problem-rader (default sort = deviation-count DESC), klikk navn → opens `/dashboard/people/[id]#hr` for dypdykk.
- **Funksjoner:**
  - Tabell: alle ansatte × payroll-felt
  - Kolonner: navn, employment_form, hourly_rate eller månedslønn, holiday_allowance%, otp%, overtime_mode + agreement-badge, current period status, timebank-saldoer (3 kontoer), siste lønnsslipp-dato, deviation-count denne periode
  - Default sort: **deviation-count DESC** (Q2 RESOLVED — problemer øverst)
  - Filter: avdeling, employment_form, deviation-flagg, overtime_mode
  - Search: navn / personnummer (siste 6) / Tripletex-ID
  - Sticky header + sticky first-column (navn) for scrolling-friendly
  - Bulk-actions: "Refresh skattekort for selected", "Export CSV"
  - Empty state: "Ingen ansatte i workspace ennå"
- **Datakilde:** Aggregate join over `profile` + `employee_payroll_profile` + `employment_contract` + `payroll.calculation` (latest per profile per period) + `payroll.timebank_entry` (sum per account_type) + `payroll.deviation` (count). Hook: `useTeamRegistry`.
- **Lenker:** UI-PLAN.md §4.2 W7.

#### W9 — Time bank admin

- **Status:** [ ] mockup pending — `W9-time-bank-admin.html`
- **Route:** `/dashboard/payroll/time-banks/`
- **Audience:** admin
- **Formål:** Workspace-bredt overview alle 3 tidskontoer. Admin kan se workspace-totals, drill ned til ansatt, og force-payout ved policy-overshoot. Også manuell saldo-justering ved feilpostering.
- **Hovedhandling:** Identifiser ansatte over toil_max_banked_hours → trigger force-payout. Eller justér ansatts saldo manuelt m/ begrunnelse.
- **Funksjoner:**
  - 3 tabs: Feriekonto (NOK) | Avspasering (timer) | Velferdsdager
  - Per-tab: workspace-total (sum over alle ansatte) + per-ansatt drilldown-tabell
  - Filter: ansatt, periode, account-type, "Over-cap"-flagg
  - Action: "Tving utbetaling" på TOIL-overshoot (>workspace.toil_default_max_banked_hours)
  - Action: "Justér saldo" → modal m/ amount + reason (creates entry_type='adjustment' row)
  - Ledger-view per ansatt: alle entry_type-rader m/ source + provenance JSONB
  - Audit-link: hver justering → activity_trail event
- **Datakilde:** `payroll.timebank_entry` aggregert per profile + `payroll.absence_quota` for wellness. Hooks: `useWorkspaceTimebanks`, `useAdjustTimebankBalance`, `useForceTimebankPayout`.
- **Lenker:** TIME-BANKS.md §3 + §4.

---

### Phase 2 — Vacation + Override + Cost overlays

#### W8 — Vacation management

- **Status:** [ ] mockup pending — `W8-vacation-management.html`
- **Route:** `/dashboard/payroll/vacation/`
- **Audience:** admin baseline + workspace-elevated approvers (Q3 RESOLVED — workspace-policy)
- **Formål:** Workspace-vacation-overview. Approve/reject pending requests. Kalender-view for planlegging. Yearly summary av opptjent feriepenger. Sentralt sted for å sikre tilstrekkelig dekning + gjøre det smidig å fordele ferie.
- **Hovedhandling:** Process pending vacation-requests (approve/reject) + se workspace-bredt kalender for å sikre tilstrekkelig dekning.
- **Funksjoner:**
  - 3 tabs: Pending requests | Approved | Calendar view
  - **Pending tab:** liste over alle uavklarte vacation-requests m/ approve/reject-action inline + reason-input
  - **Approved tab:** arkivert liste, sortert etter dato
  - **Calendar tab:** workspace-bredt månedsvisning. Hver dag: count of employees on vacation. Heatmap-farger.
  - Yearly summary header: total opptjent feriepenger workspace-bredt + utbetalt YTD + balance
  - Workspace-policy-felt: `vacation_approver_user_ids UUID[]` — admin kan legge til ekstra users m/ approve-rett
  - Conflict-detection: warn ved approve hvis to fra samme avdeling allerede borte samtidig
  - Notification flow: ved approve sender SendGrid-mail til ansatt
- **Datakilde:** `payroll.absence_quota` (vacation type) + new `vacation_request` (eller existing absence_request flow) + `payroll.timebank_entry` (account_type='vacation_pay'). Hooks: `useVacationRequests`, `useApproveVacation`.
- **Lenker:** LEGAL-FRAMEWORK.md §1.2 (Ferieloven), TIME-BANKS.md §3.1.

#### W11 — Register as paid

- **Status:** [ ] mockup pending — `W11-register-as-paid.html`
- **Komponent (ikke route):** Action-button + confirmation modal i W2 export-tab
- **Audience:** admin
- **Formål:** Markere periode som faktisk utbetalt. Lukker den juridiske sløyfen. Knytter intern payroll til ekstern reference (Tripletex transaction_id eller bank-ref). Per Bokf. §13 er denne handlingen anti-tamper.
- **Hovedhandling:** Etter approve + export → trykk "Mark as paid" → angi ekstern referanse → bekreft.
- **Funksjoner:**
  - Krav: `period.status='exported'` (eksport må ha skjedd først)
  - Form: External reference (Tripletex transaction_id ELLER bank-betalings-ID), Payment date (default = today), Notes (optional)
  - Confirmation: "Denne aksjonen kan IKKE reverseres. Eventuell feil må rettes via corrective period." (Q7 RESOLVED — irreverserbart)
  - Submit: setter `payroll.period.paid_at` + `paid_by` + `external_payment_ref`. Emit `payroll.period_marked_paid`.
  - Post-action: badge oppdateres til "Paid YYYY-MM-DD" + audit-trail-link
- **Datakilde:** Updates `payroll.period`. Schema-delta Phase 3: `payroll.period` get nye kolonner `paid_at`, `paid_by`, `external_payment_ref`. Hook: `useMarkPeriodPaid`.
- **Lenker:** UI-PLAN.md §4.2 W11.

#### W13 — Inbox: wage-line override

- **Status:** [ ] mockup pending (Phase 2)
- **Route:** `/dashboard/inbox?type=wage_line_override`
- **Audience:** admin (approver) / manager (proposer)
- **Formål:** Manager foreslår line-override → admin reviewer + godkjenner i samme inbox-mønster som change_proposal. Audit-grade endring som krever to-personer-prinsippet.
- **Hovedhandling:** Admin: scan inbox, klikk forslag, review, approve/reject.
- **Funksjoner:**
  - Filter: type=`wage_line_override`
  - Per-forslag: profile + period + line + current value + proposed value + reason + proposer
  - Approve → triggerer applyWageLineOverride: ny payroll_calculation rad (append-only), gammelt event superseded
  - Reject → status=rejected + rejection_reason
  - Notification til foreslå-er ved approve/reject
- **Datakilde:** `change_proposal WHERE proposal_kind='wage_line_override'`. Reuse existing `useChangeProposals` hook.
- **Lenker:** USER-FLOWS.md §6 Flow D.

#### W20 — Employee amendment review

- **Status:** [ ] mockup pending (Phase 2)
- **Route:** `/dashboard/my-contract/amendments`
- **Audience:** employee
- **Formål:** Ansatt aksepterer indekstillegg-amendments (ADR-0252 flow). Per Lovsen MEDIUM confidence — tariff-amendments krever ansatt-acknowledge for å beskytte mot ulovlig endring-claim.
- **Hovedhandling:** Push-notif → tap "Vis amendment" → se gammel sats vs ny sats + diff → trykk "Godta".
- **Funksjoner:**
  - Liste over pending amendments
  - Per-amendment: type (indekstillegg / MATERIAL endring), gammel sats, ny sats, effective_from, paragraf-ref
  - "Godta"-knapp → setter `acknowledged_at` + `acknowledged_by` på `contract_amendment`
  - "Be om gjennomgang"-knapp → flagger til admin (constructive-dismissal-risk-flow)
  - Disclaimer i bunn: "Du kan kontakte advokat hvis du er usikker"
- **Datakilde:** `contract_amendment WHERE acknowledged_at IS NULL`. Hook: `useMyAmendments`.
- **Lenker:** ADR-0252 §D, LEGAL-FRAMEWORK.md §5.

---

### Phase 3 — CSV exports (handled in W2 Export-tab, no separate surface)

---

### Phase 4 — Reports + payslip acknowledge

#### W12 — Reports hub

- **Status:** [ ] mockup pending — `W12-reports-hub.html`
- **Route:** `/dashboard/payroll/reports/`
- **Audience:** admin
- **Formål:** Sentralt sted for ALLE payroll-rapporter. Persistent filter-bar (Q4 RESOLVED) gjør det raskt å bytte rapport på samme datasett. Erstatter behovet for ad-hoc Excel-arbeid for månedsslutts-rutiner.
- **Hovedhandling:** Velg periode + avdeling i top-bar → klikk en rapport → se data → eksporter.
- **Funksjoner:**
  - Persistent topp-filter: Periode-range, avdeling, ansatt-multiselect (gjelder alle rapporter samtidig — Q4)
  - 8 rapport-templates som tabs eller kort:
    1. **Lønnsoppgjør per periode** — full breakdown per ansatt per periode
    2. **A-melding-summary** — preview før Tripletex/Altinn-submit
    3. **OT-cap-tracking** — hvem nærmer seg/overshoot Aml. §10-6
    4. **Feriepenger-prognose** — opptjent vs utbetalt YTD per ansatt
    5. **OTP-rapport** — pension-innskudd per ansatt (input til pensjons-leverandør)
    6. **Ansatt-kostnad-utvikling** — gross + AGA + OTP + diett over tid
    7. **Tariff-compliance** — ansatte med rate < Riksavtalen min
    8. **Deviation-historikk** — alle deviations over periode m/ ack-status
  - Per rapport: data-preview tabell + Export CSV / Export PDF
  - Saved filters: lagre filter-kombinasjon m/ navn for raskt re-bruk
- **Datakilde:** Aggregate queries mot `payroll.calculation` + `shift_pay_calculation_event` + `tariff_rate_table` + `framework_rule`. Hooks: per-rapport (`useReportLonnsoppgjor`, `useReportAmelding`, etc.).
- **Lenker:** EXPORTS.md §1–4, BENCHMARK-PLANDAY.md §8.

#### W18 — Payslip acknowledge (web)

- **Status:** [ ] mockup pending — `W18-payslip-acknowledge.html`
- **Komponent i `/dashboard/my-salary/[periodId]`:** Knapp "Jeg har sett denne lønnsslippen"
- **Audience:** employee
- **Formål:** Bygge dispute-trail. Per O2 (workspace-policy default = acknowledge-button, ikke digital signatur). Beskyttelse mot "jeg har aldri sett den lønnsslippen"-tvister.
- **Hovedhandling:** Ansatt åpner lønnsslipp → trykker bekreftelse-knapp.
- **Funksjoner:**
  - Knapp synlig hvis `payslip_acknowledged_at IS NULL`
  - Trykk → setter `payslip_acknowledged_at` + `payslip_acknowledged_by` (med IP + user-agent for audit)
  - Knapp blir til badge "Sett YYYY-MM-DD HH:MM"
  - Push-notif "Lønnsslipp klar" → deep-link til denne skjermen
- **Datakilde:** New table `payroll.payslip_view` (Phase 4 schema-delta). Hook: `useAcknowledgePayslip`.
- **Lenker:** OPEN-QUESTIONS.md §O2, MOBILE M2.

#### W19 — Employee my-time-banks (web parity)

- **Status:** [ ] mockup pending — `W19-employee-time-banks.html`
- **Route:** `/dashboard/my-salary/time-banks`
- **Audience:** employee
- **Formål:** Web parity for mobile timebank-view. Ansatt ser egne tre kontoer + ledger fra sin daglige web-arbeidsflate.
- **Hovedhandling:** Sjekk saldo. Eventuelt request avspasering eller utbetaling (read-only, action via my-schedule).
- **Funksjoner:**
  - 3 kort: Feriekonto (NOK), Avspasering (timer), Velferdsdager
  - Per kort: saldo + last-update + ledger (collapsible)
  - Ledger: 20 siste entries m/ entry_type + amount + reason
  - "Be om utbetaling"-link til absence-request-flow (TOIL-withdrawal)
- **Datakilde:** `payroll.timebank_entry WHERE profile_id = me`. Hook: `useMyTimebanks`.
- **Lenker:** TIME-BANKS.md §4, mobil M1 har samme.

---

### Phase 5–7 — Integration surfaces

#### W15 — Skatteetaten status

- **Status:** [ ] mockup pending (Phase 5)
- **Route:** `/dashboard/payroll/integrations/skatteetaten`
- **Audience:** admin
- **Formål:** Per-ansatt skattekort-status. Admin ser hvem mangler kort eller har utdaterte verdier. Fail-fast på Skatteetaten-flow så feil ikke smyger seg inn i lønnskjøring.
- **Hovedhandling:** Manuell trigger refresh på spesifikke ansatte ved fail. Bulk-refresh ved årsskifte.
- **Funksjoner:**
  - Tabell: alle ansatte × tax_card_year + tax_card_type + tax_table_number + tax_card_fetched_at + status (ok / stale / fail)
  - Action: "Refresh selected" → trigger Skatteetaten Edge Function batch
  - Per-ansatt: detail-modal m/ fail-history + retry
  - Cron-status: "Sist auto-refreshed YYYY-MM-DD"
- **Datakilde:** `employee_payroll_profile.tax_*` columns. Hook: `useSkatteetatenStatus`. Trigger: `query_tax_card` capability.
- **Lenker:** ADR-0250.

#### W17 — A-melding XML export

- **Status:** [ ] mockup pending (Phase 6, in W12)
- **Komponent:** Knapp i W12 "A-melding-summary"-rapport
- **Audience:** admin
- **Formål:** Generere A-melding XML for periode + valider mot Skatteetaten XSD. Sluttsteg i månedlig compliance-flyt.
- **Hovedhandling:** Velg periode → "Generer A-melding XML" → preview validate → "Last ned" eller "Send via Tripletex".
- **Funksjoner:**
  - Pre-flight: alle ansatte har gyldig skattekort + virksomhetsnummer
  - Generate XML
  - Local XSD validation
  - Action: Last ned XML, ELLER "Send via Tripletex" (hvis Tripletex-integration aktiv)
  - Submission-log per periode
- **Datakilde:** Aggregate `payroll.calculation_line` per ansatt + tax_card data. Hook: `useGenerateAmelding`.
- **Lenker:** EXPORTS.md §4.

#### W16 — Tripletex sync status

- **Status:** [ ] mockup pending (Phase 7)
- **Route:** `/dashboard/payroll/integrations/tripletex`
- **Audience:** admin
- **Formål:** Per-periode sync-status mot Tripletex. Mapping-UI for SmartoutSalaryCode → TripletexSalaryType. Per O23 må mapping settes opp per workspace; denne UI'en gjør det mulig.
- **Hovedhandling:** Etter approve+export → trigger sync. Monitor per-line status. Retry failures. Mappe nye salary-codes til Tripletex-koder.
- **Funksjoner:**
  - Liste over sync-events per periode m/ status (pending/synced/failed/skipped)
  - Per-linje: external_id (Tripletex transaction_id), error_detail JSONB ved fail
  - Mapping-table: alle workspace-salary-codes → Tripletex SalaryType ID. Editable.
  - Action: "Sync now", "Retry failed lines", "Discover Tripletex SalaryTypes" (calls GET /salary/type)
  - Auth-status: token-expiry countdown
- **Datakilde:** `payroll.export_event` + `payroll.export_line`. Hook: `useTripletexSync`.
- **Lenker:** TRIPLETEX-INTEGRATION.md, OPEN-QUESTIONS.md O23+O24.

---

### Mobile Extensions (read-only per ADR-0133)

#### M1 — Mobile timebank chip-filter

- **Status:** [ ] mockup pending — `M1-mobile-timebank-filter.html`
- **Route:** Extends `apps/mobile/app/(app)/(me)/payroll/timebank.tsx`
- **Audience:** employee
- **Formål:** Filter mellom 3 konto-typer på mobil — chips alltid synlige (Q5 RESOLVED).
- **Hovedhandling:** Tap chip for å filtrere ledger.
- **Funksjoner:**
  - Horizontal chip-bar: [Feriepenger] [Avspasering] [Velferdsdager]
  - Default = alle vist (ingen aktiv chip = vis alt)
  - Tap chip → filtrer ledger til den account-type
  - Tap igjen → fjern filter
- **Datakilde:** Eksisterende `useTimebankBalance`. Bare add filter-state.
- **Lenker:** TIME-BANKS.md §3.

#### M2 — Mobile payslip acknowledge

- **Status:** [ ] mockup pending — `M2-mobile-payslip-acknowledge.html`
- **Route:** Extends `apps/mobile/app/(app)/(me)/payroll/payslip-detail.tsx`
- **Audience:** employee
- **Formål:** Mobile parity for W18.
- **Hovedhandling:** Push-notif "Lønnsslipp klar" → tap → ser detail → trykk "Jeg har sett denne".
- **Funksjoner:**
  - Knapp ned i bunn av payslip-detail (under verification-bar)
  - Trykk → setter `payslip_acknowledged_at`
  - Etter ack: knapp blir til badge "Sett HH:MM"
  - Deep-link fra push-notif: `smartout://payroll/payslip?periodId=...&autoFocusAck=true`
- **Datakilde:** Same som W18.
- **Lenker:** O2.

#### M3 — Mobile amendment accept

- **Status:** [ ] mockup pending — `M3-mobile-amendment-accept.html`
- **Route:** New `apps/mobile/app/(app)/(me)/contract/amendments.tsx`
- **Audience:** employee
- **Formål:** Mobile parity for W20.
- **Hovedhandling:** Push-notif → ansatt aksepterer tariff-amendment.
- **Funksjoner:**
  - Liste over pending amendments m/ badge på (me)-tab
  - Per-amendment: gammel vs ny sats + diff + paragraf-ref
  - "Godta"-knapp m/ confirmation
  - "Be om gjennomgang" → varsler admin
- **Datakilde:** Same som W20.
- **Lenker:** ADR-0252.

---

## Cross-references

- [UI-PLAN.md](../UI-PLAN.md) §4 — full surface inventory
- [UI-PLAN.md](../UI-PLAN.md) §14 — Q1–Q7 RESOLVED decisions
- [USER-FLOWS.md](../USER-FLOWS.md) — flow A–I detail
- [ARCHITECTURE.md](../ARCHITECTURE.md) — system diagram
- [TIME-BANKS.md](../TIME-BANKS.md) — tidskonto arkitektur
- [DYNAMIC-SUPPLEMENTS.md](../DYNAMIC-SUPPLEMENTS.md) — admin-rules + Test-rule preview
- [WORKSPACE-POLICIES.md](../WORKSPACE-POLICIES.md) — admin policy options
- [LEGAL-FRAMEWORK.md](../LEGAL-FRAMEWORK.md) — Aml. + ferielov + W-codes
- [EXPORTS.md](../EXPORTS.md) — CSV/PDF/A-melding/Tripletex
- [TRIPLETEX-INTEGRATION.md](../TRIPLETEX-INTEGRATION.md) — API + SalaryType-mapping
- ADR-0078 (channel restrictions), ADR-0133 (mobile boundary), ADR-0204 (gatedMutation), ADR-0245 (mobile contract flow), ADR-0252 (Riksavtalen versjonering)
- skill: smartout-nordic-split (design tokens, fonts, colors)

## Tracking

✅ Sofia leverte komplett design-pakke 2026-05-06. Skjermer 01–14 dekket via:
- `Payroll Prototype.html` — single-file målbilde
- 9 JSX-filer i `source/` — komponentnivå
- `IMPLEMENTATION.md` — sprint-plan + design-prinsipper

Surface-mapping per W-ID i tabellen øverst.

**Phase 1 MVP klar for build:** W1 + W2 + W3 + W4 + W5 + W6 ✅
**Phase 1.5 admin-cockpit klar:** W7 + W8 + W9 + W10 + W11 + W12 → integrert i Sofia's skjerm 02 + 07

**Build-agent neste steg:** Følg `IMPLEMENTATION.md` Sprint 1 først — engine + data-modell. Ingen UI før `payroll.calc.computePeriod()` står m/ snapshot-tester.
