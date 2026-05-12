---
title: Payroll Module — Open Questions
status: draft
updated: 2026-05-06
created: 2026-05-06
module: payroll
tags: [payroll, open-questions, decisions-pending]
---

# Open Questions

> Unresolved decisions. Each question blocks at least one phase. Order: most-blocking first. Decision owner + recommended path included for each.

## O1. Multi-workspace per company A-melding aggregation

**Status:** unresolved
**Blocks:** Phase 6 (A-melding), Phase 7 (Tripletex)
**Owner:** Pontus + Skatteetaten

A single company (orgnr) can run multiple workspaces in Smartout. A-melding is filed per arbeidsgiver (orgnr), not per workspace. If a company has 3 workspaces under one orgnr, do we:
- a) File 1 A-melding per orgnr aggregating all workspaces?
- b) File 1 A-melding per workspace (3x for the company), Tripletex aggregates?
- c) Require separate orgnr per workspace (workaround, not solution)?

**Recommendation:** Defer to ADR-0250 §Open Question #1 resolution. v1 assumption: one workspace = one orgnr (de facto via `company_member`). Document this as constraint until separate ADR.

---

## O2. Lønnsgrunnlag acknowledgement requirement

**Status:** unresolved
**Blocks:** Phase 4 (PDF)
**Owner:** Pontus

Should employees actively acknowledge the lønnsgrunnlag (digital signature) or just view it?

- **View-only:** Simpler. Lønnsgrunnlag is informational; arbeidsgiver is legally responsible for correctness.
- **Acknowledge (no signature):** Push notification + button "I have seen this." Audit-emit. Builds dispute trail.
- **Digital signature (DocuSeal):** Heavy. No legal requirement in Norway for employee signing lønnsgrunnlag. Note: the actual lønnsslipp (tax-compliant) is produced by the accountant/Tripletex, not Smartout.

**Recommendation:** **Acknowledge button + audit-emit**. No DocuSeal. Simple `payslip_acknowledged_at` column on a new `payroll_payslip_view` table. Saves dispute trail without contract-level overhead.

---

## O3. Recalculation trigger model

**Status:** unresolved
**Blocks:** Phase 8 (Event Engine orchestration)
**Owner:** Pontus + system-agent-coordinator

When does payroll recalculate?

- **Auto on time_entry write (DB trigger):** Real-time accuracy; lots of redundant computation if 50 employees punch in/out per day.
- **Cron-driven (e.g. hourly):** Predictable load; up to 1h lag.
- **Manual + period-close cron:** Lowest cost; admin must remember.
- **Hybrid:** Auto on punch_out (single shift), cron on tariff/framework change, manual full-period button.

**Recommendation:** **Hybrid**. Per-shift on punch_out (cheap, single calc). Full-period on tariff/framework change. Manual button for "force recalc all" in admin UI.

---

## O4. A-melding submission timing

**Status:** unresolved
**Blocks:** Phase 6
**Owner:** Pontus

When does A-melding XML get submitted to Altinn?

- **Manual button:** Admin reviews, clicks "Send to Altinn." Lowest risk, requires action.
- **Auto on period.approved:** Highest automation. Admin needs to be VERY confident in approve.
- **Delegated to Tripletex:** Smartout never submits; Tripletex's monthly cron handles it (per ADR-0250 §Open Question #2).

**Recommendation:** **Delegate to Tripletex** for v1. ADR-0250 already proposes this. v2: optional direct Altinn submission with cert ownership transfer to Smartout.

---

## O5. Four-eyes default policy for period approval

**Status:** unresolved
**Blocks:** Phase 1.5
**Owner:** Pontus

When approving a period, should two admins be required by default?

- **Default ON:** Conservative; matches `change_proposal four-eyes` pattern (ADR-0254). Adds friction.
- **Default OFF + opt-in:** Fast; small workspaces (1-2 admins) don't have second admin available.
- **Workspace-policy:** Each workspace sets its own. Default OFF.

**Recommendation:** **Workspace-policy, default OFF**. Add `payroll_workspace_settings.requires_four_eyes_for_period_approval` boolean (default false). Single-admin workspaces work; multi-admin workspaces opt-in.

---

## O6. Period rollback semantics

**Status:** unresolved
**Blocks:** Phase 1
**Owner:** Pontus + Lovsen

If a period is `approved` and `exported` but a critical error is found (e.g. wrong tariff applied), how do we correct?

