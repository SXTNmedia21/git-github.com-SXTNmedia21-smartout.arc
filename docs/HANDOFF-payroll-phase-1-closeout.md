---
title: Payroll Phase 1 Close-Out HANDOFF
status: handoff
updated: 2026-05-16
created: 2026-05-16
module: payroll
tags: [payroll, phase-1, close-out, handoff, golden-month, adr-0341, adr-0342]
---

# Payroll Phase 1 Close-Out — HANDOFF

> Session 2026-05-16 close-out: ADR-0341 v1.1 + ADR-0342 accepted, B1 seed shipped, fixture truth micro-decisions resolved via council, E1-E5 batch applied. F2 worksheet ready for Pontus E3 rate-verify + signature pass. Cents-exact test (`pnpm test:golden-month`) still pending `expected/*.json` build (post Pontus signature + Lovsen certify + transcribe agent).

---

## Summary

- **ADR-0341 v1.1 + ADR-0342 accepted.** Golden-month oracle provenance contract and Lovsen MCP freshness-verification contract are now load-bearing ADRs. Every future krone in `expected/` carries its own `paragrafRef` + `lovsenCitationHash` (14-field per-cell schema). Stale citation = CI red.
- **W11 + W04 engine bugs fixed** (`d22645c4d`, `acf3352bc`). Tests now 235 (was 230). E2 holiday-bucket gate also shipped (`a3fe242f6`).
- **F2 golden-month worksheet built** (3 files, 43 shifts × 12 profiles × 158 cells, 146 pre-computed). 4 fixture blockers resolved via council (B1 UUID seed migration `fa54b4e3b`, B2 monthly formula, B3 Skjærtorsdag, B4 typo). E1 tariff_category + E5 role_class CHECK extended.
- **Blocking gap remaining:** `expected/*.json` (5 files per ADR-0341 §3) not yet built. Blocked on Pontus E3 Riksavtalen 2026 rate-verify + manual signature + Lovsen MCP `verify_citation_freshness` implementation + transcribe-agent. `pnpm test:golden-month` will fail until these land.

---

## What was built (commits chronological)

| SHA | Subject | Phase | Why |
|---|---|---|---|
| `aa4a7ea38` | docs(payroll): re-baseline PLAN-payroll-phase-1 as done | F1 | Discovery confirmed code shipped; unblock close-out |
| `13596f9b0` | docs(payroll): mark O25-O29 resolved with migration references | F1 | 5 open questions had been resolved in code; dashboard accuracy |
| `d0e5f745f` | docs(payroll): correct ADR-0303 → ADR-0319 mis-attribution | F1 | `notify_each_profile` was credited to wrong ADR; audit accuracy |
| `5ea80438f` | docs(payroll): document Phase 1 close-out gaps in PHASES.md | F1 | G1-G5 gap section written; PHASES.md now reflects real state |
| `d22645c4d` | fix(payroll): W11 Oslo-TZ grouping for CEST shifts spanning UTC midnight | F3 | Shifts starting 22:00 UTC (= 00:00 Oslo CEST) bucketed to wrong day |
| `acf3352bc` | test(payroll): W04 4-week rolling boundary case | F3 | Negative boundary test only covered 3 shifts in 1 week |
| `37a4a1a2e` | docs(adr): ADR-0341 — calc-engine test oracle provenance contract (v1.0 proposed) | G1+council | Golden-month source-of-truth decision after 3-seat G1 council |
| `a7e909199` | docs(adr): ADR-0341 v1.1 — council revisions (C1+C2+C3 critical, H1+H2+H3 high) | 4-seat council | Chair Self-Reversal Protocol L-0147 4th precedent; 6 mandatory edits |
| `9befd892e` | docs(adr): ADR-0342 — Lovsen MCP freshness-verification tool (proposed) | ADR-0342 | Forward dep from ADR-0341 §"Stale handling" |
| `3ef9e64cb` | docs(adr): accept ADR-0341 v1.1 + ADR-0342 — Pontus approved | acceptance | Both ADRs promoted proposed → accepted |
| `fa54b4e3b` | feat(payroll): seed 14 fixture UUIDs for golden-month F2 (per ADR-0341 v1.1) | F2-B1 | 8 tariff + 6 supplement_rule UUIDs, deterministic uuid5, NULL workspace_id K1a |
| `12c485132` | fix(payroll): rename rule-kveldstiilegg → rule-kveldstillegg (B4 council) | F2-Phase1 | Typo in fixture seed ID; CASCADE rename across packages + docs + migration |
| `a2ad90922` | fix(payroll): move sh-018 to 2026-04-02 Skjærtorsdag (B3 council) | F2-Phase2 | Wrong date (2026-04-03) + opens first helligdag regression coverage |
| `c98d66576` | feat(payroll): compute prof-005..008 base_monthly via minstelonn formula (B2) | F2-Phase3 | `205 × 37.5 × 30/7 = 32 946.43 NOK`; replaces [CONTRACT] placeholders |
| `9b910254a` | fix(payroll): resolve prof-006 fagbrev/tariff_category inconsistency (E1) | F2-Phase4 | prof-006 was voksen_ufaglart; should be voksen_faglart (fagbrev holder) |
| `a3fe242f6` | fix(payroll): gate holiday supplement_type rules to holiday buckets (E2) | F2-Phase5 | `evaluate-supplements.ts`: `supplement_type='helligdag'` rules only fire on `bucket.type==='helligdag'` |
| `448039293` | docs(payroll): flag E3 Riksavtalen 2026 rate verification pending | F2-Phase6 | [PENDING_E3_VERIFY] markers in worksheet; blocks `expected/*.json` |
| `40986b550` | docs(payroll): verify E4 gm_ prefix is engine-transparent (no-op) | F2-Phase7 | Engine resolves by UUID FK; gm_ rate_type prefix causes no regression |
| `c4b25e26f` | feat(payroll): extend tariff_rate_table.role_class CHECK for voksen types (E5) | F2-Phase8 | CHECK constraint gap: `voksen_ufaglart` / `voksen_faglart` / `voksen_faglart_2` added + backfill |

