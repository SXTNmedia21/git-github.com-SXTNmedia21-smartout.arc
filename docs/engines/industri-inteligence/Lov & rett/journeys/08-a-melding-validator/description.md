# Beskrivelse — A-melding validator

## Use case

Pontus kjører månedlig payroll. Etter alle lønnsslipper er klar, kaller han "Generer A-melding". Lovsen validerer:

```
Pre-submit validation: A-melding 2026-11
Workspace: Bistro Tre (912345678)
8 ansatte rapportert

Errors: 0
Warnings: 1
  - Anna: timelønn 195 kr/t er under Riksavtalen min (198.50). Verifiser compliance_overrides.

Lønnskode-summary:
  10 (fastlønn): 4 personer, 128 000 brutto
  11 (timelønn): 4 personer, 96 240 brutto
  20 (overtid): 2 personer, 4 800
  22 (tips): 8 personer, 47 200
  23 (sluttvederlag): 0
  
Skattetrekk-sum: 73 200
AGA-grunnlag: 276 240
OTP-grunnlag: 224 240

Klar for innsending til altinn.
```

## Hvorfor Lovsen er bra på dette

1. **STYRK-08 kode-validering** — 7-sifret stillingskode er obligatorisk. Lovsen sjekker mot K-koder-tabell.
2. **Sluttkode korrekthet** — feil sluttkode (oppsigelse vs avslutning vs annet) påvirker dagpenger-rett. Lovsen velger riktig kode basert på `contract.end_reason`.
3. **MOD11-validering** — fødselsnr 11 siffer med gyldig kontrollsiffer. Fanger taste-feil.
4. **Compliance-cross-check** — flagger lønn under tariff (sammenligner mot `tariff_rate_table`) som warning, ikke hard-fail (override mulig).
5. **Sum-matching** — brutto = sum lønnskoder. Avvik flagges (typisk pga avrunding eller manglende post).

## Phase 0c+ kobling

- Tier 3 skill `a-melding-validator` (ROADMAP)
- Direct integration med altinn-API (krever sertifisering)
- Auto-correction-suggestions ved fail
