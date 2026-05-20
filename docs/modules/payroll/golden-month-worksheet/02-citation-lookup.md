---
title: "Golden-Month Citation Lookup — Lovsen Certification Table"
status: draft
updated: 2026-05-16
created: 2026-05-16
module: payroll
tags: [payroll, golden-month, worksheet, lovsen, citation, paragraf]
---

# 02 — Citation Lookup

**Purpose:** Every `paragrafRef` appearing in File 01 is listed here with rate details. Lovsen's job: fetch each § via MCP `fetch_paragraph`, fill `lovsenCitationHash` + `lovsenCitationText` + `lovsenCitationUrl` + `fetchedAt`.

**Authority separation (ADR-0341 §Authority separation):**
- This table is NOT used by Lovsen to generate amounts — only to certify the paragraph.
- Amounts are computed by Pontus from File 01 formulas.
- Lovsen fills: `lovsenCitationHash` (SHA-256 of verbatim text), `lovsenCitationText` (verbatim), `lovsenCitationUrl`, `fetchedAt`.

**Source routing:**
- `nho-reiseliv` → Riksavtalen for Hotell- og restaurantbransjen
- `lovdata` → Arbeidsmiljøloven (Aml.), Ferieloven

---

## Citation Table

### §1 — Riksavtalen §3 (Minstelønn)

| Field | Value |
|---|---|
| paragrafRef | Riksavtalen §3 |
| source_mcp | nho-reiseliv |
| description | Minstelønn per time for voksen ufaglært arbeidstaker (tariff_category=voksen_ufaglart) |
| tier_begynner_rate | 195.00 NOK/t (trt-min-001, law_version=2025, effective_from=2025-04-01) |
| tier_2_aar_rate | 205.00 NOK/t (trt-min-002, law_version=2025, effective_from=2025-04-01) |
| unit | kr/t |
| effective_from | 2025-04-01 |
| law_version | 2025 |
| note | Only 2 tiers seeded in fixture. tiers 4_aar+ have no fixture row → W13 skips those profiles |
| lovsenCitationHash | _____ (Lovsen fills) |
| lovsenCitationText | _____ (Lovsen fills — verbatim paragraph text) |
| lovsenCitationUrl | _____ (Lovsen fills) |
| fetchedAt | _____ (Lovsen fills) |
| verifiedBy | lovsen-mcp@v1 |
| verifiedAt | _____ (Lovsen fills) |

**Appears in cells:** 1, 51 (used for W13 minstelonn check; base rate reference for prof-004/prof-001 seniority)

---

### §2 — Riksavtalen §6 (Kveldstillegg)

| Field | Value |
|---|---|
| paragrafRef | Riksavtalen §6 |
| sub_rule | kveldstillegg (21:00–23:59, alle ukedager) |
| source_mcp | nho-reiseliv |
| description | Kveldstillegg for arbeid mellom kl. 21.00 og 23.59 |
| rate | 42.41 NOK/t |
| unit | kr/t |
| tariffRateTableId | trt-supp-001 |
| supplementRuleId | rule-kveldstillegg-001 (NB: double-i typo in fixture) |
| effective_from | 2025-04-01 |
| law_version | 2025 |
| lovsenCitationHash | _____ |
| lovsenCitationText | _____ |
| lovsenCitationUrl | _____ |
| fetchedAt | _____ |
| verifiedBy | lovsen-mcp@v1 |
| verifiedAt | _____ |

**Appears in cells:** 4, 17, 21, 28, 34, 64, 68, 78, 106, 116, 121, 127, 148

---

### §3 — Riksavtalen §6 (Nattillegg — Nattvakt)

