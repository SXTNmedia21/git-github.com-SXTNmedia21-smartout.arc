---
title: "Journey — lovsen-phase-7a-adrs"
feature: lovsen-phase-7a-adrs
journey: phase-7a-adrs
status: verified
verified_at: 2026-05-17
e2e_test: null
created: 2026-05-17
updated: 2026-05-17
module: payroll
tags: [journey, payroll, lovsen, adr, phase-7, council, riksavtalen, lovdata]
---

# Journey — lovsen-phase-7a-adrs

Pure docs sortie. No runtime flows. Two journeys document how downstream actors consume the Phase 7a ADR foundation.

---

## Journey 1 — Phase 7b developer reads ADR foundation before code

**Precondition:** Phase 7b sortie opened (planned branch: `feat/payroll-phase-7b-lovdata-mcp`). Developer has access to `docs/decisions/` and `docs/reference/`.

1. Developer reads `docs/decisions/0347-lovdata-canonical-source-for-riksavtalen.md`
   → Understands routing decision: Lovdata MCP is now the Riksavtalen canonical source
   → Understands NHO MCP is repurposed to non-rate fact-finding only
   → Sees that ADR-0258 + ADR-0342 are both amended
2. Developer reads `docs/decisions/0348-two-hash-model-for-citation-envelopes.md`
   → Understands two-hash schema migration: `structureHash` + `rateHash` replace single-hash model from ADR-0341 §H
   → Understands each hash invalidates independently (structure change ≠ rate change)
3. Developer reads `docs/decisions/0349-paragraph-ref-translation-map.md`
   → Understands shorthand→canonical §-ref mapping governance
   → Understands where the live map lives: `docs/reference/riksavtalen-paragraph-mapping.md`
4. Developer reads `docs/decisions/0342-*.md` §"2026-05-17 AMENDMENT"
   → Understands NHO MCP routing is historical; all new Riksavtalen calls route through Lovdata MCP
5. Developer reads `docs/reference/riksavtalen-paragraph-mapping.md`
   → Sees 7 rows (1 LOVSEN-VERIFIED + 6 PENDING-LOVSEN-MAP)
   → Notes which supplement types still need paragraph verification before Phase 7c cell migration
6. Developer verifies trust-gate 1: runs live curl against Lovdata TARO URL
   → Confirms endpoint returns HTTP 200 + parseable JSON/XML
   → Proceeds to Phase 7b implementation

**Postcondition:** Developer has full ADR context to extend lovdata-mcp, implement `fetch_riksavtalen_paragraph` tool, and add `verify_citation_freshness` mirror — without introducing ontology fiction (ADR-0347 intent).

**Error path:** If PENDING-LOVSEN-MAP rows are still present in step 5 when Phase 7c is about to start → block Phase 7c cell re-certification until Lovsen verifies remaining rows. Do not proceed with partial map.

---

## Journey 2 — Lovsen agent verifies translation map

**Precondition:** `docs/reference/riksavtalen-paragraph-mapping.md` exists with 6 rows marked `PENDING-LOVSEN-MAP`. Lovsen agent (or human Lovsen) has access to lovdata.no.

1. Lovsen agent fetches `lovdata.no/dokument/TARO/tariff/taro-79/KAPITTEL_4` (or the relevant chapter for each supplement type)
   → Loads the Riksavtalen chapter structure
2. For each shorthand in the map (helgetillegg, nattillegg variants A/B/C, helligdagstillegg):
   → Locates the canonical paragraph in the fetched chapter (expected format: `§4-X`)
   → Records exact paragraph number and any sub-clause identifier
3. Updates `docs/reference/riksavtalen-paragraph-mapping.md` for each verified row:
   → Sets `canonicalParagraph` to verified `§4-X` value
   → Changes `status` from `PENDING-LOVSEN-MAP` to `LOVSEN-VERIFIED <date>`
   → Adds `verifiedBy: lovsen` + `verifiedAt: <date>`
4. Commits the updated map file with message referencing ADR-0349 T1 gate:
   → `docs(payroll): verify riksavtalen paragraph map rows — ADR-0349 T1`

**Postcondition:** 7/7 map rows have status `LOVSEN-VERIFIED`. Phase 7c re-certification tool can resolve every worksheet `paragrafRef` to a canonical §-ref without ambiguity.

**Error path:** If Lovdata chapter structure differs from expected (e.g. supplement is not in §4 chapter, or paragraph numbering has changed since tariff update):
→ Do NOT guess or approximate the paragraph ref
→ Escalate to ADR-0349 amendment — the map governance ADR must be updated before the ref is written to any cell
→ Comment on the relevant PENDING row: `ESCALATED — structure mismatch, see ADR-0349-amendment-<date>`
