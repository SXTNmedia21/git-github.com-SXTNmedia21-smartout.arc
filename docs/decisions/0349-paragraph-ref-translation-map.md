---
title: "Paragraph-ref translation map — Smartout worksheet shorthand → Lovdata canonical (Riksavtalen Fellesforbundet)"
id: ADR_0349
status: proposed
date: 2026-05-17
layer: decision
created: 2026-05-17
updated: 2026-05-17
module: payroll
tags: [lovsen, payroll, riksavtalen, golden-month, paragraf, translation, lovdata, phase-7]
supersedes: none
superseded_by: none
amends: none
related_adrs: [ADR-0341, ADR-0347, ADR-0348]
---

# ADR-0349: Paragraph-ref translation map — Smartout worksheet shorthand → Lovdata canonical

## 2026-05-17 AMENDMENT — Dynamic-MCP-Fetch Pivot (Round 2)

**Translation map is LOAD-BEARING for ADR-0352 `derive_supplement_set`.** Phase 7d council (2026-05-17) established that the Python MCP implementing `derive_supplement_set` consumes this map at synthesis time — not only the Phase 7c re-cert tool.

When `derive_supplement_set` is called with a workspace's configured supplement types, the MCP resolves each supplement type's `paragrafRef` shorthand to a Lovdata canonical address using this map, then fetches the live paragraph text. The map is therefore a runtime dependency of the dynamic-tariff system, not only a fixture-author artifact.

**Phase 7c-prep verification (2026-05-17) confirmed 6/6 rows.** All currently populated map entries were verified against taro-79 on Lovdata. Remaining `TBD` entries (helligdagstillegg, §3 context audit) must be resolved before Phase 7e ships `derive_supplement_set` capability tool integration.

**Map authorship unchanged.** Lovsen owns the map; Pontus owns worksheet `paragrafRef` values. Three-seat authority separation per ADR-0341 §H is preserved. The new consumer (ADR-0352 Python MCP) reads the map as a read-only artifact — it does not write to it.

## Intro

Three facts set the problem:

1. **Worksheet `paragrafRef` is Smartout domain shorthand, not a literal Lovdata reference.** Values like `"Riksavtalen §6"` and `"Riksavtalen §3"` are coarse-grained labels that Pontus (worksheet author) used to denote the supplements chapter or minstelønn chapter during fixture authoring. They are not addressable paragraph identifiers on Lovdata.no.

2. **Lovdata canonical numbering differs.** Under taro-79 (Riksavtalen Fellesforbundet 2024–2026), the Lovsen council verified on 2026-05-17 that kveldstillegg sits at `§4-3`. Other supplement types that worksheet authors labelled `"Riksavtalen §6"` (helgetillegg, nattillegg, helligdagstillegg) map to distinct sub-paragraphs in the `§4-*` range — all pending verification.

3. **Translation map resolves the gap at re-cert time.** The artifact at `docs/reference/riksavtalen-paragraph-mapping.md` maps each `(worksheetShorthand, supplementType)` pair to its Lovdata-canonical `(taro_id, paragraph, ledd)`. Worksheet authors keep their shorthand (zero re-authoring). The re-cert tool (Phase 7c) reads the map and populates `lovsenCitationUrl` + `lovsenCitationText` + `lovsenCitationHash` with the Lovdata-canonical address.

## Context

ADR-0347 (Lovdata canonical as primary citation source) requires the Phase 7 re-cert pass to fetch real Lovdata paragraph text and compute proper citation hashes. Lovdata's `fetch_riksavtalen_paragraph` tool addresses paragraphs by canonical numbering — not by the `"Riksavtalen §6"` shorthand that appears in 240+ worksheet cells.

Worksheet authors used shorthand for fixture-authoring speed. Pontus signed 240+ cells across 43 shifts; the Council Phase 5 Steward (2026-05-17) explicitly rejected re-signing 716 PENDING cells with Lovdata-canonical refs, on the grounds that it constitutes 716 re-auth events — a scope explosion disproportionate to the benefit (citation correctness can be achieved at the tool layer without touching cell authority).

