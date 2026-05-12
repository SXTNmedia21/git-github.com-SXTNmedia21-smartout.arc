---
title: Cascade Integration Audit — Payroll Module
status: action-items-tracked
updated: 2026-05-06
created: 2026-05-06
module: payroll
auditor: system-steward (opus)
verdict: GO-WITH-FIXES
tags: [payroll, audit, cascade, system-steward, pre-flight]
---

# Cascade Integration Audit — Payroll Module

> Auditor: `system-steward` (opus). Date: 2026-05-06. Scope: 16 docs in `docs/modules/payroll/` + 9 ADRs + Lovsen blueprint, cross-checked against `database.types.ts` + cascade-spec.

## Verdict

**🟡 GO-WITH-FIXES** — strong cascade-forståelse i designet, men schema-coupling-bias har skapt 2 kritiske RED findings + 7 YELLOW. Pre-flight utvidet fra 7 → 13 blockers.

## GREEN — Cascade integration korrekt (10 punkter)

1. C3 Commercial-plassering riktig per ADR-0118-mønster (MODULE_PAYROLL.md §2)
2. `shift_cost_snapshot`-rolle som C3 audit stemmer med cascade-spec
3. Tariff-snapshot freeze på `tariff_rate_snapshot JSONB` — eliminerer runtime tariff-lookup
4. K1a/K1b separasjon korrekt: `tariff_rate_table.workspace_id IS NULL = K1a`
5. Append-only invariant på `payroll.calculation` matcher cascade INV-3
6. No cascade write-back deklarert (MODULE_PAYROLL.md §6 Invariant #3) — INV-1 oppfylt
7. Event Engine grense-respekt: cascade *produserer*, EE *konsumerer* — INV-4 oppfylt
8. C1 belief vs C4 permission separert (deviation severity vs four-eyes)
9. C3 produserer ikke cascade-koeffisienter (riktig framework_rule-trigger pattern)
10. Bokføringsloven §13 retention-anker er `shift_period_end_date`, ikke `created_at`

## RED — Cascade-modell-brudd (BLOKKERER Phase 1)

### R1: `shift_pay_calculation_event` tabel EKSISTERER IKKE

**Verified:** 0 hits i `database.types.ts`. ADR-0251 status = `proposed`.

**Impact:** ARCHITECTURE.md §3 (audit-layer), DYNAMIC-SUPPLEMENTS.md §5, SORTIE-PHASE-1.md §10.8 acceptance — ALLE forutsetter en tabell som ikke finnes.

**Action:** O25 — accept ADR-0251 + add 6th migration ELLER scope-out audit til Phase 1.5.

### R2: `payroll.timebank_entry` mangler `account_type`/`value_amount`/`value_unit`

**Verified:** Tabellen er kun timer-basert (`hours numeric`). Ingen `account_type` enum eksisterer. TIME-BANKS.md §1 "Reuse Decision" basert på FEIL premiss.

**Impact:** Hele time-banks-design krever schema-change.

**Action:** O26 — bredde-ALTER ELLER split-tables. TIME-BANKS.md §1 må re-skrives.

### R3: gate_action + four-eyes per tool ikke eksplisitt

**Impact:** L-0175 (Capability Trust Gate Hard Rules) krever per-tool ADR-0204 verification. `force_timebank_payout` (destruktiv) bør ha `requires_four_eyes=true` per default — currently false.

**Action:** Update SORTIE-PHASE-1.md §8 med eksplisitt `default_allow=false` + `requires_four_eyes` per tool.

### R4: Mobile Surface Boundary respektert men flagg eksplisitt

**Impact:** Mobile authoring må aldri smugle inn `[Justér saldo]` knapp.

**Action:** Eksplisitt note i SORTIE-PHASE-1.md §7.4: "Mobile timebank.tsx FORTSATT read-only. Filter-chip + listing only."

### R5: I1 bootstrap-eierskap ikke spesifisert

**Impact:** Bubble-migrerte workspaces (Strøm Mat & Bar, Bårdshaug Vegkro, Yogurt Heaven) får hardkodede DB-defaults i stedet for industry-package defaults.

**Action:** O30 — Day 0.5 task: update `packages/ai/src/industry/packages/hospitality.ts` + `_apply.sql`.

### R6: ADR-0250 + ADR-0251 status `proposed` men SORTIE bygger på dem

**Impact:** Cascade Control Gate-regel: "Forward-looking plans are not current truth ... they do not override current code, ADRs, or verified state until landed."

**Action:** O29 — promote begge til accepted ELLER scope-out.

### R7: `add_manual_supplement` role inkonsistent (admin vs manager i 3 docs)

**Verified:**
- MODULE_PAYROLL.md §5: `min_role=admin`
- ARCHITECTURE.md §4.2: `min_role=admin`
- SORTIE-PHASE-1.md §8 + §4.1: `min_role=manager`

**Action:** O28 — RESOLVED i denne audit. Oppdatert SORTIE-PHASE-1.md §8 + §4.1 til `admin`.

### R8: `payroll.calculation.provenance` kolonne ikke verifisert

**Action:** O27 — verify `grep` mot `database.types.ts` før Day 1; legg til migration hvis mangler.

## YELLOW — Mindre inkonsistenser (12 fixes)

| ID | Issue | Status |
|---|---|---|
| Y1 | Tabel-naming `payroll.payroll_*` → `payroll.*` (ADR-0057 brudd) | ✓ FIXED bulk-replace 2026-05-06 (31/38 references) |
| Y2 | `shift_cost_snapshot` kolonner avviker fra schema (`weekend_cost`, `total_supplements numeric` ikke eksistere) | Documented; needs DATA-MODEL.md §3.5 update |
| Y3 | `shift_hour_interpretation` mangler `provenance JSONB` i schema vs docs | Cascade INV-3 satisfied via array-FKs; klargjør i ARCHITECTURE.md §2.1 |
| Y4 | `payroll.timebank_entry` schema-mismatch | Same som R2 |
| Y5 | `absence_type` enum vs row terminologi mismatch (`wellness` vs `welfare`) | Decision needed: code/category mapping |
| Y6 | `payroll.workspace_settings` mangler felt SORTIE skal ALTER | Verified clean — sortie-design er korrekt (additive) |
| Y7 | `change_proposal proposal_kind='wage_line_override'` Phase 2 | Mark eksplisitt "Phase 2" i MODULE_PAYROLL.md §5 |
| Y8 | `shift_pay_calculation_event` workspace_id-claim | Same som R1 |
| Y9 | `weekend_cost` vs `weekend_hours` på snapshot | Docs assume non-existent column — supplements i JSONB istedenfor |
| Y10 | Tariff-rate seed for nattillegg | OK — pre-flight O11 håndterer det |
| Y11 | ADR-er sitert som "akseptert" som faktisk er proposed | Same som R6 |
| Y12 | Capability `defaultAuthority` påstand ikke verifisert | Add config-citat i ARCHITECTURE.md §4 |

## MISSING — Cascade-aspekter ikke nevnt (9)

1. D5 Concept-rolle for `payroll.workspace_settings` ikke deklarert
2. Cross-workspace isolation test for cascade
3. Rule-source test (no hardcoded rates)
4. Re-derivation test (samme inputs → identisk output)
5. Telemetry-domain consistency test
6. `tariff_rate_table` overlap-handling (gist EXCLUDE-violation strategy)
7. Contract amendment-flow integrasjon (ADR-0252 Event Engine consumer-pattern)
8. Bootstrap-bypass-flag check for Bubble-migrerte workspaces (same som R5)
9. `payroll.calculation.provenance JSONB` struktur ikke standardisert

## Action Items Tracked

| ID | Action | Status | Owner |
|---|---|---|---|
| Y1 fix | Bulk find-replace `payroll.payroll_*` → `payroll.*` across 16 docs | ✓ DONE 2026-05-06 (31 refs fixed) | Claude |
| R7/O28 fix | `add_manual_supplement` role consistency → admin | ✓ DONE 2026-05-06 | Claude |
| DATA-MODEL §5 enums | Verified enum names correct + `rule_severity = (block, warn)` | ✓ DONE 2026-05-06 | Claude |
| OPEN-QUESTIONS O25–O30 | New blockers documented | ✓ DONE 2026-05-06 | Claude |
| SORTIE §2 pre-flight expansion | 7 → 13 blockers | ✓ DONE 2026-05-06 | Claude |
| O25 ADR-0251 accept | Promote ADR-0251 status proposed → accepted | PENDING | Pontus |
| O26 timebank schema decision | Bredde-ALTER vs split-tables | PENDING | Pontus + system-agent-coordinator |
| O27 calculation.provenance verify | grep `database.types.ts` | PENDING | Build-agent (Day 0) |
| O29 ADR-0250 accept | Promote ADR-0250 status proposed → accepted | PENDING | Pontus |
| O30 I1 bootstrap update | Update hospitality.ts payrollSettings + _apply.sql | PENDING | Day 0.5 task |
| Y2/Y9 DATA-MODEL §3.5 update | Match schema (drop weekend_cost, add basis enum) | PENDING | Build-agent (Day 1) |
| Y3 ARCHITECTURE §2.1 clarify | FK-arrays utgjør provenance | PENDING | Build-agent (Day 1) |
| Y5 absence_type wellness mapping | Decision: `code='wellness', category='welfare'` | PENDING | Pontus |
| R3 gate_action + four-eyes per tool | Update SORTIE §8 with explicit columns | PENDING | Pontus + build-agent |
| R4 mobile boundary explicit note | Add to SORTIE §7.4 | PENDING | Build-agent (Day 7) |

## Pre-Flight Schedule (revised)

**Pontus pre-flight (~5 timer):**
1. O25 — ADR-0251 accept-decision (30 min)
2. O26 — timebank schema-decision (1 time)
3. O28 — `add_manual_supplement` role confirm (5 min) — ALREADY APPLIED
4. O29 — ADR-0250 accept-decision (1 time)
5. O5/O6/O22/O18/O3/O16/O11 — original 7 (~1 time)
6. Y5 — wellness mapping decision (10 min)
7. R3 — four-eyes default per tool review (30 min)

**Build-agent pre-flight (Day 0):**
1. O27 — verify `calculation.provenance` kolonne (5 min)
2. Y2 + Y9 — DATA-MODEL.md §3.5 schema match (30 min)
3. Y3 — ARCHITECTURE.md §2.1 clarification (15 min)

**Day 0.5 (parallell med Day 1 kick-off):**
1. O30 — I1 hospitality-bootstrap update (2 timer)

## Sortie Timeline Impact

| Scenario | Days |
|---|---|
| Original Phase 1 | 5–8 dager |
| With ALL 13 blockers full-scope (path A R1+R2) | 7–10 dager |
| With recommended scope-cut (R1 path B + R2 path A) | 6–9 dager |

**Recommendation:** Recommended scope-cut. Defer audit-event tabel til Phase 1.5; bredde-ALTER timebank_entry istedenfor split. Behold full mode-toggle + time-banks UX i Phase 1.

## Final Notes

Cascade integrasjon-vurdering totalt: Docs viser **strong forståelse** for C3-grense, K1a/K1b, append-only, Event Engine-grense, og C1/C4-separasjon. Men schema-coupling-bias (docs antar tabeller som ikke finnes) er den dominerende failure-modusen — klassisk "spec drift fra code" som L-0098 (prior-council staleness) advarer mot.

Action items tracked → Linear epic SMA-315 + sortie-spec.

## Cross-references

- Auditor: `system-steward` (opus, sonnet=NO per dispatch rules — judgment task)
- Authoritative source: `.claude/skills/smartout-cascade-developer/SKILL.md`
- Cascade-spec: `docs/superpowers/specs/2026-03-21-cascade-scheduling-system-design.md`
- Schema: `packages/supabase/src/database.types.ts`
- All payroll docs: `docs/modules/payroll/README.md`