---

## Decisions made (with ADR + council references)

### G1 Council — golden-month source of truth (3 seats: payroll-engine + lovsen + system-steward)

Three options debated: A (Bubble oracle), B (Pontus hand-compute + Lovsen citation), C (Lovsen-generated). Unanimous reject A (ADR-0110 bug-parity prohibition + GDPR). Unanimous reject C (ADR-0258 LLM self-cert loop). Unanimous adopt **B-anchored Lovsen-citation hybrid** — Pontus owns computation authority, Lovsen owns paragraph-citation authority, engine is the test subject. Authority is explicitly separated; no seat produces both compute and proof for the same cell.

### ADR-0341 v1.0 — initial draft

11-field per-cell schema establishing `paragrafRef`, `lovsenCitationHash`, `computedBy`, `certifiedBy` fields. Proposed after G1 council.

### ADR-0341 4-seat council review (steward chair, supervisor, payroll-engine code-tracer, lovsen)

**Chair Self-Reversal Protocol L-0147 — 4th precedent.** Chair voted APPROVE Phase 3; payroll-engine code-tracer found 3 CRITICAL type mismatches against `packages/payroll-calculate/src/types.ts`. Chair reversed to REJECT IN CURRENT FORM. 6 mandated edits:

- **C1 (CRITICAL):** `amount` renamed `amount_ore` (bigint øre) — precision requirement, matches existing payroll schema convention
- **C2 (CRITICAL):** `supplementRuleId` typed as UUID (no string synthetic IDs; no rule registry exists)
- **C3 (CRITICAL):** `tariffRateTableId` added (matches existing `shift_cost_snapshot` FK mechanism)
- **H1 (HIGH):** ADR-0342 forward dependency declared
- **H2 (HIGH):** ADR-0256 citation envelope added (`lovsenCitationText`, `lovsenCitationURL`, `lovsenCitationFetchedAt`) — schema grows to 14 fields
- **H3 (HIGH):** `shift_snapshots.json` declared as 5th expected file

### ADR-0341 v1.1 — accepted

All 6 edits applied (`a7e909199`). Pontus approved (`3ef9e64cb`). Status: accepted 2026-05-16.

### ADR-0342 — Lovsen MCP freshness-verification tool

`verify_citation_freshness(hashes[])` contract: batch 100, routes by `source` field, `LOVSEN_FIXTURE_MODE=true` returns `stale: false` deterministically (ADR-0258 offline-pathway non-negotiable). Telemetry per ADR-0256. Implemented in both NHO Reiseliv MCP + Lovdata MCP. ADR-0341 §"Stale handling" depends on this tool existing. Accepted 2026-05-16.

