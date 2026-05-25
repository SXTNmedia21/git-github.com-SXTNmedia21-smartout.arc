---
title: "Sunday Period Close — Bella Vista payroll + billing simulation findings"
created: 2026-05-25
updated: 2026-05-25
agent: A5
slice: Sun period-close
tags: [simulation, payroll, billing, period-close, compliance, A-melding, Riksavtalen, Aml.]
---

# Agent A5 — Sunday Period Close Findings

> Simulation: Bella Vista (18-employee Oslo bistro). Personas: Pontus (owner) + Erik (manager).
> Slice: Step 1–8 of the Sunday plan (platform-admin billing, ad-hoc invoice, payroll lock, governance sign-off).
> Dedup baseline: BUG-1..22 from `docs/test-runs/2026-05-23-journey-sweep/BUGS.md` — not re-reported.

---

## Findings

### GAP-A5-01 — Period "approved" status has no BFF route: owner sign-off is a ghost step 🔴 CRITICAL

**Slice step:** Step 8 — "Owner signs off period → settles"

**Evidence:**
- `payroll.period_status` enum has 4 values: `open` | `locked` | `approved` | `exported`
  (`supabase/migrations/20260422110000_payroll_enums.sql:70`)
- `payroll.period` table has columns `approved_by` and (implied) approval lifecycle
  (`docs/domains/payroll/DATA-MODEL.md:34`)
- Every BFF route guards against `approved` status: `lock-period`, `recalculate-period`,
  `run-deviation-checks`, `derive-shift-hours`, `add-manual-supplement` all reject if
  `status === "locked" || "approved"` — meaning the code *expects* an approved state
  (`apps/web/src/app/api/payroll/lock-period/route.ts:88`,
   `apps/web/src/app/api/payroll/run-deviation-checks/route.ts:90`)
- **No BFF route exists for `POST /api/payroll/approve-period`** — exhaustive `find` of
  `apps/web/src/app/api/payroll/` confirms no `approve-period/` folder
- `PeriodHeader.tsx` renders only **"Beregn på nytt" + "Lås periode"** buttons for
  open periods; no "Godkjenn" (approve) CTA exists anywhere
  (`apps/web/src/app/dashboard/payroll/[periodId]/_components/PeriodHeader.tsx:80-103`)
- `USER-FLOWS.md` lists no Phase 1/2/… flow for period approval
  (`docs/domains/payroll/USER-FLOWS.md`)

**Impact:** Pontus (owner) **cannot advance the period from `locked` → `approved`**. The
`approved_by` column on `payroll.period` will never be populated. Downstream `exported`
status transition is also unreachable. Four-eyes policy referenced in GAPS-AND-DEBT G6
("Four-eyes default policy ADR for period lock") is not the same gap — that is about
*who* locks, not about the separate owner approval step the simulation spec defines.

**Compliance note:** For audit purposes (Bokf. §13, skatteetaten archival), the locked
lønnsgrunnlag needs a recorded approver. `approved_by` column exists but is never written.
This is a data-integrity gap — exported CSVs and PDFs carry no approval provenance.

---

### GAP-A5-02 — Deviation W09 (OT pre-approval) fires false-positives for every overtime shift — manager permanently blocked without workaround 🟠 HIGH

**Slice step:** Step 5 — "Erik resolves payroll deviations"

**Evidence:**
- `deviation-checks.ts` comment at W09:
  > "W09 fires when overtime_requires_pre_approval=true AND any shift has OT (W02 trigger).
  > This is conservative: it will produce a false-positive for shifts where OT was verbally
  > approved. Admin must acknowledge."
  (`packages/payroll-calculate/src/deviation-checks.ts:28-33`)
- `DeviationChecksInput` has `preApprovedShiftIds?: ReadonlySet<string>` but the BFF
  `run-deviation-checks/route.ts` passes no set for this — the optional defaults to
  `new Set<string>()` (empty), meaning **ALL overtime shifts get a W09 warning regardless**
  (`apps/web/src/app/api/payroll/run-deviation-checks/route.ts:280-285`)
- For Bella Vista (18 staff, busy Friday night), `overtime_requires_pre_approval=true` in
  `payroll.workspace_settings` means Erik will see W09 on every Friday/Saturday shift
  that ran long

**Impact:** Erik faces a wall of W09 warnings every period. Since there is no dedicated
OT pre-approval table, he must manually acknowledge each one with a free-text resolution
("verbally approved"). For 18 staff × ~4 OT shifts/month = ~72 manual acknowledgements
before lock. This is not an "advisory" experience — it is a blocker in practice.

