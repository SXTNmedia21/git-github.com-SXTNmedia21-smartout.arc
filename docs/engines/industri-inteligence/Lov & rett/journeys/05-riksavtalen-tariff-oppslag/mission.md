---
journey: 05
title: "Riksavtalen tariff-oppslag"
trigger: "Admin spør om tariff-sats, eller send-route henter min-lønn for §14-6 i sjekk"
mode: read-only lookup
adr: 0234, 0249
---

# Mission — Riksavtalen tariff-oppslag

**Mål:** Hent gjeldende tariff-sats fra Riksavtalen (LO–NHO Reiseliv) for hospitality-stilling.

**Hvorfor:** Tariff-bundet workspace MÅ holde sats over min. Manuell lookup er feilkilde. Versjonering glemmes.

**Trigger:** Lønnsoppgjør, ny ansettelse-kontrakt setup, compliance-sjekk.

**Output:**
- Min-sats per stilling (servitør, kokk, bartender, sjef, etc.)
- Helgetillegg, kveldstillegg, natt-tillegg
- Gyldig fra-dato + neste revisjons-dato
- Confidence: HØY (live fra NHO Reiseliv MCP)
