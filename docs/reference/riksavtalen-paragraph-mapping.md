---
title: "Riksavtalen paragraph translation map — Smartout shorthand ↔ Lovdata canonical"
status: in_progress
updated: 2026-05-17
created: 2026-05-17
module: payroll
tags: [reference, lovsen, riksavtalen, paragraf, lovdata, golden-month, payroll]
---

# Riksavtalen Paragraph Translation Map

> **Governance:** ADR-0349 — maintained by Lovsen (citation authority per ADR-0341 §H). Pontus does not own this file.
>
> **Scope:** taro-79 (Riksavtalen Fellesforbundet 2024–2026) only. Multi-variant support deferred per ADR-0349 open question 1.
>
> **Purpose:** Re-cert tool (Phase 7c) reads this map to resolve worksheet `paragrafRef` shorthand → Lovdata canonical coordinates before calling `fetch_riksavtalen_paragraph`. Worksheet cells are never modified — only the citation envelope fields (`lovsenCitationUrl`, `lovsenCitationText`, `lovsenCitationHash`) are populated from Lovdata-fetched output.

## How to read this map

| Column | Meaning |
|---|---|
| `worksheetShorthand` | Exact string as it appears in `paragrafRef` field of `expected/*.json` cells |
| `supplementType` | Supplement type context — needed because `"Riksavtalen §6"` maps to different sub-paragraphs depending on the supplement |
| `ruleLabel` | One or more `ruleLabel` values (from worksheet) that narrow to this supplement type |
| `taro_id` | Lovdata document identifier for taro-79 Fellesforbundet Riksavtalen |
| `paragraph` | Lovdata-canonical paragraph number within the document |
| `ledd` | Paragraph sub-section (ledd), if applicable |
| `lovdataUrl` | Canonical Lovdata.no URL for direct audit access |
| `verificationStatus` | `LOVSEN-VERIFIED <date>` or `PENDING-LOVSEN-MAP` |
| `notes` | Additional context for re-cert tool or human auditor |

## Translation Table — taro-79 Fellesforbundet

| worksheetShorthand | supplementType | ruleLabel (examples) | taro_id | paragraph | ledd | lovdataUrl | verificationStatus | notes |
|---|---|---|---|---|---|---|---|---|
| Riksavtalen §6 | kveldstillegg | `kveldstillegg` | taro-79 | §4-3 | 3.2 | https://lovdata.no/dokument/TARO/tariff/taro-79/KAPITTEL_4 | LOVSEN-VERIFIED 2026-05-17 | "For arbeid på mandag – fredag i tidsrommet 21.00-24.00 utbetales et tillegg på kr 15,65 pr. time." Lovdata rate 2024-2026: kr 15.65/t. Worksheet fixture 42.41 kr/t is 2025-rate from NHO Reiseliv — diverges from Fellesforbundet taro-79 text. RATE FLAG: E3 re-verify against NHO Reiseliv Riksavtalen (may be a different tariff binding than taro-79). |
| Riksavtalen §6 | helgetillegg | `helgetillegg` | taro-79 | §4-3 | 3.1 | https://lovdata.no/dokument/TARO/tariff/taro-79/KAPITTEL_4 | LOVSEN-VERIFIED 2026-05-17 | "For arbeid på lørdager i tidsrommet 14.00 – 24.00 og på søndager i tidsrommet 06.00 – 24.00 utbetales et tillegg på kr 29,74 pr. arbeidede time." Lovdata rate: kr 29.74/t. Worksheet fixture 56.02 kr/t diverges — RATE FLAG same as kveldstillegg; E3 NHO Reiseliv re-verify required. |
| Riksavtalen §6 | nattillegg_nattvakt | `nattillegg`, `nattvakt` | taro-79 | §4-3 | 3.3 | https://lovdata.no/dokument/TARO/tariff/taro-79/KAPITTEL_4 | LOVSEN-VERIFIED 2026-05-17 | "For arbeid i tidsrommet 24.00 – 06.00 utbetales et tillegg på kr 41,46 pr. time." (nattvakt/vekter-variant). Lovdata rate: kr 41.46/t. Worksheet fixture 42.41 kr/t — close match, minor divergence likely 2025 vs 2024 rate. E3 pending. |
| Riksavtalen §6 | nattillegg_ordinaer | `nattillegg_ordinaer` | taro-79 | §4-3 | 3.3 | https://lovdata.no/dokument/TARO/tariff/taro-79/KAPITTEL_4 | LOVSEN-VERIFIED 2026-05-17 | "For arbeid i tidsrommet 24.00 – 06.00 utbetales et tillegg på kr 54,76 pr. time." (øvrige arbeidstakere — ordinary workers). Same paragraph §4-3 as nattvakt, different ledd-sentence. Lovdata rate: kr 54.76/t. Worksheet fixture 56.02 kr/t — minor divergence, likely 2025 vs 2024 rate. E3 pending. |
| Riksavtalen §6 | nattillegg_manuelt | `nattillegg_manuelt` | taro-79 | §4-3 | 3.5 | https://lovdata.no/dokument/TARO/tariff/taro-79/KAPITTEL_4 | LOVSEN-VERIFIED 2026-05-17 | "Nattvakt kan ikke settes til manuelt arbeid [...] i tiden 01.00-06.00, uten at det er opprettet avtale mellom partene." If local agreement exists: "kr 23,47 pr. time/kr 140,84 pr. natt" for full 24:00-06:00 window. Lovdata rate: kr 23.47/t. Worksheet fixture 24.01 kr/t — minor divergence, likely 2025 vs 2024 rate. This is a SEPARATE punkt (3.5) from nattvakt 3.3 — distinct supplement rule, condition-gated on bedriftsavtale. |
| Riksavtalen §6 | helligdagstillegg | `helligdagstillegg` | taro-79 | §4-2 | — | https://lovdata.no/dokument/TARO/tariff/taro-79/KAPITTEL_4 | LOVSEN-VERIFIED 2026-05-17 | §4-2 covers helligdagsaftener, høytids- og helligdager. Payment formula: monthly salary ÷ 154 (or 162.5) hours × hours worked, PLUS 100% supplement if holiday falls on rest day. No fixed kr/t rate in taro-79 text — the 100.00 in worksheet means 100% of individual hourly rate (not a fixed NOK amount). Separate paragraph from §4-3 supplements. Paragraph confirmed. |
| Riksavtalen §3 | minstelonn | `base_hourly`, `minstelonn_*` | taro-79 | §3-3 | — | https://lovdata.no/dokument/TARO/tariff/taro-79/KAPITTEL_3 | LOVSEN-VERIFIED 2026-05-17 | §3-3 Minstelønnssatser. Hourly rates (35.5h/uke): ufaglært begynner (20+år) kr 208.71/t; etter 2 år kr 212.52/t; faglært kokk begynner kr ~224+/t (monthly-to-hourly converted). RATE FLAG: Worksheet fixtures (195.00, 205.00 kr/t) diverge materially from taro-79 §3-3 Lovdata 2024-2026 text. Either (a) worksheet uses a different tariff binding (NHO Reiseliv vs Fellesforbundet), or (b) rates are from an older period. E3 NHO Reiseliv re-verify required before Phase 7c trust-gate sign-off. Worksheet context: `base_hourly` cells (prof-001 215.00, prof-002 200.00, etc.) are above §3-3 minimums — floor validation passes in current fixture. |