**Fix hint:** Either (a) build a simple `ot_preapproval` table that Erik populates at
schedule-publish time, or (b) downgrade W09 to `info` severity and document as advisory-only.
Currently any workspace with `overtime_requires_pre_approval=true` is permanently stuck.

---

### GAP-A5-03 — No feriepenger (holiday pay) deviation check: illegal underpayment silently passes period lock 🔴 CRITICAL (compliance)

**Slice step:** Step 6 — "Erik locks period"

**Evidence:**
- W01–W14 deviation checks fully enumerated in `deviation-checks.ts`. Checks cover:
  Aml. rest time (W01), daily/weekly OT caps (W02-W04), tax card (W05), TOIL (W06),
  deduction floor (W07), punch gaps (W08-W09), breaks (W10), split shifts (W11),
  wellness quota (W12), minstelønn tariff (W13), 90%-regel (W14).
  (`packages/payroll-calculate/src/deviation-checks.ts:1-754`)
- **No check exists for feriepenger rate** — the engine never verifies that
  `vacation_pay_pct` is ≥ 10.2% (Ferieloven §10 nr. 3, standard rate) or ≥ 12.0%
  for workers over 60 (Ferieloven §10 nr. 4), or ≥ 12.0% as typical Riksavtalen
  rate used in `payroll.workspace_settings.vacation_pay_pct` default
  (`apps/web/src/app/api/payroll/run-deviation-checks/route.ts:227`: hardcoded 12.0)
- `timebank-emitter.ts` accrues feriepenger via `vacation_pay_pct` but no check
  validates this pct is legal before period lock
  (`packages/payroll-calculate/src/timebank-emitter.ts:83-90`)
- `payroll.workspace_settings` defaults `vacation_pay_pct = 12.0` but an admin can
  change it to, say, 5% without triggering any deviation

**Compliance note (Ferieloven §10):** Ferieloven § 10 nr. 3 mandates minimum 10.2%
feriepenger on previous year's earnings (feriepengergrunnlag). Workers over 60 get
minimum 12.5% (§ 10 nr. 4). Riksavtalen typically sets 12%. A workspace with
`vacation_pay_pct = 5` could lock a period containing 18 employees' feriepenger
underpayment with no system warning. This is a silent compliance breach, not a UX issue.

---

### GAP-A5-04 — No OTP (mandatory occupational pension) check: employer obligation invisible in payroll close flow 🟠 HIGH (compliance)

**Slice step:** Step 6 — "Erik locks period" / Step 7 — "Owner reviews governance"

**Evidence:**
- W01–W14 checks make no reference to OTP (Obligatorisk tjenestepensjon). Confirmed by
  exhaustive grep of `deviation-checks.ts` for `pension`, `OTP`, `tjenestepensjon`
  — zero matches
  (`packages/payroll-calculate/src/deviation-checks.ts:1-754`)
- `employee_payroll_profile` tracks `pension_scheme` (capability tool `set_pension_scheme`
  in `packages/ai/src/capabilities/payroll/tools.ts` docstring), but no deviation check
  validates that all active employees have a pension scheme set before period lock
- OTP law (Lov om obligatorisk tjenestepensjon §2) requires at least 2% of salary above
  1G for all employees working ≥ 20% of full time. A 18-employee restaurant will
  definitely have multiple employees above this threshold

**Compliance note:** Period lock without a W-check for missing `pension_scheme` on
qualifying employees means Smartout does not surface the employer's mandatory OTP
obligation at the natural audit point (period close). Tripletex push-sync (Gap G1 in
GAPS-AND-DEBT) would normally carry this, but that is Phase 7 (not shipped). Until
then, there is no compliance gate at all.

---

### GAP-A5-05 — A-melding described as "out of scope" (D7) but UI has `Lønnskode` field labelled "A-melding" — creates false expectation for Erik 🟡 MEDIUM (UX confusion)

**Slice step:** Step 5 — "Erik resolves payroll deviations / adds manual supplements"

**Evidence:**
- `ManualSupplementForm.tsx:295` renders a free-text input labelled `Lønnskode` with
  hint `A-melding`:
  `<FieldLabel label="Lønnskode" hint="A-melding" />`
  (`apps/web/src/app/dashboard/payroll/[periodId]/_components/ManualSupplementForm.tsx:294-296`)
- `payroll.salary_code` catalog table exists (`docs/domains/payroll/DATA-MODEL.md`) but
  the `Lønnskode` field is a free-text input, not a dropdown bound to the catalog
- GAPS-AND-DEBT D7 explicitly states:
  > "Smartout does not submit A-melding — accountant uses Tripletex/Visma with the
  > Phase 3/4 exports. ADR-0250 governs."
  (`docs/domains/payroll/GAPS-AND-DEBT.md:75`)
