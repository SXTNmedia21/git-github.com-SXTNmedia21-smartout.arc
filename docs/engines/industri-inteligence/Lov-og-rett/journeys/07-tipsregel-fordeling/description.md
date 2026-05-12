# Beskrivelse — Tipsregel-fordeling

## Use case

Pontus åpner workspace-setup. Lovsen guider:
> Du må sette opp en tipsregel før første lønnsutbetaling.
>
> **Spørsmål:**
> 1. Pott eller personlig? (Pott = alle deler, personlig = den som tar imot beholder)
> 2. Hvis pott: hvilken fordelings-metode? (equal/hours/role/shift-factor)
> 3. Inkluderer du backstage-personell (kjøkken/bartender/runner)?
>
> **Lovkrav (uansett valg):**
> - Tips er **lønnspliktig fra første krone** siden 2019
> - Skatt trekkes som vanlig lønn
> - AGA + feriepenger på topp
> - Rapporteres som A-melding kode 22 (separat linje)
> - Ansatte må kunne se hvordan tips fordeles (transparens-krav)

## Use case 2 — månedlig kalkulering

Slutten av måneden — Lovsen kalkulerer:
> November 2026:
> - Total tips inn (kontant + kort): 47 200 kr
> - 8 ansatte hadde shifts
> - Metode: hours_weighted
>
> | Ansatt | Timer | Andel | Tips |
> |--------|-------|-------|------|
> | Anna | 88 | 22.5% | 10 620 |
> | Ole | 72 | 18.4% | 8 685 |
> | ... | | | |
>
> A-melding kode 22 utbetalt med korresponderende skatt + AGA + feriepenger.

## Hvorfor Lovsen er bra på dette

1. **2019-regelendringen** — mange admins husker fortsatt da tips var trekkfri. Lovsen flagger eksplisitt at det IKKE er det.
2. **Cash + digital lik behandling** — kontant tips er ikke eksempt. Lovsen påminner om dette.
3. **Transparens-krav** — ansatte kan kreve å se beregning. Lovsen dokumenterer matrise per måned.
4. **Pott vs personlig grenser** — personlig tips er sjeldnere (typisk bar med eget kort-system). Lovsen veileder valg.

## Phase 0c+ kobling

- Tier 3 skill `tipsregel-rådgiver` (ROADMAP)
- Integrasjon mot `contract_tip_rule`-CRUD
- Månedlig auto-fordeling via cron + emit til `payroll`-capability
