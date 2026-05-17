---
title: "Handoff — lovsen-phase-7c-prep"
feature: lovsen-phase-7c-prep
status: done
updated: 2026-05-17
created: 2026-05-17
module: payroll
tags: [lovsen, riksavtalen, rate-verification, translation-map, architectural-pivot, phase-7c]
---

# Handoff — lovsen-phase-7c-prep

## Summary

7c-prep resolved Phase 7c trust-gate blockers 2 (rate verification) and 3 (translation map) via Lovdata WebFetch and Fellesforbundet search snippet analysis, achieving 6/6 LOVSEN-VERIFIED on the translation map but exposing 3/6 rate-verification failures (2 label-swaps + 1 type mismatch). Findings triggered the Phase 7 architectural pivot council on 2026-05-17 (APPROVE WITH CHANGES on dynamic-MCP-fetch model); Phase 7c cell migration is formally deferred pending Phase 7d ADR foundations.

---

## Decisions Made

1. **Translation map scoped to taro-79 only** — see ADR-0349 (already accepted). NHO Reiseliv tariff tariff references resolve through Riksavtalen (taro-79); separate NHO interpretation layer is Phase 7d scope.

2. **Rates are 2025 mellomoppgjør, not 2026** — no 2026 lønnsoppgjør protokoll exists. Fellesforbundet/NHO Reiseliv strike active since 19 April 2026. The 358 cert-cells stamped `lovsen-mcp@v1` carry 1 April 2025 rates — this is correct for the current legal state; no rate update is possible until settlement.

3. **Pivot to dynamic-MCP-fetch model approved** — council 2026-05-17 APPROVE WITH CHANGES. Lovsen MCP will synthesize live rates at calculation time rather than relying on static worksheet values. Five ADRs (0350–0354) define the bridge, policy, MCP tool, bootstrap, and freshness ops — authored in Phase 7d.

---

## Learnings Discovered

**L-NEW (next after L-0288): Lovdata WebFetch is reliable; NHO Reiseliv satser require PDF fallback**

Lovdata taro-79 is publicly accessible, no auth, structured paragraph URLs return verbatim text reliably. Lovdata MCP can use plain HTTP — no auth layer needed. NHO Reiseliv satser are behind the member portal; however, NHO distributes PDFs via `contentassets/` paths and Fellesforbundet publishes parallel rate tables with public search snippet coverage. WebFetch returns binary for PDFs; extract via search snippet text, not direct WebFetch. When Fellesforbundet snippet text confirms a rate, treat as verified-via-snippet and note source in audit doc.

**L-NEW: Worksheet label-swaps are a worksheet authority problem, not a code bug**

2/6 worksheet rates were label-swapped: the kveldstillegg row carried the nattillegg-nattvakt rate (42.41 kr/t), and the helgetillegg row carried the nattillegg-ordinær rate (24.01 kr/t). Root cause unclear — possibly Pontus's intended bucket-classification diverged from Lovdata-canonical terminology at worksheet creation time. Council ruled this is a worksheet authority decision (Phase 7d ADR-0351 scope), not a code bug: the engine correctly reads the worksheet label; the worksheet label itself is wrong. Fixing the worksheet without ADR alignment risks breaking 358 stamped cert-cells.

---

## Known Issues / Debt

| Item | Severity | Owner |
|------|----------|-------|
| Worksheet carries 2/6 label-swapped rates (kveldstillegg, helgetillegg rows) | HIGH — affects cert-cell stamping | Phase 7d ADR-0351 |
| Worksheet helligdag field is wrong type (flat kr/t instead of % multiplier per §4-2) | HIGH — structural mismatch | Phase 7d schema work |
| 358 cert-cells stamped `lovsen-mcp@v1` carry wrong rates + wrong year label | MEDIUM — no user impact until payroll calc | Phase 7c cell migration (deferred) |
| NHO Reiseliv satser verification is snippet-only — no full PDF extraction | LOW — rates confirmed, source is partial | Manual NHO contact if full PDF needed |
| No 2026 lønnsoppgjør rates — strike ongoing as of 2026-05-17 | INFORMATIONAL — legally correct state | Monitor Fellesforbundet/NHO settlement |

---

## Next Steps

### Phase 7d sortie (immediate)

5 ADRs to author before any implementation:

| ADR | Topic | Scope |
|-----|-------|-------|
| ADR-0350 | Lovsen bridge architecture — dynamic-MCP-fetch model | How Lovsen MCP synthesizes rates at calculation time |
| ADR-0351 | workspace-supplement-policy — label authority | Who owns supplement label canonicalization; how to reconcile worksheet vs Lovdata |
| ADR-0352 | derive_supplement_set MCP tool | Tool contract, input/output, availability fallback during MCP downtime |
| ADR-0353 | workspace_framework_binding bootstrap | Schema + bootstrap flow for binding workspace to tariff framework |
| ADR-0354 | Snapshot freshness ops | TTL, stale-on-strike handling, cache invalidation on settlement |

### Phase 7d-followup (schema)

- Migration: `active_union` column on `payroll_workspace_settings` (or equivalent)
- Migration: `workspace_framework_binding` table (D3 layer)
- Migration: `tariff_snapshot` table with TTL metadata

### Phase 7e+ (implementation)

- Lovsen bridge implementation (Lovdata MCP + NHO Reiseliv MCP compose via derive_supplement_set)
- MCP synthesis tool — single entry point for supplement rate resolution
- Capability tools wired to bridge
- UI — supplement-policy configuration page
- Phase 7c cell migration — re-stamp 358 cert-cells with corrected rates post-bridge