| Field | Value |
|---|---|
| paragrafRef | Riksavtalen §6 |
| sub_rule | nattillegg_nattvakt (00:00–06:00, night_worker_category=night_watch) |
| source_mcp | nho-reiseliv |
| description | Nattillegg for nattvakter mellom kl. 00.00 og 06.00 |
| rate | 42.41 NOK/t |
| unit | kr/t |
| tariffRateTableId | trt-supp-002 |
| supplementRuleId | rule-natt-nattvakt-001 |
| effective_from | 2025-04-01 |
| law_version | 2025 |
| applies_to | Only employees with night_worker_category=night_watch (prof-003) |
| lovsenCitationHash | _____ |
| lovsenCitationText | _____ |
| lovsenCitationUrl | _____ |
| fetchedAt | _____ |
| verifiedBy | lovsen-mcp@v1 |
| verifiedAt | _____ |

**Appears in cells:** 36, 40, 42, 44, 46

---

### §4 — Riksavtalen §6 (Nattillegg — Manuelt)

| Field | Value |
|---|---|
| paragrafRef | Riksavtalen §6 |
| sub_rule | nattillegg_manuelt (00:00–06:00, night_worker_category=manual) |
| source_mcp | nho-reiseliv |
| description | Nattillegg for manuelt nattarbeid mellom kl. 00.00 og 06.00 |
| rate | 24.01 NOK/t |
| unit | kr/t |
| tariffRateTableId | trt-supp-003 |
| supplementRuleId | rule-natt-manuelt-001 |
| effective_from | 2025-04-01 |
| law_version | 2025 |
| applies_to | Only employees with night_worker_category=manual (prof-009) |
| lovsenCitationHash | _____ |
| lovsenCitationText | _____ |
| lovsenCitationUrl | _____ |
| fetchedAt | _____ |
| verifiedBy | lovsen-mcp@v1 |
| verifiedAt | _____ |

**Appears in cells:** 108

---

### §5 — Riksavtalen §6 (Nattillegg — Ordinær)

| Field | Value |
|---|---|
| paragrafRef | Riksavtalen §6 |
| sub_rule | nattillegg_ordinaer (00:00–06:00, night_worker_category=ordinary) |
| source_mcp | nho-reiseliv |
| description | Nattillegg for ordinært nattarbeid mellom kl. 00.00 og 06.00 |
| rate | 56.02 NOK/t |
| unit | kr/t |
| tariffRateTableId | trt-supp-004 |
| supplementRuleId | rule-natt-ordinaer-001 |
| effective_from | 2025-04-01 |
| law_version | 2025 |
| applies_to | Only employees with night_worker_category=ordinary (prof-010) |
| lovsenCitationHash | _____ |
| lovsenCitationText | _____ |
| lovsenCitationUrl | _____ |
| fetchedAt | _____ |
| verifiedBy | lovsen-mcp@v1 |
| verifiedAt | _____ |

**Appears in cells:** 118, 123

---

### §6 — Riksavtalen §6 (Helgetillegg)

| Field | Value |
|---|---|
| paragrafRef | Riksavtalen §6 |
| sub_rule | helgetillegg (lørdag og søndag, weekdays=[6,7], alle timer) |
| source_mcp | nho-reiseliv |
| description | Helgetillegg for arbeid på lørdag og søndag |
| rate | 56.02 NOK/t |
| unit | kr/t |
| tariffRateTableId | trt-supp-005 |
| supplementRuleId | rule-helgetillegg-001 |
| supplement_type | week_based (stacks with normal-type supplements) |
| effective_from | 2025-04-01 |
| law_version | 2025 |
| lovsenCitationHash | _____ |
| lovsenCitationText | _____ |
| lovsenCitationUrl | _____ |
| fetchedAt | _____ |
| verifiedBy | lovsen-mcp@v1 |
| verifiedAt | _____ |

**Appears in cells:** 6, 9, 11, 23, 25, 27, 35, 37, 52, 54, 56, 58, 63, 67, 77, 80, 88, 90, 97, 99, 107, 109, 117, 119, 122, 124, 126, 132, 134, 136, 142, 145, 147, 150, 152, 154

---

### §7 — Riksavtalen §6 (Helligdagstillegg)

