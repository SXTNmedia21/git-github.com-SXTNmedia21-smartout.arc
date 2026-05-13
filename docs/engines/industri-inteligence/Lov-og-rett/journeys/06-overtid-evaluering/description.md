# Beskrivelse — Overtid-evaluering

## Use case

Anna jobbet 9.5 timer på en fredag (avtalt 8t skift). Lovsen evaluerer:
> Overtid: 1.5 timer.
> - 0.5t mellom 9-9.5 = innenfor §10-4 daglig grense (med avtale 10t)
> - 1.5t over avtalt 8t skift = overtid uansett
> - Sats: 40% tillegg (vanlig overtid)
> - Beregning: 1.5 × 200 × 1.40 = 420 kr ekstra
> - Lov-ref: Aml. §10-6 (10)

## Use case 2 — helg-overtid

Servitør jobbet lørdag 22:00–02:00 (4t natt på helg).
> Overtid + helg + natt = 50% tillegg + helgetillegg + natt-tillegg
> Per time: 200 × 1.50 + Riksavtalen helg 47.00 + Riksavtalen natt 56.00 = 403 kr/t
> Total 4t = 1 612 kr

## Use case 3 — Tariff-bundet workspace 38t/uke

Workspace bundet til Riksavtalen, ansatt har 40t kontrakt:
> Overtid starter på 38t/uke iht. Riksavtalen, ikke 40t som Aml. minimum
> Forskjell på 2t/uke = potensielt 8t/mnd ekstra overtidskompensasjon

## Hvorfor Lovsen er bra på dette

1. **Aml. + Riksavtalen kombinert** — bestemmelsene overlapper men har ulike grenser. Lovsen velger gjeldende.
2. **Helligdag-deteksjon** — sjekker `public_holiday`-tabell for dato → 100% rate
3. **Maks-overtid varsling** — flagger når ansatt nærmer seg §10-6 (4) grenser (10t/uke, 200t/år)
4. **Frivillig vs pålagt** — Aml. krever "særlig og tidsavgrenset behov" for å pålegge — Lovsen kan flag systematic overtime som compliance-risk

## Phase 0c+ kobling

- Tier 3 skill `overtid-evaluator` (ROADMAP)
- Integrasjon mot `schedule_shift` for live evaluering
- Cascade D6 production-data trigger evaluering ved shift-close
