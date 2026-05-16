---
title: "Calc-engine test oracle provenance contract — B-anchored Lovsen-citation per cell"
id: ADR_0341
status: proposed
date: 2026-05-16
layer: decision
created: 2026-05-16
updated: 2026-05-16
module: MODULE_PAYROLL
tags: [payroll, calc-engine, golden-month, oracle, provenance, lovsen, p1]
supersedes: none
superseded_by: none
related_adrs: [ADR-0110, ADR-0251, ADR-0256, ADR-0258]
---

# ADR-0341: Calc-engine test oracle provenance contract

> Lønnsslippen må kunne forklares krone for krone, om så ti år fra nå. Phase 1 acceptance (±0.01 NOK per employee) er bare meningsfull hvis den forventede verdien selv er reviderbar — ellers tester vi engine mot et orakel ingen kan forsvare.

**Tre ekstremt-viktige punkter for leseren i 2027:**

1. **Hver krone i `expected/` bærer sin egen paragraf-binding.** Ingen aggregert sum uten per-celle `paragrafRef` + `lovsenCitationHash`. En revisor kan plukke vilkårlig celle og spore den til Riksavtalen-tekst som var i kraft når Pontus regnet.
2. **Authority er separert.** Pontus regner (computation), Lovsen sertifiserer paragrafer (citation-binding), engine er systemet som testes. Ingen seat produserer både compute og proof for samme celle.
3. **Stale citation = CI red.** Når `lovsen.citation.stale` fyrer mot en paragraf golden-month siterer, blir testen rød med `golden-month.citation_stale` til fixture er re-verifisert eller paragrafen er rebound.

## Context and Problem Statement

Phase 1 acceptance criterion 1 (PHASES.md §Phase 1) requires the calc-engine to match a hand-computed expected golden-month output within ±0.01 NOK per employee. SORTIE-PHASE-1.md §5 lays out the golden-month directory at `packages/payroll-calculate/__tests__/golden-month/expected/`. The plan tells us *where* the fixture lives — it does not tell us *how the fixture itself stays auditable* a decade from now.

Without a provenance contract on the expected output, the golden-month fixture becomes opaque the moment its author moves on. A 2027 engineer asked "why is bokstav m supplement 247 NOK on Anne's Saturday shift?" cannot answer without re-deriving from scratch — which destroys the whole point of having a golden case.

Three constraints make this acute:

- **ADR-0110** disqualifies Bubble payroll_ledger_archive as oracle (legacy bug-parity + GDPR exposure on a free-text JSON archive).
- **Four non-negotiables** (payroll-engine-developer skill): versjonering, idempotens, audit-trail, golden-cases. The expected side of "golden-cases" needs the same audit-trail rigor as the engine output.
- **ADR-0251 audit pattern** (shift_pay_calculation_event) demands every kr the engine produces is explainable; the expected fixture must meet the same bar or the equality comparison is meaningless.

L-0202 (sister-lesson, repeated 5×: ADD COLUMN beats sibling-table for 1:1 attributes without lifecycle independence) — its closest analog in test territory: per-cell provenance fields beat sibling "explanation files," because the explanation has no lifecycle independent of the cell.

## Decision Drivers

- **Regulator-defensible audit:** a Skatteetaten or Arbeidstilsynet auditor must be able to walk from any `expected/*.json` cell to the exact Riksavtalen paragraph text that justified the number.
- **Authority separation:** Pontus = computation; Lovsen = paragraph; engine = test subject. No single seat both computes and proves the same cell — otherwise the test certifies itself.
- **Stale-citation detection without re-running everything:** when a cited paragraph changes (Riksavtalen revision, holiday rate update), CI must surface the affected fixtures, not silently continue passing.
- **Bubble disqualified per ADR-0110:** legacy archive carries known bugs + GDPR exposure; using it as oracle would bake bug-parity into the engine.
- **LLM self-certification risk:** if Lovsen both *generates* the expected values and *certifies* them, the test loops on the same authority twice.

## Considered Options

1. **A — Bubble-export oracle** — pull payroll_ledger_archive snapshots from the live Bubble workspace, run engine against same shifts, expect parity.
2. **B — Pontus-computed + Lovsen-certified (chosen)** — Pontus hand-computes per-cell amounts; Lovsen MCP binds each cell to verbatim paragraph text via citation hash; per-cell schema makes both authorities visible.
3. **C — Lovsen-generated** — Lovsen produces both the paragraph citation AND the computed amount per cell from the cited rule.

## Decision Outcome

Chosen option: **B — B-anchored Lovsen-citation contract**.

