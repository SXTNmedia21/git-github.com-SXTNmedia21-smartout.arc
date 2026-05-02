# Checklist — Overtid-evaluering

| # | Sjekk | Lov | Pass-krav |
|---|-------|-----|-----------|
| 1 | Daglig grense | Aml. §10-4 (1) | 9t/dag uten overtid (10t med skriftlig avtale) |
| 2 | Ukentlig grense | Aml. §10-4 (1) | 40t/uke uten overtid (40t/uke for skift) |
| 3 | Avtalt grense | `agreed_weekly_hours` på kontrakt | Timer ut over kontrakt-avtalt = overtid |
| 4 | Sats: 40% tillegg standard | Aml. §10-6 (10) | Vanlig overtid |
| 5 | Sats: 50% tillegg | Aml. §10-6 (10) + Riksavtalen | Helg eller etter 21:00 |
| 6 | Sats: 100% tillegg (dobbelt) | Riksavtalen § (varierer) | Helligdag eller hospitality-spesifikk |
| 7 | Maks overtid grenser | Aml. §10-6 (4) | 10t/uke, 25t/4 uker, 200t/år (uten avtale) |
| 8 | Tariff-bundet uke 38t | Riksavtalen | Hvis tariff-bundet → overtid starter på 38t/uke, ikke 40t |
| 9 | Pauser | Aml. §10-9 | Pauser ikke regnet inn (ulønnet hvis ikke tilgjengelig) |
| 10 | Overtidsarbeid frivillig | Aml. §10-6 (1) | Kan ikke pålegges uten "særlig og tidsavgrenset behov" |

## Beregnings-eksempler

**Standard 40t-uke + 5t overtid:**
```
Base: 40t × 200 kr = 8 000
Overtid: 5t × 200 × 1.40 = 1 400
Total: 9 400
```

**Helg-overtid (50%):**
```
Lørdag-shift over avtale: 4t × 200 × 1.50 = 1 200
Pluss helgetillegg fra Riksavtalen (hvis bundet)
```

**Helligdag (100%):**
```
17. mai 8t: 8 × 200 × 2.00 = 3 200
Pluss helligdag-tillegg fra Riksavtalen
```

## Tariff-bundet workspaces

Riksavtalen har **38t/uke** som standard-grense (ikke 40t). Lovsen sjekker `workspace_framework_binding` + bruker 38t hvis bundet.
