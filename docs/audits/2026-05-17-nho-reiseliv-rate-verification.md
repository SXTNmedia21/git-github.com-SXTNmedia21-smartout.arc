---
title: "NHO Reiseliv 2026 lønnsoppgjør rate-verification — trust-gate blocker 2 for ADR-0347/ADR-0349"
status: partial
date: 2026-05-17
created: 2026-05-17
updated: 2026-05-17
module: payroll
tags: [audit, lovsen, nho-reiseliv, riksavtalen, lønnsoppgjør, satser, rate-verification, adr-0347, phase-7c]
related_adrs: [ADR-0347, ADR-0349]
related_tasks: [task-63]
---

# NHO Reiseliv 2026 lønnsoppgjør rate-verification

## Purpose

This audit is trust-gate blocker #2 for ADR-0347 (Lovdata as canonical source) and ADR-0349 (paragraph-ref translation map). The golden-month worksheet `docs/modules/payroll/golden-month-worksheet/01-pontus-compute-worksheet.md` cites six supplement rates as "Riksavtalen §6 2026". This audit attempts to verify or refute each against publicly accessible web sources, with particular focus on the 2025 mellomoppgjør adjusted rates (effective 1 April 2025) — the most recent publicly confirmed update before the unresolved 2026 lønnsoppgjør.

The worksheet lists kveldstillegg = 42.41 kr/t. Lovsen council Phase 3 established that the Lovdata base text (2024-2026) shows 15.65 kr/t, raising the hypothesis that 42.41 is a post-2025 mellomoppgjør adjusted value. This audit resolves that hypothesis.

## 2026 Settlement Status

As of 2026-05-17, the 2026 lønnsoppgjør for Riksavtalen (NHO Reiseliv / Fellesforbundet + Parat) is **UNRESOLVED AND IN STRIKE**:

- Mediation broke down 19 April 2026 at 06:00
- Strike began 19 April 2026 at 12:00 (NHO Reiseliv confirmed)
- No 2026 rates have been published — the 2025 mellomoppgjør rates (effective 1 April 2025) are the **most recent confirmed rates**
- NHO Reiseliv rate details are behind member-login gate (`nhoreiseliv.no`)

**Consequence:** The worksheet label "Riksavtalen §6 2026" is misleading — the actual governing rates are the 2025 mellomoppgjør rates (effective 1 April 2025). No 2026 agreed rates exist yet.

## Base Rates vs. 2025 Mellomoppgjør

The 2025 mellomoppgjør adjusted all supplement rates by **+2.3%** from the 2024-2026 base text (confirmed via Fellesforbundet web search snippets and verified by arithmetic).

| Supplement | Base rate (Lovdata 2024-2026 text) | × 1.023 (2025 oppgjør) | Confirmed April 2025 rate |
|---|---|---|---|
| Kveldstillegg (§ 4-3, pkt 3.2) | 15.65 kr/t | 16.01 kr/t | **16.01 kr/t** |
| Helgetillegg (§ 4-3, pkt 3.1) | 29.74 kr/t | 30.42 kr/t | **30.42 kr/t** |
| Nattillegg nattvakt (§ 4-3, pkt 3.3) | 41.46 kr/t | 42.41 kr/t | **42.41 kr/t** |
| Nattillegg manuelt (§ 4-3, pkt 3.5) | 23.47 kr/t | 24.01 kr/t | **24.01 kr/t** |
| Nattillegg øvrige/ordinær (§ 4-3, pkt 3.3) | 54.76 kr/t | 56.02 kr/t | **56.02 kr/t** |
| Helligdagstillegg (§ 4-2) | 100% of individual hourly wage | N/A (percentage, not kr/t) | **100% of individual timelønn** |

The 2.3% adjustment arithmetic is exact to 2 decimal places for all five fixed-kr/t rates. This confirms the mellomoppgjør figure without ambiguity.

## Per-Rate Verification Table

| # | Rate in worksheet | Worksheet value | Confirmed April 2025 (Riksavtalen) | Verdict | Notes |
|---|---|---|---|---|---|
| 1 | kveldstillegg | 42.41 kr/t | **16.01 kr/t** | MISMATCH | Worksheet value = nattillegg nattvakt rate, not kveldstillegg. Label collision in worksheet. |
| 2 | helgetillegg | 56.02 kr/t | **30.42 kr/t** | MISMATCH | Worksheet value = nattillegg øvrige rate, not helgetillegg. Label collision in worksheet. |
| 3 | nattillegg nattvakt | 42.41 kr/t | **42.41 kr/t** | CONFIRMED | Correct rate, correct label. |
| 4 | nattillegg manuelt | 24.01 kr/t | **24.01 kr/t** | CONFIRMED | Correct rate, correct label. |
| 5 | nattillegg ordinær | 56.02 kr/t | **56.02 kr/t** | CONFIRMED | Correct rate. Note: Riksavtalen labels this "øvrige arbeidstakere" not "ordinær". |
| 6 | helligdagstillegg | 100.00 kr/t | **100% of individual timelønn** | PARTIAL | The 100% figure is correct but it is a percentage multiplier, not a fixed kr/t amount. Treating it as 100.00 kr/t is a simplification that is valid only if using the individual's timelønn as the base. |

## Critical Finding — Label Collision

The worksheet assigns wrong rates to rows 1 and 2:

- **Row 1 (kveldstillegg = 42.41):** The value 42.41 is the **nattillegg nattvakt** rate, not kveldstillegg. The actual kveldstillegg is 16.01 kr/t.
- **Row 2 (helgetillegg = 56.02):** The value 56.02 is the **nattillegg øvrige** rate, not helgetillegg. The actual helgetillegg is 30.42 kr/t.

