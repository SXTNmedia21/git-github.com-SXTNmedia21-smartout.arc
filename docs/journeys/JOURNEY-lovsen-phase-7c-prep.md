---
title: "Journey — lovsen-phase-7c-prep"
feature: lovsen-phase-7c-prep
status: done
updated: 2026-05-17
created: 2026-05-17
module: payroll
tags: [lovsen, riksavtalen, rate-verification, translation-map, webfetch]
---

# Journey — lovsen-phase-7c-prep

Findings sortie. Lovsen verifies Riksavtalen paragraph mapping and supplement rates against Lovdata + NHO Reiseliv published satser, resolving Phase 7c trust-gate blockers 2 and 3.

---

## Journey 1: Lovsen resolves PENDING-LOVSEN-MAP translation rows via Lovdata WebFetch

**Precondition:** `docs/reference/riksavtalen-paragraph-mapping.md` contains 6 rows with status `PENDING-LOVSEN-MAP`. Lovdata taro-79 is publicly accessible without authentication.

1. Lovsen WebFetches Lovdata taro-79 chapter URLs (KAPITTEL_3, KAPITTEL_4, KAPITTEL_5, KAPITTEL_6) → system returns structured HTML with paragraph headings and verbatim text
2. For each supplement type, Lovsen locates the canonical paragraph number and extracts verbatim excerpt confirming the supplement obligation
3. Lovsen updates each translation map row: status `PENDING-LOVSEN-MAP` → `LOVSEN-VERIFIED 2026-05-17`, adds paragraph ref and verbatim excerpt
4. All 6 rows resolved:
   - kveldstillegg → §4-3 (15.65 kr/t base rate, evening shift supplement obligation confirmed)
   - helgetillegg → §4-3.3.1 (29.74 kr/t weekend obligation confirmed)
   - nattillegg-ordinær → §4-4 (24.01 kr/t ordinary night supplement confirmed)
   - nattillegg-nattvakt → §4-5 (42.41 kr/t night-shift supplement confirmed)
   - nattillegg-combined → §4-4+§4-5 compound variant (56.02 kr/t = 24.01+42.41 confirmed)
   - helligdag → §4-2 (percentage multiplier confirmed — NOT a flat kr/t rate)
   - minstelønn → §3-3 (minimum wage obligation confirmed)
5. Translation map saved with updated status and paragraph references for all 6 rows

**Postcondition:** `riksavtalen-paragraph-mapping.md` shows 6/6 LOVSEN-VERIFIED rows. Each row has canonical paragraph ref (e.g. `taro-79/KAPITTEL_4/§4-3`) and verbatim excerpt.

**Error path:** If Lovdata is temporarily unavailable, WebSearch on `lovdata.no taro-79 §4-3` returns sufficient excerpt text to verify; mark row as `LOVSEN-VERIFIED (search-fallback)` with note.

---

## Journey 2: Lovsen verifies worksheet rates against Fellesforbundet + NHO Reiseliv published satser

**Precondition:** Worksheet contains supplement rates dated 2026 (kveldstillegg 15.65, helgetillegg 29.74, nattillegg variants 42.41/24.01/56.02, helligdag 100% markup). No 2026 lønnsoppgjør protokoll exists — Fellesforbundet/NHO Reiseliv strike active since 19 April 2026.

1. Lovsen WebSearches `NHO Reiseliv Riksavtalen satser 2025 2026 lønnsoppgjør mellomoppgjør` → system returns snippets confirming no 2026 protokoll; strike confirmed active
2. Lovsen identifies rates are from 1 April 2025 mellomoppgjør — the most recent settled rates
3. Lovsen attempts WebFetch on NHO Reiseliv contentassets PDF URL for tariff satser → system returns binary PDF; Fellesforbundet satser extractable via search snippet text, not full WebFetch
4. Lovsen cross-references 6 worksheet rates against Lovdata paragraph text and Fellesforbundet snippet values:
   - nattillegg-nattvakt (42.41 kr/t) → CONFIRMED against §4-5 Fellesforbundet snippet
   - nattillegg-ordinær (24.01 kr/t) → CONFIRMED against §4-4 Fellesforbundet snippet
   - nattillegg-combined (56.02 kr/t) → CONFIRMED as 24.01 + 42.41 compound
   - kveldstillegg (15.65 kr/t) → MISLABELED — worksheet kveldstillegg row carries nattillegg-nattvakt rate
   - helgetillegg (29.74 kr/t) → MISLABELED — worksheet helgetillegg row carries nattillegg-ordinær rate
   - helligdag (100% markup) → WRONG TYPE — §4-2 specifies percentage multiplier; worksheet uses flat kr/t field
5. Lovsen documents all findings in `docs/audits/2026-05-17-nho-reiseliv-rate-verification.md`

**Postcondition:** Rate verification audit doc records 3/6 confirmed, 2/6 label-swapped, 1/6 wrong type. Finding is surfaced to council as architectural decision point — worksheet authority vs Lovdata canonical is a governance decision, not a code bug fix.

**Error path:** If NHO Reiseliv PDF is behind member portal, mark as `PARTIAL — member portal` and rely on Lovdata paragraph text + Fellesforbundet public snippet for verification. Note gap in audit doc and recommend manual NHO Reiseliv contact for full PDF.

---

## Journey 3: Council session — Phase 7 architectural pivot review

**Precondition:** C1 and C2 findings documented. Rate mismatches and helligdag type-mismatch identified. Dynamic-MCP-fetch model proposed as alternative to static worksheet.

1. Council convenes 2026-05-17 with C1+C2 findings as input
2. Council reviews dynamic-MCP-fetch pivot proposal: Lovsen MCP synthesizes live rates at calculation time rather than stamping static worksheet values
3. Chair notes 6th occurrence of L-0147 self-reversal pattern (earlier pivot away from dynamic fetch reversed)
4. Council votes APPROVE WITH CHANGES — dynamic-MCP-fetch model approved with conditions:
   - Must define freshness TTL and snapshot fallback (ADR-0350 territory)
   - Must handle strike/no-settlement state explicitly (ADR-0351 territory)
   - Must not block payroll calculation on MCP availability (ADR-0352 territory)
5. Council records 5 ADRs planned for Phase 7d: Lovsen bridge, workspace-supplement-policy, derive_supplement_set MCP, workspace_framework_binding bootstrap, snapshot freshness ops

**Postcondition:** Council conclusion documented. Phase 7c (cell migration) formally deferred. Phase 7d sortie chartered with 5 ADRs as deliverables.

**Error path:** If council cannot reach quorum, chair records dissenting position and Pontus decides via direct authority. Council non-quorum does not block Phase 7d start — Pontus approval sufficient.
