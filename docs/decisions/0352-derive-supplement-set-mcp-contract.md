---
title: "derive_supplement_set MCP contract — Python-owned synthesis of supplement rules from Riksavtalen text"
id: ADR_0352
status: proposed
date: 2026-05-17
layer: decision
created: 2026-05-17
updated: 2026-05-17
module: MODULE_AGENT_SDK
tags: [lovsen, mcp, derive, supplement, riksavtalen, lovdata, taro, payroll, phase-7d]
amends: [ADR-0258]
related_adrs: [ADR-0256, ADR-0258, ADR-0341, ADR-0347, ADR-0349, ADR-0350, ADR-0351, ADR-0353, ADR-0354]
---

# ADR-0352: derive_supplement_set MCP contract — Python-owned synthesis of supplement rules from Riksavtalen text

## Intro

- New MCP tool `derive_supplement_set(union_id, version, ledd?) → DerivationResult`. Owns the synthesis step: Riksavtalen paragraph text → executable supplement rules + tariff rate rows ready for persistence.
- Synthesis MUST live in Python MCP (Lovsen domain). The capability tool calls the bridge (ADR-0350) → MCP returns structured rules + citation envelopes. The capability persists. TypeScript never parses Riksavtalen text.
- Output references the ADR-0349 translation map (`paragraph_refs` field carries Lovdata canonical §-references). Citation envelopes carry hash + verbatim text per ADR-0256.

## Context and Problem Statement

Phase 7 dynamic-MCP-fetch pivot replaces the static seed (`packages/ai/src/industry/packages/hospitality.ts` `HOSPITALITY_TARIFF_RATES` constants + `hospitalityPackage.tariffs`) with bootstrap-time derivation. When a workspace selects a union, the capability tool calls this MCP method, receives a complete supplement set, and persists the result to `supplement_rule` + `tariff_rate_table`.

Without this method, the capability tool would need to parse Riksavtalen text in TypeScript. That is a legal-interpretation drift risk in the same class as L-0177 (silent fallback = bug). TypeScript has no mechanism to chain `fetch_riksavtalen_paragraph`, apply the ADR-0349 translation map, extract rate values from Norwegian paragraph prose, and produce auditable citation envelopes. Python MCP already owns all of those primitives (Lovdata client, citation module, fixture mode).

## Decision Drivers

- **ADR-0258 boundary:** synthesis is content interpretation; it belongs in MCP. Capability tools call, MCP interprets.
- **Translation map (ADR-0349):** synthesis tool reads `docs/reference/riksavtalen-paragraph-mapping.md` to map workspace shorthand → Lovdata canonical §-references.
- **Audit defensibility (ADR-0256):** every emitted rule carries a citation envelope (verbatim text + hash + source URL + fetched_at).
- **Two-hash model (ADR-0348):** each emitted rule carries `structureHash` (paragraph-structure-stable) + `rateHash` (rate-value-sensitive) alongside legacy `lovsenCitationHash` (backwards-compat).
- **Floor enforcement (ADR-0351):** emitted rates ARE the tariff floor — they are the authoritative source of truth for supplement rate evaluation in the calc engine.

## Considered Options

1. **Option A — TypeScript capability tool parses Riksavtalen text** — rejected. No Python primitives available; legal-interpretation drift risk (L-0177 class); no ADR-0256 citation envelope generation in TS.
2. **Option B — Shared parsing library (Python + TS bindings)** — rejected. Complexity far exceeds benefit; two parse-surface maintenance burden with no single boundary owner.
3. **Option C — Python MCP owns synthesis end-to-end (this ADR)** — chosen. Encapsulates all legal-text parsing inside Lovsen domain; capability tool remains a thin persist-and-emit layer.

## Decision Outcome

Chosen option: **Option C** — Python MCP (`lovsen-lovdata-mcp`) owns synthesis. Capability tool calls bridge (ADR-0350), receives `DerivationResult`, persists rows, emits telemetry.

## Method Contract

