---
title: "HANDOFF — lovsen-phase-7a-adrs"
feature: lovsen-phase-7a-adrs
branch: feat/payroll-lovsen-phase-7a-adrs
spec: docs/plans/PLAN-lovsen-phase-7a-adrs.md
status: done
updated: 2026-05-17
created: 2026-05-17
module: payroll
tags: [handoff, lovsen, payroll, adr, council, phase-7, riksavtalen, lovdata]
---

# HANDOFF — lovsen-phase-7a-adrs

## Summary

Council Phase 7 reframe shipped 3 ADRs (0347/0348/0349) plus an amendment to ADR-0342, a council audit log, 3 learnings, and the Riksavtalen paragraph translation map — establishing the complete architectural foundation for Lovdata-as-canonical-source before any code lands. Phase 7b (code) and Phase 7c (cell re-certification) are blocked on 5 trust-gate items, most notably Lovsen rate-verification and the 6 remaining PENDING translation map rows.

---

## Decisions Made

| ADR | Title | Rationale |
|-----|-------|-----------|
| ADR-0347 | Lovdata canonical source for Riksavtalen | Lovdata MCP provides primary-source TARO text; NHO MCP had ontology fiction risk (rate values without structural authority). Amends ADR-0258 + ADR-0342. |
| ADR-0348 | Two-hash model for citation envelopes | Single-hash from ADR-0341 §H could not distinguish structure changes from rate changes. `structureHash` + `rateHash` enables independent invalidation — rate update does not force structure re-fetch. |
| ADR-0349 | Paragraph-ref translation map | Shorthand keys (helgetillegg, nattillegg, etc.) must resolve to canonical §-refs via a governed map, not ad-hoc lookup. Map lives at `docs/reference/riksavtalen-paragraph-mapping.md` and is gated by T1 (Lovsen verification) before Phase 7c can proceed. |
| ADR-0342 (amendment) | NHO MCP routing marked historical | 2026-05-17 amendment section added: all new Riksavtalen calls route through Lovdata MCP; NHO MCP retained for non-rate fact-finding only. 358 existing cells remain dual-lineage until Phase 7c re-cert. |

---

## Learnings Discovered

| ID | Core Rule |
|----|-----------|
| L-0286 | **MCP routing identity drift** — When two MCPs serve overlapping domains, the "canonical" one must be declared in an ADR before any cells are written. Silent routing through the wrong MCP creates dual-lineage debt that requires a re-certification pass to resolve. Never assume the MCP with the friendliest API is the authoritative source. |
| L-0287 | **Council chair self-reversal pattern** — A council chair reversing their own position mid-session (Phase 3 SELF-REVERSAL) is a strong signal that the original position was built on an assumption rather than code-traced evidence. When a chair reverses on "no new schema field," the reversal stands — the Coordinator's code-trace showing ZERO capability consumers of `paragrafRef` is the load-bearing evidence, not the chair's prior architectural instinct. Log the reversal explicitly in the audit so future readers understand the lineage. |
| L-0288 | **Schema field demand-proof gate** — Before adding any new column or field to a shared schema, require a code-trace proving at least one capability consumer currently reads or writes the field. "This will be needed" is insufficient. Zero consumers = defer the field. The two-hash model (ADR-0348) replaced a proposed new column precisely because the trace found no current consumer of `paragrafRef` as a schema field. |

---

## Known Issues / Debt

### 1. Translation map — 6 PENDING-LOVSEN-MAP rows

`docs/reference/riksavtalen-paragraph-mapping.md` has 7 rows total; only 1 (kveldstillegg §4-2) is LOVSEN-VERIFIED. The remaining 6 rows (nattillegg A/B/C, helgetillegg, helligdagstillegg, and kveldstillegg-variant) are marked `PENDING-LOVSEN-MAP`.

**Impact:** Phase 7c cell re-certification CANNOT proceed until all 7 rows are verified. The re-cert tool uses the map to resolve `paragrafRef` in every worksheet cell. A partial map means partial re-cert = silent gaps in citation envelopes.

**Owner:** Lovsen (human or agent). Journey 2 in JOURNEY-lovsen-phase-7a-adrs.md describes the verification steps.

### 2. Rate-verification — 42.41 kr/t kveldstillegg unconfirmed

The map row for kveldstillegg cites 42.41 kr/t as the rate. This figure has NOT been cross-verified against the 2026 lønnsoppgjør protokoll (NHO/LO settlement document).

**Impact:** If the 2026 settlement changed the kveldstillegg rate, all payroll calculations using this rate are wrong. Tracked as task #63 (separate from this sortie).

**Owner:** Lovsen / payroll compliance. Requires fetching the official 2026 protokoll and comparing line items.

### 3. Dual-lineage cells — 358 cells stamped `lovsen-mcp@v1` via NHO routing

Prior to ADR-0347, 358 worksheet cells were fetched via NHO MCP and stamped with `source: "lovsen-mcp@v1"`. These cells have correct rate values (assumed) but wrong lineage — they should be `source: "lovdata-mcp@v1"` after re-certification.

**Impact:** Audit trails and citation envelope `structureHash` values for these cells are based on NHO MCP responses, not Lovdata primary-source responses. Phase 7c re-cert will overwrite them, but until then, any `verify_citation_freshness` call on these cells will compare against the wrong source.

**Owner:** Phase 7c sortie (after translation map is complete and Phase 7b tooling ships).

### 4. lovdata-mcp envvar canonicalization deferred

The `LOVSEN_MCP_FIXTURE=1` env var remains the only lovdata-mcp control. Proper envvar canonicalization (renaming to `LOVDATA_MCP_*`, adding `LOVDATA_BASE_URL`, etc.) was deferred to Phase 7b to avoid scope creep in a docs-only sortie.

**Impact:** Phase 7b developer must not ship code that hardcodes the old envvar name. The Phase 7b plan should include envvar migration as the first task.

**Owner:** Phase 7b sortie.

---

## Next Steps

### Phase 7b sortie — `feat/payroll-phase-7b-lovdata-mcp`

Scope (in order):

1. **Trust-gate 1:** Live curl verification — confirm Lovdata TARO URL returns 200 + parseable
2. **Envvar canonicalization** — rename `LOVSEN_MCP_FIXTURE` → `LOVDATA_MCP_FIXTURE` (or equivalent); add `LOVDATA_BASE_URL`
3. **Shared helper extraction** — extract citation envelope construction into a shared helper (avoids duplication across lovdata-mcp + NHO MCP call sites)
4. **`fetch_riksavtalen_paragraph` tool** — new tool on lovdata-mcp that takes `paragrafRef` (e.g. `§4-2`) and returns primary-source TARO text + structureHash
5. **`verify_citation_freshness` mirror** — implement on lovdata-mcp with source-discriminator; 4-path pytest: (a) fresh hit, (b) structure stale, (c) rate stale, (d) both stale
6. **Trust-gate 4 + 5 cleared** — envvar done + pytest green

### Lovsen verification (task #63, parallel)

- Verify 42.41 kr/t kveldstillegg against 2026 lønnsoppgjør protokoll
- Verify remaining 6 PENDING-LOVSEN-MAP rows against Lovdata TARO chapter
- Update `docs/reference/riksavtalen-paragraph-mapping.md` to 7/7 LOVSEN-VERIFIED

### Phase 7c sortie — cell re-certification

- Prerequisite: Phase 7b shipped + translation map 7/7 verified
- Re-certify 358 dual-lineage cells: re-fetch via Lovdata MCP, rebuild citation envelopes, stamp `source: "lovdata-mcp@v2"`
- Run `verify_citation_freshness` across all 358 cells post-re-cert
