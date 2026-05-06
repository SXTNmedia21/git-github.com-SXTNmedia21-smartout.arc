---
title: Lovsen Learning — Payroll Module Blueprint Session
status: active
type: learning
created: 2026-05-06
updated: 2026-05-06
agent: lovsen
session: payroll-module-blueprint
tags: [learning, payroll, aml, riksavtalen, ferieloven, otp, a-melding, bokføringsloven]
---

# Lovsen Learning — Payroll Module Blueprint Session (2026-05-06)

> Session output: `docs/modules/payroll/` (9 blueprint docs). Lovsen authored `LEGAL-FRAMEWORK.md`. This file captures legal learnings + decisions + open questions surfaced during planning that the Lovsen agent should persist for future invocations.

---

## 1. Decisions Made (Authoritative — apply going forward)

### D1. Aml. §10-6 enforcement = blocking gate, not advisory
**Decision:** Engine BLOCK shift-create when overtime cap exceeded. Override path: documented `change_proposal` with `agreement_type` declaration.

**Why:** ADR-0254 requires CHECK-constraint enforcement; soft-warn would let workspaces drift past tariff-tier ceilings. Lovsen confidence HØY that hard block matches §10-6 strict reading.

**How to apply:** When user asks "kan jeg sette opp overtidsvakt nr. 11 denne uken?" Lovsen recites Aml. §10-6 fjerde ledd cap (10t/uke standard, 20t/uke med tariffavtale) + asks `agreement_type` from `overtime_cap_policy`.

---

### D2. Bokføringsloven §13 retention anchor = `shift_period_end_date` (not `created_at`)
**Decision:** All payroll audit rows (`shift_pay_calculation_event`, `payroll_calculation_line`) calculate 5-year retention from regnskapsår-slutt of the period the row belongs to.

**Why:** ADR-0251 §E. `created_at` would let recently-created records expire too soon if the underlying period is old (e.g. retroactive correction in 2030 of a 2024 shift would have wrong retention clock).

**How to apply:** When user asks "kan jeg slette gamle lønnsslipper fra 2018?" Lovsen sjekker `shift_period_end_date < date_trunc('year', now()) - interval '5 years'` — only deletable if anchor date is past, regardless of when row was created.

---

### D3. Constructive dismissal-grense = 5% reduksjon (conservative default)
**Decision:** ALL payroll-changes that reduce effective lønn ≥5% trigger MATERIAL classification + amendment-flagg, even though 5–19% is a legal gråsone.

**Why:** ADR-0236 + ADR-0244 mandate is_constructive_dismissal_risk flag. Choosing 5% over (e.g.) 20% is conservative — over-flags but never under-flags. Underflag = lawsuit risk.

**How to apply:** When user asks "kan jeg redusere månedslønn fra 35k til 33k?" (5,7%): Lovsen flag MATERIAL + sier "krever ny ansatt-signering, samme prosess som ved større endring. Anbefal saklig grunn-dokumentasjon."

---

### D4. Indekstillegg autonomy still gråsone — escalate
**Decision:** ADR-0252 §D gir indekstillegg `authority=autonomous` (no new signature). Lovsen says MEDIUM confidence — push to advokat eller NHO Reiseliv for resolution.

**Why:** Aml. §14-6 krever skriftlig kontrakt. E-post/push-varsling kan være tilstrekkelig dokumentasjon men er uavklart. Risk of "ulovlig endring"-claim is real.

**How to apply:** When indekstillegg-amendment-event observerer i `engine_event`, Lovsen escalates med disclaimer: "Indekstillegg auto-godkjent etter ADR-0252. Aml. §14-6 dokumentasjons-krav er gråsone — anbefales advokat-bekreftelse før dette går i prod."

---

### D5. Tips A-melding-koding = 111-A som default (annenArbeidsinntekt)
**Decision:** Pool-organiserte tips kodes som 111-A (annenArbeidsinntekt) i A-melding inntil Skatteetaten BFU foreligger.

**Why:** Bransjepraksisen inkonsistent. 111-A er den brede koden som dekker pool-fordelte tips. Free-form tips (gjest til ansatt direkte) ikke rapportert via Smartout — ansatt-ansvar.

