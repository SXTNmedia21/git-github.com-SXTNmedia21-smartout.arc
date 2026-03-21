---
title: "Payroll Wizard Architecture — Tillegg og lønnsarter"
status: draft
updated: 2026-03-21
created: 2026-03-10
module: wizard
tags: [payroll, wizard, tillegg, lønnsarter, tariff, overtid, avspasering, cascade]
---

> **Note:** Verified Riksavtalen rates and tariff versioning concept are in `docs/cascade-spreadsheet-overview.md`. The rates in the wizard defaults should be sourced from `tariff_rate_table` (planned).

# Payroll Wizard Architecture — Tillegg og lønnsarter

## Bakgrunn

PayrollSetupStep (steg 3 i workspace setup wizard) har i dag en statisk tabell med 5 faste tillegg (kveldstillegg, helgetillegg, helligdagstillegg, overtid 50%, overtid 100%) og en liste med stillingslønn. Brukeren kan ikke velge hvilke tillegg de faktisk bruker — de får alle eller ingen.

I virkeligheten cherry-picker de fleste restauranter fra tariffavtalen. Noen følger Riksavtalen fullt ut, andre bruker den som grunnlag men tilpasser. Mange har egne tillegg (vasketillegg, klestillegg, tips-ordning) som ikke finnes i dagens modell.

## Konsept: "Velg dine lønnsarter"

Brukeren ser en komplett liste med vanlige tillegg/lønnsarter, forhåndsvalgt basert på valgt tariffavtale. De slår av/på det de faktisk bruker og justerer satser fritt.

## Sidelayout (3 seksjoner)

### Seksjon 1 — Tariffgrunnlag (eksisterer)

Bruker velger tariffavtale → pre-fyller satser og aktive tillegg nedenfor.

### Seksjon 2 — Tillegg og lønnsarter (ny — erstatter dagens statiske tabell)

Kort med toggle + sats for hvert tillegg, gruppert i kategorier:

| Kategori         | Tillegg                      | Typisk sats             | Enhet         | Detaljer              |
| ---------------- | ---------------------------- | ----------------------- | ------------- | --------------------- |
| **Tid**          | Kveldstillegg                | 56 kr                   | kr/t          | fra–til klokkeslett   |
|                  | Nattillegg                   | 100 kr                  | kr/t          | fra–til klokkeslett   |
|                  | Helgetillegg                 | 56 kr                   | kr/t          | lør/søn toggle        |
|                  | Helligdagstillegg            | 133%                    | % av timelønn |                       |
|                  | Delt dagsverk                | 56 kr                   | kr/dag        |                       |
| **Overtid**      | Overtid 50%                  | Etter 9 t/dag           | terskel       |                       |
|                  | Overtid 100%                 | Etter 13 t/dag          | terskel       |                       |
|                  | Avspasering                  | I stedet for utbetaling | toggle        | se avspasering-logikk |
| **Kompensasjon** | Vasketillegg                 | 300 kr                  | kr/mnd        |                       |
|                  | Klestillegg / Uniformtillegg | 200 kr                  | kr/mnd        |                       |
|                  | Smusstillegg                 | 30 kr                   | kr/t          |                       |
|                  | Kost (måltidstrekk)          | 0 kr                    | kr/dag        |                       |
| **Inntekt**      | Tips (registrert)            | —                       | toggle        | skattepliktig         |
|                  | Tips (uregistrert)           | —                       | toggle        | info/advarsel         |
| **Egendefinert** | + Legg til tillegg           | —                       | fritt         | brukerdefiner         |

### Seksjon 3 — Stillingslønn (eksisterer)

Grunnlønn per stilling, som i dag.

## UX-flyt

```
1. Bruker velger tariff
   → System pre-fyller relevante tillegg som "aktive" med tarifsatser

2. Bruker ser alle tillegg som kort/rader
   → Aktive = oransje border, sats redigerbar
   → Inaktive = grå, toggle av

3. Bruker kan:
   - Slå av et tariff-tillegg de ikke bruker
   - Slå på et tillegg som ikke er i tariffen
   - Justere satser fritt (cherry-pick)
   - Legge til egne tillegg

4. Lagre → alt lagres som policy rules_json
```

## Overtid/Avspasering-valg

**Uavklart:** Skal dette ligge per ansettelsesform (steg 4) eller globalt her i lønnssteget?

Tre modeller:

- **Utbetaling** — overtid betales ut med 50%/100%
- **Avspasering** — overtid tas ut som fri (time for time + tillegg som penger)
- **Kombinasjon** — avspasering opp til X timer, deretter utbetaling

## Tilleggskategorier fra Riksavtalen / Landsoverenskomsten