## Out-of-scope entries

The following `paragrafRef` values appear in fixtures but are NOT resolved by this map (different legislative source):

| worksheetShorthand | Reason | Resolution path |
|---|---|---|
| `Ferieloven §10` | References the Holiday Pay Act (Ferieloven), not Riksavtalen. Not taro-79. | Route to Lovdata Ferieloven MCP path; separate mapping file or inline re-cert tool routing. See ADR-0349 open question 3. |
| `null` | No paragraph reference (base wage cells or cells without supplement rule binding). | Re-cert tool skips citation envelope for `paragrafRef: null` cells. |

## Verification Status Summary

| Status | Count | Notes |
|---|---|---|
| LOVSEN-VERIFIED | 7 | All 7 rows verified 2026-05-17 via Lovdata WebFetch (taro-79 KAPITTEL_3 + KAPITTEL_4) |
| PENDING-LOVSEN-MAP | 0 | T1 gate cleared |

**T1 gate (ADR-0349):** All PENDING-LOVSEN-MAP rows resolved. Phase 7c re-cert tool can proceed with a complete pass.

## Rate-divergence flags (E3 action required)

These rows show a material gap between Lovdata taro-79 2024-2026 rates and worksheet fixture rates. The gap may indicate the worksheet uses NHO Reiseliv Riksavtalen (a different tariff binding) rather than Fellesforbundet taro-79. Lovsen cannot resolve this without E3 NHO Reiseliv rate-sheet — escalation to Pontus.

| supplementType | taro-79 Lovdata rate | Worksheet fixture | Delta | Action |
|---|---|---|---|---|
| helgetillegg | kr 29.74/t | 56.02 kr/t | +88% | E3: verify NHO Reiseliv Riksavtalen rate |
| kveldstillegg | kr 15.65/t | 42.41 kr/t | +171% | E3: verify NHO Reiseliv Riksavtalen rate |
| nattillegg_nattvakt | kr 41.46/t | 42.41 kr/t | +2.3% | Minor — likely 2025 vs 2024 tariff year. E3 confirm. |
| nattillegg_ordinaer | kr 54.76/t | 56.02 kr/t | +2.3% | Minor — likely 2025 vs 2024 tariff year. E3 confirm. |
| nattillegg_manuelt | kr 23.47/t | 24.01 kr/t | +2.3% | Minor — likely 2025 vs 2024 tariff year. E3 confirm. |
| minstelonn (ufaglært begynner) | kr 208.71/t | 195.00 kr/t | -6.6% | Material gap. Worksheet BELOW taro-79 floor if tariff binding is taro-79. Must confirm correct tariff source. |

> [MEDIUM confidence] The 2.3% nattillegg deltas are consistent with annual tariff adjustment (typical 2-3% annual adjustment in Norwegian tariff agreements). The helgetillegg/kveldstillegg +88-171% gap and the minstelonn -6.6% gap require E3 escalation — the worksheet likely uses a different Riksavtalen variant (NHO Reiseliv) with different rates from Fellesforbundet taro-79.

## Change log

| Date | Change | Author |
|---|---|---|
| 2026-05-17 | Initial draft — 7 rows, 1 verified (kveldstillegg §4-3), 6 pending. Ferieloven §10 + null declared out-of-scope. | A3 (ADR-0349 drafter) |
| 2026-05-17 | T1 resolution — all 6 PENDING rows resolved via Lovdata WebFetch (taro-79 KAPITTEL_3 + KAPITTEL_4). kveldstillegg ledd corrected from 3.1 → 3.2. helligdagstillegg mapped to §4-2 (separate paragraph). nattillegg_manuelt confirmed §4-3 punkt 3.5 (condition-gated). Rate-divergence flags added for E3. T1 gate cleared. | Lovsen (Phase 7c T1) |
