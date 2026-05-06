---
title: Payroll Module — Full UI Plan
status: draft
updated: 2026-05-06
created: 2026-05-06
module: payroll
tags: [payroll, ui, ux, mobile, web, surfaces, phase-rollout]
---

# Payroll Module — Full UI Plan

> Complete inventory of EXISTING + NEW UI surfaces. Every gap mapped to phase. Mobile-web parity respected per ADR-0133. Reuses existing patterns where possible.

## 1. Bottom Line

**Eksisterende:** ~80% av employee-side mobil-UI finnes. ~50% av admin web-UI eksisterer (settings + my-salary + people HR-tab). **Hovedgap: `/dashboard/payroll/` admin hub finnes IKKE**, og 7 nye admin-flater må bygges.

**Nye surfaces totalt: 18 stk** (12 web admin + 4 web employee + 2 mobile employee).

## 2. Gap Mapping vs Pontus' Requests

| Pontus' need | Eksisterende? | Hva mangler |
|---|---|---|
| **Teamregistre** (admin oversikt over alle ansatte payroll-status) | ❌ | NEW: `/dashboard/payroll/team-registry` |
| **Ferieavvikling** (vacation management) | Partial — kvoter i `/my-salary` sidebar; ingen admin approve-flow | NEW: `/dashboard/payroll/vacation` + admin-side absence-approve |
| **Timebank-håndtering** (admin) | Partial — mobil read-only; ingen admin edit | NEW: `TimebankPanel` på people/[id] + admin justér-modal |
| **Håndtering av timer** (admin oversikt) | Partial — RosterTab viser planned vs actual | EXTEND: admin time-entry-edit + dispute-flow |
| **Kjøre payroll** (run calculation + lock + approve) | ❌ | NEW: `/dashboard/payroll/[periodId]` (Phase 1 SORTIE-spec) |
| **Registrere som betalt** (mark as paid + Tripletex sync) | ❌ | NEW: Export tab + Mark-as-paid action |
| **Skrive ut rapporter** (payroll reports) | Partial — generic reports; ingen payroll-specifikt | NEW: `/dashboard/payroll/reports` med 8 templates |

## 3. Existing Surfaces — Full Inventory

### 3.1 Mobile (employee, read-only per ADR-0133)

| Surface | Route | Status | Hooks |
|---|---|---|---|
| Payroll home (bento) | `/(me)/payroll/index.tsx` | ✓ Solid | `usePayrollSummary`, `usePayslips` |
| Payslip list | `/(me)/payroll/payslip-list.tsx` | ✓ Solid | `usePayslips` |
| Payslip detail | `/(me)/payroll/payslip-detail.tsx` | ✓ Solid (PII reveal stub) | `usePayslipDetail`, `useMyProfile` |
| Timebank balance + ledger | `/(me)/payroll/timebank.tsx` | ✓ Solid | `useTimebankBalance` |
| Supplement claims | `/(me)/payroll/supplements.tsx` | ✓ Solid | `useMySupplementClaims`, `useSubmitSupplement` |
| Absence balance | `/(me)/payroll/absence-balance.tsx` | ✓ Solid | `useAbsenceBalance` |
| Absence request | `/(me)/payroll/absence-request.tsx` | ✓ Solid | `useRequestAbsence` |
| Punch-in/out + live earnings | `/(home)/punch-clock.tsx` | ✓ Solid | `useShiftPhase`, `usePunch` |
| Clockout wizard (manager) | `/(home)/clockout.tsx` | ✓ M2 wizard | `useReconWizard` |

### 3.2 Web (admin + employee)

| Surface | Route | Status | Audience |
|---|---|---|---|
| My salary (employee) | `/dashboard/my-salary` | ✓ Solid | Employee |
| HR profile (Lønnsprofil + Tipsregel) | `/dashboard/people/[id]#hr` | ✓ Solid | Admin |
| Payroll general settings | `/dashboard/settings/payroll-general` | ✓ Solid | Admin |
| Salary codes settings | `/dashboard/settings/salary-codes` | ✓ Solid | Admin |
| Employee groups | `/dashboard/settings/employee-groups` | ✓ Solid | Admin |
| Supplement rules (6 types) | `/dashboard/settings/supplements` | ✓ Solid | Admin |
| Meal rules | `/dashboard/settings/meal-rules` | ✓ Solid | Admin |
| Shift types | `/dashboard/settings/shift-types` | ✓ Solid | Admin |
| Tariff rates panel | `/dashboard/settings/tariff-rates` | ✓ Solid | Admin |
| Employment contracts | `/dashboard/contracts` | ✓ Solid | Admin |
| Period close (reconciliation) | `/dashboard/close` | ⚠ Partial (Phase 1 erstatter) | Admin |
| Generic reports | `/dashboard/reports` | ⚠ Generic, ikke payroll-spesifikt | Admin |
| Absence approval | embedded i `/dashboard/schedule` | ⚠ Fragmentert | Manager/Admin |