### B1 Seed migration (F2 blocker resolution)

14 fixture UUIDs seeded via deterministic `uuid5(dns, label)`. `workspace_id = NULL` (platform K1a rows). `rate_type` uses `gm_` prefix to avoid EXCLUDE constraint collision. `role_class = 'voksen_ufaglart'` in provenance JSONB (existing CHECK constraint gap — closed by E5). FK-verified before commit.

### B2/B3/B4 council (4 seats: same as ADR-0341 review council)

- **B4 typo (unanimous):** `rule-kveldstiilegg` → `rule-kveldstillegg`. Cascade rename.
- **B3 Skjærtorsdag (chair-reversal, L-0147 — 5th precedent):** sh-018 date corrected to 2026-04-02. Opens first `rule-helligdag-001` regression coverage. Chair initially voted A (keep 2026-04-03); payroll-engine code-tracer showed helligdag gate gap. Chair reversed to B.
- **B2 monthly formula (3-way split, synthesized):** Chair + lovsen voted B (`base_monthly`); supervisor voted D (per-shift multiply); payroll-engine voted A (FTE fraction). Synthesized as **B-revised**: `minstelønn × FTE × actual-April-weekdays/7` using exact April 2026 calendar days (30), not 4.33 average. Fixes idempotency flag concern raised by payroll-engine. Formula: `205 × 37.5 × 30/7 = 32 946.43 NOK`.

### Escalated findings from B2/B3/B4 council

- **E1:** prof-006 `tariff_category` was `voksen_ufaglart`; fagbrev-holder must be `voksen_faglart`. Fixed in worksheet + fixture seed (`9b910254a`).
- **E2:** `supplement_type='helligdag'` rules fired on any bucket. Engine gate added: helligdag rules only match `bucket.type==='helligdag'`. 3 new unit tests. 232 → 235.
- **E3:** Riksavtalen 2026 satser not yet independently verified vs PDF. [PENDING_E3_VERIFY] markers block `expected/*.json` build.
- **E4 (no-op):** gm_ prefix transparent to engine (resolves by UUID FK). Verified, no action.
- **E5:** `role_class` CHECK constraint missing `voksen_ufaglart`, `voksen_faglart`, `voksen_faglart_2`. Extended + backfill migration (`c4b25e26f`).

### run-council SKILL.md hard rule promoted (Pontus directive)

After ADR-0341 4-seat council surfaced the code-tracer gap, Pontus directed this to be promoted to a hard rule: **schema-locking ADRs (any ADR that freezes a JSON/DB schema used by running code) require a code-tracer seat** loaded with the domain skill. Per-domain routing table added to SKILL.md. Reference case: ADR-0341, 2026-05-16.

---

## Learnings discovered

1. **L-0147 — 4th precedent (ADR-0341 review):** Chair Self-Reversal Protocol triggered when payroll-engine code-tracer found 3 CRITICAL type mismatches in ADR-0341 v1.0 schema. Chair voted APPROVE Phase 3 → reversed to REJECT IN CURRENT FORM after code-tracer evidence. Pattern: schema-locking ADRs without a code-tracer seat will produce type drift.

2. **L-0147 — 5th precedent (B3 council):** Chair voted to keep sh-018 date (2026-04-03) → reversed to correct it to Skjærtorsdag (2026-04-02) after payroll-engine code-tracer showed helligdag regression coverage gap. Pattern: fixture-truth decisions benefit from domain skill at the seat.

3. **Code-tracer-mandatory pattern (generalised):** Any council reviewing an ADR that: (a) freezes a JSON schema; (b) touches existing TypeScript types; or (c) constrains an existing DB CHECK — must include a code-tracer seat loaded with the domain skill. Without it, ADR text and implementation types diverge silently.

4. **Formula-vs-coupling principle:** When a fixture-value formula can be expressed without referencing another fixture cell, prefer the standalone formula. `205 × 37.5 × 30/7` is reproducible by any future reviewer independently; `profile.hours_per_week × base_hourly_rate × days` couples to three other fixture fields and breaks on field rename.