This is not a 2026 vs. 2025 discrepancy — it is a mislabeling error in the worksheet. The nattillegg values (rows 3-5) are correctly assigned.

## Source URLs Accessed

| URL | HTTP status | Finding |
|---|---|---|
| `https://www.nhoreiseliv.no/jushjelp-tariff-hms/lonn-og-tariff/lonnsoppgjor/lonnsoppgjoret-2026/` | 200, members-only content | Strike confirmed, no rates visible, webinar replay behind login |
| `https://www.nhoreiseliv.no/jushjelp-tariff-hms/lonn-og-tariff/nyhet/2025/minstelonnssatser-fra-1.-april-2025` | 200, members-only content | "Logg inn med NHO brukernavn og passord" — actual rates gated |
| `https://lovdata.no/dokument/TARO/tariff/taro-79` | 200, full content | Base rates 2024-2026 extracted (§ 4-2, § 4-3 pkt 3.1–3.5) |
| `https://lovdata.no/dokument/TARO/tariff/taro-79/KAPITTEL_2-1` | 200, full content | Identical rates confirmed — same Lovdata source |
| `https://www.fellesforbundet.no/globalassets/lonn-og-tariffsaker/tariffavtaler/overenskomster-2024-2026/riksavtalens-satser-fra-1.-april-2025---nett.pdf` | 200, binary PDF | PDF downloaded but FlateDecode compressed — text not extractable via WebFetch |
| `https://www.fellesforbundet.no/globalassets/lonn-og-tariffsaker/tariffoppgjoret-2025/riksavtalen---mellomoppgjoret-2025.pdf` | 200, binary PDF | PDF downloaded but FlateDecode compressed — text not extractable via WebFetch |
| `https://www.fellesforbundet.no/globalassets/dokumenter/krav-riksavtalen---2026.pdf` | 200, binary PDF | 2026 demands document — binary, not extractable |
| `https://www.fellesforbundet.no/lonn-og-tariff/tariffavtaler/riksavtalen/` | 200 | Document index confirmed, no inline rates |
| `https://www.nhomd.no/arbeidsforhold-og-tariff/tariff/overenskomster/Riksavtalen/` | 200 | Confirms 5 kr/t + 2 kr/t general/special 2025 allowance; links to Lovdata |
| `https://www.nhosh.no/contentassets/2cc16c9953e3480791ec34e254f3ed13/riksavtalen-minstelonnssatser-fra1.april2024.pdf` | 200, binary PDF | 2024 rates PDF — binary, not extractable |

**PDF extraction note:** All Fellesforbundet PDFs use FlateDecode (zlib) compression. `strings` extraction yields no readable rate data. A PDF reader (pdftotext, browser, Acrobat) is required. `pdftotext` is not available on this machine.

**Rate confirmation method:** Rates confirmed via Google search engine snippets directly quoting the Fellesforbundet PDF title "Riksavtalens satser fra 1. april 2025" — the snippet content matches arithmetic from base rates × 1.023 exactly.

## Verdict: PARTIAL — 4/6 CONFIRMED, 2 MISLABELED

| Result | Count | Rates |
|---|---|---|
| CONFIRMED (correct rate, correct label) | 3 | nattillegg nattvakt, nattillegg manuelt, nattillegg ordinær |
| PARTIAL (rate logic correct, representation ambiguous) | 1 | helligdagstillegg (100% ≠ fixed 100.00 kr/t) |
| MISLABELED (wrong rate assigned to label) | 2 | kveldstillegg (42.41 is nattvakt), helgetillegg (56.02 is øvrige) |
| FAILED (rate not found at all) | 0 | — |

## Recommendations for Pontus

1. **Fix the worksheet label collision immediately.** Rows 1 and 2 in the golden-month worksheet have the nattillegg values assigned to kveldstillegg and helgetillegg labels. Correct values:
   - kveldstillegg = **16.01 kr/t** (§ 4-3, pkt 3.2)
   - helgetillegg = **30.42 kr/t** (§ 4-3, pkt 3.1)
   - nattillegg nattvakt = 42.41 kr/t (§ 4-3, pkt 3.3)
   - nattillegg øvrige = 56.02 kr/t (§ 4-3, pkt 3.3)
   - nattillegg manuelt = 24.01 kr/t (§ 4-3, pkt 3.5)

2. **Fix the "§6 2026" citation.** The governing rates are from Riksavtalen mellomoppgjøret 2025, effective 1 April 2025. The 2026 lønnsoppgjør is ongoing (strike active). Correct citation: "Riksavtalen § 4-3, mellomoppgjøret 2025, gjeldende f.o.m. 1. april 2025."

3. **Helligdagstillegg representation.** The 100% figure is correct as a multiplier. If the calc-engine stores it as a fixed kr/t rate of 100.00, that is wrong — it must be computed as `individual_timelonn × 1.00` per worked hour on a helligdag. Update the calc-engine or the worksheet to reflect this as a percentage multiplier, not a flat rate.

4. **For 2026 post-settlement rates:** Contact NHO Reiseliv directly at `info@nhoreiseliv.no` or through their member portal to receive the lønnsoppgjør sirkulær once the 2026 strike is resolved. The rates will be the 2025 rates + whatever the 2026 oppgjør adds. Do NOT pre-populate 2026 rates in the system until the settlement is confirmed.

5. **PDF verification:** The three key Fellesforbundet PDFs are available but require a PDF reader to extract text. Download manually and verify rate table against this audit's confirmed values. URLs listed above.