| Field | Value |
|---|---|
| paragrafRef | Riksavtalen §6 |
| sub_rule | helligdagstillegg (offentlige helligdager, ingen tidsvindu-begrensning) |
| source_mcp | nho-reiseliv |
| description | Helligdagstillegg for arbeid på offentlige helligdager |
| rate | 100.00 NOK/t |
| unit | kr/t |
| tariffRateTableId | trt-supp-006 |
| supplementRuleId | rule-helligdag-001 |
| supplement_type | holiday (stacks with normal- and week_based-type supplements) |
| effective_from | 2025-04-01 |
| law_version | 2025 |
| note | Fires on ALL minutes classified as 'holiday' by classify-minute. Bucket gets holiday classification based on public_holiday date match. No time-window restriction in predicate (windows=[]). |
| lovsenCitationHash | _____ |
| lovsenCitationText | _____ |
| lovsenCitationUrl | _____ |
| fetchedAt | _____ |
| verifiedBy | lovsen-mcp@v1 |
| verifiedAt | _____ |

**Appears in cells:** 38

---

### §8 — Ferieloven §10 (Feriepenger)

| Field | Value |
|---|---|
| paragrafRef | Ferieloven §10 |
| source_mcp | lovdata |
| description | Feriepenger = feriepengegrunnlag × feriesats. Grunnlag = brutto lønn utbetalt av arbeidsgiver forrige opptjeningsår. Satser: 10.2% (standard), 12.0% (Riksavtalen tariff-bundet standard), 12.5% (Riksavtalen §5 + ekstra ferieuke for ansatte 60+/med fagbrev, avhengig av avtale). |
| rate_standard | 12.0% (profiles with holiday_allowance_pct=12.0) |
| rate_fagbrev | 12.5% (prof-006, has_fagbrev=true) |
| base | gross_amount_ore (brutto skiftlønn, ekskl. tips og manuell tillegg) |
| period_accrual | Per lønnsperiode — en rad per profil per periode |
| lovsenCitationHash | _____ |
| lovsenCitationText | _____ |
| lovsenCitationUrl | _____ |
| fetchedAt | _____ |
| verifiedBy | lovsen-mcp@v1 |
| verifiedAt | _____ |

**Appears in cells:** 15, 32, 49, 61, 75, 86, 95, 104, 114, 130, 139, 158

---

### §9 — Aml. §10-8 (Hviletid — W01)

| Field | Value |
|---|---|
| paragrafRef | Aml. §10-8 |
| source_mcp | lovdata |
| description | Arbeidstaker skal ha sammenhengende hviletid på minst 11 timer i løpet av 24 timer. |
| threshold | 11 timer mellom consecutive vakter |
| severity_in_engine | error (blocks period lock) |
| deviation_check | W01 |
| applies_to | All workers regardless of is_tariff_bound |
| lovsenCitationHash | _____ |
| lovsenCitationText | _____ |
| lovsenCitationUrl | _____ |
| fetchedAt | _____ |
| verifiedBy | lovsen-mcp@v1 |
| verifiedAt | _____ |

**Triggered by:** sh-009 (prof-002, 9h gap), sh-034 (prof-010, 10h gap)

---

### §10 — Aml. §10-4 (Daglig arbeidstid — W02)

| Field | Value |
|---|---|
| paragrafRef | Aml. §10-4 |
| source_mcp | lovdata |
| description | Alminnelig arbeidstid må ikke overstige 9 timer i løpet av 24 timer og 40 timer i løpet av 7 dager. |
| threshold | 9 timer per dag (540 min worked) |
| severity_in_engine | warning |
| deviation_check | W02 |
| applies_to | All workers |
| lovsenCitationHash | _____ |
| lovsenCitationText | _____ |
| lovsenCitationUrl | _____ |
| fetchedAt | _____ |
| verifiedBy | lovsen-mcp@v1 |
| verifiedAt | _____ |

**Triggered by:** sh-003 (600 min), sh-004 (720 min), sh-010 (690 min), sh-024 (690 min), sh-026 (660 min)

---

### §11 — Aml. §10-12 (Overtime banking / TOIL)