```python
# Input
def derive_supplement_set(
    union_id: str,           # e.g. "taro-79" (Fellesforbundet) or "taro-226" (Parat). Required.
    version: str,            # e.g. "2024-2026" or "2025-mellomoppgjor". Required.
    ledd: Optional[str] = None,  # specific paragraph subsection if narrowing
) -> DerivationResult: ...

# Output
class DerivationResult(TypedDict):
    rules: list[SupplementRuleSpec]      # ready-to-persist supplement rules
    rates: list[TariffRateSpec]          # tariff_rate_table rows
    paragraph_refs: list[Citation]       # ADR-0256 envelopes per rule
    union_metadata: UnionMetadata        # union_name, agreement_period, source_pdf_url
    derived_at: str                      # ISO-8601
    derivation_version: str              # e.g. "lovdata-mcp@v1+taro-79@2025-mellomoppgjor"
```

No version defaults — ADR-0258 mandates explicit version. Unknown `union_id` → `ValueError` listing supported IDs.

## Output Shapes

Python TypedDict models mirroring the TypeScript types in `packages/payroll-calculate/src/types.ts`:

```python
class SupplementRuleSpec(TypedDict):
    supplement_type: str              # e.g. "kveldstillegg", "helgetillegg"
                                      # Smartout-canonical, derived from ADR-0349 map reverse-lookup
    paragraph_ref_canonical: str      # e.g. "§4-3" (Lovdata)
    paragraph_ref_shorthand: str      # e.g. "Riksavtalen §6" (Smartout-domain)
    windows: list[TimeWindow]
    weekdays: list[int]
    match_predicate: dict
    structureHash: str                # ADR-0348: paragraph structure hash (<RATE>-masked)
    rateHash: str                     # ADR-0348: rate-value-sensitive hash
    lovsenCitationHash: str           # legacy single-hash backwards-compat (deprecated)
    lovsen_paragraph_url: str

class TariffRateSpec(TypedDict):
    supplement_type: str
    rate_value_ore: int               # bigint øre per Smartout convention (1 NOK = 100 øre)
    rate_basis: str                   # "per_hour" | "per_minute" | "percent_of_base"
    effective_from: str               # ISO-8601
    effective_to: Optional[str]
    law_version: str
    union_id: str
```

The `rate_value_ore` convention (bigint øre) matches `TariffRateInput.amount` in `types.ts` — converted at boundary by the capability tool. Parsing failure on rate extraction → `rate_value_ore=None` + flag for manual override (see Error Handling).

## Synthesis Logic

Python MCP responsibility — no TypeScript parsing:

1. Read the translation map (`docs/reference/riksavtalen-paragraph-mapping.md`, ADR-0349) to resolve shorthand ↔ canonical §-references.
2. For each canonical §-reference, call existing `fetch_riksavtalen_paragraph(taro_id, paragraph, version, ledd)` (Phase 7b) — chained internal call.
3. Parse rate values from verbatim text using per-supplement-type regex patterns (kveldstillegg, helgetillegg, nattillegg variants, helligdag, minstelønn).
4. Build `TimeWindow` + weekdays from paragraph text parsing.
5. Compute `structureHash` = SHA256 of paragraph text with rate numerals masked via `<RATE>` token (ADR-0348).
6. Compute `rateHash` = SHA256 of canonical-form rate extraction string (ADR-0348).
7. Build ADR-0256 Citation envelope per rule (verbatim text + hash + source URL + fetched_at).
8. Return `DerivationResult`.

## MCP Server Placement

File: `services/lovsen-lovdata-mcp/src/tools/derive_supplement_set.py`

Lovdata MCP owns Riksavtalen per ADR-0347. NHO Reiseliv MCP does NOT get this tool — out of scope per ADR-0347 repurpose (NHO Reiseliv MCP handles lønnsoppgjør cirkulær and employer-interpretive K1a auxiliary, not canonical paragraph text).

## Fixture Mode

`LOVSEN_FIXTURE_MODE=true` (ADR-0258 canonical; legacy `LOVSEN_MCP_FIXTURE=1` also honoured) returns deterministic synthesis from fixture file:

```
src/fixtures/derive_supplement_set_{union_id}_{version}.json
```

Missing fixture → explicit `FileNotFoundError` with instructions (no silent degradation). No network calls in fixture mode. CI always runs fixture mode.

## Error Handling