## 4. New UI Surfaces — Full Inventory

### 4.1 Web Admin Hub (Phase 1 — SORTIE-spec'd)

| ID | Surface | Route | Phase | Description |
|---|---|---|---|---|
| **W1** | Payroll hub / period list | `/dashboard/payroll/page.tsx` | 1 | Liste over alle perioder m/ status-badges (open/locked/approved/exported), totals, filters |
| **W2** | Period detail | `/dashboard/payroll/[periodId]/page.tsx` | 1 | Tab-strip: Lines / Deviations / Manual / Tip / Export. Per-profile rader med totals-row øverst (Planday-mønster) |
| **W3** | Line drawer (drill-down) | komp i W2 | 1 | Per-profile drawer: Shifts / Lines / Audit tabs. Audit viser `shift_pay_calculation_event` chain |
| **W4** | Deviation drawer | komp i W2 | 1 | Per-deviation: paragraf-ref + computed values + acknowledge-form |
| **W5** | Lock modal | komp i W2 | 1 | Pre-check: BLOCKS hvis severity=error unack. Confirmation w/ totals |
| **W6** | Manual supplement form | komp i W2 | 1 | Admin add-supplement: salary-code-select + hours/amount + reason |

### 4.2 Web Admin Hub (Phase 1 EXTENDED — basert på Pontus' request)

| ID | Surface | Route | Phase | Description |
|---|---|---|---|---|
| **W7** | **Team registry** | `/dashboard/payroll/team-registry/page.tsx` | 1.5 | Workspace-bredt tabell: alle ansatte × payroll-status. Kolonner: navn, employment_form, hourly_rate eller månedslønn, holiday_allowance%, otp%, overtime_mode, current period status, timebank-saldoer (3 kontoer), siste lønnsslipp-dato. Filtre: avdeling, employment_form, deviation-flagg. Sort/search. Click → opens `/dashboard/people/[id]#hr` |
| **W8** | **Vacation management** | `/dashboard/payroll/vacation/page.tsx` | 2 | Workspace-vacation-overview: alle ferieuttak-requests + kvoter + saldo. Tabs: Pending requests / Approved / Calendar view (workspace-bredt). Approve/reject inline. Yearly summary: total opptjent feriepenger + utbetalt YTD |
| **W9** | **Time bank admin** | `/dashboard/payroll/time-banks/page.tsx` | 1.5 | Workspace-overview alle 3 tidskontoer: feriekonto NOK total + per ansatt drilldown, TOIL-saldo total + per ansatt, wellness-dager brukt/opptjent. Filter: account-type, profile, periode. Force-payout-action på TOIL-overshoot (>workspace.toil_max_banked_hours) |
| **W10** | **Run payroll** | `/dashboard/payroll/[periodId]/run/page.tsx` | 1 | Step-by-step run-flow: derive_shift_hours → snapshot_costs → aggregate_period → run_deviation_checks. Progress bar per step. Resultat-summary: X ansatte beregnet, Y deviations populert |
| **W11** | **Register as paid** | komp i W2 export-tab | 3 | "Mark as paid" action på approved+exported periode. Fyller `paid_at` + `paid_by` på `payroll_period`. Krever bekreftelse + kobling til ekstern referanse (Tripletex transaction_id eller bank-betalings-ID) |
| **W12** | **Reports hub** | `/dashboard/payroll/reports/page.tsx` | 4 | Payroll-spesifikt rapport-dashboard. 8 templates: lønnsoppgjør per periode, A-melding-summary, OT-cap-tracking, feriepenger-prognose, OTP-rapport, ansatt-kostnad-utvikling, tariff-compliance, deviation-historikk. Hver: filter (periode, avdeling, ansatt) + Export CSV/PDF |

### 4.3 Web Admin — Phase 2+ Extensions