- **a) Unlock approved period, edit, re-approve, re-export:** Bokføringsloven §13 trail breaks. Tripletex period may be locked from their side. NOT RECOMMENDED.
- **b) New corrective period (e.g. April-corr-1):** Clean audit. Both periods exist in archive. Tripletex receives correction transactions.
- **c) Roll forward into next period (e.g. correction lines in May 2026):** Simpler, but employee sees confusing line items.

**Recommendation:** **Option b — corrective period**. Engine treats it as a new period spanning same dates with marker `is_corrective=true` and `corrects_period_id` FK. All payroll_calculation rows new. Old period stays frozen. New A-melding `corr` flag for impacted lines. ADR required.

---

## O7. Indekstillegg amendment requires new signature?

**Status:** unresolved
**Blocks:** Phase 1 (general payroll workflow stability)
**Owner:** Arbeidsrettsadvokat or NHO Reiseliv juridisk

Per ADR-0252 §D: indekstillegg auto-applies, employee gets notification only — no new signature.

Aml. §14-6 requires written contract; is e-mail/push notification sufficient?

**Lovsen confidence:** MEDIUM that varsling is enough. Risk of ulovlig endring claim is real.

**Recommendation:** Get arbeidsrettsadvokat or NHO Reiseliv juridisk to confirm. If not confirmed pre-Phase-1: require explicit ansatt-acknowledge on all indekstillegg amendments, even for tiny rate changes. Conservative.

---

## O8. Tips A-melding kode classification

**Status:** unresolved
**Blocks:** Phase 6 (A-melding)
**Owner:** Skatteetaten (bindende forhåndsuttalelse) or regnskapsfører

Pool-organized tips: kode 111-A (annenArbeidsinntekt) or `tips`?
Free-form tips passed direct to employee: who reports?

**Lovsen confidence:** MEDIUM — bransjepraksisen inkonsistent.

**Recommendation:** Get Skatteetaten BFU. Default until then: code 111-A for ALL pool-organized tips; non-pool tips not reported by Smartout (employee responsibility).

---

## O9. Lærlinglønn + OTP edge cases

**Status:** unresolved (deferred)
**Blocks:** Lærling-contracts (separate from main payroll roadmap)
**Owner:** Pontus + ADR-0253

Lærling under Opplæringsloven kap. 4: minstelønn ca 70-90% of full minstelønn; OTP plikt depends on stillingsprosent (>20%).

**Recommendation:** Out-of-scope for v1. Lærling-kontrakter stay BLOCKED per ADR-0241 until separate ADR resolves.

---

## O10. Frikort + AGA-fritak grenseverdier

**Status:** unresolved (annual maintenance pattern needed)
**Blocks:** Phase 5 (Skatteetaten fetch reliability)
**Owner:** Pontus + system-agent-coordinator

Frikort grense (<70k 2025) and AGA-fritak grense (<850 NOK/mnd 2025) update annually 1. januar. Engine must:
- Detect when grense exceeded and trigger correct trekk-logic
- Auto-update grenseverdier each year

**Recommendation:** New table `public.regulatory_threshold` with effective_from/until + grenseverdi per type. Seed via migration each January. Engine reads at calculation time. Add to recalc trigger when threshold table changes.

---

## O11. Nattillegg sats — delvis verifisert, kronetall MEDIUM confidence

**Status:** delvis løst (Lovsen-vurdering 2026-05-06) — kronetall må Pontus bekrefte mot Riksavtalen-PDF
**Blocks:** Phase 1 (calc engine produces wrong night-cost without rate)
**Owner:** Pontus (endelig bekreftelse + seed)

Lovgrunnlag: Riksavtalen §6 tillegg for ubekvem arbeidstid, tidsvindu **kl. 00:00–06:00**.

Satser per 1. april 2025 (MEDIUM confidence — verifiser mot NHO Reiselivs innloggede satsside):
- Nattvakter og sikkerhetspersonell: **42,41 kr/t**
- Manuelt arbeid (rengjøring, oppvask) kl. 01–06: **24,01 kr/t** (alternativt 143,92 kr/natt flat)
- Alle øvrige: **56,02 kr/t**

Stack-regel: kveldstillegg (15,65 kr/t kl. 18–24) og nattillegg overlapper ikke — kvelds slutter kl. 00, natt starter kl. 00. En vakt 22–03 gir 2t kvelds + 3t natt, ikke addert.