5. **ADD-COLUMN-beats-sibling-table in fixture territory:** Extending `tariff_rate_table.role_class` CHECK constraint (E5) rather than creating a new lookup table keeps FK resolution simple and does not require a new fixture UUID slot. Pattern matches L-0202 (5th-occurrence context from billing-erik-seed).

6. **op run corrupts supabase gen types (repeated trap):** 1Password substitutes substring matches in column names. Do not wrap `supabase gen types` in `op run`. Noted in session context from earlier sessions; confirmed relevant for fixture seed migration generation.

---

## Known gaps / open work

| Gap | Description | Severity | Owner | Ticket |
|---|---|---|---|---|
| G1 (F2 fixture) | `expected/*.json` (5 files) not built. Blocked on: Pontus E3 Riksavtalen 2026 rate-verify + manual signature of worksheet + Lovsen MCP `verify_citation_freshness` implementation (ADR-0342 T1-T4) + transcribe-agent that materialises worksheet to JSON + test runner wire-up | LOAD-BEARING | Pontus (E3 verify + signature) then dev (transcribe agent + test runner) | SMA-372 |
| G2 (43 vs 600 shifts) | Golden-month uses 43 shifts vs §10.1 spec's ~600. Pontus must decide: scale to 600 OR accept 43 with documented scope-cut ADR | Medium | Pontus decision | SMA-372 |
| G5 (Phase 1.5 approve flow) | `approve_period` capability tool + four-eyes gate not built. Accepted as deferred from Phase 1 scope | Low | Next sortie | — |
| ADR-0342 T1-T4 implementation | `verify_citation_freshness(hashes[])` method not yet implemented in NHO Reiseliv MCP or Lovdata MCP. ADR accepted but tool body = future sortie | High | Dev (separate sortie) | SMA-372 |
| E3 rate verification | Riksavtalen 2026 satser in worksheet carry [PENDING_E3_VERIFY] markers. 4 cells: kveldstillegg, helgetillegg, helligdag pct, OT 50%/100%. Pontus verifies against PDF `riksavtalens-satser-fra-1.-april-2025---nett.pdf` (covers April 2026 satser) | High | Pontus | SMA-372 |
| E6 fixture UUID alignment | Some downstream worksheet references use string labels (e.g. `tariff-riksavtalen-2026`) where the FK expects UUID. Transcribe-agent must resolve label → seeded UUID before writing JSON | Low | Transcribe-agent sortie | SMA-372 |
| D3 ManualSupplementForm UI | `add_manual_supplement` is chat-only (ADR-0078 Høy-PII). No period-detail Sheet/Form exists. Carried from Phase 1 HANDOFF | Low | Phase 2 | — |
| D4 Recalc trigger missing | `force_timebank_payout` + `add_manual_supplement` do not auto-trigger recalculate_period | Low | Phase 2 | — |
| 600-shift Strøm Mat & Bar scale-up | Phase 1.5 or post-real-customer-first-period | Low | Future | — |

---

## Next steps (for next session)

1. **Pontus (blocking):** Open `docs/modules/payroll/golden-month-worksheet/02-citation-lookup.md` and complete §E3 rate verify against `riksavtalens-satser-fra-1.-april-2025---nett.pdf`. Clear [PENDING_E3_VERIFY] markers. Sign off on worksheet via git commit or comment.
2. **Pontus (blocking):** Decide G2 — accept 43-shift scope or commit to 600-shift scale-up. Write outcome as ADR if accepting 43.
3. **ADR-0342 implementation sortie:** Implement `verify_citation_freshness(hashes[])` in NHO Reiseliv MCP + Lovdata MCP. Follow ADR-0342 §Contract exactly (batch 100, LOVSEN_FIXTURE_MODE determinism, telemetry per ADR-0256).
4. **Transcribe-agent sortie:** Build agent that reads `01-pontus-compute-worksheet.md` + `02-citation-lookup.md` (post Pontus signature) and writes the 5 `expected/*.json` files per ADR-0341 §3 schema. UUID label resolution against seeded K1a rows.
5. **Test runner wire-up:** Add `pnpm test:golden-month` script + golden-month.test.ts `compareWithExpected()` branch (currently only structural invariants fire).
6. **Phase 1.5 sortie:** `approve_period` tool + four-eyes gate. See PHASES.md §Phase 1.5.
7. **SMA-372 update:** After E3 verify + signature, update Linear ticket status to In Progress → update to Done when `expected/*.json` lands and CI green.