**How to apply:** Når user spør "hvilken A-melding-kode for drikkepenger?", Lovsen siterer 111-A med MEDIUM confidence + anbefaler Skatteetaten BFU for full sikkerhet.

---

## 2. New Compliance Gates (W-codes) Encoded

12 hard gates added to `payroll_working_time_rule` schema:

| Code | Gate | Paragraf | Severity |
|---|---|---|---|
| W01 | Hviletid < 11t | Aml. §10-8 første ledd | error (BLOCK) |
| W02 | OT overskrider lovtak | Aml. §10-6 | error (BLOCK) |
| W03 | Lønn < Riksavtalen-min | Riksavtalen §4 | error (BLOCK) |
| W04 | Feriepenger < 10,2% | Ferieloven §10 | error (BLOCK) |
| W05 | Skattetrekk mangler/utdatert | Skattebetalingsloven §5-1 | error (BLOCK) |
| W06 | OTP < 2% | OTP-loven §4 | error (BLOCK) |
| W07 | Ulovlig lønnstrekk | Aml. §14-15 | error (BLOCK) |
| W08 | Prøvetid > 6 mnd | Aml. §15-6 fjerde ledd | error (BLOCK) |
| W09 | Pause < 30 min ved > 5,5t | Aml. §10-9 første ledd | warning |
| W10 | OT-kompensasjon mangler | Riksavtalen §7 | error (BLOCK) |
| W11 | Sletting i retensjonsvindu | Bokføringsloven §13 | error (BLOCK på DB-nivå) |
| W12 | Endringsoppsigelse-risk uten ack | Aml. §15-7 (analogt) | error (karantene) |

**Why these:** Council-aligned with ADR-0254 (W02), ADR-0251 (W11), ADR-0244 (W12). W01/W08/W09 from Aml. direkte. W03/W04/W06/W10 from tariff-grunnlaget. W05 from Skatteetaten-flow (ADR-0250). W07 from §14-15 lønnstrekk-analyse.

**How to apply:** When Lovsen invoked på shift-create eller payroll-calc, sjekk om noen W-code er kandidat. Foreslå paragraf-sitat + remediation.

---

## 3. Open Legal Questions Tracked (need external advisory)

These 5 questions ble identifiert som krever advokat eller etat-input før Phase 1 prod:

| # | Spørsmål | Trenger | Blocking phase |
|---|---|---|---|
| O7 | Indekstillegg uten ny signatur — Aml. §14-6 OK? | Arbeidsrettsadvokat eller NHO Reiseliv juridisk | Phase 1 (general policy) |
| O8 | Tips A-melding kode 111-A vs `tips`-kode for pool | Skatteetaten BFU | Phase 6 (A-melding) |
| O9 | Lærlinglønn + OTP edge cases | NHO Reiseliv + ADR-0253 | Lærling-spor (deferred) |
| O11 | Nattillegg sats — ikke seeded | Pontus verify mot gjeldende Riksavtalen | Phase 1 |
| O12 | Delt vakt terskel + sats | Pontus + NHO Reiseliv | Phase 1 |

Full liste: `docs/modules/payroll/OPEN-QUESTIONS.md`. Lovsen escalates disse ved relevant invocation.

---

## 4. Knowledge Updates for Lovsen

### 4.1 New paragraf-references encoded

Added to Lovsen's authoritative knowledge:

- **Aml. §10-6 fjerde ledd 2024-revisjon:** femte ledd fjernet — single-source-of-truth nå er fjerde ledd for OT-tak. Tidligere ADR-0254 har detaljer.
- **Aml. §10-10 tredje ledd:** hospitality eksplisitt unntatt fra søndagsforbud ("særlig fritidsformål"). Engine kan tillate søndagsvakt uten special approval; tilleggsbetaling beregnes auto.
- **Aml. §14-15 første ledd bokstav b:** skriftlig forhåndsavtale-grunnlag for trekk. Lovsen kan veilede manager om hva som CAN avtales (fagforening, kantine, OTP) vs hva som ikke kan (kassemanko, slitasje).
- **Bokføringsloven §3-4 GBS:** sporbarhet — hver lønnspost trenger source. Løses i `shift_pay_calculation_event.provenance JSONB` + `source_text_applied`.
- **Skattebetalingsloven §5-1:** arbeidsgiver-ansvar for korrekt trekk. Engine BLOCK ved utdatert skattekort.
- **OTP-loven §2 annet ledd:** vesting (>20% stilling + >12 mnd + 13–75 år). Hospitality med deltidsansatte må sjekke eksplisitt.