- **Unknown `union_id`** → `ValueError` listing supported values (initially: `taro-79`, `taro-226` only).
- **Empty `version`** → `ValueError` per ADR-0258 (no defaults — version confusion is a legal accuracy failure).
- **Translation map entry missing** for a supplement type → return partial `DerivationResult` with an additional `incomplete_supplements: list[str]` field. Capability tool surfaces this to admin for manual map update (ADR-0349 T3 CI gate will catch this at CI time).
- **Rate extraction parse failure** → emit `lovsen.derive.parse_failure` event (stderr stub); return rule with `rate_value_ore=None` and a `parse_failed: true` flag. Capability tool marks the row for manual override — never silently inserts `0` øre.

## Telemetry Stub

Per ADR-0342 event pattern:

| Event | Payload |
|---|---|
| `lovsen.derive.completed` | `union_id`, `version`, `n_rules`, `n_rates`, `n_incomplete` |
| `lovsen.derive.parse_failure` | `union_id`, `supplement_type`, `paragraph_ref` |

Events are stderr-stub only (Python MCP, no TypeScript registry) until a Python telemetry bridge is defined. Capability-side telemetry (capability persists + emits) uses the TypeScript `emit()` registry per ADR-0341.

## Rules & Consequences

- **Good, because** synthesis is fully encapsulated in Lovsen domain — the capability layer never interprets Riksavtalen text, translation map is reused as single source of truth, and citation envelopes are preserved per ADR-0256 for every emitted rule.
- **Good, because** static seed (`hospitality.ts` `HOSPITALITY_TARIFF_RATES`) is replaced by bootstrap-time derivation — rates are always sourced from the authoritative Lovdata text, eliminating the "update both constants AND seed migration" maintenance burden (see current source comment in the file).
- **Bad, because** rate-extraction regex per supplement type is a maintenance burden when Riksavtalen reformats paragraph prose between lønnsoppgjør rounds (typically every 2 years). Mitigated by: fixture mode catches regressions at CI time; parse failures are surfaced to admin, not silently zeroed.
- **Bad, because** partial-derivation surface (`incomplete_supplements` field) requires an admin-facing flow to complete manual map updates. This flow is not yet built (deferred — Phase 7f gate T1 covers only fixture + parser, not admin UI).
- **Agent Impact:** capability tool `setup_workspace_tariff` (ADR-0353) consumes this method via the bridge (ADR-0350). Capability body MUST NOT parse Riksavtalen text directly. Any new supplement type requires: (1) translation map entry (ADR-0349), (2) parser regex in `derive_supplement_set.py`, (3) fixture row in `derive_supplement_set_{union_id}_{version}.json`, (4) pytest coverage path.

## Implementation Gates (Phase 7f)

- **T1:** Spec `DerivationResult` Pydantic models + write fixtures for `taro-79` at versions `2025-mellomoppgjor` + `2024-2026` base.
- **T2:** Implement rate-extraction parser per supplement type: kveldstillegg, helgetillegg, nattillegg (nattvakt + ordinær variants), helligdagstillegg, minstelønn (begynner, 2-år, 4-år, 6-år, 8-år, 10-år seniority tiers per `SeniorityTier` type in `types.ts`).
- **T3:** Wire to `services/lovsen-lovdata-mcp/src/server.py` tool catalog.
- **T4:** pytest 6-path coverage: fixture-mode green, live-mode (CI skipped), unknown-union ValueError, missing-version ValueError, partial-derivation (missing map entry), parse-failure flag.

## References

- ADR-0256 — Citation envelope contract (verbatim text + hash + fetched_at)
- ADR-0258 — Lovsen MCP boundary (synthesis = MCP, no defaults, fixture mode canonical)
- ADR-0341 — Calc-engine test oracle provenance contract (per-cell citation fields)
- ADR-0347 — Lovdata as K1a canonical source for Riksavtalen; `fetch_riksavtalen_paragraph` (Phase 7b)
- ADR-0348 — Two-hash model (`structureHash` + `rateHash`)
- ADR-0349 — Paragraph-ref translation map (shorthand → canonical)
- ADR-0350 — Lovsen MCP→capability bridge transport (how capability calls MCP)
- ADR-0351 — Workspace supplement policy + tariff floor enforcement
- ADR-0353 — `setup_workspace_tariff` capability tool (consumer of this method)
- ADR-0354 — Snapshot freshness / staleness ops

---

> After writing: register in `docs/decisions/0000-decision-log.md` and update the ADR table in `CLAUDE.md`.