The Coordinator's code-trace (2026-05-17) confirmed zero capability consumers of the `paragrafRef` field downstream of the fixture schema. The field is used for human-readable debugging; it does not drive any runtime logic. This makes a tool-side translation safe: nothing in the engine reads `paragrafRef` to route, classify, or compute.

A deterministic lookup table is therefore the correct boundary. It is a single artifact maintained by Lovsen, not a rewrite of 716 cell authorities.

## Decision Drivers

- **Worksheet authority preservation.** Pontus signed `amount_ore` + `formula` per ADR-0341. Re-signing 716 PENDING cells to change only the `paragrafRef` field constitutes 716 additional re-auth events. Steward Phase 5 rejected this scope expansion as disproportionate — the amounts are correct, only the citation label is coarse-grained.
- **Code-trace evidence.** Zero capability consumers of `paragrafRef` in the engine or capability layer. The field is fixture-schema-only; changing it at fixture time versus translation-time has identical downstream effect.
- **Cascade integrity.** A deterministic map = single source of truth. Any future Riksavtalen renumbering updates one file, not hundreds of worksheet cells.
- **Forward-compatibility.** If taro-79 is superseded by a 2027 edition, the map gains a `validFrom`/`validTo` column. Worksheet cells remain unchanged; only the map is versioned.
- **Phase 7c unblocking.** Re-cert tool needs this map to proceed. Without it, the tool cannot resolve `"Riksavtalen §6"` → `fetch_riksavtalen_paragraph` parameters.

## Considered Options

1. **Option A — Re-paragrafRef all 716 PENDING cells to Lovdata canonical.** Each cell's `paragrafRef` field is updated to `"§4-3"` (or variant) and Pontus re-signs. REJECTED by Steward Phase 5: 716 re-auth events is a scope explosion. The re-cert pass exists to add citation envelopes, not to re-derive worksheet computation. Re-signing signals Pontus re-checked the amount; re-labelling a citation reference is not an amount recheck.

2. **Option B — Add 17th field `canonicalParagrafRef` to the per-cell schema (ADR-0341 §H).** Each cell carries both `paragrafRef` (worksheet shorthand) and `canonicalParagrafRef` (Lovdata address). REJECTED by Coordinator code-trace + Steward self-reversal: the schema already has 16 fields. A 17th field that is always derivable from a lookup adds schema surface without new information. Zero capability consumers means zero benefit from embedding at cell level.

3. **Option C (chosen) — Translation map at `docs/reference/riksavtalen-paragraph-mapping.md`, applied by re-cert tool at fetch time.** Worksheet `paragrafRef` stays as authored. Re-cert tool reads map, resolves to Lovdata canonical, calls `fetch_riksavtalen_paragraph`, writes citation envelope. Worksheet schema and fixture files untouched.

## Decision Outcome

Chosen option: **C — Translation map as fixture-author artifact, consumed by re-cert tool at Phase 7c fetch time.**

Council Phase 5 synthesis (Steward, 2026-05-17) accepted this framing after the Coordinator demonstrated zero downstream consumers of `paragrafRef`. The Steward self-reversed the Option B proposal mid-council when the code-trace evidence landed.

### Mechanics

1. **Worksheet authors write `paragrafRef` as shorthand** (`"Riksavtalen §6"`, `"Riksavtalen §3"`, `"Ferieloven §10"`). No change from current practice.
2. **Map file** (`docs/reference/riksavtalen-paragraph-mapping.md`) declares the deterministic resolution: `(worksheetShorthand, supplementType)` → `(taro_id, paragraph, ledd, lovdataUrl)`.
3. **Re-cert tool (Phase 7c)** reads `paragrafRef` + `ruleLabel` (which encodes supplement type) from each worksheet cell, looks up the map, resolves to Lovdata canonical coordinates, calls `fetch_riksavtalen_paragraph`, and writes `lovsenCitationUrl` + `lovsenCitationText` + `lovsenCitationHash` into the cell's citation envelope.
4. **CI validation** (Implementation gate T3): every `paragrafRef` value in any `expected/*.json` MUST exist in the map as a key. Missing map entry = `golden-month.paragrafref_map_missing` error. This prevents silent resolution gaps when new supplement types are added.
5. **`paragrafRef` display value unchanged.** The cell still shows `"Riksavtalen §6"` for human readability. The `lovsenCitationUrl` field in the envelope shows the canonical Lovdata URL.