**Recommendation:** Pontus bekrefter kronetall mot Riksavtalen §6 PDF (fellesforbundet.no satser 2025). Seed tre separate `tariff_rate_table`-rader med `effective_from = '2025-04-01'`. Se TIME-BANKS-LEGAL.md §O11 + O16 for gruppe-klassifiserings-gap.

---

## O12. Delt vakt — terskel og sats: IKKE VERIFISERT nasjonalt

**Status:** delvis avklart — nasjonal flat-sats finnes sannsynligvis ikke i Riksavtalen (Lovsen-vurdering 2026-05-06)
**Blocks:** Phase 1 (calc engine produces no delt-vakt-tillegg) — men kan implementeres som workspace-konfigurerbar 0-default
**Owner:** NHO Reiseliv juridisk (for å bekrefte at ingen nasjonal sats finnes) + Pontus (workspace-default)

Riksavtalen §2-4 pkt. 4.4.1 gir ansatt rett til å be om delt arbeidstid 1 dag/uke — men inneholder ikke en fast kronesats for delt-vakt-tillegg. Terskel og sats avtales lokalt skriftlig.

Ingen nasjonal seed er mulig uten bekreftelse om at en sats eksisterer.

**Recommendation:**
1. Kontakt NHO Reiseliv juridisk for å bekrefte at ingen nasjonal delt-vakt-sats finnes i Riksavtalen.
2. Implementer som workspace-konfigurerbar regel: `split_shift_threshold_minutes` + `split_shift_allowance_amount` i `payroll_workspace_settings`. Default 0 (ingen tillegg).
3. Blokkerer ikke Phase 1 dersom default = 0 og konfigurerbarhet er på plass.

---

## O13. Forskuddstrekk-forskyvning fra januar 2026

**Status:** unresolved (regulatory change)
**Blocks:** Phase 7 (Tripletex sync)
**Owner:** Pontus + Tripletex docs

Per January 2026: forskuddstrekk MUST be paid to Skatteetaten the first working day after disbursement (not monthly).

Does Tripletex automatically handle this in their flow, or must Smartout schedule it?

**Recommendation:** Verify with Tripletex partner support. If Tripletex handles: no Smartout work. If not: Smartout must trigger Tripletex skattetrekk-betaling on a per-disbursement schedule, separate from period close.

---

## O14. Reise/diett skattefri grense — annual maintenance

**Status:** unresolved (annual maintenance pattern needed)
**Blocks:** Phase 1 (diett accuracy)
**Owner:** same as O10

Statens reisesatser update annually January. Engine needs annual re-seed.

**Recommendation:** Same `regulatory_threshold` table as O10. One row per (type, year): diett-uten-overnatting, diett-med-overnatting-innenlands, diett-med-overnatting-utlandet, kjøregodtgjørelse-km.

---

## O15. Constructive dismissal grense for 5–19% lønn-reduksjon

**Status:** unresolved (legal grey zone)
**Blocks:** Phase 1 (amendment-classifier policy)
**Owner:** Lovsen + Arbeidsrettsadvokat

Aml. §15-7 analogy is skjønnsbasert. 5–19% reduction is unclear.

**Recommendation:** Conservative default: ALL reductions ≥5% trigger MATERIAL + amendment-classifier flag. Document policy in workspace settings; admin can override per case (with paper trail).

---

---

## O16. Nattillegg: gruppe-klassifisering nattvakt vs. ordinaer

**Status:** unresolved (avdekket av Lovsen 2026-05-06)
**Blocks:** Phase 1 nattillegg-seed og rate-valg
**Owner:** Pontus

Riksavtalen har ulike satser (42,41 vs. 56,02 kr/t). Engine trenger et klassifiserings-felt — per kontrakt, per vakt, eller per stillings-type.

**Recommendation:** Klassifiser per `payroll_shift_type` (vakt-nivå), ikke kontrakt-nivå. Samme ansatt kan da ha nattvakt-rate på en vakt og ordinaer-rate på en dagvakt. Legg til `night_worker_category enum('night_watch', 'manual', 'ordinary')` på `payroll_shift_type`.

---

## O17. TOIL sluttoppgjør — utbetalingsplikts-hjemmel

**Status:** unresolved (LAV confidence — gråsone)
**Blocks:** Phase 1 TOIL-implementasjon (sluttoppgjør-logikk)
**Owner:** NHO Reiseliv juridisk eller arbeidsrettsadvokat