A 3-seat council ran on 2026-05-16. Verdict unanimous: A rejected (ADR-0110 + bug-parity + GDPR), C rejected (ADR-0258 boundary + LLM self-certification risk), B adopted with per-cell schema lock + stale-handling + authority separation. Pontus accepts in the next session; this ADR is filed `proposed`.

### Per-cell schema (locked)

Every cell in every `expected/*.json` file MUST carry this exact shape:

```json
{
  "amount": 1247.00,
  "amount_unit": "NOK",
  "ruleId": "ot_50pct_first_2h",
  "paragrafRef": "Riksavtalen §11.2",
  "lovsenCitationHash": "sha256:abc...",
  "tariffVersionHash": "sha256:def...",
  "formula": "8h × 64.34 + 2h × 32.17",
  "computedBy": "pontus@smartout.no",
  "computedAt": "2026-05-16T14:30:00Z",
  "verifiedBy": "lovsen-mcp@v1",
  "verifiedAt": "2026-05-16T14:35:00Z"
}
```

Field semantics:

- `amount` — NOK with 2-decimal precision; the value the engine must hit within ±0.01.
- `ruleId` — identifier matching the engine's internal rule registry (e.g. `ot_50pct_first_2h`).
- `paragrafRef` — human-readable paragraph reference, used for debugging.
- `lovsenCitationHash` — SHA-256 of the verbatim paragraph text Lovsen returned (ADR-0256 schema). Binds the cell to a specific text snapshot.
- `tariffVersionHash` — SHA-256 of the tariff_rate_table row in force at `computedAt`; detects rate-table drift independently of paragraph drift.
- `formula` — human-readable derivation; not parsed by CI, but mandatory for the 2027-engineer audit walk.
- `computedBy` / `computedAt` — Pontus's authority signature; who computed, when.
- `verifiedBy` / `verifiedAt` — Lovsen MCP's citation-binding signature; which Lovsen version certified the paragraph, when.

### Directory layout

```
packages/payroll-calculate/__tests__/golden-month/
└── expected/
    ├── aggregated_periods.json     // array of cells per period
    ├── payroll_lines.json          // array of cells per line
    ├── deviations.json             // array of cells per deviation
    └── timebank_entries.json       // array of cells per timebank entry
```

Each file is a JSON array of cells in the schema above. No nested wrappers, no metadata envelope at file level (per-cell `computedAt` carries the temporal context).

### Stale handling

When `lovsen.citation.stale` (ADR-0256 telemetry) fires against a `paragrafRef` cited in any `expected/*.json` cell, CI MUST fail with error code `golden-month.citation_stale` until either:

1. The fixture cell is re-verified (new `lovsenCitationHash` + new `verifiedAt`), OR
2. The cited paragraph is rebound to the new Riksavtalen version (new `paragrafRef` + new `lovsenCitationHash` + Pontus re-confirms `amount` unchanged or updates it).

The stale-check runs as part of `pnpm test:golden-month`. Detection mechanism: load all `lovsenCitationHash` values from `expected/*.json`, call Lovsen MCP `verify_citation_freshness(hashes[])`, fail on any stale return.

### Authority separation

Three seats, three responsibilities, no overlap:

| Seat | Owns | Forbidden |
|---|---|---|
| **Pontus** | computation of `amount`, `formula`, `ruleId` | producing or signing `lovsenCitationHash` |
| **Lovsen MCP** | citation-binding (`paragrafRef`, `lovsenCitationHash`, `verifiedBy`, `verifiedAt`) | producing `amount` or `formula` |
| **Engine** | the system under test — produces actual output for comparison | participating in fixture construction at all |

If a cell has Pontus computing AND Pontus signing the citation, the cell is invalid. If Lovsen computes the amount from a cited rule, the cell is invalid (loops authority — see Option C rejection).

### Scope limits

- **43-shift fixture acceptable for v1.** SORTIE-PHASE-1.md §5 already scope-cut to 43 shifts; this ADR ratifies that scope for Phase 1 close-out. Scale to 600 shifts (Strøm Mat & Bar full period) when the first real period runs.
- **Lovsen scope per ADR-0258 — citation-binding only.** Lovsen MCP is the boundary for paragraph fetch + hash; it does NOT generate fixture values.
- **Phases 7+ out of scope.** Phase 7 (Tripletex export) and Phase 8 (recalc orchestration) will need their own oracle contracts — different domains, different authorities. This ADR governs calc-engine golden-month only.

## Rules & Consequences