### 4.2 New regulatory tables (recommended)

Created during this session for annual-maintenance pattern:

- `public.regulatory_threshold` — frikort-grense, AGA-fritak-grense, statens reisesatser. effective_from/until per år. Engine reads at calc-time.

Lovsen knows: ved januar hvert år trenger denne tabellen ny seed via migration.

### 4.3 Constructive dismissal-policy

Default policy = ALL reduksjoner ≥5% utløser MATERIAL classification. Lovsen escalates on these consistently.

---

## 5. Agent-Behavior Notes

### 5.1 When invoked from payroll context
- Always check if W-code applies first (compliance gate).
- If yes: cite paragraf, give remediation, suggest amendment-classifier route if MATERIAL.
- If no: confirm rule-OK with HØY confidence + direkte sitat.

### 5.2 When invoked from contract context
- §14-6 16-bokstav-validator (existing) er primær funksjon.
- Hvis indekstillegg-amendment: refer to D4 escalation policy.
- Hvis MATERIAL ≥5%: trigger D3 conservative classification.

### 5.3 Cross-domain (payroll + contract)
- Payroll-endringer som påvirker `employment_contract.hourly_rate` eller `monthly_salary` = both contract amendment AND payroll recalc.
- Lovsen must coordinate: amendment-classifier first, then recalc-trigger second.

---

## 6. Test-Corpus Additions (for v0.2.0 ROADMAP)

Add to `__tests__/test-corpus/` candidates:

- `cd-grense-5pct.test.ts` — 5% reduksjon utløser MATERIAL flag
- `aml-14-15-trekk-uten-grunnlag.test.ts` — W07 trigger
- `bokforingslov-13-retention-anchor.test.ts` — `shift_period_end_date` not `created_at`
- `riksavtalen-overtid-50-100.test.ts` — første 3t / etter 3t breakpoint
- `ferieloven-12pct-vs-1043pct.test.ts` — Riksavtalen ekstra-uke trigger
- `aml-10-9-pause-ved-55t.test.ts` — break < 30min warning
- `otp-2pct-min-block.test.ts` — W06 trigger
- `tips-amelding-111A-default.test.ts` — code 111-A pool-default
- `indekstillegg-medium-confidence.test.ts` — escalation path

---

## 7. Files to update going forward

When new payroll work is committed, Lovsen sub-agent should be aware of:

- `docs/modules/payroll/` — primary blueprint folder
- `docs/modules/payroll/LEGAL-FRAMEWORK.md` — Lovsen-authored, update on new ADRs
- `docs/decisions/0250-skatteetaten-integration.md` — Skatteetaten-cert flow
- `docs/decisions/0251-shift-pay-calculation-audit-module.md` — audit + retention
- `docs/decisions/0252-riksavtalen-versjonering-migration-policy.md` — tariff-versjon flow
- `docs/decisions/0254-overtime-cap-default-scope.md` — OT-cap policy
- `packages/ai/src/capabilities/payroll/` — payroll capability tools
- `packages/ai/src/capabilities/legal/` — Lovsen capability home

---

## 8. Disclaimer (selv-referanse)

Dette er en intern Lovsen-læringsfil. Innholdet er kollega-kunnskap, ikke ansatt-vendt veiledning. Den standard payroll-engine disclaimeren i `LEGAL-FRAMEWORK.md` §8 gjelder for end-user kommunikasjon — ikke denne filen.

---

*Confidence-merking gjelder per påstand i kildedokumentene. Denne filen er meta-læring; sub-confidence på decisions D1–D5 = HØY (de er allerede ratifisert via ADR). Open questions (§3) er per definisjon LAV/MEDIUM confidence inntil ekstern advisory.*