Ingen eksplisitt paragraf sier "TOIL-saldo utbetales ved fratredelse". Dekkes sannsynligvis av Aml. §14-15 (opptjent lønn-kravet), men tvist-risiko er reell.

**Recommendation:** Advokatvurdering. Inntil avklart: TOIL-avtalen skal inneholde eksplisitt sluttoppgjørs-klausul ("ved opphør utbetales gjenværende timer til timelønn på fratredelsesdatoen").

---

## O18. TOIL carry-over maks-grense (workspace-policy)

**Status:** unresolved (workspace-design-beslutning)
**Blocks:** Phase 1 TOIL (ingen lovkrav, men operasjonell risiko)
**Owner:** Pontus

Aml. setter ingen carry-over-grense. Lang saldo er arbeidsgivers balanse-risiko.

**Recommendation:** Workspace-policy med default `toil_max_banked_hours = 80`. Tvangsutbetaling av overskudd ved periodeslutt. Implementeres som `payroll_workspace_settings`-kolonne.

---

## O19. Hotelloverenskomsten vs. Riksavtalen nattillegg — to tariff-rader

**Status:** unresolved (avdekket av Lovsen 2026-05-06)
**Blocks:** Phase 1 nattillegg-seed for Virke-bundne workspaces
**Owner:** Pontus + ADR-0252

Hotelloverenskomsten (Virke) har separate satser fra Riksavtalen (NHO Reiseliv). `tariff_id` på `employment_contract` skiller allerede, men nattillegg-rader er ikke seeded for begge.

**Recommendation:** ADR-0252-prosessen seeder separate `tariff_rate_table`-rader per tariff-kilde. Krever tilgang til Hotelloverenskomstens 2025-satsark.

---

## O20. Velferdsdager / wellness days — absence_type + NAV-grensesnitt

**Status:** unresolved (workspace-design-beslutning)
**Blocks:** Velferdskonto-implementasjon (ikke Phase 1 blokkerende)
**Owner:** Pontus

"Wellness days" er bedriftspolitikk, ikke lovkrav. Ingen norsk lovregulering. Spørsmål om NAV-grensesnitt og egenmeldingstelling ved bruk.

**Recommendation:** Registrer som `absence_type = 'wellness'`, `is_paid = true`, `nav_reportable = false`. Påvirker ikke egenmeldingstelling. Workspace konfigurerer antall dager. Se TIME-BANKS-LEGAL.md §C for detaljer.

---

## O23. Tripletex SalaryType-mapping per workspace

**Status:** unresolved (avdekket av Tripletex-verifisering 2026-05-06)
**Blocks:** Phase 7 (Tripletex push-sync)
**Owner:** Per-workspace setup (not platform-default)

Tripletex has no platform-standard SalaryType codes for kveld/natt/helg/helligdag. Each Tripletex account configures its own. Smartout integration must:
1. On first connect: `GET /salary/type?count=1000` → discover what codes the workspace's Tripletex account has
2. Surface a mapping UI: "Smartout Riksavtalen-rate → Tripletex SalaryType"
3. Persist mapping in `payroll.salary_code.external_code` per workspace
4. Recheck mapping on Riksavtalen-amendment trigger (new rate-type may need new SalaryType)

**Recommendation:** Build mapping UI in Phase 7 — `dashboard/settings/_components/TripletexSalaryMappingPanel.tsx` (NEW). Mapping required before any sync attempt; Phase 7 sortie includes the UI.

---

## O24. Tripletex pre-populated nattillegg SalaryTypes

**Status:** UNVERIFIED — requires sandbox access
**Blocks:** Phase 7 onboarding-flow assumption
**Owner:** Pontus (sandbox account) + Tripletex partner support

Question: does Tripletex pre-populate **three** distinct nattillegg SalaryTypes (nattvakt + manuelt + øvrige), or just one generic "nattillegg" expected to be split by workspace?

If three pre-populated: mapping is automatic on first sync.
If only one: workspace admin must manually create two more SalaryTypes in Tripletex GUI before Smartout can map them.

**Recommendation:** Ship Phase 7 with both paths handled. Mapping UI shows status: "✓ Mapped" / "⚠ Missing — create in Tripletex first".

---

## O25. shift_pay_calculation_event tabel eksisterer ikke (ADR-0251 proposed)