- **Good, because** every kr in `expected/` is traceable to a specific paragraph text in force at a specific time — regulator-defensible, falsifiable, survives author turnover.
- **Good, because** the stale-citation hook means Riksavtalen revisions surface as CI failures with named affected cells, not silent drift.
- **Good, because** authority separation prevents the self-certification loop that would have made the test certify itself.
- **Bad, because** computation burden falls on Pontus (~3 days per fixture refresh for the 43-shift v1; ~2 weeks for the 600-shift Strøm Mat & Bar scale-up). No way around this — the whole point is hand-derived ground truth.
- **Bad, because** fixture refresh requires both Pontus availability AND Lovsen MCP availability; either-unavailable blocks the refresh.
- **Neutral:** sets the pattern for future engine oracle contracts (Phase 7 Tripletex parity, Phase 8 recalc determinism). Same schema shape will apply; only the authorities + scope swap.

### Implementation gates

- **F2 (golden-month build) MUST land schema-compliant fixture.** Every cell in every `expected/*.json` carries all 11 schema fields. PR review checklist explicitly verifies this.
- **F6 (verify step) MUST check every cell carries all schema fields.** Test runner loads `expected/*.json`, validates each cell against a Zod schema before running the equality comparison. A cell missing any field fails the run with `golden-month.cell_schema_violation`.
- **F6 MUST run stale-check.** Per the stale-handling rule above; CI red on any stale citation.

### Agent Impact

- **payroll-engine-developer skill** gets a new section "Test Oracle Provenance" pointing to this ADR.
- **Golden-month fixture authors** must use the schema verbatim — no abbreviated cell shapes, no "minimal" mode for early dev (the discipline must hold from day one or it never holds).
- **CI pipeline** gains two new failure modes: `golden-month.cell_schema_violation` (missing fields) and `golden-month.citation_stale` (paragraph drift).
- **Phase 7+ planning** inherits the pattern: every engine that ships a golden case must declare its three-seat authority separation before fixture work begins.

## Alternatives considered

### Option A — Bubble-export oracle (rejected, unanimous)

Pull payroll_ledger_archive snapshots from live Bubble, run engine against same shifts, expect parity.

Rejected because:
- **ADR-0110** explicitly disqualifies Bubble archive as oracle (legacy free-text JSON, no schema, known bugs).
- **Bug-parity trap:** the engine would inherit every Bubble bug as "passing." We are migrating away from Bubble *because* its output is wrong — using it as oracle locks in the wrongness.
- **GDPR exposure:** archive contains personnummer + bank-account in plaintext; using it as test fixture means CI environments need GDPR controls equivalent to production.
- **Cannot answer "why."** Bubble payroll output has no per-cell rule attribution. A 2027 audit walk dead-ends at "Bubble said so."

### Option C — Lovsen-generated (rejected per ADR-0258 + self-certification)

Lovsen produces both the paragraph citation AND the computed amount per cell.

Rejected because:
- **ADR-0258 scope boundary:** Lovsen MCPs do citation-binding, not domain calculation. Generating supplement amounts crosses into capability territory.
- **LLM self-certification risk:** if Lovsen computes `247 NOK` from cited rule `Riksavtalen §11.2` and also certifies the citation, the test verifies Lovsen's interpretation of Lovsen's reading — circular, no external truth anchor.
- **Determinism risk:** LLM-derived amounts may drift across Lovsen model versions; we lose the "frozen ground truth" property that golden cases exist to provide.

## References

- ADR-0110 — Payroll ledger archive semantics (Bubble oracle disqualification)
- ADR-0251 — shift_pay_calculation_event audit module (audit-trail pattern this fixture mirrors)
- ADR-0256 — Lovsen citation contract (citation schema + hash + stale-detection mechanism)
- ADR-0258 — Lovsen MCP boundary (citation-only scope, not generation)
- `docs/modules/payroll/SORTIE-PHASE-1.md` §5 — golden-month directory layout
- `docs/modules/payroll/PHASES.md` §Phase 1 — acceptance criterion 1 (±0.01 NOK)
- `.claude/skills/payroll-engine-developer/SKILL.md` — four non-negotiables (versjonering, idempotens, audit-trail, golden-cases)
- Council session 2026-05-16 — 3-seat verdict on golden-month source-of-truth (B-anchored hybrid, unanimous against A, unanimous against C)

---

> Pontus regner. Lovsen siterer. Engine bevises. Ingen seat sertifiserer seg selv.

> Registered in `docs/decisions/0000-decision-log.md`. Status `proposed` pending Pontus accept in next session.