---

## Files touched this session

### ADRs (docs/decisions/)

- `0341-calc-engine-test-oracle-provenance-contract.md` — written, 4-seat council reviewed, v1.1 accepted
- `0342-lovsen-mcp-freshness-verification-tool.md` — written, accepted

### Migrations (supabase/migrations/)

- `20260516_payroll_fixture_uuids.sql` (B1 seed — 14 UUIDs, tariff + supplement_rule K1a rows)
- `20260516_payroll_role_class_check_extension.sql` (E5 — CHECK constraint + backfill)
- `20260516_payroll_kveldstillegg_rename.sql` (B4 — CASCADE rename provenance UPDATE)

### Engine (packages/payroll-calculate/src/)

- `deviation-checks.ts` — W11 Oslo-TZ fix (osloDateString helper), W04 boundary test
- `evaluate-supplements.ts` — E2 holiday-bucket gate

### Engine tests (packages/payroll-calculate/__tests__/golden-month/)

- `input/supplement_rules.json` — B4 rename + B1 UUID alignment
- `input/shift_inventory.json` — B3 sh-018 date correction
- `input/profiles.json` — E1 prof-006 tariff_category fix, B2 monthly formula for prof-005..008
- `input/tariff_rate_table.json` — B1 UUID seed alignment

### Docs (docs/)

- `HANDOFF-payroll-phase-1-closeout.md` — this file
- `modules/payroll/PHASES.md` — F1 doc cleanup + G1-G8 gap section
- `modules/payroll/golden-month-worksheet/00-shift-inventory.md` — 43-shift inventory
- `modules/payroll/golden-month-worksheet/01-pontus-compute-worksheet.md` — 12 profiles × 158 cells
- `modules/payroll/golden-month-worksheet/02-citation-lookup.md` — Lovsen certification table (E3 pending)
- `PLAN-payroll-phase-1.md` — re-baselined as done

---

## References

- **ADR-0341 v1.1** — `docs/decisions/0341-calc-engine-test-oracle-provenance-contract.md` — calc-engine test oracle provenance contract (14-field per-cell schema)
- **ADR-0342** — `docs/decisions/0342-lovsen-mcp-freshness-verification-tool.md` — Lovsen MCP `verify_citation_freshness` tool contract
- **ADR-0110** — Bubble oracle prohibited (bug-parity + GDPR prohibition; reason G1 option A rejected)
- **ADR-0251** — `shift_pay_calculation_event` INSERT-only audit trail; load-bearing for provenance chain
- **ADR-0256** — Lovsen citation envelope (`lovsenCitationText`, `lovsenCitationURL`, `lovsenCitationFetchedAt`); H2 edit in ADR-0341 v1.1
- **ADR-0258** — `LOVSEN_FIXTURE_MODE=true` determinism contract; non-negotiable for offline CI pathway
- **SMA-372** — Linear ticket tracking this close-out session
- **COUNCIL-LOG — G1** (session 2026-05-16a): golden-month source-of-truth. Seats: payroll-engine, lovsen, system-steward. Verdict: B-anchored Lovsen-citation hybrid
- **COUNCIL-LOG — ADR-0341 text review** (session 2026-05-16b): 4-seat review. Seats: steward (chair), supervisor, payroll-engine code-tracer, lovsen. L-0147 4th precedent. REJECT IN CURRENT FORM → 6 mandated edits → v1.1
- **COUNCIL-LOG — B2/B3/B4 fixture truth** (session 2026-05-16c): 4-seat. B3 L-0147 5th precedent. B2 3-way split → synthesised formula
- **council_meta.md entry** — Session 2026-05-16b Phase 9 self-improvement: code-tracer-mandatory pattern promoted to run-council SKILL.md hard rule (schema-locking ADRs)
- **L-0147 precedents:** 4th = ADR-0341 ADR review council (chair reversal on type mismatch); 5th = B3 fixture council (chair reversal on Skjærtorsdag date)
- **Worksheet files:** `docs/modules/payroll/golden-month-worksheet/` (00, 01, 02)
- **HANDOFF-payroll-phase-1.md** — Phase 1 code-ship HANDOFF (the record of what was built before this session)