**Status:** BLOCKING — schema-claim fabrikert
**Blocks:** Phase 1 §10.8 acceptance + ARCHITECTURE.md §3 audit-layer + DYNAMIC-SUPPLEMENTS.md §5
**Owner:** Pontus (ADR-0251 accept-decision)

**Verified:** `grep "shift_pay_calculation_event" packages/supabase/src/database.types.ts` → **0 hits**.

ADR-0251 status = `proposed` (ikke akseptert). Hele audit-layer-arkitekturen i ARCHITECTURE.md §3 + provenance-emit per supplement-firing i DYNAMIC-SUPPLEMENTS.md §5 + acceptance-test §10.8 forutsetter at tabellen finnes.

**Resolution paths:**
- a) **Accept ADR-0251** før Day 1 + inkluder migration `<ts>_payroll_phase1_pay_calc_audit.sql` som 6. migration i SORTIE-PHASE-1.md §4
- b) **Scope-out audit til Phase 1.5** — Phase 1 logger kun provenance JSONB i `payroll.calculation.provenance` / `shift_cost_snapshot.supplements.metadata`. Update ARCHITECTURE.md §3 + DYNAMIC-SUPPLEMENTS.md §5 + acceptance §10.8.

**Recommendation:** Path (a) — ADR-0251 er trolig riktig design (Bokf. §13). Skriv ferdig + accept som del av pre-flight.

---

## O26. payroll.timebank_entry schema fundamentalt ikke som TIME-BANKS.md hevder

**Status:** BLOCKING — re-design eller bredde-ALTER kreves
**Blocks:** Phase 1 time-banks deliverable
**Owner:** Pontus + system-agent-coordinator

**Verified:** `database.types.ts:1532-1583` viser `payroll.timebank_entry` har KOLONNER:
```
created_at, created_by, description, effective_date,
entry_type (enum: accrual|withdrawal|adjustment|expiry|carry_over|payout),
expiry_date, hours, id, payroll_calculation_id,
profile_id, schedule_absence_id, workspace_id
```

**Mangler:** `account_type`, `value_amount`, `value_unit`, `occurred_at`, `metadata`. Tabellen er **kun timer-basert** (`hours numeric`). Ingen `payroll.timebank_account_type` enum eksisterer.

TIME-BANKS.md §1 "Reuse Decision" basert på FEIL premiss — dette er ikke clean reuse, det er en re-design.

**Resolution paths:**
- a) **Bredde-ALTER:** Add `account_type` enum (`vacation_pay|toil|wellness`) + `value_amount numeric` + `value_unit text CHECK ('hours','NOK','days')`. Backfill eksisterende rows `account_type='toil', value_amount=hours, value_unit='hours'`.
- b) **Split per kontotype** (cleaner cascade): `payroll.vacation_pay_ledger` (NOK) + behold `payroll.timebank_entry` (hours, TOIL only) + `payroll.absence_quota` (days, wellness via `absence_type='wellness'`). Hver tabell én datatype.

**Recommendation:** Path (b). Cleaner cascade-mønster. TIME-BANKS.md §1 må re-skrives etter beslutning. Estimat +1 dag på Phase 1 schema-arbeid.

---

## O27. payroll.calculation.provenance kolonne ikke verifisert

**Status:** UNVERIFIED — verify før Day 1
**Blocks:** Cascade INV-3 (provenance på øverste C3 decision-rad)
**Owner:** Pontus eller build-agent verifikasjon

DATA-MODEL.md §2.2 line 127 lister `provenance JSONB` på `payroll.calculation`. Hvis kolonnen mangler, hele provenance-mønsteret bryter på top-nivå.

**Resolution:** `grep -A 30 "      calculation: {" packages/supabase/src/database.types.ts | grep provenance`. Hvis 0 treff: schema-delta `<ts>_payroll_phase1_calc_provenance.sql` må legges til SORTIE-PHASE-1.md §4.

---

## O28. Add-manual-supplement role inkonsistent i 3 docs

**Status:** RESOLVED — pick admin
**Blocks:** Phase 1 capability authority seed
**Owner:** Pontus (decision)

**Inkonsistens:**
- MODULE_PAYROLL.md §5 line 144: `min_role=admin`
- ARCHITECTURE.md §4.2 line 233: `min_role=admin`
- SORTIE-PHASE-1.md §8 line 314: `min_role=manager`

**Decision:** `min_role=admin`. Per-shift adjust som genererer payroll-konsekvens er admin-action. Workspace-policy kan upgrade manager → admin per workspace senere hvis behov.

