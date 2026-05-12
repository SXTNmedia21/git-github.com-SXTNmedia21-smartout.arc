# Beskrivelse — Riksavtalen tariff-oppslag

## Use case

Pontus skal ansette ny bartender. Han spør Lovsen: "Hva er gjeldende min-sats for bartender etter Riksavtalen?"

Lovsen henter live:
> Riksavtalen 2026-04 setter min-timelønn for bartender til 215.00 kr/time.
>
> **Tillegg:**
> - Lørdag: +52.00
> - Søndag: +69.00
> - Kveld 18-21: +25.00
> - Natt 21-06: +60.00
> - Helligdag: +110.00
>
> [HØY confidence — hentet fra NHO Reiseliv 2026-04-01]
>
> Neste revisjon: 2027-04-01.

## Use case 2 — gate i §14-6 i

Send-route kaller `validateAml146` som internt kaller `riksavtalen-lookup` for stilling for å sjekke kontrakt-sats:

```
contract.hourly_rate = 200
riksavtalen.min(servitør, 2026-04) = 198.50
sjekk: 200 ≥ 198.50 ✅ pass
```

Eller fail:
```
contract.hourly_rate = 195
riksavtalen.min(servitør, 2026-04) = 198.50
fail § 14-6 i + soft-warning "compliance_overrides[]" eller blokk
```

## Hvorfor Lovsen er bra på dette

1. **Versjonering automatisk** — sjekker `valid_from` mot send-tidspunkt eller `framework_snapshot`
2. **Helgetillegg/natt-tillegg dekket** — admins glemmer ofte tillegg i shift-cost-kalkulasjon
3. **Workspace-overrides respektert** — hvis workspace har avtalt over-tariff, brukes den

## Phase 0c+ kobling

- MCP-server `nho-reiseliv` med `fetch_riksavtalen(version)` + `lookup_tariff_supplement(category)`
- Cached snapshot i `Lov-og-rett/riksavtalen/2026-04.json`
- Auto-refresh ved revisjon-dato passering
