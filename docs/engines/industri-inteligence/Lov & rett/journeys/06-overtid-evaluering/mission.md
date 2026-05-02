---
journey: 06
title: "Overtid-evaluering"
trigger: "Shift-cost beregning, schedule-validation, eller admin spør 'er dette overtid?'"
mode: read-only evaluation
adr: 0234, 0249
---

# Mission — Overtid-evaluering

**Mål:** Avgjøre om en shift kvalifiserer som overtid iht. Aml. §10-6, beregne korrekt sats (40% / 50% / 100%).

**Hvorfor:** Overtid uten korrekt sats = lønnskrav + brudd på Aml. Manuell beregning er feilkilde.

**Trigger:** Shift over `agreed_weekly_hours`, dag over §10-4-grense, eller helligdag-arbeid.

**Output:**
- `is_overtime: bool`
- `overtime_hours: number`
- `overtime_rate: 40 | 50 | 100` (prosent over base)
- `base_rate` + `overtime_total`
- Lov-referanse per beregning