| ID | Surface | Route | Phase | Description |
|---|---|---|---|---|
| **W13** | Inbox: wage-line override | `/dashboard/inbox?type=wage_line_override` | 2 | Existing inbox + nytt filter for `change_proposal kind='wage_line_override'`. Manager foreslår, admin approver. Audit chain |
| **W14** | Inbox: period approval | `/dashboard/inbox?type=period_approval` | 1.5 | Four-eyes flow: hvis workspace policy krever to admins for approve-period |
| **W15** | Skatteetaten status | `/dashboard/payroll/integrations/skatteetaten` | 5 | Per-ansatt skattekort-status (sist hentet, gyldig år, type, fail-tilstander). Manuell trigger refresh |
| **W16** | Tripletex sync status | `/dashboard/payroll/integrations/tripletex` | 7 | Per-periode sync-status. Linje-nivå: synced/failed/pending. Mapping-UI: SmartoutSalaryCode → TripletexSalaryType. Retry per linje |
| **W17** | A-melding export | komp i W12 reports | 6 | Generere XML for periode + validate mot XSD. Last ned eller "Send via Tripletex"-action |

### 4.4 Web Employee Read (extensions)

| ID | Surface | Route | Phase | Description |
|---|---|---|---|---|
| **W18** | My salary acknowledge | komp i `/dashboard/my-salary` | 4 | Push-notif "Lønnsslipp klar" → ansatt åpner → "Jeg har sett" knapp → `payslip_acknowledged_at` lagres. Audit-trail. Per O2 |
| **W19** | My time banks | `/dashboard/my-salary/time-banks` | 1.5 | Employee read-only view: feriekonto saldo + TOIL saldo + wellness-saldo. Ledger-historikk. Mobile har dette; web parity |
| **W20** | My contract amendment review | `/dashboard/my-contract/amendments` | 2 | Indekstillegg-amendments som ansatt skal akseptere. Liste + "Godta" knapp. Knytter til ADR-0252-flow |

### 4.5 Mobile Extensions (read-only per ADR-0133)

| ID | Surface | Route | Phase | Description |
|---|---|---|---|---|
| **M1** | Timebank chip-filter | utvid `/(me)/payroll/timebank.tsx` | 1 | Filter chips: [Feriepenger] [Avspasering] [Velferdsdager]. Default = alle. Per TIME-BANKS.md |
| **M2** | Payslip acknowledge | utvid `/(me)/payroll/payslip-detail.tsx` | 4 | "Jeg har sett denne lønnsslippen" knapp på payslip-detail. Push-notif når exported. Audit-emit |
| **M3** | Indekstillegg accept | `/(me)/contract/amendments.tsx` (NEW) | 2 | Mobil-versjon av W20. Ansatt godtar tariff-amendments via push-notif → tap → bekreft |

## 5. Shift-Authoring Surfaces (cost overlay extensions)

| ID | Surface | Phase | Description |
|---|---|---|---|
| **S1** | Shift-cost preview i schedule | extend `daily-grid.tsx` | 2 | Per-vakt-kost overlay (planned cost based on tariff + employee hourly_rate). Toggle on/off |
| **S2** | Publish-flow payroll-warning | extend `publish-overview-dialog.tsx` | 1.5 | Pre-publish surface W01 (rest period) + W02 (OT cap) som warnings. BLOCK på error. Manager kan override m/ dokumentert grunn |
| **S3** | Roster cost preview | extend `RosterTab.tsx` | 2 | Sum-row: total planlagt lønnskost vs faktisk lønnskost (basert på time_entry punch_in/out) |

## 6. Reusable Components Catalog

Bygg ikke fra null. Bruk eksisterende:

| Pattern | Location | Bruk for |
|---|---|---|
| `EntityDrawer` | `apps/web/src/components/dashboard/entity-drawer/` | LineDrawer, DeviationDrawer, TimebankAdjustModal |
| `settings-tabs.tsx` lazy-loaded tabs | `apps/web/src/app/dashboard/settings/_components/` | Period detail tab structure |
| `PeriodList` + `PayslipDetail` | `apps/web/src/app/dashboard/my-salary/_components/` | Reuse for admin period-list (W1) m/ workspace-scope |
| `useChangeProposals` hook | `apps/web/src/app/dashboard/_hooks/` | Inbox W13 + W14 |
| Drawer pattern | `useDrawerPayrollProfile` | TimebankPanel mount-point |
| Form fields + Zod | `react-hook-form` + `zod` | Manual supplement form W6 |
| Toast feedback | `sonner` | Alle mutations |
| Empty states | shadcn EmptyState | Period list, deviations, timebanks |