Basert på søk i tariffavtalene (NHO Reiseliv, Fellesforbundet, Virke):

- Kveldstillegg: 56 kr/t etter kl. 21:00 (Riksavtalen)
- Nattillegg: Skattefritt inntil 435 kr/natt
- Helgetillegg: Lørdag/søndag
- Helligdagstillegg: 133% av timelønn
- Delt dagsverk: Tillegg ved delt arbeidsdag
- Smusstillegg: For spesielt ubehagelig arbeid (lukt, støv, varme, smittefare)
- Vasketillegg: Kompensasjon for vask av arbeidsklær
- Klestillegg: Kompensasjon for uniform/arbeidsklær

## Datamodell (rules_json)

```json
{
  "tariff": "riksavtalen",
  "supplements": [
    {
      "key": "kveldstillegg",
      "category": "tid",
      "enabled": true,
      "rate": 56,
      "unit": "kr/t",
      "config": { "from_hour": "21:00", "to_hour": "06:00" }
    },
    {
      "key": "nattillegg",
      "category": "tid",
      "enabled": false,
      "rate": 100,
      "unit": "kr/t",
      "config": { "from_hour": "00:00", "to_hour": "06:00" }
    }
  ],
  "overtime": {
    "model": "utbetaling",
    "threshold_50": 9,
    "threshold_100": 13,
    "avspasering_cap_hours": null
  },
  "custom_supplements": [
    { "name": "Bonustillegg", "rate": 50, "unit": "kr/t", "description": "..." }
  ]
}
```

## Lagringsstrategi

**Beslutning:** Beholder `policy`-tabellen med `rules_json` (JSONB) som wizard-lagring. Ingen nye tabeller nå.

**Begrunnelse:** Wizard-data er midlertidig konfigurasjon. Når payroll-modulen bygges, konverteres `rules_json` til ekte tabeller. Å lage egne tabeller nå ville bety dobbelt arbeid.

**Krav til rules_json-strukturen:**

- Konsekvent og dokumentert — all data må kunne leses maskinelt
- Hvert tillegg har `key`, `category`, `enabled`, `rate`, `unit`, `config`
- Ingen implisitt logikk — alt er eksplisitt i JSON
- Bakoverkompatibel — nye felter er valgfrie, eksisterende endres aldri

**Konverteringsstrategi (fremtidig):**

```
policy.rules_json (wizard)
  → payroll_supplement (en rad per aktivt tillegg)
  → payroll_overtime_rule (overtid/avspasering-config)
  → position_wage (allerede delvis i rules_json)
```

Konverteringen skjer som en engangsmigrasjon når payroll-modulen implementeres. Wizard-policyen beholdes som kilde/audit-trail.

## Åpne spørsmål

1. Overtid/avspasering — globalt (steg 3) eller per ansettelsesform (steg 4)?
2. Tips-registrering — bare toggle, eller skal det ha konfigurasjon (fordelingsmodell)?
3. Skal tilleggslistens defaults komme fra industry package eller hardkodes?

## Kilder

- [Landsoverenskomst for Hotell- og Restaurantvirksomheter 2024-2026 (PDF)](https://www.fellesforbundet.no/globalassets/lonn-og-tariffsaker/tariffavtaler/overenskomster-2024-2026/landsoverenskomst-for-hotell--og-restaurantvirksomheter-2024-2026.pdf)
- [Riksavtalen - Fellesforbundet](https://www.fellesforbundet.no/lonn-og-tariff/tariffavtaler/riksavtalen/)
- [NHO Reiseliv - Lønn og tariff](https://www.nhoreiseliv.no/jushjelp-tariff-hms/lonn-og-tariff/)
- [Smusstillegg - Spekter](https://www.spekter.no/lonn-og-tariff/tariffavtaler/forbundsvise-avtaledeler-a2/overenskomstens-del-a2-lo-ys/overenskomstens-del-a2-lo-ys-omrade-10/2-6-smusstillegg)
- [Virke - Landsoverenskomst](https://www.virke.no/tariff-og-lonn/finn-tariffavtale/landsoverenskomst-for-hotell--og-restaurantvirksomheter-ff/)
- [Skatteetaten - Ansettelsesformer a-meldingen 2025](https://www.skatteetaten.no/en/business-and-organisation/employer/the-a-melding/siste-fra-a-ordningen/endringer-i-rapportering-av-ansettelsesformer-i-a-meldingen-fra-2025/)
- [Arbeidstilsynet - Midlertidig ansettelse](https://www.arbeidstilsynet.no/en/pay-and-engagement-of-employees/engagement-of-employees/temporary-employment/)