### Authority of the map

The map is authored and maintained by Lovsen (citation authority per ADR-0341 §H authority separation). Pontus does not own the map. Worksheet `paragrafRef` values are authored by Pontus (computation authority). This preserves the three-seat separation: Pontus signs amounts, Lovsen signs citations, engine is the test subject.

### Scope of this map

This map covers **taro-79 (Riksavtalen Fellesforbundet 2024–2026) only**. If D3 configuration is later split per workspace variant (taro-226 vs taro-79, per open question below), the map gains a per-variant column or a second file.

## Rules & Consequences

- **Good, because** worksheet authors keep shorthand; no re-signing burden; Pontus's authority over `amount_ore` and `formula` is undisturbed.
- **Good, because** citation envelope (`lovsenCitationUrl` etc.) receives Lovdata-canonical address; regulator-defensible at audit time.
- **Good, because** map is the single source of truth for shorthand resolution; Riksavtalen renumbering updates one file, not hundreds of cells.
- **Bad, because** map is a new artifact requiring ongoing maintenance. When Riksavtalen 2027 ships with different paragraph numbers, the map must be updated before any re-cert pass runs. Failure to maintain = CI red on `golden-month.paragrafref_map_missing` (acceptable — this is the intended signal).
- **Agent Impact:** Re-cert tool (Phase 7c) MUST load map before calling `fetch_riksavtalen_paragraph`. Capability layer is untouched. CI gains one new error code `golden-month.paragrafref_map_missing`.

## Implementation Gates

- **T1** — Lovsen verifies remaining 6 PENDING-LOVSEN-MAP entries in `docs/reference/riksavtalen-paragraph-mapping.md` against Lovdata taro-79. Output committed to map file. Cannot proceed to Phase 7c without T1 complete.
- **T2** — Re-cert tool (Phase 7c) loads map at startup, resolves `paragrafRef` + `ruleLabel` → Lovdata coordinates, calls `fetch_riksavtalen_paragraph`, writes envelope fields.
- **T3** — CI validation: `pnpm test:golden-month` validates every `paragrafRef` value in `expected/*.json` exists as a key in the map. Fails with `golden-month.paragrafref_map_missing` on any unresolvable shorthand.

## Open Questions

1. **taro-79 vs taro-226 variant.** This map is taro-79 (Fellesforbundet Riksavtalen). If workspace D3 configuration supports a second Riksavtalen variant (e.g. taro-226 Lederne), the map must either gain a `variant` column or split into per-variant files. To be resolved when multi-variant D3 ADR is drafted.

2. **`"Riksavtalen §3"` context audit.** Worksheet uses `"Riksavtalen §3"` for minstelønn cells. The map currently marks this as `TBD` pending a worksheet context audit to confirm the supplement type for each `§3` occurrence. T1 must include this audit.

3. **`"Ferieloven §10"` coverage.** The `paragrafRef` grep shows `"Ferieloven §10"` appearing in fixtures. This references the Holiday Pay Act, not Riksavtalen. It does NOT need a taro-79 entry — it routes to a different MCP (Lovdata Ferieloven). The map file should declare this explicitly as `out-of-scope` for taro-79 coverage, with a pointer to the Ferieloven fetch path.

## References

- **ADR-0341** — Per-cell schema; `paragrafRef` field semantics (§H); three-seat authority separation.
- **ADR-0347** — Lovdata canonical citation as primary source (Phase 7 re-cert basis); taro-79 as the authoritative Riksavtalen document on Lovdata.no.
- **ADR-0348** — Two-hash model (`lovsenCitationHash` NHO snapshot + `lovdataCitationHash` Lovdata canonical); supersedes ADR-0341 §H single-hash.
- **`docs/reference/riksavtalen-paragraph-mapping.md`** — The map artifact governed by this ADR.
- Council Phase 5 synthesis 2026-05-17 — Steward self-reversal on Option B; Coordinator code-trace confirming zero capability consumers of `paragrafRef`.
