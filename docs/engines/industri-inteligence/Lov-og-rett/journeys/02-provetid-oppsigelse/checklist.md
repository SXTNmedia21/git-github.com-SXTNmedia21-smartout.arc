# Checklist — Prøvetid-oppsigelse

| # | Sjekk | Lov-referanse | Pass-krav |
|---|-------|---------------|-----------|
| 1 | Kontrakt har eksplisitt prøvetid-bestemmelse | Aml. §14-6 f, §15-6 1. ledd | `trial_period_months > 0` på `employment_contract` |
| 2 | Prøvetid ikke utløpt | §15-6 | `start_date + trial_period_months > today` |
| 3 | Sykefravær-pause regnet inn | §15-6 4. ledd | sjekk `schedule_absence` for sick days, fratrekk fra prøvetid |
| 4 | Saklig grunn dokumentert | §15-6 1. ledd | grunn faller innen "tilpasning / dyktighet / pålitelighet" |
| 5 | Oppsigelsesfrist | §15-3 7. ledd | minst 14 dager hvis ikke annet avtalt |
| 6 | Skriftlig oppsigelse | §15-4 | dokument generert |
| 7 | Oppsigelsen leveres personlig eller rekommandert | §15-4 | leveringsmetode logget |
| 8 | Begrunnelse oppgitt på forespørsel | §15-4 2. ledd | begrunnelse-tekst klar |
| 9 | Forhandlingsrett-info | §17-3 | ansatt informert om rett til forhandling |
| 10 | Ingen diskriminering | §13-1 + Likestillings- og diskrimineringsloven | grunn ikke knyttet til kjønn/alder/etnisitet/funksjonshemming/legning/etc |

## Hard-blokk

- Sjekk #1 fail → kontrakt mangler prøvetid → kun fast-oppsigelse mulig (§15-7)
- Sjekk #2 fail → prøvetid utløpt → fast-oppsigelse-regler gjelder
- Sjekk #4 fail → grunn faller utenfor §15-6 → må vurderes mot §15-7 (saklig grunn)
- Sjekk #10 fail → ulovlig grunn → STOPP, eskaler til advokat

## Soft-warning

- Manglende dokumentasjon (sjekk #4) — anbefal samlet evaluation før oppsigelse
- Sykefravær-pause uklar (sjekk #3) — manuell verifisering før beregning av prøvetid-utløp