## 7. Phase Rollout — UI Surface per Phase

### Phase 1 (MVP — SORTIE-PHASE-1.md)
- W1, W2, W3, W4, W5, W6 (period list + detail + drill-down + lock + manual supplement)
- W10 (run payroll flow)
- TimebankPanel utvidelse på `LonnsprofilSection` (people/[id])
- M1 (mobile chip-filter)
- Settings: 19 nye policy-felt

### Phase 1.5 (parallel/extension — bygger på samme schema)
- W7 (team registry) — workspace-overview
- W9 (time bank admin) — workspace-overview alle kontoer
- W14 (period approval inbox) — four-eyes
- W19 (employee my-time-banks web parity)
- S2 (publish-flow payroll-warnings)

### Phase 2
- W8 (vacation management)
- W13 (wage-line override inbox)
- W20 + M3 (indekstillegg accept flow)
- S1 + S3 (shift cost preview overlays)

### Phase 3
- W11 (register-as-paid)
- CSV exports

### Phase 4
- W12 (reports hub) + 8 report templates
- W18 + M2 (payslip acknowledge)
- PDF lønnsslipp

### Phase 5
- W15 (Skatteetaten status panel)

### Phase 6
- W17 (A-melding XML export)

### Phase 7
- W16 (Tripletex sync status + mapping UI)

## 8. Mobile-Web Parity Boundary (ADR-0133)

| Action | Web | Mobile |
|---|---|---|
| View own payslip | ✓ (W18) | ✓ (M2) |
| View own time-banks | ✓ (W19) | ✓ (eksisterende + M1) |
| Request leave | ✓ (eksisterende my-schedule) | ✓ (eksisterende absence-request) |
| Submit supplement claim | ❌ | ✓ (eksisterende supplements.tsx) |
| Accept indekstillegg amendment | ✓ (W20) | ✓ (M3) |
| **Approve leave (admin)** | ✓ (W8) | ❌ |
| **Lock period (admin)** | ✓ (W2) | ❌ |
| **Approve period (admin)** | ✓ (W2 + W14) | ❌ |
| **Acknowledge deviation** | ✓ (W4) | ❌ |
| **Add manual supplement (admin)** | ✓ (W6) | ❌ |
| **Override line (manager+admin)** | ✓ (W13) | ❌ |
| **Run payroll** | ✓ (W10) | ❌ |
| **Register as paid** | ✓ (W11) | ❌ |
| **Export reports** | ✓ (W12) | ❌ |
| **Edit team registry** | ✓ (W7) | ❌ |
| **Reveal PII (own)** | ✓ | ✓ |
| **Reveal PII (other employee, admin)** | ✓ | ❌ |

Mobile = witness + execute. Web = compose + approve + report.

## 9. Empty States + Loading + Error Standards

Per Smartout-Nordic-Split design system. Hver ny side MÅ ha:

```
Loading state:
  - Skeleton matching final layout (no spinner-only)
  - <500ms first paint or skeleton holds

Empty state:
  - Centered card w/ icon + headline + 1-line description + primary CTA
  - Examples: "Ingen perioder ennå" w/ "Opprett første periode"-CTA

Error state:
  - Inline error in component (ikke full-page) for partial failure
  - Full-page boundary kun ved auth-fail eller schema-fail
  - Always w/ "Prøv igjen" action

Success/mutation feedback:
  - Sonner toast (eksisterende mønster)
  - Optimistic update via TanStack Query invalidation
```

## 10. Telemetry Coverage per Surface

Hver mutasjon emit per `packages/telemetry/src/registry.ts` ADR-0204:

| Surface | Events |
|---|---|
| W2 (period detail) | `payroll.period_locked`, `payroll.period_approved`, `payroll.deviation_blocked_approval` |
| W4 (deviation) | `payroll.deviation_acknowledged` |
| W6 (manual supplement) | `payroll.manual_supplement_added` |
| W7 (team registry) | `payroll.team_registry_viewed` (page-level) |
| W8 (vacation) | `payroll.vacation_request_approved`, `payroll.vacation_request_rejected` |
| W9 (time-banks admin) | `payroll.timebank_balance_adjusted`, `payroll.timebank_payout_forced` |
| W10 (run payroll) | `payroll.recalc_triggered` |
| W11 (register as paid) | `payroll.period_marked_paid` |
| W12 (reports) | `payroll.report_generated`, `payroll.report_exported` |
| W18 / M2 (acknowledge) | `payroll.payslip_acknowledged` |

