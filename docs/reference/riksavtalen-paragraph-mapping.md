---
title: "Riksavtalen paragraph translation map — Smartout shorthand ↔ Lovdata canonical"
status: draft
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
| Riksavtalen §6 | kveldstillegg | `kveldstillegg` | taro-79 | §4-3 | 1 | https://lovdata.no/dokument/TARO/taro-79#PARAGRAPH_4-3 | LOVSEN-VERIFIED 2026-05-17 | Evening supplement 18:00–24:00 per Fellesforbundet. Pontus uses 42.41 kr/t rate (2025 fixture; E3 pending). |
| Riksavtalen §6 | helgetillegg | `helgetillegg` | taro-79 | §4-X | TBD | PENDING | PENDING-LOVSEN-MAP | Weekend supplement (lørdag/søndag). Lovsen must confirm sub-paragraph number. |
| Riksavtalen §6 | nattillegg_nattvakt | `nattillegg`, `nattvakt` | taro-79 | §4-X | TBD | PENDING | PENDING-LOVSEN-MAP | Night shift supplement — nattvakt variant (42.41 kr/t fixture). |
| Riksavtalen §6 | nattillegg_ordinaer | `nattillegg_ordinaer` | taro-79 | §4-X | TBD | PENDING | PENDING-LOVSEN-MAP | Night supplement — ordinær nattillegg (56.02 kr/t fixture). Distinct rate from nattvakt; may be same paragraph different ledd. |
| Riksavtalen §6 | nattillegg_manuelt | `nattillegg_manuelt` | taro-79 | §4-X | TBD | PENDING | PENDING-LOVSEN-MAP | Night supplement — manuelt variant (24.01 kr/t fixture). Lovsen must confirm whether this is a separate ledd or a separate supplement rule under same paragraph. |
| Riksavtalen §6 | helligdagstillegg | `helligdagstillegg` | taro-79 | §4-X | TBD | PENDING | PENDING-LOVSEN-MAP | Public holiday supplement (100.00 kr/t fixture). |
| Riksavtalen §3 | minstelonn | `base_hourly`, `minstelonn_*` | taro-79 | §3-X | TBD | PENDING | PENDING-LOVSEN-MAP | Minimum wage rates (voksen ufaglært begynner 195.00 kr/t, 2+ år 205.00 kr/t, faglært ~205+ kr/t). Worksheet context audit required — see ADR-0349 open question 2. |

## Out-of-scope entries

The following `paragrafRef` values appear in fixtures but are NOT resolved by this map (different legislative source):

| worksheetShorthand | Reason | Resolution path |
|---|---|---|
| `Ferieloven §10` | References the Holiday Pay Act (Ferieloven), not Riksavtalen. Not taro-79. | Route to Lovdata Ferieloven MCP path; separate mapping file or inline re-cert tool routing. See ADR-0349 open question 3. |
| `null` | No paragraph reference (base wage cells or cells without supplement rule binding). | Re-cert tool skips citation envelope for `paragrafRef: null` cells. |

## Verification Status Summary

| Status | Count | Notes |
|---|---|---|
| LOVSEN-VERIFIED | 1 | kveldstillegg §4-3 verified 2026-05-17 |
| PENDING-LOVSEN-MAP | 6 | helgetillegg, 3× nattillegg variants, helligdagstillegg, §3 minstelønn |

**T1 gate (ADR-0349):** All PENDING-LOVSEN-MAP rows must be verified by Lovsen against Lovdata taro-79 before Phase 7c re-cert tool can run a complete pass. T1 output is committed directly to this file by Lovsen.

## Change log

| Date | Change | Author |
|---|---|---|
| 2026-05-17 | Initial draft — 7 rows, 1 verified (kveldstillegg §4-3), 6 pending. Ferieloven §10 + null declared out-of-scope. | A3 (ADR-0349 drafter) |