- Erik at Bella Vista will type a salary code (e.g. "5210") in the hint-labelled field
  and expect it to appear in an A-melding submission. It never will.

**Impact:** False promise in the UI. The field's data goes into `payroll.manual_supplement`
but has no downstream pipeline to Altinn A-melding. A Norwegian payroll manager reading
"A-melding" on a field understands it as "this feeds the monthly Altinn report." It does not.

**Fix:** Either (a) rename hint to "Lønnskode (CSV-eksport)" or remove the `hint` prop,
or (b) bind to `payroll.salary_code` catalog dropdown and document the CSV-export
pipeline, not A-melding.

---

### BUG-A5-06 — `run-deviation-checks` silently ignores `punchOutMissingShiftIds` — W08 never fires 🟠 HIGH (logic bug)

**Slice step:** Step 6 — "Erik locks period" (recalculate before lock)

**Evidence:**
- `DeviationChecksInput` has `punchOutMissingShiftIds?: ReadonlySet<string>` (defaults to
  `new Set<string>()`)
  (`packages/payroll-calculate/src/deviation-checks.ts:690`)
- `run-deviation-checks/route.ts` builds `InterpretedShift[]` from `payroll.calculation`
  rows, setting `effective_end: c.actual_end ?? ""` when `actual_end` is null
  (`apps/web/src/app/api/payroll/run-deviation-checks/route.ts:166-181`)
- **The route never populates `punchOutMissingShiftIds`** — it passes the default empty
  set, meaning W08 ("Punch-out missing: time_entry.punch_out was null") is checked
  against an always-empty set and **will never fire**, even when all 14 Friday-night
  shifts had punch-out auto-filled from scheduled end
  (`apps/web/src/app/api/payroll/run-deviation-checks/route.ts:280-285`)

**Impact:** During Friday night service (14 staff) with the POS down (deviation logged
in A3 simulation), punch-outs may be missing for multiple employees. W08 is supposed to
surface these as info deviations so Erik can manually verify. It does not. Erik sees
clean calculated hours but has no visibility into which ones used scheduled end.

---

### GAP-A5-07 — Billing: `platform_metrics_daily` table unknown — billing landing page silently renders with empty MRR chart 🟡 MEDIUM

**Slice step:** Step 1 — "Pontus opens /platform-admin/billing"

**Evidence:**
- `platform-admin/billing/page.tsx:24` queries `admin.from("platform_metrics_daily")`:
  ```ts
  admin.from("platform_metrics_daily").select("date, mrr_nok")...
  ```
  (`apps/web/src/app/platform-admin/billing/page.tsx:24-28`)
- `grep -rn "platform_metrics_daily" supabase/migrations/` returns no migration that
  creates this table. No migration in `supabase/migrations/` creates
  `platform_metrics_daily` or any materialized view with that name. (Confirmed by
  exhaustive listing — table does not appear in any .sql file.)
- `metricsResult.data` will be `null` on query failure, silently falling back to
  `mrrData: []`; the MRR chart renders as flat zero-line with no error state

**Impact:** Pontus opens billing, sees no MRR trend, assumes the product has no revenue.
The query either returns empty (table exists but empty) or silently fails (table does not
exist). Either way, the owner's first billing view is broken with no feedback.

**Fix:** Verify whether `platform_metrics_daily` is a materialized view (not in
migrations but created outside schema control), or add the missing migration / error
boundary on empty data.

---

### GAP-A5-08 — Ad-hoc invoice: `due_at` disabled on `draft` status but period/due validation is missing — invoice created with `period_from > period_to` passes 🟡 MEDIUM

**Slice step:** Step 2 — "Pontus runs ad-hoc invoice for plan upgrade"

**Evidence:**
- `AdHocInvoiceDrawer.tsx:95-96`:
  ```ts
  const [periodFrom, setPeriodFrom] = useState(...today);
  const [periodTo, setPeriodTo] = useState(...today);
  ```
  Both default to today.
- `canSubmit` validation at line 120-130 checks `description.trim().length > 0`,
  `quantity > 0`, `unit_price >= 0`, `vat_rate >= 0` — **no check that
  `periodFrom <= periodTo`**
  (`apps/web/src/app/platform-admin/billing/invoices/_components/ad-hoc-invoice-drawer.tsx:120-130`)
- `due_at` input is disabled when `status === "draft"` (line 325: `disabled={status === "draft"}`)
  but the Zod schema `CreateAdHocInvoiceInputSchema` may not enforce period ordering
  server-side either (cannot see `@smartout/billing` package source directly, but the
  BFF action passes `period_from` + `period_to` without pre-validation)