## 11. Surface-Component Counts per Phase

| Phase | New routes | New components | New hooks | Estimat per surface (dev days) |
|---|---|---|---|---|
| 1 | 6 | ~18 | ~10 | 0.5–1 day per surface |
| 1.5 | 4 | ~12 | ~5 | 0.5–0.7 day per surface |
| 2 | 4 | ~10 | ~4 | 0.5 day per surface |
| 3 | 0 (extends W2) | 2 | 1 | 0.3 day |
| 4 | 1 (W12 hub) | ~12 (8 templates) | ~6 | 1 day for hub + 0.3 per template |
| 5 | 1 | 3 | 2 | 0.5 day |
| 6 | extends W12 | 1 | 1 | 0.5 day |
| 7 | 1 | 4 | 3 | 1 day |

**Total UI dev for module:** ~25–30 dev days fordelt på 7 phases.

## 12. Cross-References

- USER-FLOWS.md — flow A–I detail
- ARCHITECTURE.md §1 — system diagram
- TIME-BANKS.md §4 — UI integration
- DYNAMIC-SUPPLEMENTS.md §4 — Test-rule UI
- BENCHMARK-PLANDAY.md — UX patterns
- WORKSPACE-POLICIES.md — admin settings
- EXPORTS.md — export modal UX
- ADR-0133 — mobile-web boundary
- ADR-0245 — mobile contract flow precedent
- JOURNEY-payroll-foundation.md — verified mobile journeys
- JOURNEY-tips-leader-flows-leder-setter-pot.md — tips modal precedent

## 13. Out-of-Scope (UI-wise)

- Mobile-side admin payroll-edit (ADR-0133 boundary)
- Voice channel for any payroll PII (ADR-0078)
- Real-time collaborative editing (single-admin pattern)
- Bulk-import historical lønnslipper (Bubble migration done; no re-imports)
- Payroll-mode for trainee (no special UI; admin reviews via existing flow)
- Multi-currency UI (NOK only, ADR scoped)
- Payroll for non-Norwegian employees (separate ADR)

## 13.5 Design Reference Folder

**Location:** `docs/modules/payroll/design/` (Pontus populerer)

Pontus leverer HTML-mockup per surface i denne folderen. Build-agent bruker HTML som visuell spec ved implementering — Tailwind/shadcn-konvertering skjer ved Phase-tidspunkt for hvert surface.

Forventet struktur:
```
docs/modules/payroll/design/
├── W1-period-list.html
├── W2-period-detail.html
├── W3-line-drawer.html
├── W4-deviation-drawer.html
├── W5-lock-modal.html
├── W6-manual-supplement-form.html
├── W7-team-registry.html
├── W8-vacation-management.html
├── W9-time-bank-admin.html
├── W10-run-payroll.html
├── W11-register-as-paid.html
├── W12-reports-hub.html
├── W18-payslip-acknowledge.html
├── W19-employee-time-banks.html
├── W20-amendment-review.html
├── M1-mobile-timebank-filter.html
├── M2-mobile-payslip-acknowledge.html
└── M3-mobile-amendment-accept.html
```

Build-agent regler:
1. Les HTML-mockup som visuell SoT
2. Konverter til React/TSX m/ shadcn + Tailwind v4 + Nordic Split tokens
3. Kvalitet: pixel-parity ikke krav, men struktur/hierarki/spacing skal matche
4. Dynamisk data: erstatt mockup-strings m/ TanStack Query hooks

Folder finnes ikke ved skriving av denne planen (2026-05-06). Pontus leverer.

## 14. Decisions Pending

For UI plan to be ready-to-implement-by-build-agent:

| Q | Decision needed |
|---|---|
| Q1 | Skal `/dashboard/payroll/` være toppnivå i sidebar eller under "Operasjon"? |
| Q2 | Team-registry sort-default: alphabetical vs by-deviation-count? |
| Q3 | Vacation approve-flow: workspace-policy om manager kan approve, eller alltid admin? |
| Q4 | Reports-hub: filter-bar persistent eller per-report? |
| Q5 | Mobile timebank chip-filter: always-visible eller collapse? |
| Q6 | Run payroll-flow: full-page wizard eller modal? Recommendation: modal with progress |
| Q7 | Register-as-paid: kan reverseres? Recommendation: nei (audit anti-tamper) |

Pontus eller council må svare før Phase 1.5 kick-off.