| Field | Value |
|---|---|
| paragrafRef | Aml. §10-12 |
| source_mcp | lovdata |
| description | Arbeidsgiver og arbeidstaker kan skriftlig avtale at overtid helt eller delvis kan avspaseres (tas ut som fritid). Avtale skal foreligge skriftlig. |
| applies_to | prof-003 (toil_agreement_signed_at=2026-01-10), prof-011 (toil_agreement_signed_at=2026-02-01) |
| result_in_period | 0 TOIL hours banked for both (all shifts ≤ 7.5h worked) |
| lovsenCitationHash | _____ |
| lovsenCitationText | _____ |
| lovsenCitationUrl | _____ |
| fetchedAt | _____ |
| verifiedBy | lovsen-mcp@v1 |
| verifiedAt | _____ |

**Appears in cells:** 50, 140 (both 0 TOIL)

---

## UUID Resolution Required

The following IDs in the fixture are **test-scope IDs only** (not real DB UUIDs). Before F6, Pontus + Lovsen must resolve these against the actual `supplement_rule` and `tariff_rate_table` seed in Supabase Local:

| fixture_id | type | note |
|---|---|---|
| rule-kveldstillegg-001 | supplement_rule.id | Double-i typo — verify exact id in seed |
| rule-natt-nattvakt-001 | supplement_rule.id | — |
| rule-natt-manuelt-001 | supplement_rule.id | — |
| rule-natt-ordinaer-001 | supplement_rule.id | — |
| rule-helgetillegg-001 | supplement_rule.id | — |
| rule-helligdag-001 | supplement_rule.id | — |
| trt-supp-001 | tariff_rate_table.id | kveldstillegg 42.41 |
| trt-supp-002 | tariff_rate_table.id | natt_nattvakt 42.41 |
| trt-supp-003 | tariff_rate_table.id | natt_manuelt 24.01 |
| trt-supp-004 | tariff_rate_table.id | natt_ordinaer 56.02 |
| trt-supp-005 | tariff_rate_table.id | helgetillegg 56.02 |
| trt-supp-006 | tariff_rate_table.id | helligdag 100.00 |
| trt-min-001 | tariff_rate_table.id | minstelonn_begynner 195.00 |
| trt-min-002 | tariff_rate_table.id | minstelonn_2_aar 205.00 |

These rows are **not in the current Supabase migrations**. They exist only in `__tests__/golden-month/input/tariff.json` and `rules.json`. Before F6, either:
1. Add a migration/seed that inserts these rows with stable UUIDs, OR
2. Mark all affected cells as `<seed-uuid-placeholder>` and resolve at seed time.

**This is the primary unresolved blocker before F6.**

---

## Summary of Unique paragrafRefs

| # | paragrafRef | source | cells affected |
|---|---|---|---|
| 1 | Riksavtalen §3 | nho-reiseliv | 2 cells (minstelonn reference) |
| 2 | Riksavtalen §6 (kveldstillegg) | nho-reiseliv | 13 cells |
| 3 | Riksavtalen §6 (nattillegg nattvakt) | nho-reiseliv | 5 cells |
| 4 | Riksavtalen §6 (nattillegg manuelt) | nho-reiseliv | 1 cell |
| 5 | Riksavtalen §6 (nattillegg ordinær) | nho-reiseliv | 2 cells |
| 6 | Riksavtalen §6 (helgetillegg) | nho-reiseliv | 36 cells |
| 7 | Riksavtalen §6 (helligdagstillegg) | nho-reiseliv | 1 cell |
| 8 | Ferieloven §10 | lovdata | 12 cells |
| 9 | Aml. §10-8 | lovdata | W01 deviation (not a pay cell, but citation needed) |
| 10 | Aml. §10-4 | lovdata | W02 deviation (not a pay cell) |
| 11 | Aml. §10-12 | lovdata | 2 cells (0-value TOIL) |

**Total unique paragrafRefs: 11** (8 are §-level unique; Riksavtalen §6 appears as 6 sub-rules)
**Total Lovsen fetch calls needed: 11** (one per row above)
