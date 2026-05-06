---
name: payroll-engine-developer
description: |
  AUTHORITATIVE guide for Smartout's Payroll Engine — three-layer architecture (Input/Regelmotor/Output), four non-negotiable principles (versjonering/idempotens/audit-trail/golden-cases), tariff-bound vs ubundne workspaces, calc-engine determinism, transparency requirement (every kr explainable). MUST be loaded before ANY payroll, lønn, calc-engine, tariff, supplement-rule, time-bank, feriepenger, A-melding, period-lock, or deviation work.

  Triggers (English): payroll, payroll-engine, calc-engine, salary, wage, paycheck, paycomponent, paycode, ruleset, time-entry, timesheet, time-bank, TOIL, holiday-pay, vacation-pay, deviation, lock-period, manual-supplement, dynamic-supplement, golden-month, period-close, payslip, A-melding, Tripletex, audit-trail.

  Triggers (Norwegian): lønn, lønnsslipp, lønnskjøring, lønnsperiode, lønnsart, lønnsprofil, ansiennitet, kveldstillegg, helgetillegg, nattillegg, overtidstillegg, helligdagstillegg, kort-varsel-tillegg, minstelønn, feriepenger, tidskonto, avspasering, vaktsupplement, regelmotor, lukk periode, avvik, manuelt tillegg, A-melding, tariff, tariffbinding, Riksavtalen, Riksavtalens satser.

  Triggers (specific tables): payroll.workspace_settings, payroll.shift_type, payroll.timebank_entry, payroll.payroll_calculation, payroll.payroll_period, payroll.payroll_line, payroll.shift_pay_calculation_event, payroll.manual_supplement, payroll.supplement_rule, payroll.break_rule, public.tariff_rate_table, public.framework_rule, public.regulatory_framework, public.employee_payroll_profile, public.employment_contract, public.public_holiday, public.shift_cost_snapshot.

  Triggers (files/paths): packages/payroll-calculate/**, apps/web/src/app/dashboard/payroll/**, apps/web/src/app/dashboard/my-salary/**, apps/mobile/src/app/(me)/payroll/**, packages/ai/src/capabilities/payroll/**, services/lovsen-nho-reiseliv-mcp/**, supabase/migrations/*payroll*.sql, supabase/migrations/*tariff*.sql, docs/modules/payroll/**.

  Triggers (ADRs): ADR-0057, ADR-0110, ADR-0204, ADR-0242, ADR-0250, ADR-0251, ADR-0252, ADR-0254, ADR-0259.

  Triggers (phrases from Pontus): "lønn er feil", "låsing av periode", "tariff stemmer ikke", "Riksavtalen-sats", "feriepenger-grunnlag", "A-melding eksport", "kveldstillegg fyrer ikke", "OT 50/100", "ansiennitetstrinn", "minstelønnssjekk", "manuelt tillegg", "tidskonto saldo".

  Core principle: **Hver krone må kunne forklares.** Versjonert tariff-data, idempotente kalkyler, append-only audit-trail, hand-computed golden-cases. Tariff-bundet workspace = auto-håndhev; ikke-bundet = soft-guide. "Confident != Authorized" gjelder også her — Lovsen siterer, calc-engine håndhever, C4 autoriserer.

  ALWAYS load when editing any file under packages/payroll-calculate/, apps/web/src/app/dashboard/payroll/, packages/ai/src/capabilities/payroll/, supabase/migrations/*payroll*, or when reasoning about deterministic salary calculation, tariff versioning, or audit transparency.
---

# Payroll Engine Developer Guide

> **Lønn er ikke et regneark.** Hver krone må kunne forklares: hvilken vakt, hvilken regel, hvilken tariff-versjon. Dette er forskjellen på et lønnssystem og Excel.

This skill is the AUTHORITATIVE source for Smartout's Payroll Engine. Loaded automatically by triggers above. CLAUDE.md and ADR-0057 point here.

---

## Three-Layer Architecture

Pure separation. Lekkasje mellom lag = arkitektur-brudd.

| Lag | Hva | Smartout-tabeller | Cascade-dim |
|---|---|---|---|
| **1. Input** | Timesheet + ansattprofil. Råtimer, fra/til/pause, koblet til ansatt med `employee_payroll_profile` (stillingskode, ansiennitet, fast/timelønn, FTE, `is_tariff_bound`). | `time_entry` + `schedule_shift` + `profile` + `employment_contract` + `employee_payroll_profile` | D2 + D6 |
| **2. Regelmotor** | Versjonert regelsett. Riksavtalen som **data**, aldri kode. Klassifiserer timer + slår opp satser per ansiennitet/dag/tid/tariff. | `tariff_rate_table` (versjonert via `effective_from/to` + `law_version`) + `framework_rule` + `regulatory_framework` + `supplement_rule` + K1a-baselines i `packages/ai/src/industry/packages/hospitality.ts` | D3 + K1a |
| **3. Output** | PayComponents (resultatlinjer), lønnsslipp, feriepenger, A-melding. Hver linje peker tilbake til input + regel + versjon. | `payroll_calculation` + `payroll_line` + `payroll_period` + `shift_pay_calculation_event` (audit) | C3 |

**Domenemodell — 6 entiteter (Pontus's model):**

| Entitet | Smartout-tabell | Rolle |
|---|---|---|
| Employee | `profile` | Hvem |
| SalaryProfile | `employee_payroll_profile` + ansiennitet utledet fra `employment_contract.start_date` | Hva personen er kvalifisert for |
| TimeEntry | `time_entry` | Råtimer |
| PayCode | `payroll.shift_type` enum + `supplement_rule` | Lønnsart-klassifisering |
| RuleSet | `tariff_rate_table` (versjonert) | Sats-oppslag |
| PayComponent | `payroll_calculation` row | Resultat-linje |

---

## Four Non-Negotiable Principles

1. **Versjonering, ikke overskriving** — `tariff_rate_table` lagres som versjoner. Hver rad har `effective_from`, `effective_to` (nullable for "current"), `law_version` (`'2024'`, `'2025'`, `'2026'`). Når 2026-oppgjør lander, ny rad m/ `effective_from='2026-04-01'`, gammel rad får `effective_to`. Gamle lønnskjøringer reproduseres bit-eksakt.

2. **Idempotens** — Samme `(shift, time_entry, rules, tariff_snapshot, workspace_settings)` → identisk `payroll_calculation`-rad. Re-kjøring inkrementerer `derivation_version`, gammel rad bevart (append-only). Tariff snapshot frosset på `shift_cost_snapshot.tariff_rate_snapshot` JSONB ved første calc.

3. **Audit trail (NON-NEGOTIABLE)** — Hver `payroll_calculation` peker tilbake til `time_entry_id`, `tariff_rate_table_id`, `framework_rule_id`. `shift_pay_calculation_event` er INSERT-only (RLS rejecter UPDATE/DELETE per Bokf. §13). Supersession-chain via `superseded_by_event_id`. **Aldri scope-out.** Per ADR-0251.

4. **Golden cases** — `packages/payroll-calculate/__tests__/golden-month/` inneholder hand-computed referanse: 12 ansatte × 1 måned × ~600 vakter med kjent forventet output (cents-eksakt). Hver regelendring kjører dette mot CI. Drift = bug.

---

## Tariff-Binding — Workspace-Gate

**Lovsen-soft-guide-regelen** (ADR-pending):

| Workspace | `is_tariff_bound` | Calc-engine atferd | Lovsen-stemme |
|---|---|---|---|
| Tariffbundet (NHO Reiseliv-medlem via Riksavtalen) | `true` | Auto-håndhever §6 nattillegg, §3 minstelønn, §4 OT-satser | "Iht. Riksavtalen §6 SKAL du betale 42.41 kr/t" |
| Ikke-tariffbundet (uorganisert) | `false` | Bruker som *default*; admin kan justere/AV | "Bransjenorm er 42.41 kr/t — du står fritt; dette er hva tariff-bedrifter betaler" |

**Lov vs tariff:** Aml. (Arbeidsmiljøloven) håndheves ALLTID — hviletid §10-8, OT-cap §10-6, etc. — ufravikelig. Riksavtalen (tariff) er kun bindende for `is_tariff_bound=true`.

Lovsen-MCP returnerer alltid `applies_only_if_bound: true` for tariff-rules slik agent ikke siterer §6 som lov til ubundne klienter.

---

## Calculation Flow (deterministic)

```
1. interpret-shift.ts       (Layer 3) — råtimer minus pauser, klassifiser dag/tid/tariff
2. evaluate-supplements.ts  (Layer 3) — fyrer supplement-rules; stacking-policy avgjør
3. snapshot-cost.ts         (Layer 4) — frys tariff snapshot, lås satser
4. aggregate-period.ts      (Layer 5) — summer per profil per periode
5. deviation-checks.ts      (W01-W14) — block/warn på minstelønn/hviletid/OT-cap
6. timebank-emitter.ts      — accrue feriepenger/TOIL/wellness
```

Alle pure-fn. Zero I/O. Deterministic. Inputs frozen → outputs frozen.

---

## File Index — Where Everything Is

### Documentation (`docs/modules/payroll/`)

| File | Topic |
|---|---|
| `MODULE_PAYROLL.md` | Engine-kontrakt + module entry-point |
| `ARCHITECTURE.md` | Calc-pipeline + Layer 3/4/5 |
| `DATA-MODEL.md` | Schema reference (alle payroll-tabeller) |
| `LEGAL-FRAMEWORK.md` | Lovsen-authored legal-binding |
| `TIME-BANKS.md` + `TIME-BANKS-LEGAL.md` | Feriekonto, TOIL, wellness |
| `DYNAMIC-SUPPLEMENTS.md` | Admin-authored regel-DSL |
| `WORKSPACE-POLICIES.md` | Policy-options + GDPR |
| `EXPORTS.md` | A-melding (Altinn) + Tripletex sync |
| `TRIPLETEX-INTEGRATION.md` | Sync-mønster |
| `BENCHMARK-PLANDAY.md` | Feature-benchmark mot Planday |
| `PHASES.md` | Phase 1-8 roadmap |
| `OPEN-QUESTIONS.md` | O1-O30 åpne beslutninger |
| `SORTIE-PHASE-1.md` | Phase 1 MVP scope + sequencing |
| `USER-FLOWS.md` | Manager-flows |
| `UI-PLAN.md` | 18 surfaces × 7 phases |
| `AUDIT-CASCADE-2026-05-06.md` | Cascade-audit funn |
| `DRIFT-PREVENTION-PLAN.md` | 3-tier drift-detection |
| `design/` | Sofia-prototype + JSX + tokens.css |

### Code

| Path | Innhold |
|---|---|
| `packages/payroll-calculate/` | Pure-fn calc-engine (Phase 1 — being built) |
| `packages/ai/src/capabilities/payroll/` | Capability tools (`lock_period`, `acknowledge_deviation`, `set_overtime_mode`, `adjust_timebank_balance`, `force_timebank_payout`, `query_timebank_balance`, `add_manual_supplement`) |
| `apps/web/src/app/dashboard/payroll/` | Period list + detail + drilldown |
| `apps/web/src/app/dashboard/my-salary/` | Employee self-view (read-only) |
| `apps/mobile/src/app/(me)/payroll/` | Mobile payslip + timebank (read-only per ADR-0133) |
| `services/lovsen-nho-reiseliv-mcp/` | Riksavtalen-fetch (Phase 7 real-fetch pending) |
| `packages/ai/src/industry/packages/hospitality.ts` | I1 K1a-baseline (workspace_settings defaults) |

### Migrations

| File | Hva |
|---|---|
| `20260422110000_payroll_enums.sql` | Phase 0 enums |
| `20260422110100_payroll_config_tables.sql` | workspace_settings + supplement_rule |
| `20260422110200_payroll_calculation_tables.sql` | payroll_period + payroll_line + calculation |
| `20260422110300_payroll_alter_existing.sql` | Legacy alter |
| `20260422110400_payroll_seed_holidays.sql` | public_holiday Norge-seed |
| `20260422110500_payroll_absence_enums.sql` | absence_type enum |
| `20260422110600_payroll_absence_tables.sql` | schedule_absence + absence_quota |
| `20260422110700_payroll_schema.sql` | schema-grant |
| `20260515100500_payroll_ledger_archive.sql` | Bubble-migrert ledger-arkiv |
| `20260519160000_payroll_capability_authority_seed.sql` | Tool authority defaults |

### ADRs (load FØR endringer i samme område)

| ADR | Tema |
|---|---|
| 0057 | Payroll schema-separation (egen `payroll`-schema) |
| 0110 | payroll_ledger_archive (Bubble-migrert) — read-only |
| 0204 | gatedMutation requirement (alle write-tools) |
| 0242 | Contract↔payroll capability-split |
| 0250 | Dynamic supplement framework (Phase 1) |
| 0251 | shift_pay_calculation_event audit-module (Phase 1, non-negotiable) |
| 0252 | Riksavtalen versjonering migration-policy |
| 0254 | Timebank dual-currency (NOK + hours) |
| 0259 | Workspace_settings policy-defaults |

---

## 100% Transparency — "Log for Accuracy"

**Krav:** Hver krone i en lønnsslipp skal kunne traces tilbake til:
1. Hvilken `time_entry` (input)
2. Hvilken `framework_rule` / `supplement_rule` (regel)
3. Hvilken `tariff_rate_table` row (sats)
4. Hvilken `derivation_version` av kalkylen (versjon)

**Tre lag av transparens:**

### Layer 1 — UI Trace (per linje)
`apps/web/src/app/dashboard/payroll/[periodId]/_components/LineDrawer.tsx` viser drilldown:
- Per ansatt: hver vakt + hver regel som fyrte + hver sats som ble brukt
- "Hvorfor 547 kr?" → klikk linje → ser `(8.5 timer × 64.34 kr/t base) + (2 timer × 27% kveldstillegg = 34.74 kr/t)`

### Layer 2 — DB Audit (per kalkyle)
`shift_pay_calculation_event` (ADR-0251) — INSERT-only:
```sql
SELECT * FROM payroll.shift_pay_calculation_event
WHERE workspace_id = $1 AND payroll_period_id = $2
ORDER BY created_at;
-- Returnerer hver supplement-firing med rule_id + tariff_id + amount + provenance JSONB
```

### Layer 3 — Activity Trail (per agent-handling)
`activity_trail` (per ADR-0186 + telemetry registry):
```sql
SELECT * FROM activity_trail
WHERE workspace_id = $1 AND event_name LIKE 'payroll.%'
ORDER BY occurred_at DESC;
-- Hver lock_period, acknowledge_deviation, manual_supplement, recalc trigger logget
```

### Telemetry events (`packages/telemetry/src/registry.ts`)
- `payroll.period_locked`
- `payroll.deviation_acknowledged`
- `payroll.deviation_blocked_approval`
- `payroll.manual_supplement_added`
- `payroll.overtime_mode_changed`
- `payroll.timebank_accrued` (activity_trail kun, flooder PostHog)
- `payroll.timebank_withdrawn`
- `payroll.timebank_payout_forced`
- `payroll.supplement_rule_fired` (activity_trail kun)
- `payroll.recalc_triggered`
- `payroll.tariff_freeze_drift`

---

## Debugging Workflow

| Symptom | Sjekk-rekkefølge |
|---|---|
| "Tallet er feil" | (1) `payroll_calculation` row + `derivation_version` (2) `shift_pay_calculation_event` rules-fired (3) `tariff_rate_table` snapshot på `shift_cost_snapshot.tariff_rate_snapshot` (4) Hand-compute mot golden-month-fixture |
| "Lock-knapp grå" | `payroll_deviation` med `severity='error'` AND `acknowledged_by IS NULL` — fix ack |
| "Tillegg fyrer ikke" | (1) `supplement_rule.is_active=true`? (2) `evaluate-supplements.ts` test-rule preview (3) `workspace_settings.supplement_stacking_policy` blokker? |
| "Periode låst, men endring trengs" | Aldri unlock. Lag corrective period (ADR-pending O6). |
| "Calc kjører ikke" | RPC `payroll.recalculate_period(period_id)` — sjekk Edge Function logs eller `engine_event` |
| "Tariff-drift" | Re-run på lukket periode skal gi identisk resultat. Hvis ulik → `tariff_freeze_drift` event firet — bug i snapshot |
| "Riksavtalen-sats stemmer ikke" | Sjekk `tariff_rate_table.law_version` + `effective_from`; verifiser mot Lovsen-MCP `lookup_tariff_supplement` (eller fixture hvis offline) |

---

## Critical Traps

- **Aldri hardkod satser** i app-kode. Alt fra `tariff_rate_table` eller `framework_rule`. Hardkodet 42.41 = brudd på prinsipp 1.
- **Aldri auto-håndhev tariff på `is_tariff_bound=false`** workspaces. Lovsen kan veilede, calc-engine bruker som default kun.
- **Aldri unlock** lukket periode. Kun corrective period i neste periode (Bokf. §13 ufravikelig).
- **Aldri manuelt edit** derivert linje. Bare add-on `manual_supplement`.
- **Aldri lukk** med uack errors. UI-knapp disabled til `deviations.unacked === 0`.
- **Aldri mobile authoring** av payroll. ADR-0133. Mobile = read-only payslip + push-confirm.
- **Aldri ny enum** uten å sjekke `database.types.ts` først (72 enums finnes).
- **Aldri ny tabell** uten `workspace_id` + RLS dual-auth (JWT + API key).
- **Aldri capability-tool** uten `gatedMutation` per ADR-0204.
- **Aldri bypass** `derive_workspace_id` server-side (ADR-0151 forgery defense).
- **Tariff snapshot må fryses** på `shift_cost_snapshot.tariff_rate_snapshot` JSONB ved første calc — ellers kan re-run gi ulikt resultat.
- **Versjons-felt `law_version`** speiler Lovsen-MCP `version`-arg-konvensjon — `'2024'`, `'2025'`, `'2026'`. Aldri default til "latest".

---

## Specialized Agent

**Pontus' krav:** AI-agent 100% spesialisert på payroll for å sikre at alt blir rett. Lønn = høy konsekvens.

**Status:** Dedikert agent ikke spawnet enda. Inntil agent finnes, build-agent som jobber i payroll-territorium MÅ:

1. Laste denne skill først
2. Laste `smartout-cascade-developer` (D2/D3/C3-mapping)
3. Laste `smartout-database-guide` for SQL/migrations
4. Konsultere `lovsen` agent for arbeidsrett-spørsmål (Aml. + Riksavtalen)
5. Aldri foreslå satser uten kilde-citat (PDF, lovsen-MCP, eller `tariff_rate_table`-rad)

**Foreslått sortie:** Spawn `payroll-engine-agent.md` i `.claude/agents/` med model:opus, scope: alle endringer i `packages/payroll-calculate/`, `packages/ai/src/capabilities/payroll/`, `apps/web/src/app/dashboard/payroll/`, `supabase/migrations/*payroll*`. Triggers: alle skill-triggers over.

---

## Quick Reference — Common Operations

```bash
# Run golden-month test
pnpm turbo test --filter=@smartout/payroll-calculate

# Re-calculate a period (admin chat)
"Recalculate period <period_id>"
# → calls payroll.recalculate_period(period_id) RPC

# Inspect every supplement firing for a period
psql -c "SELECT rule_id, sum(amount), count(*) FROM payroll.shift_pay_calculation_event WHERE payroll_period_id='<id>' GROUP BY rule_id"

# Verify tariff freeze on locked period
psql -c "SELECT id, tariff_rate_snapshot->>'effective_from', tariff_rate_snapshot->>'law_version' FROM public.shift_cost_snapshot WHERE payroll_period_id='<id>' LIMIT 5"

# Check deviation-checks status before lock
psql -c "SELECT severity, count(*), count(*) FILTER (WHERE acknowledged_by IS NOT NULL) FROM payroll.payroll_deviation WHERE payroll_period_id='<id>' GROUP BY severity"
```

---

## Reference Files

- Canonical spec: `docs/modules/payroll/SORTIE-PHASE-1.md`
- Engine architecture: `docs/modules/payroll/ARCHITECTURE.md`
- Schema reference: `docs/modules/payroll/DATA-MODEL.md`
- Sofia design handoff: `docs/modules/payroll/design/Payroll Prototype.html`
- Cascade-mapping: `.claude/skills/smartout-cascade-developer/SKILL.md`
- Database rules: `.claude/skills/smartout-database-guide/SKILL.md`
- Riksavtalen-fetch: `services/lovsen-nho-reiseliv-mcp/README.md`

---

## When NOT to Load

- Pure UI-styling (kun design-tokens, ingen calc-logikk) → `smartout-nordic-split` er nok
- Authentication / RLS / migrations utenfor payroll → `smartout-database-guide` er nok
- Edge Function-arbeid utenfor payroll → `smartout-edge-function-guide` er nok

---

**Status:** UNTESTED skill — created 2026-05-06 mid-session. Pending RED-GREEN-REFACTOR cycle per `writing-skills` Iron Law. First test scenarios queued for next sortie kick-off.