**Action:** Update SORTIE-PHASE-1.md §8 line 314 + §4.1 line 139 fra `'manager'` til `'admin'`.

---

## O29. ADR-0250 + ADR-0251 status proposed but build assumes accepted

**Status:** BLOCKING — promote both ADRs eller scope-out
**Blocks:** Phase 1 (R1) + Phase 5 Skatteetaten flow
**Owner:** Pontus

Cascade Control Gate-regel: "Forward-looking plans are not current truth ... they do not override current code, ADRs, or verified state until landed."

ADR-0250 (Skatteetaten cert + flow) og ADR-0251 (audit-tabel) er begge `proposed`. SORTIE-PHASE-1.md §10.8 + flere docs påberoper begge som hard acceptance.

**Resolution:** Pre-flight blocker kombinert med O25.

---

## O30. I1 hospitality-bootstrap mangler 19 nye payroll_workspace_settings felt

**Status:** BLOCKING for nye workspace-create + Bubble-migrerte workspaces
**Blocks:** Phase 1 — påvirker Strøm Mat & Bar, Bårdshaug Vegkro, Yogurt Heaven (Bubble-migrerte)
**Owner:** Pontus + Day 0.5 task

Cascade INV: "Bootstrap is a release gate. Any plan that adds cascade consumers while I1 bootstrap is still unwired must be flagged as incomplete or unsafe."

19 nye workspace-policy-felt i SORTIE-PHASE-1.md §3 har DB-defaults. Men `packages/ai/src/industry/packages/hospitality.ts` payrollSettings export og `supabase/templates/restaurant/_apply.sql` template må også vite om feltene — ellers seedes nye workspaces med hardkodede DB-defaults i stedet for industry-package defaults.

**Resolution:** Day 0.5 task lagt til SORTIE-PHASE-1.md §12: "Update `packages/ai/src/industry/packages/hospitality.ts` payrollSettings + `_apply.sql` template med 19 nye felt."

---

## O22. Overtime-mode toggle — ADMIN or MATERIAL amendment?

**Status:** unresolved (avdekket av TIME-BANKS.md design 2026-05-06)
**Blocks:** Phase 1 TOIL-toggle UX
**Owner:** Arbeidsrettsadvokat eller NHO Reiseliv juridisk

When admin (or employee with admin approval) flips `employee_payroll_profile.overtime_mode` from `paid_out` to `banked`:
- Lovsen MEDIUM confidence: this is ADMIN amendment (not MATERIAL) because tillegg fortsatt utbetales — only base hours move from cash to time-bank.
- Counter-argument: "predictable cash flow" is a contract feature. Switching from monthly cash to time-bank could be argued as MATERIAL forutsigbarhets-endring per ADR-0236.

**Recommendation:** Conservative until advokat confirms — classify as ADMIN with audit-emit + employee notification. Do NOT auto-trigger `change_proposal four-eyes`. Document policy in workspace settings; flag for review on first 3 toggles per workspace.

---

## O21. Feriekonto multi-workspace (jf. O1)

**Status:** deferred (avhenger av O1-resolusjon)
**Blocks:** Phase 1 feriekonto ved multi-workspace-selskap
**Owner:** Defer til O1-ADR

Feriekonto er workspace-isolert inntil O1 (multi-workspace per orgnr) er løst. Dokumentér som kjent begrensning.

**Recommendation:** Ingen tiltak nå. Merge med O1-ADR når den skrives.

---

## Decision Tracking

When a question is resolved:
1. Add an ADR if architectural.
2. Update this file: status = resolved, decision recorded inline, link to ADR.
3. Unblock the dependent phase.

Open questions checked at start of each sortie. Cannot start a phase if it has un-resolved blockers.

---

## Aging

- O1, O3, O5, O6: should resolve before Phase 1 kicks off (~1 week)
- O7, O8: needs external advisory; can run in parallel with Phase 1 build
- O11: kronetall MEDIUM confidence — Pontus verifiserer mot Riksavtalen PDF, ~30 min
- O12: nasjonal sats finnes sannsynligvis ikke — NHO Reiseliv juridisk bør bekrefte, ikke blokkerende hvis default=0
- O16–O21: avdekket av TIME-BANKS-LEGAL.md gjennomgang 2026-05-06
- O2, O10, O14, O15: nice-to-have decisions; can defer
- O4, O13: integration-time; resolve before Phase 6 / 7
- O9: out-of-scope, no aging
