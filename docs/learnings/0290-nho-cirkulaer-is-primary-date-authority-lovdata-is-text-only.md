---
title: "L-0290 — NHO cirkulær official_effective_date = legal date authority; Lovdata = verbatim-text authority"
id: L_0290
status: active
date: 2026-05-17
layer: learning
created: 2026-05-17
updated: 2026-05-17
tags: [lovsen, riksavtalen, nho-reiseliv, lovdata, tariff, date-authority, lonnsoppgjor, phase-7d]
related_adrs: [ADR-0347, ADR-0352, ADR-0353]
related_learnings: [L-0288, L-0286]
---

# L-0290 — NHO cirkulær `official_effective_date` = legal date authority; Lovdata = verbatim-text authority

## What happened

Lovsen council Phase 3 (dynamic-MCP-fetch pivot, 2026-05-17): The steward's initial Phase 1 framing treated NHO Reiseliv cirkulær and Lovdata as co-equal date authorities. Lovsen Phase 3 review established the correct hierarchy:

- **NHO Reiseliv lønnsoppgjør cirkulær** carries an explicit `virkningsdato` field (e.g., "Gjeldende fra 01.04.2026"). This is the legally binding effective date for new Riksavtalen rates. The cirkulær is published by NHO Reiseliv to employers immediately after lønnsoppgjøret is concluded — before Lovdata mirrors the updated text.
- **Lovdata** mirrors the verbatim Riksavtalen text weeks to months after the cirkulær is published. Using Lovdata's publication/update date as the legal binding date means the system believes the old rate is still in force during the lag period — producing wrong-year or wrong-period rate calculations.

Steward self-reversal in Phase 5: source-priority is NOT co-equal. NHO cirkulær is PRIMARY; Lovdata is SECONDARY.

## Rule

Tariff snapshot operations MUST treat the NHO Reiseliv lønnsoppgjør cirkulær `official_effective_date` as the PRIMARY date authority — the date from which new rates are legally binding. Lovdata is the SECONDARY verbatim-text authority — used for paragraph text, citation envelope, and structural hash (per ADR-0348), but NOT as the date from which rates become legally operative.

Both fields are stored in the tariff snapshot envelope (per ADR-0353). Neither is optional.

## ADR resolution

- **ADR-0352** (`derive_supplement_set`): MCP contract stores `official_effective_date` from NHO cirkulær as `binding_date` in the snapshot envelope.
- **ADR-0353** (`workspace_framework_binding`): Binding lifecycle events reference `official_effective_date` from NHO cirkulær, not Lovdata update timestamp.

## Why this matters

A workspace running a payroll period starting 01.04.2026 must use the rate effective 01.04.2026 (from NHO cirkulær virkningsdato). If the system reads Lovdata's update date (e.g., 15.05.2026), it believes the pre-lønnsoppgjør rate applies until mid-May — a legally material error. Underpaying employees by the pre-lønnsoppgjør rate for 6 weeks is a §14-15 violation.
