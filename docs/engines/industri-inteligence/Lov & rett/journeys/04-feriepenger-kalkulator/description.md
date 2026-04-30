# Beskrivelse — Feriepenger-kalkulator

## Use case 1 — Månedlig påløp

Pontus kjører månedlig payroll. Lovsen kalkulerer påløpt feriepenger for hver ansatt (akkumuleres til utbetaling juni neste år).

Output per ansatt:
```
Anna (12% sats): brutto 32 000 → påløpt 3 840 (12% av månedslønn)
Akkumulert hittil i året: 38 400
```

## Use case 2 — Sluttoppgjør

Ole sier opp 15. mai. Lovsen kalkulerer:
```
Brutto utbetalt 1.1–15.5 = 156 000
+ Verdi ikke-tatt ferie 12 dager × dagsats = 18 000
Total feriepenge-grunnlag = 174 000
Sats 12% = 20 880
SKATT TREKK: ja (utbetales samme år)
A-melding kode 22
```

## Hvorfor Lovsen er bra på dette

1. **Skiller utbetaling-år fra opptjenings-år** — feriepenger opptjent år X utbetales juni år X+1 trekkfri. Sluttoppgjør samme år trekkes. Mange admins blander.

2. **Aldersgruppe-tillegg automatisk** — over 60 år får +2.3%. Lovsen sjekker `personal_number` første 6 siffer for fødselsdato.

3. **6. ferieuke detection** — sjekker `tariff_rate_table` + `workspace_framework_binding` for om workspace har avtalt 6. ferieuke (14.3%).

4. **A-melding-koder right** — Kode 20/22/23 for ulike utbetalings-typer. Lovsen velger riktig kode automatisk.

## Phase 0c+ kobling

- Tier 3 skill `feriepenger-kalkulator` (ROADMAP v0.2.0)
- Integrasjon mot `payroll`-capability for direkte commit til lønnsslipp
- Sluttoppgjør-templates for arbeidsforhold med `contract.status='terminated'`