**Impact:** An admin (or owner with super-admin) can create an ad-hoc invoice with
`period_from = 2026-06-01` and `period_to = 2026-05-01` (swapped). Invoice is created
as draft. The `invoice` immutability trigger fires only on `draft→issued` transitions —
swapped period stays in the DB until the accountant notices.

**Compliance note:** Næringslovgivningen (regnskapsloven §7-2) requires invoices to
state correct period. A reversed period on an issued invoice is a material error.

---

### GAP-A5-09 — `useLockPeriod` hook has no `emit()` call in `onSuccess` — ADR-0193 mutation telemetry missing at UI level 🟡 MEDIUM

**Slice step:** Step 6 — "Erik locks period"

**Evidence:**
- `use-lock-period.ts` `onSuccess` handler:
  ```ts
  onSuccess: (result) => {
    if (!result.ok) return;
    void queryClient.invalidateQueries({...});
    void queryClient.invalidateQueries({...});
  }
  ```
  No `emit()` call. (`apps/web/src/app/dashboard/payroll/[periodId]/_hooks/use-lock-period.ts:48-58`)
- ADR-0193 (referenced in `tools.ts:4`) + CLAUDE.md mandate: "Never create a TanStack
  Query mutation without an `emit()` call in `onSuccess`"
- The BFF route does emit `payroll.period_locked` server-side (correct), but the client
  mutation hook skips its own instrumentation — missing UI-level event for analytics

**Note:** This is lower severity since the server emits correctly. However, it violates
the project-wide invariant and will be flagged by any future ADR-audit sweep.

---

## Compliance gaps (Aml./Riksavtalen/A-melding)

| # | Law/Tariff | Article | Gap in system | Severity |
|---|---|---|---|---|
| C1 | Ferieloven | §10 nr. 3–4 | No deviation check validates `vacation_pay_pct ≥ 10.2%`. Illegal underpayment passes period lock. (GAP-A5-03) | CRITICAL |
| C2 | Lov om OTP | §2 | No check that all qualifying employees have a pension scheme before lock. OTP obligation invisible. (GAP-A5-04) | HIGH |
| C3 | Bokf.loven | §13 | `approved_by` column on `payroll.period` never populated — no approval provenance on locked lønnsgrunnlag/CSV. (GAP-A5-01) | CRITICAL |
| C4 | Aml. | §10-6 | W09 (OT pre-approval) fires false-positive for every OT shift because `preApprovedShiftIds` is never populated by BFF. Effectively forces admin to acknowledge every OT shift as "verbally approved." (GAP-A5-02) | HIGH |
| C5 | Regnskapsloven | §7-2 | Ad-hoc invoice allows `period_from > period_to` — material error on issued invoice. (GAP-A5-08) | MEDIUM |
| C6 | A-melding (Altinn) | §3-1 Ltr. a | UI field labelled "A-melding" hint on salary code creates false expectation — Smartout does not submit A-melding per ADR-0250. Ops risk: admin believes compliance is satisfied when it is not. (GAP-A5-05) | MEDIUM |

---

## Summary table

| # | ID | Type | Severity | Step | File |
|---|---|---|---|---|---|
| 1 | GAP-A5-01 | Gap | CRITICAL | Step 8 (owner sign-off) | `apps/web/src/app/api/payroll/` (no approve-period/ route) |
| 2 | GAP-A5-02 | Gap | HIGH | Step 5 (deviations) | `run-deviation-checks/route.ts:280` |
| 3 | GAP-A5-03 | Gap | CRITICAL | Step 6 (lock) | `deviation-checks.ts:711` (W01–W14, no W-feriepenger) |
| 4 | GAP-A5-04 | Gap | HIGH | Step 6+7 | `deviation-checks.ts:711` (no OTP check) |
| 5 | GAP-A5-05 | Gap | MEDIUM | Step 5 | `ManualSupplementForm.tsx:295` |
| 6 | BUG-A5-06 | Bug | HIGH | Step 6 | `run-deviation-checks/route.ts:280` (punchOutMissingShiftIds never set) |
| 7 | GAP-A5-07 | Gap | MEDIUM | Step 1 | `billing/page.tsx:24` (`platform_metrics_daily` missing migration) |
| 8 | GAP-A5-08 | Gap | MEDIUM | Step 2 | `ad-hoc-invoice-drawer.tsx:120` (no period ordering validation) |
| 9 | GAP-A5-09 | Bug | LOW | Step 6 | `use-lock-period.ts:48` (no emit in onSuccess) |
